/**
 * albaran_update.js - Panel Titular
 * Lógica para la edición de albaranes existentes.
 * Versión final: Soporta campos de tiempo, remolque, plazas y validación estricta.
 */

let albaranID = null;
let userLicenciaId = 0;      
let userLicenciaNumero = "";  
let cargandoConductores = false;

// =================================================================================
// 🚀 INICIALIZACIÓN
// =================================================================================
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Obtener ID de la URL (/titulares/update/71)
    const pathParts = window.location.pathname.split('/');
    albaranID = pathParts[pathParts.length - 1];

    if (!albaranID || isNaN(albaranID)) {
        showStatus("❌ ID de albarán no detectado en la URL.", "error");
        return;
    }

    console.log(`%c🛠️ [UPDATE] Iniciando edición para ID: ${albaranID}`, "color: #FF8C00; font-weight: bold;");

    // 2. Cargar identidad y catálogos
    const identityOk = await loadUserIdentity();
    if (!identityOk) return;

    try {
        await Promise.all([
            loadEmpresas(),
            loadConductores()
        ]);

        // 3. Cargar datos del registro y poblar el formulario
        await loadAlbaranToEdit(albaranID);
        
    } catch (err) {
        console.error("❌ [INIT] Error crítico en la carga:", err);
        showStatus("🛑 Error al inicializar el formulario.", "error");
    }
    
    // 4. Activar componentes lógicos
    setupKmCalculation();
    setupWordCounter();
    setupVisualFeedback();
});

// =================================================================================
// 📡 COMUNICACIÓN CON API (CARGA)
// =================================================================================

async function loadUserIdentity() {
    try {
        const response = await fetch('/api/v1/user/licencia_info');
        if (response.status === 401) { window.location.href = '/login'; return false; }
        const data = await response.json();
        if (data.licencia_id) {
            userLicenciaId = data.licencia_id;
            userLicenciaNumero = data.licencia_numero || String(data.licencia_id);
            return true;
        }
        return false;
    } catch (error) { return false; }
}

async function loadEmpresas() {
    const select = document.getElementById('empresa');
    if (!select) return;
    try {
        const response = await fetch('/api/v1/empresas');
        const json = await response.json();
        const empresas = json.data || json;
        select.innerHTML = '<option value="" disabled>Seleccione empresa</option>';
        empresas.forEach(emp => {
            const opt = document.createElement('option');
            opt.value = emp.id; opt.textContent = emp.nombre;
            select.appendChild(opt);
        });
    } catch (e) { console.error("Error empresas:", e); }
}

async function loadConductores() {
    const select = document.getElementById('asalariado_select');
    if (!select) return;
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
            const opt = document.createElement('option');
            opt.value = c.nombre; opt.textContent = `${c.nombre} (${c.conductor || 'S/N'})`;
            select.appendChild(opt);
        });
    } catch (e) { console.error("Error conductores:", e); }
}

async function loadAlbaranToEdit(id) {
    try {
        const response = await fetch(`/api/v1/albaranes/id/${id}`);
        if (!response.ok) throw new Error("No se pudo cargar el albarán desde el servidor");
        const result = await response.json();
        const data = result.data;

        // HELPER SEGURO: Evita el error "Cannot set properties of null"
        const safeSet = (elementId, value) => {
            const el = document.getElementById(elementId);
            if (!el) return;
            if (el.type === 'checkbox') {
                el.checked = !!value;
            } else {
                el.value = (value !== null && value !== undefined) ? value : "";
            }
        };

        // --- POBLADO DE CAMPOS ---
        safeSet('albaran_id', data.id);
        safeSet('licencia', userLicenciaNumero);
        safeSet('n_albaran', data.numero_albaran);
        
        const headerNum = document.getElementById('header_num');
        if (headerNum) headerNum.textContent = `#${data.numero_albaran}`;
        
        if (data.fecha) safeSet('fecha', data.fecha.split('T')[0]);
        
        const formatTime = (isoStr) => isoStr ? isoStr.split('T')[1].substring(0, 5) : "";
        safeSet('hora_ini', formatTime(data.hora_ini));
        safeSet('hora_fin', formatTime(data.hora_fin));
        safeSet('espera_ini', formatTime(data.espera_ini));
        safeSet('espera_fin', formatTime(data.espera_fin));

        safeSet('empresa', data.empresa_ref);
        safeSet('asalariado_select', data.asalariado);
        safeSet('num_plazas', data.num_plazas);
        safeSet('referencia', data.referencia);
        safeSet('origen', data.origen);
        safeSet('destino', data.destino);
        safeSet('parada', data.parada);
        safeSet('observaciones', data.observaciones);

        const toDec = (val) => val ? parseFloat(val).toFixed(2) : "0.00";
        safeSet('km_ini', toDec(data.km_ini));
        safeSet('km_fin', toDec(data.km_fin));
        safeSet('km_nacionales', toDec(data.km_nacionales));
        safeSet('km_internacionales', toDec(data.km_internacionales));
        safeSet('km_totales', toDec(data.km_totales));
        safeSet('importe_suplidos', toDec(data.importe_suplidos));
        safeSet('importe_total', toDec(data.importe_total));

        safeSet('urbano', data.urbano);
        safeSet('diurno', data.diurno);
        safeSet('noct_fest', data.noct_fest);
        safeSet('remolque', data.remolque); // Mapeado correctamente
        safeSet('adjuntos', data.adjuntos);

        console.log("✅ [UPDATE] Formulario poblado correctamente.");

    } catch (error) {
        showStatus("❌ Error al cargar datos: " + error.message, "error");
    }
}

// =================================================================================
// 🧮 LÓGICA DE NEGOCIO (KMS)
// =================================================================================

function setupKmCalculation() {
    const kmIni = document.getElementById('km_ini');
    const kmFin = document.getElementById('km_fin');
    const kmTot = document.getElementById('km_totales');

    const calculate = () => {
        if (!kmIni || !kmFin || !kmTot) return;
        const valIni = parseFloat(kmIni.value) || 0;
        const valFin = parseFloat(kmFin.value) || 0;
        if (valFin > 0) {
            if (valFin < valIni) {
                kmFin.classList.add('text-red-600', 'border-red-500');
                kmTot.value = "0.00";
            } else {
                kmFin.classList.remove('text-red-600', 'border-red-500');
                kmTot.value = (valFin - valIni).toFixed(2);
            }
        }
    };

    const ids = ['km_ini', 'km_fin', 'km_nacionales', 'km_internacionales'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', calculate);
            el.addEventListener('blur', (e) => {
                if (e.target.value) e.target.value = parseFloat(e.target.value).toFixed(2);
            });
        }
    });
}

// =================================================================================
// 💾 ENVÍO DE DATOS (PUT)
// =================================================================================

function validateStrict(payload) {
    const faltantes = [];
    if (!payload.fecha) faltantes.push("Fecha");
    if (!payload.origen) faltantes.push("Origen");
    if (!payload.destino) faltantes.push("Destino");
    if (!payload.importe_total || payload.importe_total <= 0) faltantes.push("Importe Total");

    if (faltantes.length > 0) {
        alert(`⚠️ CAMPOS OBLIGATORIOS FALTANTES:\n\n• ${faltantes.join('\n• ')}`);
        return false;
    }
    return true;
}

document.getElementById('albaranForm').onsubmit = async (event) => {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const payload = {};

    for (const [key, value] of formData.entries()) {
        if (value === "" || value === null) {
            payload[key] = null;
            continue;
        }
        if (key.startsWith('km_') || key.startsWith('importe_') || key === 'num_plazas' || key === 'empresa_ref') {
            payload[key] = parseFloat(value) || 0;
        } else {
            payload[key] = value;
        }
    }

    ['urbano', 'diurno', 'noct_fest', 'remolque', 'adjuntos'].forEach(id => {
        const el = document.getElementById(id);
        if (el) payload[id] = el.checked;
    });

    payload['id'] = parseInt(albaranID);
    if (!validateStrict(payload)) return;

    showStatus("⏳ Guardando cambios...", "info");

    try {
        const response = await fetch(`/api/v1/albaranes/${albaranID}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            showStatus("✅ Albarán actualizado correctamente.", "success");
            setTimeout(() => window.location.href = '/titulares', 1500);
        } else {
            const result = await response.json();
            throw new Error(result.error || "Error al actualizar.");
        }
    } catch (error) {
        alert(`❌ Error al guardar:\n${error.message}`);
        showStatus(`Error: ${error.message}`, "error");
    }
};

// =================================================================================
// 🎨 UTILIDADES UI
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
        const update = () => {
            const count = area.value.trim().split(/\s+/).filter(w => w.length > 0).length;
            label.textContent = `${count} palabras registradas`;
        };
        area.addEventListener('input', update);
        update();
    }
}

function setupVisualFeedback() {
    ['origen', 'destino', 'importe_total'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('blur', () => {
                if (!el.value || el.value === "0" || el.value === "0.00") {
                    el.classList.add('border-orange-300', 'ring-2', 'ring-orange-100');
                } else {
                    el.classList.remove('border-orange-300', 'ring-2', 'ring-orange-100');
                }
            });
        }
    });
}