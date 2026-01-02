/**
 * albaran_update.js - Panel Titular
 * Asegura la carga secuencial para evitar campos vacíos.
 */

let albaranID = null;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Obtener ID de la URL
    const pathParts = window.location.pathname.split('/');
    albaranID = pathParts[pathParts.length - 1];

    if (!albaranID || isNaN(albaranID)) {
        showStatus("❌ ID de albarán no detectado.", "error");
        return;
    }

    console.log(`🚀 [UPDATE] Iniciando edición para ID: ${albaranID}`);

    try {
        // 2. CRÍTICO: Esperar a que los catálogos se carguen COMPLETAMENTE 
        // antes de intentar poner los datos del albarán.
        await Promise.all([
            loadEmpresas(),
            loadConductores()
        ]);

        // 3. Una vez los <select> tienen sus <option>, cargamos los datos
        await loadAlbaranToEdit(albaranID);
        
    } catch (err) {
        console.error("❌ Error en el flujo de carga:", err);
        showStatus("🛑 Error al inicializar el formulario.", "error");
    }
    
    setupKmCalculation();
    setupWordCounter();
    lucide.createIcons();
});

// --- CARGA DE CATÁLOGOS CON TOKEN ---

async function loadEmpresas() {
    const select = document.getElementById('empresa');
    if (!select) return;
    const response = await fetch('/api/v1/empresas', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    const json = await response.json();
    select.innerHTML = '<option value="">Seleccione empresa</option>';
    (json.data || []).forEach(emp => {
        const opt = document.createElement('option');
        opt.value = emp.id; 
        opt.textContent = emp.nombre;
        select.appendChild(opt);
    });
}

async function loadConductores() {
    const select = document.getElementById('asalariado_select');
    if (!select) return;
    const response = await fetch('/api/v1/conductores/mis-conductores', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    const json = await response.json();
    select.innerHTML = '<option value="">-- Sin Asalariado (Titular) --</option>';
    (json.data || []).forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.nombre; 
        opt.textContent = c.nombre;
        select.appendChild(opt);
    });
}

// --- CARGA DEL REGISTRO ---

async function loadAlbaranToEdit(id) {
    const response = await fetch(`/api/v1/albaranes/id/${id}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    const result = await response.json();
    
    if (typeof populateForm === 'function') {
        // populateForm ya sabe que data.cliente -> nombre_pasajero
        populateForm(result.data);
        
        // IDs específicos que populateForm no toca
        document.getElementById('albaran_id').value = result.data.id;
        const headerNum = document.getElementById('header_num');
        if (headerNum) headerNum.textContent = `#${result.data.numero_albaran}`;
        
        console.log("✅ Formulario de actualización poblado.");
    }
}

// --- ENVÍO DE DATOS (PUT) ---

document.getElementById('albaranForm').onsubmit = async (event) => {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const payload = {};

    formData.forEach((value, key) => {
        const el = form.querySelector(`[name="${key}"]`);
        if (el.type === 'checkbox') {
            payload[key] = el.checked;
        } else if (el.type === 'number' || key === 'empresa_ref' || key === 'num_plazas') {
            payload[key] = parseFloat(value) || 0;
        } else {
            payload[key] = value || null;
        }
    });

    // Forzamos el ID original (Regla 2025-12-17)
    payload.id = parseInt(albaranID);

    try {
        const response = await fetch(`/api/v1/albaranes/${albaranID}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            showStatus("✅ Actualizado correctamente.", "success");
            setTimeout(() => window.location.href = '/titulares', 1500);
        } else {
            const res = await response.json();
            throw new Error(res.error || "Error al actualizar.");
        }
    } catch (error) {
        showStatus(error.message, "error");
    }
};

function showStatus(msg, type) {
    const el = document.getElementById('statusMessage');
    if (!el) return;
    el.textContent = msg;
    el.className = `block mt-6 p-4 rounded-xl text-center font-bold border-2 ${
        type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
    }`;
    el.classList.remove('hidden');
}

function setupKmCalculation() {
    const kmIni = document.getElementById('km_ini');
    const kmFin = document.getElementById('km_fin');
    const kmTot = document.getElementById('km_totales');
    const calc = () => {
        const v1 = parseFloat(kmIni.value) || 0;
        const v2 = parseFloat(kmFin.value) || 0;
        if (v2 >= v1) kmTot.value = (v2 - v1).toFixed(2);
    };
    kmIni.addEventListener('input', calc);
    kmFin.addEventListener('input', calc);
}

function setupWordCounter() {}