/**
 * ARCHIVO: static/js/admin_albaran_copiar.js
 * DESCRIPCIÓN: Lógica de clonación de albarán.
 * El submit es idéntico al de admin_albaran_nuevo.js (mismo blindaje SQL).
 * ACTUALIZADO: 21/03/2026
 */

document.addEventListener('DOMContentLoaded', async () => {

    const albaranId = window.location.pathname.split('/').filter(p => p !== '').pop();
    console.log(`🚀 [CLONADOR] Clonando desde ID: ${albaranId}`);
    if (!albaranId || isNaN(albaranId)) return;

    // ── 1. Cargar catálogos (igual que en nuevo.js) ──────────────────
    await Promise.all([cargarLicencias(), cargarEmpresas()]);

    // ── 2. Obtener datos del albarán origen ──────────────────────────
    let origen = null;
    try {
        const res = await fetch(`/api/v1/albaranes/id/${albaranId}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const result = await res.json();
        if (!res.ok || !result.data) throw new Error(result.error || 'No encontrado');
        origen = result.data;
        console.log('📦 [CLONADOR] Datos origen recibidos:', origen);
    } catch (e) {
        console.error('[CLONADOR] Error cargando origen:', e);
        showUIStatus(`Error al cargar el albarán origen: ${e.message}`, 'error');
        return;
    }

    // ── 3. Poblar formulario ─────────────────────────────────────────
    // Llamamos al motor de cargar.js para lo que puede hacer
    if (typeof window.populateForm === 'function') {
        window.populateForm(origen);
    }

    // Parcheamos encima los campos que populateForm rompe en un formulario editable:

    // FECHA → populateForm manda DD/MM/YYYY, el input date necesita YYYY-MM-DD
    setInputDate('fecha', origen.fecha);

    // HORAS → populateForm devuelve "--:--" si está vacío, el input time necesita ""
    setInputTime('hora_ini',   origen.hora_ini);
    setInputTime('hora_fin',   origen.hora_fin);
    setInputTime('espera_ini', origen.espera_ini);
    setInputTime('espera_fin', origen.espera_fin);

    // SELECTS → reasignar después del await para garantizar que las opciones existen
    setSelectVal('licencia_ref', origen.licencia || origen.licencia_ref);
    setSelectVal('empresa_ref',  origen.empresa_ref);
    setSelectVal('num_plazas',   origen.num_plazas || 4);

    // IMPORTE TOTAL → cargar.js busca 'importe_total_view' (span), aquí es un <input>
    const impTotalEl = document.getElementById('importe_total');
    if (impTotalEl) impTotalEl.value = (parseFloat(origen.importe_total) || 0).toFixed(2);

    // SUPLIDOS → cargar.js añade " €", inválido en type="number"
    const suplEl = document.getElementById('importe_suplidos');
    if (suplEl) suplEl.value = (parseFloat(origen.importe_suplidos) || 0).toFixed(2);

    // HORA TOTAL (espera decimal) → cargar.js no lo mapea
    const horaTotalEl = document.getElementById('hora_total');
    if (horaTotalEl) horaTotalEl.value = origen.hora_total || '';

    // CHECKBOXES → cargar.js llama syncBadge('urbano_val') que no existe aquí
    setCheckbox('urbano',       origen.urbano);
    setCheckbox('diurno',       origen.diurno);
    setCheckbox('noct_fest',    origen.noct_fest);
    setCheckbox('remolque',     origen.remolque);
    setCheckbox('cobrado',      origen.cobrado);
    setCheckbox('pagado',       origen.pagado);
    setCheckbox('finalizado',   origen.finalizado !== undefined ? origen.finalizado : true);
    setCheckbox('adjuntos_bool',origen.adjuntos_bool);

    // ADJUNTOS REF → cargar.js no lo mapea con este id
    const adjRef = document.getElementById('adjuntos_ref');
    if (adjRef) adjRef.value = origen.adjuntos || '';

    // OBSERVACIONES → cargar.js busca 'observaciones_view', aquí es 'observaciones'
    const obsEl = document.getElementById('observaciones');
    if (obsEl) obsEl.value = origen.observaciones || '';

    // ── 4. LIMPIEZA DE COPIA ─────────────────────────────────────────
    // Nº albarán nuevo con prefijo identificativo
    const nAlbaranEl = document.getElementById('n_albaran');
    if (nAlbaranEl) nAlbaranEl.value = `COPY-${origen.numero_albaran}`;

    // Fecha → hoy
    const fechaEl = document.getElementById('fecha');
    if (fechaEl) fechaEl.value = new Date().toISOString().split('T')[0];

    // Facturación → reset (no duplicar cobros)
    ['num_factura', 'fecha_cobro'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    setCheckbox('cobrado', false);
    setCheckbox('pagado',  false);

    // Cabecera
    const headerNum = document.getElementById('header_num');
    if (headerNum) headerNum.textContent = `ORIGEN: #${origen.numero_albaran}`;

    // ── 5. Km y submit ───────────────────────────────────────────────
    initCalculosKms();
    document.getElementById('albaranForm')?.addEventListener('submit', handleClonarSubmit);

    if (window.lucide) lucide.createIcons();
});


// ════════════════════════════════════════════════════════════════════
// SUBMIT — idéntico al de admin_albaran_nuevo.js
// ════════════════════════════════════════════════════════════════════
async function handleClonarSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const data = {};

    // 1. PROCESAMIENTO CON VALORES POR DEFECTO PARA SQL
    //    (mismo blindaje que en nuevo.js para evitar Error 1366 / 1048)
    formData.forEach((value, key) => {
        const input = form.querySelector(`[name="${key}"]`);
        const valStr = value.toString().trim();

        if (input.type === 'checkbox') {
            data[key] = input.checked;
        } else if (input.type === 'number') {
            // SQL Decimal/Int: vacío → 0
            data[key] = valStr === '' ? 0 : parseFloat(valStr);
        } else if (input.type === 'time') {
            // SQL Time: vacío → null
            data[key] = valStr === '' ? null : valStr;
        } else {
            // SQL String: vacío → "-"
            data[key] = valStr === '' ? '-' : valStr;
        }
    });

    // Checkboxes NO marcados no aparecen en FormData → forzar false
    ['urbano', 'diurno', 'noct_fest', 'remolque',
     'cobrado', 'pagado', 'finalizado', 'adjuntos_bool'].forEach(id => {
        const el = document.getElementById(id);
        if (el && el.type === 'checkbox') data[id] = el.checked;
    });

    // 2. MAPEO Y TIPOS ESPECIALES (igual que nuevo.js)
    data.cliente = data.nombre_pasajero || '-';
    delete data.nombre_pasajero;

    data.licencia_ref = parseInt(document.getElementById('licencia_ref').value) || 0;
    data.empresa_ref  = parseInt(document.getElementById('empresa_ref').value)  || 0;
    data.num_plazas   = parseInt(data.num_plazas) || 4;
    data.finalizado   = true;

    console.log('📤 [CLONADOR] Payload Final:', data);

    // 3. VALIDACIÓN MÍNIMA
    if (data.licencia_ref === 0 || data.empresa_ref === 0 || data.numero_albaran === '-') {
        showUIStatus('⚠️ Mínimo requerido: Licencia, Empresa y Nº Albarán.', 'error');
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

        if (res.ok) {
            showUIStatus('✅ CLONACIÓN REALIZADA CON ÉXITO', 'success');
            setTimeout(() => window.location.href = '/admin', 1500);
        } else {
            throw new Error(result.error || 'Error al procesar en el servidor');
        }
    } catch (err) {
        console.error('❌ [CLONADOR] Error en POST:', err);
        showUIStatus(`❌ FALLO: ${err.message}`, 'error');
    }
}


// ════════════════════════════════════════════════════════════════════
// CATÁLOGOS (mismo patrón que nuevo.js)
// ════════════════════════════════════════════════════════════════════
async function cargarLicencias() {
    const select = document.getElementById('licencia_ref');
    if (!select) return;
    try {
        const res = await fetch('/api/v1/licencias', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const result = await res.json();
        const list = result.data || result;
        select.innerHTML = '<option value="0" disabled selected>-- SELECCIONAR LICENCIA --</option>';
        list
            .sort((a, b) => String(a.licencia).localeCompare(String(b.licencia), undefined, { numeric: true }))
            .forEach(l => {
                select.innerHTML += `<option value="${l.id}">LICENCIA: ${l.licencia}</option>`;
            });
    } catch (err) { console.error('❌ Error licencias:', err); }
}

async function cargarEmpresas() {
    const select = document.getElementById('empresa_ref');
    if (!select) return;
    try {
        const res = await fetch('/api/v1/empresas', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const result = await res.json();
        const list = result.data || result;
        select.innerHTML = '<option value="0" disabled selected>-- SELECCIONAR EMPRESA --</option>';
        list
            .sort((a, b) => a.nombre.localeCompare(b.nombre))
            .forEach(e => {
                select.innerHTML += `<option value="${e.id}">${e.nombre.toUpperCase()}</option>`;
            });
    } catch (err) { console.error('❌ Error empresas:', err); }
}


// ════════════════════════════════════════════════════════════════════
// HELPERS DE ASIGNACIÓN
// ════════════════════════════════════════════════════════════════════

function toInputDate(val) {
    if (!val) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
    if (val.includes('T')) return val.split('T')[0];
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(val)) {
        const [d, m, y] = val.split('/');
        return `${y}-${m}-${d}`;
    }
    try {
        const p = new Date(val);
        if (!isNaN(p)) return p.toISOString().split('T')[0];
    } catch (_) {}
    return '';
}

function setInputDate(id, val) {
    const el = document.getElementById(id);
    if (el && el.type === 'date') el.value = toInputDate(val);
}

function toInputTime(val) {
    if (!val) return '';
    let t = val;
    if (t.includes('T')) t = t.split('T')[1];
    else if (t.includes(' ')) t = t.split(' ')[1];
    const clean = t.substring(0, 5);
    return (clean === '--:--' || clean === '') ? '' : clean;
}

function setInputTime(id, val) {
    const el = document.getElementById(id);
    if (el && el.type === 'time') el.value = toInputTime(val);
}

function setSelectVal(id, val) {
    if (val === null || val === undefined) return;
    const el = document.getElementById(id);
    if (!el) return;
    const strVal = String(val);
    const opt = Array.from(el.options).find(o => o.value === strVal);
    if (opt) el.value = strVal;
    else console.warn(`[CLONADOR] setSelectVal: opción "${strVal}" no encontrada en #${id}`);
}

function setCheckbox(id, val) {
    const el = document.getElementById(id);
    if (!el || el.type !== 'checkbox') return;
    el.checked = (val === true || val === 1 || val === '1' || val === 'true');
}

function showUIStatus(msg, type) {
    const el = document.getElementById('statusMessage');
    if (!el) return;
    el.className = `mt-8 p-5 rounded-2xl text-center font-black w-full max-w-2xl border-2 uppercase text-xs tracking-widest block shadow-lg ${
        type === 'success'
            ? 'bg-green-100 text-green-700 border-green-500'
            : 'bg-red-100 text-red-700 border-red-500'
    }`;
    el.textContent = msg;
    el.classList.remove('hidden');
}

function initCalculosKms() {
    const v1  = document.querySelector('input[name="km_ini"]');
    const v2  = document.querySelector('input[name="km_fin"]');
    const tot = document.querySelector('input[name="km_totales"]');
    const calc = () => {
        if (v1 && v2 && tot)
            tot.value = Math.max(0, (parseFloat(v2.value) || 0) - (parseFloat(v1.value) || 0)).toFixed(2);
    };
    v1?.addEventListener('input', calc);
    v2?.addEventListener('input', calc);
}