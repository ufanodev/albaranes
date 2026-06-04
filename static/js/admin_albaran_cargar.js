/**
 * ARCHIVO: static/js/admin_albaran_cargar.js
 * ACTUALIZADO: 04/06/2026
 *
 * El backend devuelve horas como "2026-05-26T05:16:00+02:00"
 * Ya viene en hora Madrid con offset explícito → extraemos HH:mm tras la T directamente.
 * No usamos new Date() para horas → evita cualquier conversión de zona horaria.
 *
 * CAMBIOS:
 *   - ADD: hora_total (minutos totales de espera, entero)
 *   - ADD: fecha_pago en sección 6
 *   - ADD: renderBadge para cobrado, pagado, finalizado (nuevos IDs del HTML)
 *   - FIX: eliminada referencia a status_badges_container (ya no existe en el HTML)
 *   - FIX: empresa_nombre_view para vista de solo lectura
 */

function populateForm(data) {
    if (!data) return;
    console.log("📦 [ADMIN MAPPER] Procesando albarán:", data);

    // ─── Helpers ────────────────────────────────────────────────────────────

    const formatEuroDate = (isoStr) => {
        if (!isoStr) return "-";
        try {
            const cleanDate = isoStr.split('T')[0];
            const d = new Date(cleanDate);
            if (isNaN(d.getTime())) return isoStr;
            return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch (e) { return "-"; }
    };

    /**
     * FIX DEFINITIVO: El backend devuelve "2026-05-26T05:16:00+02:00"
     * La hora tras la T ya es hora Madrid → extraemos HH:mm sin conversión.
     *   "2026-05-26T05:16:00+02:00" → "05:16" ✅
     *   "05:16:00"                  → "05:16" ✅
     *   "05:16"                     → "05:16" ✅
     */
    const extractTimeForInput = (timeStr) => {
        if (!timeStr) return "";
        if (typeof timeStr === 'string') {
            const tIdx = timeStr.indexOf('T');
            if (tIdx !== -1) return timeStr.substring(tIdx + 1, tIdx + 6);
            return timeStr.substring(0, 5);
        }
        return "";
    };

    const formatTimeDisplay = (t) => extractTimeForInput(t) || "--:--";

    const setVal = (id, value, isDate = false, isTime = false) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) {
            if (el.type === 'date')  { el.value = value ? value.split('T')[0] : ''; return; }
            if (el.type === 'time' || isTime) { el.value = extractTimeForInput(value); return; }
            if (isDate && value)     { el.value = value.split('T')[0]; }
            else                     { el.value = (value !== null && value !== undefined && value !== '') ? value : ''; }
        } else {
            let display = (value !== null && value !== undefined && value !== '') ? value : "-";
            if (isDate && value) display = formatEuroDate(value);
            if (isTime && value) display = formatTimeDisplay(value);
            el.textContent = display;
        }
    };

    const setCheck = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.checked = !!val;
    };

    /**
     * Badge de estado activo/inactivo para cobrado, pagado, finalizado.
     * Busca el elemento por id y le aplica clases según color y estado.
     */
    const renderBadge = (id, activo, label, color) => {
        const el = document.getElementById(id);
        if (!el) return;
        const palettes = {
            blue:  { on: 'border-blue-400 bg-blue-100 text-blue-800',   off: 'border-slate-200 bg-slate-100 text-slate-400' },
            green: { on: 'border-green-400 bg-green-100 text-green-800', off: 'border-slate-200 bg-slate-100 text-slate-400' },
            teal:  { on: 'border-teal-400 bg-teal-100 text-teal-800',   off: 'border-slate-200 bg-slate-100 text-slate-400' },
        };
        const p = palettes[color] || palettes.blue;
        const icon = activo ? 'check-circle-2' : 'circle';
        el.className = `badge-status ${activo ? p.on : p.off}`;
        el.innerHTML = `<i data-lucide="${icon}" class="w-4 h-4"></i> ${label}`;
    };

    // ─── 1. CABECERA E IDs ───────────────────────────────────────────────────

    const hiddenId = document.getElementById('albaran_id');
    if (hiddenId) hiddenId.value = data.id || data.ID || '';

    setVal('header_num', `#${data.numero_albaran}`);
    setVal('licencia_ref', data.licencia_ref);
    setVal('n_albaran',   data.numero_albaran);
    setVal('fecha',       data.fecha, true);
    setVal('hora_ini',    data.hora_ini,  false, true);
    setVal('hora_fin',    data.hora_fin,  false, true);

    // ─── 2. CLIENTE / FACTURACIÓN ────────────────────────────────────────────

    // Select editable (update)
    const empresaSelect = document.getElementById('empresa');
    if (empresaSelect && data.empresa_ref) empresaSelect.value = data.empresa_ref;

    // Input de solo lectura (vista)
    const empresaView = document.getElementById('empresa_nombre_view');
    if (empresaView) empresaView.value = data.empresa_nombre || data.empresa || '';

    setVal('nombre_pasajero', data.cliente || data.nombre_pasajero);
    setVal('tlf_pasajero',    data.tlf_pasajero);
    setVal('dni_pasajero',    data.dni_pasajero);
    setVal('matricula',       data.matricula);

    // ─── 3. ITINERARIO ───────────────────────────────────────────────────────

    setVal('origen',     data.origen);
    setVal('parada',     data.parada);
    setVal('destino',    data.destino);
    setVal('referencia', data.referencia);
    setVal('espera_ini', data.espera_ini, false, true);
    setVal('espera_fin', data.espera_fin, false, true);

    // hora_total: entero (minutos). Si es 0 o null mostramos vacío en edición, "—" en vista.
    const horaTotalEl = document.getElementById('hora_total');
    if (horaTotalEl) {
        const val = parseInt(data.hora_total) || 0;
        horaTotalEl.value = val > 0 ? val : '';
    }

    // ─── 4. KILOMETRAJE ──────────────────────────────────────────────────────

    setVal('km_ini',     data.km_ini);
    setVal('km_fin',     data.km_fin);
    setVal('km_totales', data.km_totales);

    setCheck('urbano',    data.urbano);
    setCheck('diurno',    data.diurno);
    setCheck('noct_fest', data.noct_fest);
    setCheck('remolque',  data.remolque);

    const plazasEl = document.getElementById('num_plazas');
    if (plazasEl && data.num_plazas) plazasEl.value = data.num_plazas;

    // Badges visuales de tipo de servicio (sección 4 de la vista)
    const syncBadge = (id, active) => {
        const el = document.getElementById(id);
        if (!el) return;
        const p = el.parentElement;
        if (active) {
            p.classList.add('bg-orange-100', 'border-orange-300', 'text-orange-700', 'opacity-100');
            p.classList.remove('bg-slate-100', 'opacity-80');
        } else {
            p.classList.remove('bg-orange-100', 'border-orange-300', 'text-orange-700', 'opacity-100');
            p.classList.add('bg-slate-100', 'opacity-80');
        }
    };
    syncBadge('urbano_val',    data.urbano);
    syncBadge('diurno_val',    data.diurno);
    syncBadge('noct_fest_val', data.noct_fest);
    syncBadge('remolque_val',  data.remolque);

    // ─── 5. ECONOMÍA ─────────────────────────────────────────────────────────

    setVal('asalariado',    data.asalariado);
    setVal('autorizado_por',data.autorizado_por);

    const suplEl = document.getElementById('importe_suplidos');
    if (suplEl) suplEl.value = (parseFloat(data.importe_suplidos) || 0).toFixed(2);

    // Importe total: input en update, span en vista
    const totalInput = document.getElementById('importe_total');
    if (totalInput) totalInput.value = (parseFloat(data.importe_total) || 0).toFixed(2);
    const totalView = document.getElementById('importe_total_view');
    if (totalView) totalView.textContent = (parseFloat(data.importe_total) || 0).toFixed(2);

    // ─── 6. ADMIN EXCLUSIVO ──────────────────────────────────────────────────

    // Nº Factura: input en update, div en vista
    setVal('num_factura',      data.num_factura);
    const numFactView = document.getElementById('num_factura_view');
    if (numFactView) numFactView.textContent = data.num_factura || '—';

    // Fecha cobro: input date en update, div en vista
    const fechaCobroInput = document.getElementById('fecha_cobro');
    if (fechaCobroInput && fechaCobroInput.tagName === 'INPUT') {
        fechaCobroInput.value = data.fecha_cobro ? data.fecha_cobro.split('T')[0] : '';
    }
    const fechaCobroView = document.getElementById('fecha_cobro_view');
    if (fechaCobroView) fechaCobroView.textContent = data.fecha_cobro ? formatEuroDate(data.fecha_cobro) : '—';

    // Fecha pago: input date en update, div en vista
    const fechaPagoInput = document.getElementById('fecha_pago');
    if (fechaPagoInput && fechaPagoInput.tagName === 'INPUT') {
        fechaPagoInput.value = data.fecha_pago ? data.fecha_pago.split('T')[0] : '';
    }
    const fechaPagoView = document.getElementById('fecha_pago_view');
    if (fechaPagoView) fechaPagoView.textContent = data.fecha_pago ? formatEuroDate(data.fecha_pago) : '—';

    // Checkboxes (update)
    setCheck('cobrado',   data.cobrado);
    setCheck('pagado',    data.pagado);
    setCheck('finalizado',data.finalizado);

    // Badges de estado (vista)
    renderBadge('badge_cobrado',    data.cobrado,    'Cobrado (Empresa)',  'blue');
    renderBadge('badge_pagado',     data.pagado,     'Pagado (Conductor)', 'green');
    renderBadge('badge_finalizado', data.finalizado, 'Servicio Cerrado',   'teal');

    // Observaciones
    setVal('observaciones',      data.observaciones);
    const obsView = document.getElementById('observaciones_view');
    if (obsView) obsView.textContent = data.observaciones || '—';

    // ─── Fin ─────────────────────────────────────────────────────────────────

    if (window.lucide) lucide.createIcons();

    console.log("✅ [ADMIN MAPPER] hora_ini:", extractTimeForInput(data.hora_ini),
                "| hora_fin:", extractTimeForInput(data.hora_fin),
                "| hora_total:", data.hora_total);
}

window.populateForm  = populateForm;
window.AlbaranLoader = { populateForm };