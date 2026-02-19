/**
 * admin_albaran_update.js - PANEL ADMINISTRADOR
 * Edición total de albaranes con trazabilidad completa en consola.
 */

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Obtener ID desde la URL
    const urlParts = window.location.pathname.split('/').filter(p => p !== "");
    const albaranId = urlParts[urlParts.length - 1];

    if (!albaranId || isNaN(albaranId)) {
        showStatus("ID de albarán no válido en la URL", "error");
        return;
    }

    console.group(`🚀 [ADMIN-UPDATE] Inicializando Edición - ID: ${albaranId}`);
    
    try {
        // 2. CARGA DE DICCIONARIOS MAESTROS
        console.log("⏳ 1. Cargando diccionarios maestros (Licencias, Empresas, Conductores)...");
        await Promise.all([
            loadSelectData('/api/v1/licencias', 'licencia_ref', 'licencia'),
            loadSelectData('/api/v1/empresas', 'empresa_ref', 'nombre'),
            loadSelectData('/api/v1/conductores/licencia/all', 'asalariado_select', 'nombre', true)
        ]);
        console.log("✅ 1. Diccionarios cargados correctamente.");

        // 3. RECUPERAR DATOS DEL ALBARÁN
        console.log(`⏳ 2. Solicitando datos del albarán ${albaranId} al servidor...`);
        const response = await fetch(`/api/v1/albaranes/id/${albaranId}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        
        if (!response.ok) {
            console.error("❌ Error en la respuesta del servidor:", response.status);
            throw new Error(`Error ${response.status}: No se pudo obtener el registro.`);
        }

        const result = await response.json();
        console.log("📥 2. Datos recibidos del servidor:", result.data);
        
        const data = result.data;

        // 4. POBLAR FORMULARIO Y BLOQUEAR LICENCIA
        populateAdminForm(data);
        lockLicenseField(data);

        // UI Helpers
        if(document.getElementById('header_num')) {
            document.getElementById('header_num').textContent = `#${data.numero_albaran}`;
        }
        console.log("✅ 3. Formulario poblado y listo.");

    } catch (err) {
        console.error("❌ [CRITICAL-ERROR]:", err.message);
        showStatus("Error al cargar datos: " + err.message, "error");
    }
    console.groupEnd();

    initCalculosKms();
    if (window.lucide) lucide.createIcons();
});

/**
 * Mapeo de datos al formulario
 */
function populateAdminForm(data) {
    const form = document.getElementById('albaranForm');
    if (!form) return;

    Object.keys(data).forEach(key => {
        const el = form.querySelector(`[name="${key}"]`);
        if (el) {
            if (el.type === 'checkbox') {
                el.checked = !!data[key];
            } else if (el.type === 'date') {
                el.value = data[key] ? data[key].substring(0, 10) : '';
            } else if (el.type === 'time') {
                let timeVal = data[key];
                if (timeVal && timeVal.includes('T')) {
                    timeVal = timeVal.split('T')[1].substring(0, 5);
                } else if (timeVal) {
                    timeVal = timeVal.substring(0, 5);
                }
                el.value = timeVal || '';
            } else {
                el.value = data[key] || '';
            }
        }
    });

    if(data.id) document.getElementById('albaran_id').value = data.id;
    if(data.numero_albaran) {
        const nAlbaran = document.getElementById('n_albaran') || form.querySelector('[name="numero_albaran"]');
        if(nAlbaran) nAlbaran.value = data.numero_albaran;
    }
}

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
    } catch (e) {
        console.warn(`⚠️ No se cargó selector: ${elementId}`, e);
    }
}

// 5. MANEJO DEL ENVÍO (PUT)
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

    // Normalizar Números
    const nums = ['empresa_ref', 'num_plazas', 'km_ini', 'km_fin', 'km_totales', 'importe_suplidos', 'importe_total'];
    nums.forEach(f => payload[f] = parseFloat(payload[f]) || 0);

    // Limpieza de seguridad
    delete payload.id;
    delete payload.licencia_ref; 

    console.group("📡 [ENVÍO] Petición PUT al Servidor");
    console.log("📍 URL:", `/api/v1/albaranes/${albaranId}`);
    console.log("📤 Datos enviados (Payload):", payload);
    console.groupEnd();

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

        console.group("📥 [RECIBIDO] Respuesta del Servidor");
        console.log("📊 Status:", res.status);
        console.log("📦 Cuerpo:", result);
        console.groupEnd();

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

/**
 * Utilidades UI y Cálculos
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
}