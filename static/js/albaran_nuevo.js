/**
 * albaran_nuevo.js - Lógica para la creación de albaranes (Vista Titular)
 * Gestiona validaciones, cálculos automáticos de KMS y envío seguro.
 * Versión final: Soporta campos de tiempo, remolque y plazas.
 */

let userLicenciaId = 0;      
let userLicenciaNumero = "";  
let cargandoConductores = false;

// =================================================================================
// 🚀 INICIALIZACIÓN
// =================================================================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log("%c🚀 [INIT] Iniciando Formulario de Albarán Unificado", "color: #FF8C00; font-weight: bold;");
    
    // 1. Cargar identidad del titular
    const identityOk = await loadUserIdentity();
    if (!identityOk) return; 

    // 2. Cargar catálogos maestros
    try {
        await Promise.all([
            loadEmpresas(),
            loadConductores()
        ]);
    } catch (err) {
        console.error("❌ [INIT] Error en carga de catálogos maestros:", err);
    }
    
    // 3. Activar lógica de componentes
    setupKmCalculation();
    setupWordCounter();
    setDefaultDateTime();
    setupVisualFeedback();
    
    console.log("%c✅ [INIT] Formulario listo para operación.", "color: #22c55e; font-weight: bold;");
});

// =================================================================================
// 📡 COMUNICACIÓN CON LA API (CARGA)
// =================================================================================

async function loadUserIdentity() {
    const licInput = document.getElementById('licencia');
    try {
        const response = await fetch('/api/v1/user/licencia_info');
        if (response.status === 401) { window.location.href = '/login'; return false; }
        
        const data = await response.json();
        if (data.licencia_id) {
            userLicenciaId = data.licencia_id;
            userLicenciaNumero = data.licencia_numero || String(data.licencia_id);
            if (licInput) licInput.value = userLicenciaNumero;
            return true;
        }
        return false;
    } catch (error) {
        showStatus(`🛑 Error de identidad: ${error.message}`, 'error');
        return false;
    }
}

async function loadEmpresas() {
    const select = document.getElementById('empresa');
    if (!select) return;
    try {
        const response = await fetch('/api/v1/empresas');
        const json = await response.json();
        const empresas = json.data || json;
        select.innerHTML = '<option value="" disabled selected>Seleccione una empresa...</option>';
        empresas.forEach(emp => {
            const option = document.createElement('option');
            option.value = emp.id; 
            option.textContent = emp.nombre; 
            select.appendChild(option);
        });
    } catch (error) {
        console.error("Error empresas:", error);
    }
}

async function loadConductores() {
    const select = document.getElementById('asalariado_select'); 
    if (!select || cargandoConductores) return;
    cargandoConductores = true;
    try {
        const response = await fetch('/api/v1/conductores'); 
        const json = await response.json();
        const todos = json.data || json;

        const misConductores = todos.filter(c => {
            const ref = String(c.licencia || c.licencia_ref || "").trim();
            return ref === String(userLicenciaId) || ref === String(userLicenciaNumero).trim();
        });

        select.innerHTML = '<option value="">-- Sin Asalariado (Titular) --</option>';
        misConductores.forEach(c => {
            const option = document.createElement('option');
            option.value = c.nombre; 
            option.textContent = `${c.nombre} (${c.conductor || "S/N"})`; 
            select.appendChild(option);
        });
    } finally {
        cargandoConductores = false;
    }
}

// =================================================================================
// 🧮 LÓGICA DE NEGOCIO (Kms y Tiempos)
// =================================================================================

function setupKmCalculation() {
    const kmIni = document.querySelector('[name="km_ini"]');
    const kmFin = document.querySelector('[name="km_fin"]');
    const kmNac = document.querySelector('[name="km_nacionales"]');
    const kmInt = document.querySelector('[name="km_internacionales"]');
    const kmTot = document.querySelector('[name="km_totales"]');

    const calculate = () => {
        const valIni = parseFloat(kmIni.value) || 0;
        const valFin = parseFloat(kmFin.value) || 0;
        
        if (valFin > 0) {
            if (valFin < valIni) {
                kmFin.classList.add('border-red-500', 'text-red-600');
                kmTot.value = "0.00";
            } else {
                kmFin.classList.remove('border-red-500', 'text-red-600');
                kmTot.value = (valFin - valIni).toFixed(2);
            }
        }
    };

    [kmIni, kmFin, kmNac, kmInt].forEach(el => {
        if (!el) return;
        el.addEventListener('input', calculate);
        el.addEventListener('blur', (e) => {
            if (e.target.value) e.target.value = parseFloat(e.target.value).toFixed(2);
        });
    });
}

// =================================================================================
// 💾 PROCESAMIENTO Y ENVÍO
// =================================================================================

function validateStrict(payload) {
    const faltantes = [];
    if (!userLicenciaId) faltantes.push("Identidad de Licencia");
    if (!payload.numero_albaran) faltantes.push("Nº Albarán");
    if (!payload.fecha) faltantes.push("Fecha");
    if (!payload.origen) faltantes.push("Origen");
    if (!payload.destino) faltantes.push("Destino");
    if (!payload.importe_total || payload.importe_total <= 0) faltantes.push("Importe Total (€)");

    if (faltantes.length > 0) {
        alert(`⚠️ CAMPOS OBLIGATORIOS FALTANTES:\n\n• ${faltantes.join('\n• ')}`);
        return false;
    }
    return true;
}

window.handleAction = async function(action, event = null) {
    if (event) event.preventDefault();

    if (action === 'crear') {
        const form = document.getElementById('albaranForm');
        const btnSubmit = form.querySelector('button[type="submit"]');
        const formData = new FormData(form);
        const payload = {};

        // 1. Recopilar todos los campos de texto y número
        for (const [key, value] of formData.entries()) {
            if (value === "" || value === null) {
                payload[key] = null; // Backend espera null para campos vacíos
                continue;
            }

            if (key.startsWith('km_') || key.startsWith('importe_') || key === 'num_plazas' || key === 'empresa_ref') {
                payload[key] = parseFloat(value) || 0;
            } else {
                payload[key] = value;
            }
        }

        // 2. Mapear Checkboxes explícitamente
        const checks = ['urbano', 'diurno', 'noct_fest', 'festivo', 'finalizado', 'remolque', 'adjuntos'];
        checks.forEach(name => {
            const el = form.querySelector(`[name="${name}"]`);
            payload[name] = el ? el.checked : false;
        });

        // 3. Forzar metadatos de seguridad
        payload['licencia_ref'] = userLicenciaId;
        payload['estado'] = 0;

        // 4. Validación
        if (!validateStrict(payload)) return;

        // 5. Envío
        if (btnSubmit) btnSubmit.disabled = true;
        showStatus("Guardando en el servidor...", "info");

        try {
            const response = await fetch('/api/v1/albaranes/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            if (response.ok) {
                showStatus('✅ Albarán guardado correctamente.', 'success');
                setTimeout(() => window.location.href = '/titulares', 1500);
            } else {
                throw new Error(result.error || 'Error al guardar');
            }
        } catch (error) {
            alert(`❌ Error al guardar:\n${error.message}`);
            if (btnSubmit) btnSubmit.disabled = false;
        }
    }
};

// =================================================================================
// 🎨 UTILIDADES VISUALES
// =================================================================================

function showStatus(msg, type) {
    const el = document.getElementById('statusMessage');
    if (!el) return;
    el.textContent = msg;
    const base = "status-message block mt-6 p-4 rounded-xl text-center font-bold border-2 ";
    if (type === 'success') el.className = base + "bg-green-50 text-green-700 border-green-200";
    else if (type === 'error') el.className = base + "bg-red-50 text-red-700 border-red-200";
    else el.className = base + "bg-blue-50 text-blue-700 border-blue-200";
    el.classList.remove('hidden');
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function setupWordCounter() {
    const area = document.getElementById('observaciones');
    const label = document.getElementById('wordCount');
    if (area && label) {
        area.addEventListener('input', () => {
            const words = area.value.trim().split(/\s+/).filter(w => w.length > 0).length;
            label.textContent = `${words} palabras registradas`;
        });
    }
}

function setDefaultDateTime() {
    const fInput = document.getElementById('fecha');
    if (fInput && !fInput.value) {
        fInput.value = new Date().toISOString().split('T')[0];
    }
}

function setupVisualFeedback() {
    const fields = ['numero_albaran', 'origen', 'destino', 'importe_total'];
    fields.forEach(name => {
        const el = document.querySelector(`[name="${name}"]`);
        if (el) {
            el.addEventListener('blur', () => {
                if (!el.value || el.value === "0") el.classList.add('border-orange-300');
                else el.classList.remove('border-orange-300');
            });
        }
    });
}