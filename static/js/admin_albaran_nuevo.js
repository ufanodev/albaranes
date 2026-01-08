/**
 * admin_albaran_nuevo.js - PANEL ADMINISTRADOR
 * Carga total de datos maestros sincronizada con DB de 49 columnas.
 */

document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 [ADMIN] Iniciando Formulario Maestro");

    // 1. Cargar todos los datos maestros al inicio
    console.time("⏱️ Carga Inicial");
    await Promise.all([
        cargarLicencias(),
        cargarEmpresas(),
        cargarListaConductores() // Carga global para admin
    ]);
    console.timeEnd("⏱️ Carga Inicial");

    // 2. Fecha por defecto
    const fechaInput = document.getElementById('fecha');
    if (fechaInput) fechaInput.value = new Date().toISOString().split('T')[0];

    initEventListeners();
    initCalculosKms();
    initWordCounter();
    lucide.createIcons();
});

/**
 * Carga TODOS los conductores disponibles
 */
async function cargarListaConductores() {
    const select = document.getElementById('asalariado_select');
    if (!select) return;

    try {
        // Llamamos a la ruta (que en el backend ahora devuelve todo)
        const res = await fetch('/api/v1/conductores/licencia/all', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const responseData = await res.json();
        const list = responseData.data || [];

        select.innerHTML = '<option value="">-- Seleccionar Conductor --</option>';
        list.forEach(con => {
            const opt = document.createElement('option');
            opt.value = con.nombre;
            opt.textContent = con.nombre;
            select.appendChild(opt);
        });
        console.log(`✅ [UI] ${list.length} conductores cargados.`);
    } catch (err) {
        console.error("❌ Error al cargar conductores:", err);
    }
}

async function cargarLicencias() {
    const select = document.getElementById('licencia_ref');
    try {
        const res = await fetch('/api/v1/licencias', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await res.json();
        const list = data.data || data;

        select.innerHTML = '<option value="" disabled selected>-- Licencia --</option>';
        list.forEach(l => {
            const opt = document.createElement('option');
            opt.value = l.id;
            opt.textContent = l.licencia;
            select.appendChild(opt);
        });
    } catch (err) { console.error("❌ Error licencias:", err); }
}

async function cargarEmpresas() {
    const select = document.getElementById('empresa_ref');
    try {
        const res = await fetch('/api/v1/empresas', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await res.json();
        const list = data.data || data;

        select.innerHTML = '<option value="" disabled selected>-- Empresa --</option>';
        list.forEach(e => {
            const opt = document.createElement('option');
            opt.value = e.id;
            opt.textContent = e.nombre;
            select.appendChild(opt);
        });
    } catch (err) { console.error("❌ Error empresas:", err); }
}

function initEventListeners() {
    const form = document.getElementById('albaranForm');
    if (form) {
        form.addEventListener('submit', handleInsertMaestro);
    }
}

/**
 * Lógica de INSERT (POST)
 */
async function handleInsertMaestro(event) {
    event.preventDefault();
    const statusMsg = document.getElementById('statusMessage');
    const formData = new FormData(event.target);
    const data = {};

    formData.forEach((value, key) => { data[key] = value; });

    // Tipos para MySQL
    const numFields = ['licencia_ref', 'empresa_ref', 'km_ini', 'km_fin', 'km_totales', 'importe_total', 'importe_suplidos', 'num_plazas'];
    numFields.forEach(f => data[f] = parseFloat(data[f]) || 0);

    // Booleanos
    const boolFields = ['festivo', 'finalizado', 'urbano', 'diurno', 'noct_fest', 'remolque', 'adjuntos', 'cobrado', 'pagado'];
    boolFields.forEach(f => {
        const el = event.target.querySelector(`[name="${f}"]`);
        data[f] = el ? el.checked : false;
    });

    // Limpieza Regla 2025-12-17 (Sin ID)
    delete data.id;
    delete data.enganche;
    if (!data.fecha_cobro) delete data.fecha_cobro;

    try {
        const res = await fetch('/api/v1/albaranes', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}` 
            },
            body: JSON.stringify(data)
        });

        if (res.ok) {
            statusMsg.className = "mt-6 p-4 rounded-xl text-center font-bold bg-green-100 text-green-700 block";
            statusMsg.textContent = "✅ ALBARÁN GUARDADO CON ÉXITO";
            setTimeout(() => window.location.href = '/admin/albaranes', 1500);
        } else {
            const errResult = await res.json();
            throw new Error(errResult.error || "Fallo servidor");
        }
    } catch (err) {
        statusMsg.className = "mt-6 p-4 rounded-xl text-center font-bold bg-red-100 text-red-700 block";
        statusMsg.textContent = `❌ ERROR: ${err.message}`;
    }
}

// Utilidades de UI (Kms y Palabras)
function initCalculosKms() {
    const v1 = document.querySelector('input[name="km_ini"]'), v2 = document.querySelector('input[name="km_fin"]'), tot = document.querySelector('input[name="km_totales"]');
    const calc = () => { if (v1 && v2 && tot && v2.value > 0) tot.value = (parseFloat(v2.value) - parseFloat(v1.value)).toFixed(2); };
    v1?.addEventListener('input', calc); v2?.addEventListener('input', calc);
}

function initWordCounter() {
    const obs = document.getElementById('observaciones');
    if (obs) obs.addEventListener('input', () => {
        const w = obs.value.trim().split(/\s+/).filter(x => x.length > 0).length;
        document.getElementById('wordCount').textContent = `${w} palabras`;
    });
}