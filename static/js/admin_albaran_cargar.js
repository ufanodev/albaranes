/**
 * ARCHIVO: static/js/admin_albaran_cargar.js
 * ACTUALIZADO: 17/11/2026
 *   - Vista y edición comparten el MISMO HTML; este mapper rellena ambos.
 *     En vista (body[data-mode="view"]) los date/time se convierten a texto
 *     y se muestran como dd/mm/yyyy y HH:mm.
 *   - ADD: km_nacionales, km_internacionales, adjuntos.
 *   - FIX: num_plazas no se cargaba (el <select> no tenía id).
 *   - FIX: km_* se formatean siempre a 2 decimales.
 *   - FIX: lectura tolerante de claves (snake_case, camelCase, PascalCase)
 *          por si el JSON de Go no lleva tags.
 *   - FIX: booleanos tinyint: 0/1, "0"/"1", true/false ("0" ya no cuenta como true).
 *   - FIX: fecha_cobro / fecha_pago se habilitan si cobrado / pagado vienen marcados.
 *   - FIX: empresa / licencia: si la opción no existe aún en el select, se crea.
 *
 * Horas: el backend devuelve "2026-05-26T05:16:00+02:00" (hora Madrid).
 * Se extrae HH:mm tras la T por texto, sin new Date().
 */

function populateForm(data) {
    if (!data) return;
    console.log("📦 [ADMIN MAPPER] Procesando albarán:", data);

    const isView = document.body && document.body.dataset.mode === 'view';

    // ─── Lectura tolerante de claves ────────────────────────────────────────
    const toCamel  = (k) => k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    const toPascal = (k) => { const c = toCamel(k); return c.charAt(0).toUpperCase() + c.slice(1); };
    const get = (...keys) => {
        for (const k of keys) {
            for (const variant of [k, toCamel(k), toPascal(k)]) {
                const v = data[variant];
                if (v !== undefined && v !== null) return v;
            }
        }
        return null;
    };

    // ─── Helpers de formato ─────────────────────────────────────────────────
    const isZeroDate = (s) => !s || typeof s !== 'string' || s.startsWith('0001');

    const formatEuroDate = (isoStr) => {
        if (isZeroDate(isoStr)) return '';
        const m = isoStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
        return m ? `${m[3]}/${m[2]}/${m[1]}` : isoStr;
    };

    const isoDate = (isoStr) => isZeroDate(isoStr) ? '' : isoStr.substring(0, 10);

    const extractTime = (timeStr) => {
        if (!timeStr || typeof timeStr !== 'string') return '';
        const tIdx = timeStr.indexOf('T');
        if (tIdx !== -1) return timeStr.substring(tIdx + 1, tIdx + 6);
        return timeStr.substring(0, 5);
    };

    const toBool = (v) => v === true || v === 1 || v === '1' || v === 'true' || v === 'on';

    const toDec = (v) => {
        if (v === null || v === undefined || v === '') return '';
        const n = parseFloat(String(v).replace(',', '.'));
        return isNaN(n) ? '' : n.toFixed(2);
    };

    // Primer valor no vacío (para etiquetas de los combos)
    const firstText = (...vals) => vals.find(v => v !== null && v !== undefined && String(v).trim() !== '') ?? '';
    const lic = data.licencia_data || data.LicenciaData || {};
    const emp = data.empresa_data  || data.EmpresaData  || {};

    // ─── Setters ────────────────────────────────────────────────────────────
    const $ = (id) => document.getElementById(id);

    const setText = (id, value) => {
        const el = $(id);
        if (!el) return;
        el.value = (value !== null && value !== undefined) ? value : '';
    };

    // Fecha: <input type="date"> → yyyy-mm-dd ; texto (vista) → dd/mm/yyyy
    const setDate = (id, value) => {
        const el = $(id);
        if (!el) return;
        el.value = el.type === 'date' ? isoDate(value) : formatEuroDate(value);
    };

    const setTime = (id, value) => {
        const el = $(id);
        if (el) el.value = extractTime(value);
    };

    const setNum = (id, value) => {
        const el = $(id);
        if (el) el.value = toDec(value);
    };

    const setCheck = (id, value) => {
        const el = $(id);
        if (el) el.checked = toBool(value);
    };

    // Selecciona un valor en un <select>; si la opción no existe la crea.
    const setSelect = (id, value, label) => {
        const el = $(id);
        if (!el || value === null || value === undefined || value === '') return;
        const val = String(value);
        el.dataset.selected = val; // por si otro script recarga las opciones después
        let opt = Array.from(el.options).find(o => o.value === val);
        if (!opt) {
            opt = new Option(label || val, val);
            el.add(opt);
        }
        el.value = val;
    };

    // ─── 1. CABECERA / CONTROL ──────────────────────────────────────────────
    setText('albaran_id', get('id', 'ID'));
    const headerNum = $('header_num');
    if (headerNum) headerNum.textContent = `#${get('numero_albaran') ?? ''}`;

    setSelect('licencia_ref', get('licencia_ref'),
              String(firstText(lic.licencia, lic.Licencia, get('licencia'))).toUpperCase());
    setText('n_albaran', get('numero_albaran'));
    setDate('fecha',     get('fecha'));
    setTime('hora_ini',  get('hora_ini'));
    setTime('hora_fin',  get('hora_fin'));

    // ─── 2. FACTURACIÓN / CLIENTE ───────────────────────────────────────────
    setSelect('empresa', get('empresa_ref'),
              String(firstText(emp.nombre, emp.Nombre, get('empresa_nombre'))).toUpperCase());
    setText('nombre_pasajero', get('nombre_pasajero', 'cliente'));
    setText('tlf_pasajero',    get('tlf_pasajero'));
    setText('dni_pasajero',    get('dni_pasajero'));
    setText('matricula',       get('matricula'));

    // ─── 3. ITINERARIO ──────────────────────────────────────────────────────
    setText('origen',     get('origen'));
    setText('parada',     get('parada'));
    setText('destino',    get('destino'));
    setText('referencia', get('referencia'));
    setTime('espera_ini', get('espera_ini'));
    setTime('espera_fin', get('espera_fin'));

    const horaTotal = parseInt(get('hora_total'), 10) || 0;
    setText('hora_total', horaTotal > 0 ? horaTotal : (isView ? '0' : ''));

    // ─── 4. KILOMETRAJE ─────────────────────────────────────────────────────
    setNum('km_ini',             get('km_ini'));
    setNum('km_fin',             get('km_fin'));
    setNum('km_totales',         get('km_totales'));
    setNum('km_nacionales',      get('km_nacionales'));
    setNum('km_internacionales', get('km_internacionales'));

    const plazas = parseInt(get('num_plazas', 'plazas'), 10);
    if (plazas > 0) setSelect('num_plazas', plazas, `${plazas} Plazas`);

    setCheck('urbano',    get('urbano'));
    setCheck('diurno',    get('diurno'));
    setCheck('noct_fest', get('noct_fest'));
    setCheck('remolque',  get('remolque'));

    // ─── 5. ECONOMÍA ────────────────────────────────────────────────────────
    setText('asalariado',     get('asalariado'));
    setText('autorizado_por', get('autorizado_por'));
    $('importe_suplidos') && ($('importe_suplidos').value = toDec(get('importe_suplidos')) || '0.00');
    $('importe_total')    && ($('importe_total').value    = toDec(get('importe_total'))    || '0.00');

    // ─── 6. ADMINISTRACIÓN ──────────────────────────────────────────────────
    setText('num_factura', get('num_factura'));
    setCheck('cobrado',    get('cobrado'));
    setCheck('pagado',     get('pagado'));
    setCheck('finalizado', get('finalizado'));
    setCheck('adjuntos',   get('adjuntos'));
    setText('adjuntos_ref', get('adjuntos_ref'));
    setDate('fecha_cobro', get('fecha_cobro'));
    setDate('fecha_pago',  get('fecha_pago'));

    // En edición: la fecha va habilitada si su checkbox está marcado
    if (!isView) {
        // (admin_albaran_update.js vuelve a sincronizar con syncFechasFacturacion)
        const syncFecha = (chkId, fechaId) => {
            const chk = $(chkId), f = $(fechaId);
            if (chk && f) f.disabled = !chk.checked;
        };
        syncFecha('cobrado', 'fecha_cobro');
        syncFecha('pagado',  'fecha_pago');
    }

    // Observaciones
    setText('observaciones', get('observaciones'));

    if (window.lucide) lucide.createIcons();

    console.log("✅ [ADMIN MAPPER] km:", get('km_ini'), get('km_fin'), get('km_totales'),
                get('km_nacionales'), get('km_internacionales'),
                "| plazas:", get('num_plazas'), "| adjuntos:", get('adjuntos'));
}

window.populateForm  = populateForm;
window.AlbaranLoader = { populateForm };