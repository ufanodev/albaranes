/**
 * ARCHIVO: static/js/albaran_update.js
 * DESCRIPCIÓN: Lógica para titulares: Carga y Actualización de albaranes.
 */

document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 [INIT] Iniciando modo edición de albarán (Panel Titular)...");

    // 1. Obtención robusta del ID
    let albaranId = new URLSearchParams(window.location.search).get('id');
    if (!albaranId) {
        const parts = window.location.pathname.split('/').filter(p => p !== "");
        const last = parts[parts.length - 1];
        if (!isNaN(last)) albaranId = last;
    }

    if (!albaranId) {
        showStatus("Error: No se pudo identificar el albarán.", "error");
        return;
    }

    // 2. Carga inicial
    await Promise.all([cargarEmpresas(), loadAlbaranToEdit(albaranId)]);

    if (window.lucide) lucide.createIcons();
    initFormatters();
    
    // 3. Listener de envío
    document.getElementById('albaranForm')?.addEventListener('submit', handleFormSubmit);
});

async function cargarEmpresas() {
    const select = document.getElementById('empresa');
    if (!select) return;
    try {
        const res = await fetch('/api/v1/empresas');
        const json = await res.json();
        const ordenadas = (json.data || []).sort((a, b) => a.nombre.localeCompare(b.nombre));

        select.innerHTML = '<option value="">-- Seleccionar Empresa --</option>';
        ordenadas.forEach(e => {
            const opt = document.createElement('option');
            opt.value = e.id;
            opt.textContent = e.nombre.toUpperCase();
            select.appendChild(opt);
        });
    } catch (e) { console.error("Error empresas:", e); }
}

async function loadAlbaranToEdit(id) {
    try {
        const res = await fetch(`/api/v1/albaranes/id/${id}`);
        if (!res.ok) throw new Error("Albarán inexistente");
        const { data } = await res.json();

        // Rellenado de campos
        const fill = (id, val) => { if(document.getElementById(id)) document.getElementById(id).value = val || ''; };
        
        fill('albaran_id', data.id);
        fill('licencia', data.licencia);
        fill('n_albaran', data.numero_albaran);
        fill('referencia', data.referencia);
        fill('fecha', data.fecha ? data.fecha.split('T')[0] : '');

        const fmtT = (t) => t ? (t.includes('T') ? t.split('T')[1].substring(0,5) : t.substring(0,5)) : '';
        fill('hora_ini', fmtT(data.hora_ini));
        fill('hora_fin', fmtT(data.hora_fin));
        
        if(document.getElementById('empresa')) document.getElementById('empresa').value = data.empresa_ref;
        
        fill('nombre_pasajero', data.nombre_pasajero);
        fill('tlf_pasajero', data.tlf_pasajero);
        fill('dni_pasajero', data.dni_pasajero);
        fill('matricula', data.matricula);
        fill('origen', data.origen);
        fill('destino', data.destino);
        fill('parada', data.parada);
        fill('hora_total', parseFloat(data.hora_total || 0).toFixed(2));
        fill('espera_ini', fmtT(data.espera_ini));
        fill('espera_fin', fmtT(data.espera_fin));

        ['urbano', 'diurno', 'noct_fest', 'remolque'].forEach(k => {
            if(document.getElementById(k)) document.getElementById(k).checked = !!data[k];
        });

        fill('km_totales', parseFloat(data.km_totales || 0).toFixed(2));
        fill('km_nacionales', parseFloat(data.km_nacionales || 0).toFixed(2));
        fill('km_internacionales', parseFloat(data.km_internacionales || 0).toFixed(2));
        fill('importe_suplidos', parseFloat(data.importe_suplidos || 0).toFixed(2));
        fill('asalariado', data.asalariado);
        fill('autorizado_por', data.autorizado_por);
        fill('num_plazas', data.num_plazas);
        fill('observaciones', data.observaciones);
        fill('importe_total', parseFloat(data.importe_total || 0).toFixed(2));

        if (document.getElementById('adjuntos_bool')) document.getElementById('adjuntos_bool').checked = !!data.adjuntos;
        fill('adjuntos_ref', data.adjuntos_ref);

    } catch (e) { console.error("Error carga:", e); }
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('albaran_id')?.value;
    const formData = new FormData(e.target);
    const payload = {};

    formData.forEach((v, k) => {
        const input = e.target.querySelector(`[name="${k}"]`);
        payload[k] = (input.type === 'checkbox') ? input.checked : v;
    });

    // Casteos
    payload.empresa_ref = parseInt(payload.empresa_ref) || 0;
    payload.num_plazas = parseInt(payload.num_plazas) || 4;
    ['km_totales', 'importe_total', 'importe_suplidos', 'hora_total'].forEach(f => {
        payload[f] = parseFloat(payload[f]) || 0.0;
    });
    payload.adjuntos = payload.adjuntos_bool || false;

    try {
        const res = await fetch(`/api/v1/albaranes/user/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            showStatus("✅ Albarán actualizado con éxito.", "success");
            setTimeout(() => window.location.href = '/titulares/pendientes', 1500);
        } else {
            const err = await res.json();
            throw new Error(err.error || "Error al actualizar");
        }
    } catch (e) { showStatus("❌ Error: " + e.message, "error"); }
}

function showStatus(msg, type) {
    const el = document.getElementById('statusMessage');
    if (!el) return;
    el.className = `mt-8 p-5 rounded-2xl text-center font-black w-full max-w-2xl border-2 uppercase text-xs tracking-widest ${type === 'success' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`;
    el.textContent = msg;
    el.classList.remove('hidden');
}

function initFormatters() {
    ['importe_total', 'importe_suplidos', 'km_totales', 'hora_total'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('blur', () => { if (el.value) el.value = parseFloat(el.value).toFixed(2); });
    });
}