/**
 * ARCHIVO: static/js/admin_albaran_cargar.js
 * ACTUALIZADO: 26/05/2026 - FIX DEFINITIVO
 *
 * El backend devuelve horas como "2026-05-26T05:16:00+02:00"
 * Ya viene en hora Madrid con offset explícito → extraemos HH:mm tras la T directamente.
 * No usamos new Date() para horas → evita cualquier conversión de zona horaria.
 */

function populateForm(data) {
    if (!data) return;
    console.log("📦 [ADMIN MAPPER] Procesando albarán:", data);

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
     * Casos:
     *   "2026-05-26T05:16:00+02:00" → indexOf('T')=10 → substring(11,16) → "05:16" ✅
     *   "05:16:00"                  → no tiene T → substring(0,5) → "05:16" ✅
     *   "05:16"                     → no tiene T → substring(0,5) → "05:16" ✅
     */
    const extractTimeForInput = (timeStr) => {
        if (!timeStr) return "";
        if (typeof timeStr === 'string') {
            const tIdx = timeStr.indexOf('T');
            if (tIdx !== -1) {
                // ISO con T: extraemos los 5 chars tras la T
                return timeStr.substring(tIdx + 1, tIdx + 6);
            }
            // Sin T: "HH:mm:ss" o "HH:mm"
            return timeStr.substring(0, 5);
        }
        return "";
    };

    const formatTimeDisplay = (t) => extractTimeForInput(t) || "--:--";

    const setVal = (id, value, isDate = false, isTime = false) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) {
            if (el.type === 'date') { el.value = value ? value.split('T')[0] : ''; return; }
            if (el.type === 'time' || isTime) { el.value = extractTimeForInput(value); return; }
            if (isDate && value) { el.value = value.split('T')[0]; }
            else { el.value = (value !== null && value !== undefined && value !== '') ? value : ''; }
        } else {
            let display = (value !== null && value !== undefined && value !== '') ? value : "-";
            if (isDate && value) display = formatEuroDate(value);
            if (isTime && value) display = formatTimeDisplay(value);
            el.textContent = display;
        }
    };

    const setCheck = (id, val) => { const el = document.getElementById(id); if (el) el.checked = !!val; };

    // 1. CABECERA E IDs
    const hiddenId = document.getElementById('albaran_id');
    if (hiddenId) hiddenId.value = data.id || data.ID || '';
    setVal('header_num', `#${data.numero_albaran}`);
    setVal('licencia_ref', data.licencia_ref);
    setVal('n_albaran', data.numero_albaran);
    setVal('fecha', data.fecha, true);
    setVal('hora_ini', data.hora_ini, false, true);
    setVal('hora_fin', data.hora_fin, false, true);

    // 2. FACTURACIÓN
    const empresaSelect = document.getElementById('empresa');
    if (empresaSelect && data.empresa_ref) empresaSelect.value = data.empresa_ref;
    setVal('nombre_pasajero', data.cliente || data.nombre_pasajero);
    setVal('tlf_pasajero', data.tlf_pasajero);
    setVal('dni_pasajero', data.dni_pasajero);
    setVal('matricula', data.matricula);

    // 3. ITINERARIO
    setVal('origen', data.origen);
    setVal('parada', data.parada);
    setVal('destino', data.destino);
    setVal('referencia', data.referencia);
    setVal('espera_ini', data.espera_ini, false, true);
    setVal('espera_fin', data.espera_fin, false, true);

    // 4. KILOMETRAJE
    setVal('km_ini', data.km_ini);
    setVal('km_fin', data.km_fin);
    setVal('km_totales', data.km_totales);
    setCheck('urbano', data.urbano);
    setCheck('diurno', data.diurno);
    setCheck('noct_fest', data.noct_fest);
    setCheck('remolque', data.remolque);
    const plazasEl = document.getElementById('num_plazas');
    if (plazasEl && data.num_plazas) plazasEl.value = data.num_plazas;

    // 5. ECONOMÍA
    setVal('asalariado', data.asalariado);
    setVal('autorizado_por', data.autorizado_por);
    const suplEl = document.getElementById('importe_suplidos');
    if (suplEl) suplEl.value = (parseFloat(data.importe_suplidos) || 0).toFixed(2);
    const totalEl = document.getElementById('importe_total');
    if (totalEl) totalEl.value = (parseFloat(data.importe_total) || 0).toFixed(2);

    // 6. ADMIN EXCLUSIVO
    setVal('num_factura', data.num_factura);
    setVal('fecha_cobro', data.fecha_cobro, true);
    setCheck('cobrado', data.cobrado);
    setCheck('pagado', data.pagado);
    setCheck('finalizado', data.finalizado);
    setCheck('festivo', data.festivo);
    setVal('observaciones', data.observaciones);

    // 7. BADGES KM
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
    syncBadge('urbano_val', data.urbano);
    syncBadge('diurno_val', data.diurno);
    syncBadge('noct_fest_val', data.noct_fest);
    syncBadge('remolque_val', data.remolque);

    // 8. BADGES ESTADO
    const statusContainer = document.getElementById('status_badges_container');
    if (statusContainer) {
        statusContainer.innerHTML = '';
        const hasFactura = data.num_factura && data.num_factura !== '-';
        statusContainer.innerHTML += `<div class="badge-status ${hasFactura ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-slate-100 text-slate-400 border-slate-200'}"><i data-lucide="${hasFactura ? 'file-check' : 'file-minus'}" class="w-3 h-3"></i> ${hasFactura ? 'FACTURADO' : 'NO FACTURADO'}</div>`;
        const hasCobro = data.fecha_cobro;
        statusContainer.innerHTML += `<div class="badge-status ${hasCobro ? 'bg-green-100 text-green-700 border-green-200' : 'bg-orange-100 text-orange-700 border-orange-200'}"><i data-lucide="${hasCobro ? 'check-circle' : 'clock'}" class="w-3 h-3"></i> ${hasCobro ? 'COBRADO' : 'PENDIENTE COBRO'}</div>`;
    }

    if (window.lucide) lucide.createIcons();
    console.log("✅ [ADMIN MAPPER] hora_ini:", extractTimeForInput(data.hora_ini), "| hora_fin:", extractTimeForInput(data.hora_fin));
}

window.populateForm = populateForm;
window.AlbaranLoader = { populateForm };