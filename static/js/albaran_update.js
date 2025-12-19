/**
 * albaran_update.js
 * Lógica para la edición de albaranes desde el Panel de Titular.
 * Carga datos desde /api/v1/albaranes/id/:id y permite modificar campos técnicos.
 */

let albaranID = null;

// =================================================================================
// 🚀 INICIALIZACIÓN
// =================================================================================
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Extraer ID de la URL (/titulares/update/47)
    const pathParts = window.location.pathname.split('/');
    albaranID = pathParts[pathParts.length - 1];

    if (!albaranID || isNaN(albaranID)) {
        showStatus("❌ ID de albarán no detectado en la URL.", "error");
        return;
    }

    console.log(`🛠️ [UPDATE] Iniciando sesión de edición para ID: ${albaranID}`);

    // 2. Carga de datos maestros y albarán en orden
    try {
        // Cargamos empresas y conductores primero para que los combos estén listos
        await Promise.all([
            loadEmpresas(),
            loadConductores()
        ]);

        // Cargamos los datos del albarán y poblamos el form
        await loadAlbaranData(albaranID);
        
        setupWordCounter();
    } catch (err) {
        console.error("❌ [INIT] Error en la inicialización:", err);
    }
});

// =================================================================================
// 📡 COMUNICACIÓN CON API (GET)
// =================================================================================

async function loadEmpresas() {
    const select = document.getElementById('empresa');
    if (!select) return;
    try {
        const response = await fetch('/api/v1/empresas');
        const json = await response.json();
        const empresas = json.data || json;
        
        select.innerHTML = '<option value="" disabled>Seleccione empresa</option>';
        empresas.forEach(e => {
            const opt = document.createElement('option');
            opt.value = e.id;
            opt.textContent = e.nombre;
            select.appendChild(opt);
        });
    } catch (e) { console.error("❌ Error carga empresas:", e); }
}

async function loadConductores() {
    const select = document.getElementById('asalariado_select');
    if (!select) return;
    try {
        const response = await fetch('/api/v1/conductores');
        const json = await response.json();
        const todos = json.data || json;
        
        select.innerHTML = '<option value="">-- Sin Asalariado (Titular) --</option>';
        todos.forEach(c => {
            const opt = document.createElement('option');
            // Usamos el nombre como valor para que coincida con el campo asalariado de la DB
            opt.value = c.nombre; 
            opt.textContent = `${c.nombre} (${c.conductor || 'S/N'})`;
            select.appendChild(opt);
        });
    } catch (e) { console.error("❌ Error carga conductores:", e); }
}

async function loadAlbaranData(id) {
    try {
        // IMPORTANTE: Ruta sincronizada con routes.go (/id/:id)
        const response = await fetch(`/api/v1/albaranes/id/${id}`);
        
        if (response.status === 401) { window.location.href = '/login'; return; }
        if (!response.ok) throw new Error(`Servidor respondió con status ${response.status}`);
        
        const result = await response.json();
        const data = result.data;

        if (!data) throw new Error("No se encontraron datos.");

        // Poblar el formulario usando albaran_cargar.js
        if (typeof populateForm === 'function') {
            populateForm(data);
        }

        // 🔒 BLOQUEO DE SEGURIDAD (Datos que no deben cambiar)
        const lock = ['n_albaran', 'numero_albaran', 'licencia', 'licencia_ref'];
        lock.forEach(fieldId => {
            const el = document.getElementById(fieldId);
            if (el) {
                el.readOnly = true;
                el.classList.add('bg-slate-200', 'cursor-not-allowed', 'opacity-70');
            }
        });

        document.getElementById('loadingIndicator')?.classList.add('hidden');
        console.log("✅ [UPDATE] Formulario listo para edición.");

    } catch (error) {
        console.error("❌ [UPDATE] Error:", error);
        showStatus('❌ Error al cargar los datos del albarán.', 'error');
    }
}

// =================================================================================
// 💾 ENVÍO DE DATOS (PUT)
// =================================================================================

window.handleAction = async function(actionType, event = null) {
    if (event) event.preventDefault();

    if (actionType === 'modificar') {
        const form = document.getElementById('albaranForm');
        const formData = new FormData(form);
        const payload = {};

        // 1. Mapeo de campos generales y numéricos
        for (const [key, value] of formData.entries()) {
            if (value === "" || value === null) continue;

            // Aseguramos tipos numéricos para el backend Go
            if (['km_totales', 'km_nacionales', 'km_internacionales', 'importe_total', 'importe_suplidos', 'num_plazas', 'empresa_ref'].includes(key)) {
                const num = parseFloat(value);
                if (!isNaN(num)) payload[key] = num;
            } else {
                payload[key] = value;
            }
        }

        // 2. Mapeo de Checkboxes (Booleanos)
        const checks = ['urbano', 'diurno', 'noct_fest', 'festivo', 'finalizado', 'enganche'];
        checks.forEach(id => {
            const el = document.getElementById(id);
            payload[id] = el ? el.checked : false;
        });

        // 3. ID de identificación obligatorio
        payload['id'] = parseInt(albaranID);

        console.log("📤 [PUT] Enviando actualización:", payload);
        showStatus('⏳ Guardando cambios...', 'info');

        try {
            const response = await fetch(`/api/v1/albaranes/${albaranID}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                showStatus('✅ Albarán actualizado correctamente.', 'success');
                setTimeout(() => window.location.href = '/titulares', 1500);
            } else {
                const errResult = await response.json();
                throw new Error(errResult.error || 'Error al actualizar');
            }
        } catch (error) {
            console.error("❌ [PUT] Error:", error);
            showStatus(`❌ Error: ${error.message}`, 'error');
        }
    }
};

// =================================================================================
// 🎨 UTILIDADES UI
// =================================================================================

function showStatus(msg, type) {
    const el = document.getElementById('statusMessage');
    if (!el) return;
    el.textContent = msg;
    el.className = `mt-6 p-4 text-center font-bold rounded-xl border transition-all`;
    
    if (type === 'success') el.classList.add('bg-green-100', 'text-green-800', 'border-green-300');
    else if (type === 'error') el.classList.add('bg-red-100', 'text-red-800', 'border-red-300');
    else el.classList.add('bg-blue-100', 'text-blue-800', 'border-blue-300');
    
    el.classList.remove('hidden');
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function setupWordCounter() {
    const obs = document.getElementById('observaciones');
    if (!obs) return;
    const update = () => {
        const count = obs.value.trim().split(/\s+/).filter(w => w.length > 0).length;
        document.getElementById('wordCount').textContent = `${count} palabras`;
    };
    obs.addEventListener('input', update);
    update();
}