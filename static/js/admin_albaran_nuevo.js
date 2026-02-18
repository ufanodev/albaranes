/**
 * admin_albaran_nuevo.js - PANEL ADMINISTRADOR
 * Inserción rápida optimizada para entorno administrativo.
 * Redirección tras éxito a: http://localhost:8080/admin/
 */

document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 [ADMIN] Iniciando Motor de Inserción Rápida");

    // 1. Carga paralela de datos maestros
    await Promise.all([
        cargarLicencias(),
        cargarEmpresas()
    ]);

    // 2. Establecer fecha de hoy
    const fechaInput = document.getElementById('fecha');
    if (fechaInput) {
        fechaInput.value = new Date().toISOString().split('T')[0];
    }

    // 3. Inicializar componentes
    initEventListeners();
    initCalculosKms();
    
    if (window.lucide) lucide.createIcons();
});

/**
 * Obtiene las licencias y puebla el select con sus IDs reales
 */
async function cargarLicencias() {
    const select = document.getElementById('licencia_ref');
    if (!select) return;
    try {
        const res = await fetch('/api/v1/licencias', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await res.json();
        const list = data.data || data;

        select.innerHTML = '<option value="0" disabled selected>-- SELECCIONAR LICENCIA --</option>';
        list.forEach(l => {
            const opt = document.createElement('option');
            opt.value = l.id; 
            opt.textContent = `LICENCIA: ${l.licencia}`;
            select.appendChild(opt);
        });
    } catch (err) { 
        console.error("❌ [ADMIN] Error cargando licencias:", err); 
    }
}

/**
 * Obtiene las empresas y puebla el select (Orden A-Z)
 */
async function cargarEmpresas() {
    const select = document.getElementById('empresa_ref');
    if (!select) return;
    try {
        const res = await fetch('/api/v1/empresas', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await res.json();
        const list = data.data || data;

        const ordenadas = (list || []).sort((a, b) => a.nombre.localeCompare(b.nombre));

        select.innerHTML = '<option value="0" disabled selected>-- SELECCIONAR EMPRESA --</option>';
        ordenadas.forEach(e => {
            const opt = document.createElement('option');
            opt.value = e.id; 
            opt.textContent = e.nombre.toUpperCase();
            select.appendChild(opt);
        });
    } catch (err) { 
        console.error("❌ [ADMIN] Error cargando empresas:", err); 
    }
}

function initEventListeners() {
    const form = document.getElementById('albaranForm');
    if (form) {
        form.addEventListener('submit', handleInsertMaestro);
    }
}

/**
 * Procesa el envío del formulario con normalización estricta para ADMIN
 */
async function handleInsertMaestro(event) {
    event.preventDefault();
    const statusMsg = document.getElementById('statusMessage');
    const form = event.target;
    
    // Captura manual de IDs para asegurar integridad numérica
    const rawLicencia = document.getElementById('licencia_ref').value;
    const rawEmpresa = document.getElementById('empresa_ref').value;
    
    const formData = new FormData(form);
    const data = {};

    // 1. Mapeo de datos y gestión de Checkboxes
    formData.forEach((value, key) => {
        const input = form.querySelector(`[name="${key}"]`);
        if (input && input.type === 'checkbox') {
            data[key] = input.checked;
        } else {
            // Normalización preventiva: Si el texto está vacío, enviamos "-" para evitar error 1364
            data[key] = (typeof value === 'string' && value.trim() === "") ? "-" : value;
        }
    });

    // 2. FORZADO DE TIPOS PARA BACKEND
    data.licencia_ref = parseInt(rawLicencia) || 0;
    data.empresa_ref = parseInt(rawEmpresa) || 0;
    data.importe_total = parseFloat(data.importe_total) || 0;
    data.km_totales = parseFloat(data.km_totales) || 0;
    data.finalizado = true; // Por defecto para admin

    // 3. CAMPOS CRÍTICOS (Garantizar NOT NULL)
    data.tlf_pasajero = data.tlf_pasajero && data.tlf_pasajero !== "-" ? data.tlf_pasajero : "-";
    data.dni_pasajero = data.dni_pasajero && data.dni_pasajero !== "-" ? data.dni_pasajero : "-";
    data.asalariado = data.asalariado && data.asalariado !== "-" ? data.asalariado : "TITULAR";

    console.log("📤 [DEBUG FRONT] Enviando al servidor:", data);

    // Validación mínima
    if (data.licencia_ref === 0 || data.empresa_ref === 0) {
        statusMsg.className = "mt-6 p-4 rounded-xl text-center font-bold bg-orange-100 text-orange-700 block border-2 border-orange-500";
        statusMsg.textContent = "⚠️ Error: Debes seleccionar Licencia y Empresa.";
        statusMsg.classList.remove('hidden');
        return;
    }

    try {
        const res = await fetch('/api/v1/albaranes', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}` 
            },
            body: JSON.stringify(data)
        });

        const result = await res.json();
        console.log("📥 [DEBUG FRONT] Respuesta:", result);

        if (res.ok) {
            statusMsg.className = "mt-6 p-4 rounded-xl text-center font-bold bg-green-100 text-green-700 block border-2 border-green-500 shadow-lg";
            statusMsg.textContent = "✅ ALBARÁN GUARDADO. REDIRIGIENDO AL PANEL...";
            statusMsg.classList.remove('hidden');
            
            // REDIRECCIÓN A LA RAÍZ DE ADMIN
            setTimeout(() => {
                window.location.href = '/admin';
            }, 1200);
            
        } else {
            throw new Error(result.error || "Fallo en el guardado");
        }
    } catch (err) {
        statusMsg.className = "mt-6 p-4 rounded-xl text-center font-bold bg-red-100 text-red-700 block border-2 border-red-500 shadow-lg";
        statusMsg.textContent = `❌ ERROR: ${err.message}`;
        statusMsg.classList.remove('hidden');
    }
}

/**
 * Cálculo automático de KMs
 */
function initCalculosKms() {
    const v1 = document.querySelector('input[name="km_ini"]');
    const v2 = document.querySelector('input[name="km_fin"]');
    const tot = document.querySelector('input[name="km_totales"]');
    
    const calc = () => { 
        if (v1 && v2 && tot) {
            const val1 = parseFloat(v1.value) || 0;
            const val2 = parseFloat(v2.value) || 0;
            tot.value = Math.max(0, (val2 - val1)).toFixed(2); 
        }
    };
    
    v1?.addEventListener('input', calc); 
    v2?.addEventListener('input', calc);
}