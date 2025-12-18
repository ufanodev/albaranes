/**
 * albaran_nuevo.js - Lógica para la creación de albaranes (Vista Titular)
 */

let userLicenciaId = 0; // ID numérico para la DB (ej: 1)
let userLicenciaNumero = ""; // Número visual (ej: "001")

// =================================================================================
// 🚀 INICIALIZACIÓN
// =================================================================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 [INIT] Preparando formulario de nuevo albarán.");
    
    // 1. Cargar identidad (ID y Número de Licencia)
    const identityOk = await loadUserIdentity();
    if (!identityOk) return; // Si falla la identidad, no seguimos

    // 2. Cargar catálogos
    await Promise.all([
        loadEmpresas(),
        loadConductores()
    ]);
    
    // 3. Configuración visual
    setupWordCounter();
    setDefaultDateTime();
    console.log("✅ [INIT] Formulario listo para operar.");
});

// =================================================================================
// 📡 CARGA DE DATOS (API)
// =================================================================================

async function loadUserIdentity() {
    const licInput = document.getElementById('licencia');
    const btnGuardar = document.querySelector('.btn-crear');

    try {
        // Usamos la ruta que ya comprobamos que funciona en busqueda.js
        const response = await fetch('/api/v1/user/licencia_info');
        if (response.status === 401) { window.location.href = '/login'; return false; }
        if (!response.ok) throw new Error('No se pudo verificar su identidad');

        const data = await response.json();
        
        if (data.licencia_id) {
            userLicenciaId = data.licencia_id;
            userLicenciaNumero = data.licencia_numero || data.licencia_id;

            if (licInput) {
                licInput.value = userLicenciaNumero; // Mostramos "001"
                licInput.classList.add('bg-gray-100', 'cursor-not-allowed', 'font-bold');
                licInput.readOnly = true;
            }
            if (btnGuardar) btnGuardar.disabled = false;
            return true;
        } else {
            throw new Error('Su usuario no tiene una licencia vinculada.');
        }
    } catch (error) {
        console.error("❌ [IDENTITY] Error:", error);
        showStatus(`🛑 Error: ${error.message}`, 'error');
        if (btnGuardar) btnGuardar.disabled = true;
        return false;
    }
}

async function loadEmpresas() {
    const select = document.getElementById('empresa');
    if (!select) return;

    try {
        const response = await fetch('/api/v1/empresas');
        const json = await response.json();
        const empresas = json.data || [];

        select.innerHTML = '<option value="" disabled selected>Seleccione una empresa</option>';
        empresas.forEach(emp => {
            const option = document.createElement('option');
            option.value = emp.id; 
            option.textContent = emp.nombre; 
            select.appendChild(option);
        });
    } catch (error) {
        console.error("❌ [EMPRESAS] Error:", error);
        select.innerHTML = '<option value="" disabled>Error al cargar empresas</option>';
    }
}

async function loadConductores() {
    const select = document.getElementById('asalariado_select'); 
    if (!select) return;

    try {
        const response = await fetch('/api/v1/conductores'); 
        if (!response.ok) return; // Si es titular quizá no tenga acceso a la lista global

        const json = await response.json();
        const conductores = json.data || [];

        select.innerHTML = '<option value="" selected>Seleccione un conductor (opcional)</option>';
        conductores.forEach(c => {
            const option = document.createElement('option');
            const name = `${c.Licencia || ''} - ${c.Nombre || ''}`; 
            option.value = name; 
            option.textContent = name; 
            select.appendChild(option);
        });
    } catch (error) {
        console.warn("⚠️ [CONDUCTORES] No se pudo cargar la lista opcional.");
    }
}

// =================================================================================
// 💾 ACCIONES DEL FORMULARIO
// =================================================================================

window.handleAction = async function(actionType, event = null) {
    if (event) event.preventDefault();

    if (actionType === 'crear') {
        const form = document.getElementById('albaranForm');
        
        if (userLicenciaId === 0) {
            showStatus('❌ Error: Licencia no identificada.', 'error');
            return;
        }

        const formData = new FormData(form);
        const payload = {};

        // Procesamiento inteligente de campos
        for (const [key, value] of formData.entries()) {
            if (value === "" || value === null) continue;

            // Conversión a Números (Importes, KM, Refs)
            if (key.startsWith('km_') || key.startsWith('importe_') || key.endsWith('_ref') || key === 'num_plazas') {
                const num = parseFloat(value);
                if (!isNaN(num)) payload[key] = num;
            } else {
                payload[key] = value;
            }
        }

        // Mapeo de Checkboxes (Booleanos)
        const checks = ['urbano', 'diurno', 'noct_fest', 'festivo', 'finalizado', 'enganche', 'cobrado', 'pagado'];
        checks.forEach(id => {
            const el = document.getElementById(id);
            payload[id] = el ? el.checked : false;
        });

        // 🛡️ Inyección forzada de seguridad
        payload['licencia_ref'] = userLicenciaId; // El ID 1 de la DB
        payload['estado'] = 0; // Estado inicial "Creado"

        // Validación mínima
        if (!payload.numero_albaran || !payload.fecha || !payload.empresa_ref) {
            showStatus('⚠️ Por favor, complete los campos obligatorios.', 'error');
            return;
        }

        try {
            const response = await fetch('/api/v1/albaranes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                showStatus('✅ Albarán guardado correctamente.', 'success');
                setTimeout(() => window.location.href = '/titulares', 1500);
            } else {
                const errData = await response.json();
                throw new Error(errData.error || 'Error al guardar');
            }
        } catch (error) {
            showStatus(`❌ Error: ${error.message}`, 'error');
        }
    }

    if (actionType === 'volver') window.location.href = '/titulares';
};

// =================================================================================
// 🎨 UTILS VISUALES
// =================================================================================

function showStatus(msg, type) {
    const el = document.getElementById('statusMessage');
    if (!el) { alert(msg); return; }
    
    el.textContent = msg;
    el.className = `status-message block mt-4 p-4 text-center rounded-lg border font-bold`;
    
    if (type === 'success') el.classList.add('bg-green-100', 'text-green-800', 'border-green-300');
    else if (type === 'error') el.classList.add('bg-red-100', 'text-red-800', 'border-red-300');
    else el.classList.add('bg-blue-100', 'text-blue-800', 'border-blue-300');
    
    el.classList.remove('hidden');
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function setupWordCounter() {
    const obs = document.getElementById('observaciones');
    if (obs) {
        obs.addEventListener('input', function() {
            const count = this.value.trim().split(/\s+/).filter(w => w.length > 0).length;
            const counterEl = document.getElementById('wordCount');
            if (counterEl) counterEl.textContent = `${count} palabras`;
        });
    }
}

function setDefaultDateTime() {
    const now = new Date();
    const fInput = document.getElementById('fecha');
    const hInput = document.getElementById('hora');

    if (fInput && !fInput.value) fInput.value = now.toISOString().split('T')[0];
    if (hInput && !hInput.value) {
        hInput.value = now.toTimeString().substring(0, 5);
    }
}