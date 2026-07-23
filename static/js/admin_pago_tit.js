/**
 * ARCHIVO: static/js/admin_pago_tit.js
 * ACTUALIZADO: 24/06/2026
 *   - FIX: isBlank() corregido — pagado por defecto no bloquea el guardado
 *   - FIX: render() no duplica la opción cabecera
 *   - FIX: tableFooter como <div> fuera de la tabla
 *   - FIX: pageSize "Mostrar Todo" usa filteredData.length real, no 99999
 *   - FIX: loadData() pagina la API en lotes de API_BATCH (500) en paralelo
 *   - FIX: totalServer detecta total_albaranes / total / count según API
 *   - FIX: cálculo de totalPages usa API_BATCH, no data.length (evita bug última página)
 *   - FIX: logs debug en consola para diagnosticar respuesta de la API
 */

'use strict';

const STATE = {
    allData: [],
    filteredData: [],
    currentPage: 1,
    pageSize: 25,
    sortKey: 'fecha',
    sortDir: 'desc',
    searchMode: 'campos',
    showAll: false
};

/* ═══════════════════════ HISTORIAL ═══════════════════════ */

const HISTORY_KEY = 'pago_tit_search_history';
const HISTORY_MAX = 15;

const SearchHistory = {
    load() {
        try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
        catch { return []; }
    },
    save(list) {
        try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list)); }
        catch {}
    },
    capture() {
        return {
            ts         : Date.now(),
            mode       : STATE.searchMode,
            licencia   : document.getElementById('licenciaSelect')?.value || '',
            empresa    : document.getElementById('empresa')?.value        || '',
            pagado     : document.getElementById('pagado')?.value         ?? 'false',
            referencia : document.getElementById('referencia')?.value     || '',
            fecha_desde: document.getElementById('fecha_desde')?.value    || '',
            fecha_hasta: document.getElementById('fecha_hasta')?.value    || '',
            palabra    : document.getElementById('palabra')?.value         || '',

            // Filtros avanzados
            matricula        : document.getElementById('matricula')?.value         || '',
            num_factura      : document.getElementById('num_factura')?.value       || '',
            cobrado          : document.getElementById('cobrado')?.value           || '',
            fecha_pago_desde : document.getElementById('fecha_pago_desde')?.value  || '',
            fecha_pago_hasta : document.getElementById('fecha_pago_hasta')?.value  || '',
            fecha_cobro_desde: document.getElementById('fecha_cobro_desde')?.value || '',
            fecha_cobro_hasta: document.getElementById('fecha_cobro_hasta')?.value || ''
        };
    },
    isBlank(snap) {
        if (snap.mode === 'palabra') return !snap.palabra.trim();
        return (
            !snap.licencia    &&
            !snap.empresa     &&
            !snap.referencia  &&
            !snap.fecha_desde &&
            !snap.fecha_hasta &&
            snap.pagado === '' &&
            !snap.matricula && !snap.num_factura && !snap.cobrado &&
            !snap.fecha_pago_desde && !snap.fecha_pago_hasta &&
            !snap.fecha_cobro_desde && !snap.fecha_cobro_hasta
        );
    },
    _sameFilters(a, b) {
        return a.mode === b.mode && a.licencia === b.licencia && a.empresa === b.empresa &&
               a.pagado === b.pagado && a.referencia === b.referencia &&
               a.fecha_desde === b.fecha_desde && a.fecha_hasta === b.fecha_hasta && a.palabra === b.palabra &&
               a.matricula === b.matricula && a.num_factura === b.num_factura && a.cobrado === b.cobrado &&
               a.fecha_pago_desde === b.fecha_pago_desde && a.fecha_pago_hasta === b.fecha_pago_hasta &&
               a.fecha_cobro_desde === b.fecha_cobro_desde && a.fecha_cobro_hasta === b.fecha_cobro_hasta;
    },
    push(snap) {
        if (this.isBlank(snap)) return;
        let list = this.load();
        list = list.filter(e => !this._sameFilters(e, snap));
        list.unshift(snap);
        if (list.length > HISTORY_MAX) list = list.slice(0, HISTORY_MAX);
        this.save(list);
        HistoryUI.render();
    },
    remove(index) { const list = this.load(); list.splice(index, 1); this.save(list); HistoryUI.render(); },
    clear() { this.save([]); HistoryUI.render(); }
};

function _histLabel(item) {
    const d  = new Date(item.ts);
    const hm = String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
    if (item.mode === 'palabra' && item.palabra) return `${hm} · BÚSQ: ${item.palabra.toUpperCase().substring(0,30)}`;
    const parts = [];
    if (item.licencia)           parts.push(`LIC ${item.licencia}`);
    if (item.empresa)            parts.push(item.empresa.substring(0,20).toUpperCase());
    if (item.pagado === 'false') parts.push('PENDIENTES');
    if (item.pagado === 'true')  parts.push('PAGADOS');
    if (item.referencia)         parts.push(`EXP:${item.referencia}`);
    if (item.fecha_desde)        parts.push(`D:${item.fecha_desde.substring(5)}`);
    if (item.fecha_hasta)        parts.push(`H:${item.fecha_hasta.substring(5)}`);
    if (item.matricula)          parts.push(`MAT:${item.matricula.toUpperCase()}`);
    if (item.num_factura)        parts.push(`FAC:${item.num_factura}`);
    if (item.cobrado === 'true')  parts.push('COBRADO EMP.');
    if (item.cobrado === 'false') parts.push('NO COBRADO EMP.');
    return `${hm} · ${parts.length ? parts.join(' · ') : 'FILTRO: MANUAL'}`;
}

const HistoryUI = {
    render() {
        const sel = document.getElementById('histSelect');
        if (!sel) return;
        const list = SearchHistory.load();
        sel.innerHTML = '';
        const hdr = document.createElement('option');
        hdr.value = '__hdr__';
        hdr.text  = list.length ? `🕐 BÚSQUEDAS RECIENTES (${list.length})` : '🕐 BÚSQUEDAS RECIENTES';
        hdr.selected = true;
        sel.appendChild(hdr);
        if (list.length === 0) {
            const emp = document.createElement('option');
            emp.value = '__empty__'; emp.text = '  — Sin búsquedas guardadas —'; emp.disabled = true;
            sel.appendChild(emp); return;
        }
        list.forEach((item, i) => {
            const opt = document.createElement('option');
            opt.value = String(i); opt.text = _histLabel(item); sel.appendChild(opt);
        });
        const sep = document.createElement('option');
        sep.value = '__sep__'; sep.text = '─────────────────────────────'; sep.disabled = true;
        sel.appendChild(sep);
        const clr = document.createElement('option');
        clr.value = '__clear__'; clr.text = '🗑  Borrar historial'; sel.appendChild(clr);
    },
    onSelectChange(sel) {
        const val = sel.value;
        if (!val || val === '__hdr__' || val === '__empty__' || val === '__sep__') return;
        if (val === '__clear__') { SearchHistory.clear(); sel.selectedIndex = 0; return; }
        const list = SearchHistory.load();
        const snap = list[parseInt(val, 10)];
        if (!snap) { sel.selectedIndex = 0; return; }
        UI_PAGOS.setSearchModeManual(snap.mode);
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
        set('licenciaSelect', snap.licencia); set('empresa', snap.empresa); set('pagado', snap.pagado);
        set('referencia', snap.referencia);   set('fecha_desde', snap.fecha_desde);
        set('fecha_hasta', snap.fecha_hasta); set('palabra', snap.palabra);

        // Filtros avanzados
        set('matricula', snap.matricula);
        set('num_factura', snap.num_factura);
        set('cobrado', snap.cobrado);
        set('fecha_pago_desde', snap.fecha_pago_desde);
        set('fecha_pago_hasta', snap.fecha_pago_hasta);
        set('fecha_cobro_desde', snap.fecha_cobro_desde);
        set('fecha_cobro_hasta', snap.fecha_cobro_hasta);

        sel.selectedIndex = 0;
        window.handleSearch();
    }
};

window.SearchHistory = SearchHistory;
window.HistoryUI     = HistoryUI;

/* ═══════════════════════ UI PAGOS ═══════════════════════ */

const UI_PAGOS = {
    formatDate(iso) {
        if (!iso || iso.startsWith('0001')) return '-';
        return iso.substring(0, 10);
    },
    boolIcon(val) {
        return (val === true || val === 1 || val === '1')
            ? '<span class="text-green-500 font-black text-base">✅</span>'
            : '<span class="text-red-400 font-black text-base">✗</span>';
    },
    alertMessage(message, type = 'info') {
        const s = document.getElementById('statusMessage');
        if (!s) return;
        s.textContent = message;
        const cls = type === 'success' ? 'border-green-500 text-green-600'
                  : type === 'error'   ? 'border-red-500 text-red-600'
                                       : 'border-blue-400 text-blue-600';
        s.className = `fixed bottom-5 right-5 z-[2000] p-4 rounded-xl shadow-2xl border-2 bg-white font-black text-xs uppercase tracking-widest ${cls}`;
        s.classList.remove('hidden');
        setTimeout(() => s.classList.add('hidden'), 5000);
    },
    updateSelectionUI() {
        const all     = Array.from(document.querySelectorAll('.cb-seleccion:not(:disabled)'));
        const checked = all.filter(cb => cb.checked);
        const counter = document.getElementById('selectedCount');
        const cbAll   = document.getElementById('cb-select-all');
        if (checked.length > 0) {
            counter.textContent = `${checked.length} seleccionado${checked.length > 1 ? 's' : ''}`;
            counter.classList.remove('hidden');
        } else {
            counter.classList.add('hidden');
        }
        if (cbAll) {
            cbAll.checked       = all.length > 0 && checked.length === all.length;
            cbAll.indeterminate = checked.length > 0 && checked.length < all.length;
        }
    },
    setSearchModeManual(mode) {
        STATE.searchMode = mode;
        const pSec = document.getElementById('palabraSection');
        const cSec = document.getElementById('camposSection');
        const btnC = document.getElementById('btn-mode-campos');
        const btnP = document.getElementById('btn-mode-palabra');
        const ON  = 'px-4 py-2 rounded-lg bg-primary-link text-white font-black text-[10px] uppercase shadow-md transition-all';
        const OFF = 'px-4 py-2 rounded-lg bg-white text-slate-400 font-black text-[10px] border uppercase transition-all';
        if (mode === 'palabra') {
            pSec?.classList.remove('hidden'); cSec?.classList.add('hidden');
            if (btnP) btnP.className = ON; if (btnC) btnC.className = OFF;
            document.getElementById('palabra')?.focus();
        } else {
            pSec?.classList.add('hidden'); cSec?.classList.remove('hidden');
            if (btnC) btnC.className = ON; if (btnP) btnP.className = OFF;
        }
    }
};

window.UI_PAGOS = UI_PAGOS;

window.handleSelectAll = (masterCb, event) => {
    if (event) event.stopPropagation();
    document.querySelectorAll('.cb-seleccion:not(:disabled)').forEach(cb => { cb.checked = masterCb.checked; });
    UI_PAGOS.updateSelectionUI();
};

/* ═══════════════════════ FILTROS AVANZADOS POR URL ═══════════════════════
 * Llegan desde /admin/busqueda_avanzada?destino=pago_tit como query params.
 * ═══════════════════════════════════════════════════════════════════════ */

function applyURLParamsToUI() {
    const qs = new URLSearchParams(window.location.search);
    if ([...qs.keys()].length === 0) return false;

    if (window.UI_PAGOS) UI_PAGOS.setSearchModeManual('campos');

    const setById = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };

    if (qs.has('licencia')) setById('licenciaSelect', qs.get('licencia'));
    if (qs.has('empresa'))  setById('empresa', qs.get('empresa'));

    const directos = [
        'referencia', 'fecha_desde', 'fecha_hasta', 'pagado',
        'matricula', 'num_factura', 'cobrado',
        'fecha_pago_desde', 'fecha_pago_hasta',
        'fecha_cobro_desde', 'fecha_cobro_hasta'
    ];
    directos.forEach(name => { if (qs.has(name)) setById(name, qs.get(name)); });

    // Limpiamos la URL para que un refresco no repita la búsqueda por sorpresa.
    window.history.replaceState({}, '', window.location.pathname);
    return true;
}

/* ═══════════════════════ INIT ═══════════════════════ */

async function initPagoTit() {
    HistoryUI.render();
    await SearchEngine.initCatalog(true);
    const vieneDeURL = applyURLParamsToUI();
    await loadData(vieneDeURL);
    setupTableEvents();
}

/* ═══════════════════════ DATA ═══════════════════════ */

/**
 * Tamaño de lote por request. 500 cubre la mayoría de APIs sin timeout.
 * Auméntalo a 1000 si tu backend lo permite.
 */
const API_BATCH = 500;

function _setLoadingMsg(msg) {
    const tbody = document.getElementById('albaranResults');
    if (tbody) tbody.innerHTML = `<tr><td colspan="14" class="p-10 text-center italic text-gray-400 animate-pulse font-bold uppercase tracking-widest">${msg}</td></tr>`;
}

async function loadData(forzarHistorial = false) {
    _setLoadingMsg('Sincronizando Liquidaciones...');

    const cbAll = document.getElementById('cb-select-all');
    if (cbAll) { cbAll.checked = false; cbAll.indeterminate = false; }
    document.getElementById('selectedCount')?.classList.add('hidden');

    try {
        const token   = localStorage.getItem('token');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

        // ── PÁGINA 1: SIN filtro cobrado — traer TODOS los albaranes ──
        // Los filtros de estado (creado/enviado/pendiente/pagado) se aplican
        // en handleSearch() client-side según el select "Estatus de Pago".
        const res1  = await fetch(`/api/v1/albaranes/search?pageSize=${API_BATCH}&page=1`, { headers });
        const json1 = await res1.json();

        console.debug('[loadData] Respuesta página 1:', {
            keys     : Object.keys(json1),
            total_alb: json1.total_albaranes,
            total    : json1.total,
            count    : json1.count,
            data_len : (Array.isArray(json1.data) ? json1.data : json1)?.length
        });

        let data = Array.isArray(json1.data) ? json1.data
                 : Array.isArray(json1)       ? json1
                 : [];

        const totalServer = json1.total_albaranes
                         ?? json1.total
                         ?? json1.count
                         ?? json1.total_count
                         ?? json1.totalCount
                         ?? data.length;

        const totalPages = Math.max(1, Math.ceil(totalServer / API_BATCH));

        console.debug(`[loadData] totalServer=${totalServer} | API_BATCH=${API_BATCH} | totalPages=${totalPages}`);

        // ── PÁGINAS 2..N en paralelo ──
        if (totalPages > 1) {
            _setLoadingMsg(`Cargando ${totalServer} registros... (${totalPages} lotes)`);

            const requests = [];
            for (let p = 2; p <= totalPages; p++) {
                const url = `/api/v1/albaranes/search?pageSize=${API_BATCH}&page=${p}`;
                requests.push(
                    fetch(url, { headers })
                        .then(r => r.json())
                        .then(j => {
                            const chunk = Array.isArray(j.data) ? j.data : (Array.isArray(j) ? j : []);
                            console.debug(`[loadData] Página ${p}: ${chunk.length} registros`);
                            return chunk;
                        })
                        .catch(err => { console.error(`[loadData] Error página ${p}:`, err); return []; })
                );
            }

            const chunks = await Promise.all(requests);
            for (const chunk of chunks) data = data.concat(chunk);
        }

        console.debug(`[loadData] TOTAL cargado (antes de deduplicar): ${data.length} albaranes`);

        // ── Deduplicar por id ──
        // Salvaguarda ante respuestas del backend con filas repetidas (p.ej. un
        // JOIN sin DISTINCT que multiplica el albarán por cada conductor/registro
        // relacionado). Si esto se ve activarse a menudo, el problema real está
        // en la consulta SQL de /api/v1/albaranes/search, no aquí.
        const unicos = new Map();
        data.forEach(alb => unicos.set(alb.id, alb));
        const totalAntes = data.length;
        data = Array.from(unicos.values());
        if (data.length !== totalAntes) {
            console.warn(`[loadData] ⚠️ Se detectaron ${totalAntes - data.length} filas duplicadas del backend (deduplicadas por id).`);
        }

        console.debug(`[loadData] TOTAL final: ${data.length} albaranes`);

        // STATE.allData = TODOS los albaranes (2445 en tu caso)
        // El filtro de estado se aplica en handleSearch() según el select del formulario
        STATE.allData = data;

        window.handleSearch(null, { forzarHistorial }); // aplica filtros del formulario y renderiza
    } catch (err) {
        console.error('loadData error:', err);
        _setLoadingMsg('⚠️ Error al conectar con la base de datos');
        UI_PAGOS.alertMessage('Error al conectar con la base de datos', 'error');
    }
}

/* ═══════════════════════ SEARCH ═══════════════════════ */

window.handleSearch = (e, opciones = {}) => {
    if (e) e.preventDefault();
    const { forzarHistorial = false } = opciones;

    const cbAll = document.getElementById('cb-select-all');
    if (cbAll) { cbAll.checked = false; cbAll.indeterminate = false; }
    document.getElementById('selectedCount')?.classList.add('hidden');

    const pagadoVal  = document.getElementById('pagado')?.value  ?? 'false';
    const fechaDesde = document.getElementById('fecha_desde')?.value || '';
    const fechaHasta = document.getElementById('fecha_hasta')?.value || '';

    const params = {
        mode    : STATE.searchMode,
        licencia: document.getElementById('licenciaSelect')?.value || '',
        empresa : document.getElementById('empresa')?.value        || '',
        ref     : document.getElementById('referencia')?.value     || '',
        palabra : document.getElementById('palabra')?.value        || '',

        // Filtros avanzados (los resuelve SearchEngine.applyFilters en search.js)
        matricula        : document.getElementById('matricula')?.value         || '',
        num_factura      : document.getElementById('num_factura')?.value       || '',
        cobrado          : document.getElementById('cobrado')?.value           || '',
        fecha_pago_desde : document.getElementById('fecha_pago_desde')?.value  || '',
        fecha_pago_hasta : document.getElementById('fecha_pago_hasta')?.value  || '',
        fecha_cobro_desde: document.getElementById('fecha_cobro_desde')?.value || '',
        fecha_cobro_hasta: document.getElementById('fecha_cobro_hasta')?.value || ''
    };

    let filtered = SearchEngine.applyFilters(STATE.allData, params);

    // ── Filtro de estado según lógica SQL del negocio ──
    // El campo "Estatus de Pago" filtra sobre cobrado+pagado, no solo pagado:
    //   'false' → Pendientes de pago al titular: cobrado=1, pagado=0
    //   'true'  → Ya pagados al titular:         cobrado=1, pagado=1
    //   ''      → Mostrar todos (sin filtro de estado)
    const b = v => v === true || v === 1 || v === '1';

    if (pagadoVal === 'false') {
        // Pendientes: empresa ya cobró (cobrado=1) pero titular aún no cobró (pagado=0)
        filtered = filtered.filter(alb => b(alb.cobrado) && !b(alb.pagado));
    } else if (pagadoVal === 'true') {
        // Pagados: empresa cobró (cobrado=1) y titular ya cobró (pagado=1)
        filtered = filtered.filter(alb => b(alb.cobrado) && b(alb.pagado));
    }
    // pagadoVal === '' → mostrar TODOS sin filtro de estado

    if (fechaDesde) filtered = filtered.filter(a => a.fecha && a.fecha.substring(0,10) >= fechaDesde);
    if (fechaHasta) filtered = filtered.filter(a => a.fecha && a.fecha.substring(0,10) <= fechaHasta);

    STATE.filteredData = filtered;
    handleSort(STATE.sortKey, 'string', true);
    STATE.currentPage = 1;
    renderTable();
    if (window.refreshAdvancedFiltersBannerTit) window.refreshAdvancedFiltersBannerTit();

    if (e instanceof Event || forzarHistorial) SearchHistory.push(SearchHistory.capture());
};

/* ═══════════════════════ RENDER TABLE ═══════════════════════ */

function renderTable() {
    const tbody       = document.getElementById('albaranResults');
    const tableFooter = document.getElementById('tableFooter');
    if (!tbody) return;
    tbody.innerHTML = '';

    const cbAll = document.getElementById('cb-select-all');
    if (cbAll) { cbAll.checked = false; cbAll.indeterminate = false; }
    document.getElementById('selectedCount')?.classList.add('hidden');

    const total = STATE.filteredData.length;
    const effectivePageSize = STATE.showAll ? total : STATE.pageSize;
    const totalPages = Math.max(1, Math.ceil(total / (effectivePageSize || 1)));
    if (STATE.currentPage > totalPages) STATE.currentPage = totalPages;

    const start    = STATE.showAll ? 0 : (STATE.currentPage - 1) * effectivePageSize;
    const pageData = STATE.showAll
        ? STATE.filteredData
        : STATE.filteredData.slice(start, start + effectivePageSize);

    if (!pageData.length) {
        tbody.innerHTML = '<tr><td colspan="14" class="p-10 text-center font-bold text-orange-500 uppercase tracking-widest">Sin resultados coincidentes</td></tr>';
        tableFooter?.classList.add('hidden');
        updatePaginationUI();
        return;
    }

    let suma = 0;

    pageData.forEach(alb => {
        const imp   = parseFloat(alb.importe_total || 0);
        suma       += imp;
        const isPag = alb.pagado  === true || alb.pagado  === 1 || alb.pagado  === '1';
        const isCob = alb.cobrado === true || alb.cobrado === 1 || alb.cobrado === '1';
        const isEnv = alb.enviado === true || alb.enviado === 1 || alb.enviado === '1';

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-orange-50/50 transition-colors border-b border-slate-50 group';
        tr.innerHTML = `
            <td class="p-3 text-center">
                <input type="checkbox" value="${alb.id}" data-licencia="${alb.licencia_ref}"
                    class="cb-seleccion h-4 w-4 rounded border-gray-300 cursor-pointer accent-orange-500"
                    ${isPag ? 'disabled checked' : ''}
                    onchange="UI_PAGOS.updateSelectionUI()">
            </td>
            <td class="p-3 text-slate-400 font-mono text-[11px]">#${alb.id}</td>
            <td class="p-3 font-black text-slate-800 text-[11px]">${alb.numero_albaran}</td>
            <td class="p-3 font-bold text-blue-600 uppercase text-[11px]">${SearchEngine.getLicenciaNumero(alb)}</td>
            <td class="p-3 font-medium text-slate-500 text-[11px]">${UI_PAGOS.formatDate(alb.fecha)}</td>
            <td class="p-3 font-bold text-slate-700 uppercase truncate text-[11px]">${SearchEngine.getEmpresaNombre(alb)}</td>
            <td class="p-3 font-bold text-slate-500 uppercase text-[11px] truncate">${alb.referencia || '-'}</td>
            <td class="p-3 font-bold text-slate-500 text-[11px] truncate">${alb.num_factura || '-'}</td>
            <td class="p-3 text-right font-black text-primary-link text-sm bg-orange-50/20">€${imp.toFixed(2)}</td>
            <td class="p-3 text-center">${UI_PAGOS.boolIcon(isEnv)}</td>
            <td class="p-3 text-center">${UI_PAGOS.boolIcon(isCob)}</td>
            <td class="p-3 text-center">${UI_PAGOS.boolIcon(isPag)}</td>
            <td class="p-3 text-slate-500 text-[10px] truncate" title="${alb.observaciones || ''}">${alb.observaciones || '-'}</td>
            <td class="p-3 text-center">
                <button onclick="window.location.href='/admin/albaranes/view/${alb.id}'"
                    class="bg-slate-100 hover:bg-primary-link hover:text-white text-slate-500 p-2 rounded-xl transition active:scale-95"
                    title="Ver albarán">
                    <i data-lucide="eye" class="w-4 h-4"></i>
                </button>
            </td>`;
        tbody.appendChild(tr);
    });

    const elTotal = document.getElementById('totalImporte');
    if (elTotal) elTotal.textContent = `€${suma.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
    tableFooter?.classList.remove('hidden');
    updatePaginationUI();
    if (window.lucide) lucide.createIcons();
}

/* ═══════════════════════ PAGO MASIVO ═══════════════════════ */

window.handleBulkPay = async () => {
    const boxes = Array.from(document.querySelectorAll('.cb-seleccion:checked:not(:disabled)'));
    if (!boxes.length) return UI_PAGOS.alertMessage('Selecciona registros pendientes para liquidar', 'error');
    if (!confirm(`¿Confirmar liquidación de ${boxes.length} albarán(es)?`)) return;

    UI_PAGOS.alertMessage(`Procesando ${boxes.length} pago(s)...`, 'info');
    const token    = localStorage.getItem('token');
    const fechaHoy = new Date().toISOString().substring(0, 10);
    let errores = 0;

    for (const cb of boxes) {
        try {
            const res = await fetch(`/api/v1/albaranes/id/${cb.value}`, {
                method : 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body   : JSON.stringify({ pagado: true, cobrado: true, fecha_pago: fechaHoy, licencia_ref: parseInt(cb.dataset.licencia) || 0 })
            });
            if (!res.ok) errores++;
        } catch { errores++; }
    }

    UI_PAGOS.alertMessage(
        errores === 0 ? `✅ ${boxes.length} albarán(es) liquidado(s) correctamente` : `⚠️ Completado con ${errores} error(es)`,
        errores === 0 ? 'success' : 'error'
    );
    await loadData();
};

/* ═══════════════════════ SORT / PAGINACIÓN ═══════════════════════ */

window.handleSort = (key, type, isInitial = false) => {
    if (!isInitial) {
        STATE.sortDir = (STATE.sortKey === key && STATE.sortDir === 'asc') ? 'desc' : 'asc';
        STATE.sortKey = key;
    }
    STATE.filteredData.sort((a, b) => {
        let vA = a[key] || '', vB = b[key] || '';
        if (key === 'licencia_ref')   { vA = SearchEngine.getLicenciaNumero(a); vB = SearchEngine.getLicenciaNumero(b); }
        if (key === 'empresa_nombre') { vA = SearchEngine.getEmpresaNombre(a);  vB = SearchEngine.getEmpresaNombre(b); }
        if (type === 'number' || key === 'importe_total') { vA = parseFloat(vA) || 0; vB = parseFloat(vB) || 0; }
        if (type === 'date'   || key === 'fecha')         { vA = new Date(vA).getTime(); vB = new Date(vB).getTime(); }
        return STATE.sortDir === 'asc' ? (vA < vB ? -1 : 1) : (vA < vB ? 1 : -1);
    });
    if (!isInitial) renderTable();
};

function updatePaginationUI() {
    const total      = STATE.filteredData.length;
    const effectivePageSize = STATE.showAll ? total : STATE.pageSize;
    const totalPages = Math.max(1, Math.ceil(total / (effectivePageSize || 1)));
    const elRes = document.getElementById('resultsCount');
    const elPag = document.getElementById('pageInfo');
    if (elRes) elRes.textContent = total;
    if (elPag) elPag.textContent = STATE.showAll
        ? `Página 1 / 1 (todos)`
        : `Página ${STATE.currentPage} / ${totalPages}`;
    document.getElementById('prevPageBtn').disabled = STATE.showAll || STATE.currentPage === 1;
    document.getElementById('nextPageBtn').disabled = STATE.showAll || STATE.currentPage >= totalPages;
    if (window.lucide) lucide.createIcons();
}

function setupTableEvents() {
    const recs = document.getElementById('recordsPerPage');
    if (recs) {
        recs.onchange = e => {
            const val = e.target.value;
            if (val === 'all') {
                STATE.showAll  = true;
                STATE.pageSize = 25;
            } else {
                STATE.showAll  = false;
                STATE.pageSize = parseInt(val, 10);
            }
            STATE.currentPage = 1;
            renderTable();
        };
    }
    document.getElementById('prevPageBtn').onclick = () => {
        if (!STATE.showAll && STATE.currentPage > 1) { STATE.currentPage--; renderTable(); }
    };
    document.getElementById('nextPageBtn').onclick = () => {
        const totalPages = Math.ceil(STATE.filteredData.length / STATE.pageSize);
        if (!STATE.showAll && STATE.currentPage < totalPages) { STATE.currentPage++; renderTable(); }
    };
    document.getElementById('palabra')?.addEventListener('input', () => {
        if (STATE.searchMode === 'palabra') window.handleSearch();
    });
}

/* ═══════════════════════ EXPORT / MISC ═══════════════════════ */

window.handleExportPDF   = () => { if (!STATE.filteredData.length) return alert('No hay datos'); Oficina.generarPDF('Liquidacion_Titulares',   STATE.filteredData); };
window.handleExportXLSX  = () => { if (!STATE.filteredData.length) return alert('No hay datos'); Oficina.generarExcel('Liquidacion_Titulares', STATE.filteredData); };
window.handleGeneratePDF  = window.handleExportPDF;
window.handleGenerateXLSX = window.handleExportXLSX;

window.handleClearAllFilters = () => {
    document.getElementById('searchForm')?.reset();
    const elPal = document.getElementById('palabra');
    if (elPal) elPal.value = '';
    window.handleSearch();
};

window.handleLogout = () => { localStorage.removeItem('token'); window.location.href = '/login'; };

document.addEventListener('DOMContentLoaded', initPagoTit);