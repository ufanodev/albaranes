/**
 * admin_albaran_update.js - PANEL ADMINISTRADOR
 * Gestión de edición con carga total de diccionarios y control de facturación.
 */

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Obtener ID desde la URL (/admin/albaranes/update/123)
    const urlParts = window.location.pathname.split('/');
    const albaranId = urlParts[urlParts.length - 1];

    if (!albaranId || isNaN(albaranId)) {
        showStatus("ID de albarán no válido en la URL", "error");
        return;
    }

    console.log(`🚀 [ADMIN-UPDATE] Cargando Albarán ID: ${albaranId}`);

    try {
        // 2. CARGA DE DICCIONARIOS MAESTROS (Simultáneo)
        await Promise.allSettled([
            loadSelectData('/api/v1/licencias', 'licencia_ref', 'licencia'),
            loadSelectData('/api/v1/empresas', 'empresa_ref', 'nombre'),
            loadSelectData('/api/v1/conductores/licencia/all', 'asalariado_select', 'nombre', true)
        ]);

        // 3. RECUPERAR DATOS DEL ALBARÁN
        const response = await fetch(`/api/v1/albaranes/id/${albaranId}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        
        if (!response.ok) throw new Error("No se pudo obtener el registro del servidor.");

        const result = await response.json();
        const data = result.data;

        // 4. POBLAR FORMULARIO
        populateAdminForm(data);

        // UI Helpers
        if(document.getElementById('header_num')) {
            document.getElementById('header_num').textContent = `#${data.numero_albaran}`;
        }

    } catch (err) {
        console.error("❌ [ERROR]:", err.message);
        showStatus("Error al cargar datos: " + err.message, "error");
    }

    initCalculosKms();
    lucide.createIcons();
});

/**
 * Mapeo de datos al formulario (Lógica robusta para Admin)
 */
function populateAdminForm(data) {
    const form = document.getElementById('albaranForm');
    if (!form) return;

    for (const key in data) {
        const el = form.querySelector(`[name="${key}"]`);
        if (el) {
            if (el.type === 'checkbox') {
                el.checked = !!data[key];
            } else if (el.type === 'date') {
                el.value = data[key] ? data[key].substring(0, 10) : '';
            } else if (el.type === 'time') {
                el.value = data[key] && data[key].includes('T') 
                    ? data[key].split('T')[1].substring(0, 5) 
                    : data[key] ? data[key].substring(0, 5) : '';
            } else {
                el.value = data[key] || '';
            }
        }
    }

    if(data.id) document.getElementById('albaran_id').value = data.id;
    if(data.numero_albaran) document.getElementById('n_albaran').value = data.numero_albaran;
    if(data.cliente) document.getElementById('nombre_pasajero').value = data.cliente;
}

/**
 * Carga genérica de selectores
 */
async function loadSelectData(url, elementId, textField, useTextAsValue = false) {
    const select = document.getElementById(elementId);
    if (!select) return;

    try {
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const json = await response.json();
        const list = json.data || json;

        if (Array.isArray(list)) {
            const currentHTML = select.innerHTML;
            select.innerHTML = currentHTML + list.map(item => {
                const val = useTextAsValue ? item[textField] : item.id;
                return `<option value="${val}">${item[textField]}</option>`;
            }).join('');
        }
    } catch (e) {
        console.warn(`No se cargó select ${elementId}`);
    }
}

// 5. MANEJO DEL ENVÍO (PUT)
document.getElementById('albaranForm').onsubmit = async (e) => {
    e.preventDefault();
    const albaranId = document.getElementById('albaran_id').value;
    const formData = new FormData(e.target);
    const payload = Object.fromEntries(formData.entries());

    const bools = ['urbano', 'diurno', 'noct_fest', 'remolque', 'adjuntos', 'cobrado', 'pagado', 'finalizado', 'festivo'];
    bools.forEach(id => {
        const el = e.target.querySelector(`[name="${id}"]`);
        payload[id] = el ? el.checked : false;
    });

    const nums = ['licencia_ref', 'empresa_ref', 'num_plazas', 'km_ini', 'km_fin', 'km_totales', 'importe_suplidos', 'importe_total'];
    nums.forEach(f => payload[f] = parseFloat(payload[f]) || 0);

    // REGLA 2025-12-17: El ID está en la URL, se limpia del body
    delete payload.id;

    try {
        const res = await fetch(`/api/v1/albaranes/admin/${albaranId}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            showStatus("✅ REGISTRO MAESTRO ACTUALIZADO", "success");
            
            // 🔄 MATIZ DE RUTA: Redirección al panel principal admin
            setTimeout(() => window.location.href = '/admin/', 1500); 

        } else {
            const errData = await res.json();
            throw new Error(errData.error || "Error al actualizar");
        }
    } catch (err) {
        showStatus(err.message, "error");
    }
};

/**
 * Utilidades UI
 */
function initCalculosKms() {
    const v1 = document.querySelector('[name="km_ini"]');
    const v2 = document.querySelector('[name="km_fin"]');
    const tot = document.querySelector('[name="km_totales"]');
    const c = () => { if(v1 && v2 && tot && v2.value > 0) tot.value = (v2.value - v1.value).toFixed(2); };
    v1?.addEventListener('input', c); v2?.addEventListener('input', c);
}

function showStatus(msg, type) {
    const el = document.getElementById('statusMessage');
    if (!el) return;
    el.textContent = msg;
    el.className = `mt-8 p-5 rounded-2xl text-center font-black border-2 uppercase text-xs block ${
        type === 'success' ? 'bg-green-100 text-green-700 border-green-500' : 'bg-red-100 text-red-700 border-red-500'
    }`;
    el.classList.remove('hidden');
}