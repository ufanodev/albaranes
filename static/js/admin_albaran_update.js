/**
 * ARCHIVO: static/js/admin_albaran_update.js
 * DESCRIPCIÓN: Edición total de albaranes para Administrador.
 * ACTUALIZADO: 15/04/2026 - FIX: Sincronización horaria dinámica y carga de diccionarios.
 */

document.addEventListener('DOMContentLoaded', async () => {
    const urlParts = window.location.pathname.split('/').filter(p => p !== "");
    const albaranId = urlParts[urlParts.length - 1];

    if (!albaranId || isNaN(albaranId)) {
        showStatus("ID de albarán no válido en la URL", "error");
        return;
    }

    console.group(`🚀 [ADMIN-UPDATE] Inicializando Edición - ID: ${albaranId}`);
    
    try {
        // 1. CARGA DE DICCIONARIOS MAESTROS
        console.log("⏳ 1. Cargando diccionarios maestros...");
        await Promise.all([
            loadSelectData('/api/v1/licencias', 'licencia_ref', 'licencia'),
            loadSelectData('/api/v1/empresas', 'empresa_ref', 'nombre'),
            loadSelectData('/api/v1/conductores/licencia/all', 'asalariado_select', 'nombre', true)
        ]);

        // 2. RECUPERAR DATOS DEL ALBARÁN
        const response = await fetch(`/api/v1/albaranes/id/${albaranId}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        
        if (!response.ok) throw new Error(`Error ${response.status}: No se pudo obtener el registro.`);

        const result = await response.json();
        const data = result.data;

        // 3. POBLAR FORMULARIO (Usa AlbaranLoader para el fix de horas Madrid vs Cloud)
        if (window.AlbaranLoader) {
            window.AlbaranLoader.populateForm(data);
        } else {
            console.warn("⚠️ AlbaranLoader no encontrado, usando fallback local.");
            fallbackPopulate(data);
        }
        
        lockLicenseField(data);

        if(document.getElementById('header_num')) {
            document.getElementById('header_num').textContent = `#${data.numero_albaran}`;
        }
        console.log("✅ 2. Formulario poblado correctamente.");

    } catch (err) {
        console.error("❌ [CRITICAL-ERROR]:", err.message);
        showStatus("Error al cargar datos: " + err.message, "error");
    }
    console.groupEnd();

    initCalculosKms();
    if (window.lucide) lucide.createIcons();
});

/**
 * 🔒 Bloquea el campo de Licencia Titular
 */
function lockLicenseField(data) {
    const selectLic = document.getElementById('licencia_ref');
    if (selectLic) {
        selectLic.value = data.licencia_ref;
        selectLic.disabled = true; 
        selectLic.classList.add('bg-gray-100', 'cursor-not-allowed', 'border-orange-300');
        
        if (!document.getElementById('lic-lock-msg')) {
            const msg = document.createElement('div');
            msg.id = 'lic-lock-msg';
            msg.className = 'text-[10px] text-orange-600 font-bold uppercase mt-1';
            msg.innerHTML = '🔒 Propiedad vinculada (No editable)';
            selectLic.parentNode.appendChild(msg);
        }
    }
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
            const options = list.map(item => {
                const val = useTextAsValue ? item[textField] : item.id;
                return `<option value="${val}">${String(item[textField]).toUpperCase()}</option>`;
            }).join('');
            const firstOption = select.options[0] ? select.options[0].outerHTML : '<option value="">Seleccione...</option>';
            select.innerHTML = firstOption + options;
        }
    } catch (e) { console.warn(`⚠️ No se cargó selector: ${elementId}`); }
}

/**
 * Fallback en caso de que AlbaranLoader falle
 */
function fallbackPopulate(data) {
    const form = document.getElementById('albaranForm');
    if (!form) return;
    Object.keys(data).forEach(key => {
        const el = form.querySelector(`[name="${key}"]`) || document.getElementById(key);
        if (el) {
            if (el.type === 'checkbox') el.checked = !!data[key];
            else if (el.type === 'date') el.value = data[key] ? data[key].substring(0, 10) : '';
            else el.value = data[key] || '';
        }
    });
}

// 4. MANEJO DEL ENVÍO (PUT)
document.getElementById('albaranForm').onsubmit = async (e) => {
    e.preventDefault();
    const albaranId = document.getElementById('albaran_id').value;
    const formData = new FormData(e.target);
    const payload = Object.fromEntries(formData.entries());

    // Normalizar Checkboxes
    const bools = ['urbano', 'diurno', 'noct_fest', 'remolque', 'adjuntos', 'cobrado', 'pagado', 'finalizado', 'festivo', 'adjuntos_bool'];
    bools.forEach(id => {
        const el = e.target.querySelector(`[name="${id}"]`);
        if (el) payload[id] = el.checked;
    });

    // Normalizar Números (Fix comas a puntos)
    const nums = ['empresa_ref', 'num_plazas', 'km_ini', 'km_fin', 'km_totales', 'importe_suplidos', 'importe_total', 'hora_total'];
    nums.forEach(f => {
        if (payload[f] !== undefined) {
            payload[f] = parseFloat(String(payload[f]).replace(',', '.')) || 0;
        }
    });

    // Normalizar Horas (Strings literales HH:mm para que el Backend Go reste el desfase)
    const times = ['hora_ini', 'hora_fin', 'espera_ini', 'espera_fin'];
    times.forEach(t => {
        const el = e.target.querySelector(`[name="${t}"]`);
        if (el && el.value) payload[t] = el.value;
        else delete payload[t];
    });

    // Mapeo especial para coincidir con el Modelo del Backend
    if (payload.nombre_pasajero) {
        payload.cliente = payload.nombre_pasajero;
        delete payload.nombre_pasajero;
    }

    delete payload.id;
    delete payload.licencia_ref; 

    try {
        const res = await fetch(`/api/v1/albaranes/${albaranId}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(payload)
        });

        const result = await res.json();
        if (res.ok) {
            showStatus("✅ ACTUALIZADO CORRECTAMENTE", "success");
            setTimeout(() => window.location.href = '/admin/albaranes', 1500); 
        } else {
            throw new Error(result.error || "Error al actualizar");
        }
    } catch (err) {
        console.error("❌ [UPDATE-ERROR]:", err.message);
        showStatus(err.message, "error");
    }
};

function initCalculosKms() {
    const v1 = document.querySelector('[name="km_ini"]');
    const v2 = document.querySelector('[name="km_fin"]');
    const tot = document.querySelector('[name="km_totales"]');
    const c = () => { 
        if(v1 && v2 && tot) {
            const val1 = parseFloat(v1.value) || 0;
            const val2 = parseFloat(v2.value) || 0;
            if (val2 > 0) tot.value = Math.max(0, val2 - val1).toFixed(2);
        }
    };
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
}