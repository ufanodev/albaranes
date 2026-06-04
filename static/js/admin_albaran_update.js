/**
 * ARCHIVO: static/js/admin_albaran_update.js
 * DESCRIPCIÓN: Edición total de albaranes para Administrador.
 * ACTUALIZADO: 04/06/2026
 *   - FIX: empresa_ref se fuerza desde el select id='empresa'.
 *   - FIX: fecha se fuerza desde el input directamente.
 *   - FIX: nombre_pasajero se envía como 'nombre_pasajero'.
 *   - FIX: Campo 'enviado' siempre = true en cada actualización admin.
 *   - FIX: espera_ini y espera_fin son HH:mm (pasan por addTwoHours).
 *   - FIX: hora_total es entero (minutos totales de espera, tecleado por admin).
 *   - ADD: toggleFecha y syncFechasFacturacion para cobrado/pagado con fecha inline.
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
        console.log("⏳ 1. Cargando diccionarios maestros...");
        await Promise.all([
            loadSelectData('/api/v1/licencias', 'licencia_ref', 'licencia'),
            loadSelectData('/api/v1/empresas', 'empresa', 'nombre'),
        ]);

        const response = await fetch(`/api/v1/albaranes/id/${albaranId}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });

        if (!response.ok) throw new Error(`Error ${response.status}: No se pudo obtener el registro.`);

        const result = await response.json();
        const data = result.data;

        if (window.AlbaranLoader) {
            window.AlbaranLoader.populateForm(data);
        } else {
            console.warn("⚠️ AlbaranLoader no encontrado, usando fallback local.");
            fallbackPopulate(data);
        }

        lockLicenseField(data);
        syncFechasFacturacion();

        if (document.getElementById('header_num')) {
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

function fallbackPopulate(data) {
    const form = document.getElementById('albaranForm');
    if (!form) return;
    if (data.cliente !== undefined && data.nombre_pasajero === undefined) {
        data.nombre_pasajero = data.cliente;
    }
    Object.keys(data).forEach(key => {
        const el = form.querySelector(`[name="${key}"]`) || document.getElementById(key);
        if (el) {
            if (el.type === 'checkbox') el.checked = !!data[key];
            else if (el.type === 'date') el.value = data[key] ? data[key].substring(0, 10) : '';
            else el.value = data[key] || '';
        }
    });
    const empresaSelect = document.getElementById('empresa');
    if (empresaSelect && data.empresa_ref) empresaSelect.value = data.empresa_ref;
}

// MANEJO DEL ENVÍO (PUT)
document.getElementById('albaranForm').onsubmit = async (e) => {
    e.preventDefault();
    const albaranId = document.getElementById('albaran_id').value;

    if (!albaranId) {
        showStatus("Error: ID de albarán no encontrado", "error");
        return;
    }

    const formData = new FormData(e.target);
    const payload = Object.fromEntries(formData.entries());

    // Fecha: forzar desde input
    const fechaEl = document.getElementById('fecha');
    if (fechaEl && fechaEl.value) payload.fecha = fechaEl.value;

    // Empresa: forzar desde select
    const empresaEl = document.getElementById('empresa');
    if (empresaEl && empresaEl.value) payload.empresa_ref = empresaEl.value;

    // Horas HH:mm: sumar 2h para compensar offset UTC del backend.
    // espera_ini y espera_fin son HH:mm → pasan por addTwoHours.
    // hora_total es número entero → NO pasa por aquí.
    const addTwoHours = (timeStr) => {
        if (!timeStr) return null;
        const [h, m] = timeStr.split(':').map(Number);
        const total = h * 60 + m + 120;
        const newH = Math.floor(total / 60) % 24;
        const newM = total % 60;
        return String(newH).padStart(2, '0') + ':' + String(newM).padStart(2, '0');
    };
    const times = ['hora_ini', 'hora_fin', 'espera_ini', 'espera_fin'];
    times.forEach(t => {
        const el = document.getElementById(t);
        if (el && el.value) payload[t] = addTwoHours(el.value);
        else delete payload[t];
    });

    // Normalizar Checkboxes
    const bools = ['urbano', 'diurno', 'noct_fest', 'remolque', 'cobrado', 'pagado', 'finalizado'];
    bools.forEach(name => {
        const el = e.target.querySelector(`[name="${name}"]`);
        payload[name] = el ? el.checked : false;
    });

    // Normalizar Números decimales
    const nums = ['empresa_ref', 'num_plazas', 'km_ini', 'km_fin', 'km_totales',
                  'importe_suplidos', 'importe_total', 'hora_total'];
    nums.forEach(f => {
        if (payload[f] !== undefined && payload[f] !== '') {
            payload[f] = parseFloat(String(payload[f]).replace(',', '.')) || 0;
        }
    });

    // hora_total: forzar entero (minutos totales de espera)
    if (payload.hora_total !== undefined) {
        payload.hora_total = Math.min(360, Math.max(0, Math.round(payload.hora_total)));
    }

    // Fechas cobro/pago: solo si el check está activo y hay valor, si no null
    const fechaCobro = document.getElementById('fecha_cobro');
    const fechaPago  = document.getElementById('fecha_pago');
    payload.fecha_cobro = (document.getElementById('cobrado')?.checked && fechaCobro?.value)
        ? fechaCobro.value : null;
    payload.fecha_pago  = (document.getElementById('pagado')?.checked && fechaPago?.value)
        ? fechaPago.value : null;

    // Admin siempre marca como enviado
    payload.enviado = true;

    // Limpiar campos que no deben enviarse
    delete payload.id;
    delete payload.licencia_ref;
    delete payload.numero_albaran;

    console.log("📤 [ADMIN-UPDATE] Payload enviado:", JSON.stringify(payload, null, 2));

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
    const calcular = () => {
        if (v1 && v2 && tot) {
            const val1 = parseFloat(v1.value) || 0;
            const val2 = parseFloat(v2.value) || 0;
            if (val2 > 0) tot.value = Math.max(0, val2 - val1).toFixed(2);
        }
    };
    v1?.addEventListener('input', calcular);
    v2?.addEventListener('input', calcular);
}

/**
 * Activa/desactiva el input de fecha según el estado del checkbox.
 * Si se desmarca, limpia el valor.
 */
function toggleFecha(checkId, dateId) {
    const check = document.getElementById(checkId);
    const dateEl = document.getElementById(dateId);
    if (!check || !dateEl) return;
    if (check.checked) {
        dateEl.disabled = false;
        if (!dateEl.value) {
            const hoy = new Date();
            const offset = hoy.getTimezoneOffset() * 60000;
            dateEl.value = new Date(hoy - offset).toISOString().split('T')[0];
        }
    } else {
        dateEl.disabled = true;
        dateEl.value = '';
    }
}

/**
 * Sincroniza el estado inicial de las fechas al cargar el formulario.
 * Se llama tras populateForm para reflejar los datos del backend.
 */
function syncFechasFacturacion() {
    toggleFecha('cobrado', 'fecha_cobro');
    toggleFecha('pagado',  'fecha_pago');
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