/**
 * ARCHIVO: static/js/admin_pago_emp.js
 * ACTUALIZADO: 24/06/2026
 *   - NEW: Historial de búsquedas persistente (localStorage, máx. 15 entradas)
 *          — mismo patrón que admin_pago_tit.js
 */

'use strict';

const STATE = {
    allData: [],
    currentPage: 1,
    pageSize: 25,
    sortKey: 'fecha',
    sortDir: 'desc',
    searchMode: 'campos'
};

/* ═══════════════════════ HISTORIAL ═══════════════════════ */

const HISTORY_KEY = 'pago_emp_search_history';
const HISTORY_MAX = 15;

const SearchHistory = {
    load() {
        try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
        catch { return []; }
    },
    save(list) {
        try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list)); }
        catch { /* storage lleno */ }
    },
    capture() {
        const form = document.getElementById('searchForm');
        const fd   = form ? new FormData(form) : new FormData();
        return {
            ts         : Date.now(),
            mode       : STATE.searchMode,
            licencia   : fd.get('licencia_ref')  || '',
            empresa    : fd.get('empresa_ref')    || '',
            cobrado    : fd.get('cobrado')        ?? 'false',
            referencia : fd.get('referencia')     || '',
            fecha_desde: fd.get('fecha_desde')    || '',
            fecha_hasta: fd.get('fecha_hasta')    || '',
            palabra    : document.getElementById('palabra')?.value || ''
        };
    },
    isBlank(s) {
        if (s.mode === 'palabra') return !s.palabra.trim();
        return !s.licencia && !s.empresa && !s.referencia &&
               !s.fecha_desde && !s.fecha_hasta && s.cobrado === '';
    },
    _same(a, b) {
        return a.mode === b.mode && a.licencia === b.licencia &&
               a.empresa === b.empresa && a.cobrado === b.cobrado &&
               a.referencia === b.referencia && a.fecha_desde === b.fecha_desde &&
               a.fecha_hasta === b.fecha_hasta && a.palabra === b.palabra;
    },
    push(snap) {
        if (this.isBlank(snap)) return;
        let list = this.load().filter(e => !this._same(e, snap));
        list.unshift(snap);
        if (list.length > HISTORY_MAX) list = list.slice(0, HISTORY_MAX);
        this.save(list);
        HistoryUI.render();
    },
    clear() { this.save([]); HistoryUI.render(); }
};

function _histLabel(item) {
    const d  = new Date(item.ts);
    const hm = String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
    if (item.mode === 'palabra' && item.palabra)
        return `${hm} · BÚSQ: ${item.palabra.toUpperCase().substring(0, 30)}`;
    const parts = [];
    if (item.licencia)           parts.push(`LIC ${item.licencia}`);
    if (item.empresa)            parts.push(item.empresa.substring(0, 20).toUpperCase());
    if (item.cobrado === 'false') parts.push('PENDIENTES');
    if (item.cobrado === 'true')  parts.push('COBRADOS');
    if (item.referencia)         parts.push(`EXP:${item.referencia}`);
    if (item.fecha_desde)        parts.push(`D:${item.fecha_desde.substring(5)}`);
    if (item.fecha_hasta)        parts.push(`H:${item.fecha_hasta.substring(5)}`);
    return `${hm} · ${parts.length ? parts.join(' · ') : 'FILTRO: MANUAL'}`;
}

const HistoryUI = {
    render() {
        const sel = document.getElementById('histSelect');
        if (!sel) return;
        const list = SearchHistory.load();
        sel.innerHTML = '';

        const hdr = document.createElement('option');
        hdr.value    = '__hdr__';
        hdr.text     = list.length ? `🕐 BÚSQUEDAS RECIENTES (${list.length})` : '🕐 BÚSQUEDAS RECIENTES';
        hdr.selected = true;
        sel.appendChild(hdr);

        if (!list.length) {
            const emp = document.createElement('option');
            emp.value = '__empty__'; emp.text = '  — Sin búsquedas guardadas —'; emp.disabled = true;
            sel.appendChild(emp);
            return;
        }

        list.forEach((item, i) => {
            const opt = document.createElement('option');
            opt.value = String(i); opt.text = _histLabel(item);
            sel.appendChild(opt);
        });

        const sep = document.createElement('option');
        sep.value = '__sep__'; sep.text = '─────────────────────────────'; sep.disabled = true;
        sel.appendChild(sep);

        const clr = document.createElement('option');
        clr.value = '__clear__'; clr.text = '🗑  Borrar historial';
        sel.appendChild(clr);
    },

    onSelectChange(sel) {
        const val = sel.value;
        if (!val || val === '__hdr__' || val === '__empty__' || val === '__sep__') return;
        if (val === '__clear__') { SearchHistory.clear(); sel.selectedIndex = 0; return; }

        const snap = SearchHistory.load()[parseInt(val, 10)];
        if (!snap) { sel.selectedIndex = 0; return; }

        UI_EMP.setSearchModeManual(snap.mode);

        // Restaurar campos de formulario
        const form = document.getElementById('searchForm');
        const setField = (name, v) => {
            const el = form?.querySelector(`[name="${name}"]`);
            if (el) el.value = v;
        };
        setField('licencia_ref',  snap.licencia);
        setField('empresa_ref',   snap.empresa);
        setField('cobrado',       snap.cobrado);
        setField('referencia',    snap.referencia);
        setField('fecha_desde',   snap.fecha_desde);
        setField('fecha_hasta',   snap.fecha_hasta);
        const pal = document.getElementById('palabra');
        if (pal) pal.value = snap.palabra;

        sel.selectedIndex = 0;
        window.handleSearch(); // sin event → no guarda en historial
    }
};

window.SearchHistory = SearchHistory;
window.HistoryUI     = HistoryUI;

/* ═══════════════════════ UI EMP ═══════════════════════ */

const UI_EMP = {
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
        setTimeout(() => s.classList.add('hidden'), 4000);
    },
    setSearchModeManual(mode) {
        STATE.searchMode = mode;
        const btnC = document.getElementById('btn-mode-campos');
        const btnP = document.getElementById('btn-mode-palabra');
        const secC = document.getElementById('camposSection');
        const secP = document.getElementById('palabraSection');
        const ON  = 'px-5 py-2 rounded-lg bg-primary-link text-white font-black text-[10px] uppercase shadow-lg flex items-center gap-2';
        const OFF = 'px-5 py-2 rounded-lg bg-slate-50 text-slate-400 font-black text-[10px] border border-slate-200 uppercase flex items-center gap-2 hover:bg-white transition-all';
        if (mode === 'campos') {
            if (btnC) btnC.className = ON;
            if (btnP) btnP.className = OFF;
            secC?.classList.remove('hidden');
            secP?.classList.add('hidden');
        } else {
            if (btnP) btnP.className = ON;
            if (btnC) btnC.className = OFF;
            secC?.classList.add('hidden');
            secP?.classList.remove('hidden');
            document.getElementById('palabra')?.focus();
        }
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
    }
};

window.UI_EMP = UI_EMP;

window.handleSelectAll = (masterCb, event) => {
    if (event) event.stopPropagation();
    document.querySelectorAll('.cb-seleccion:not(:disabled)').forEach(cb => { cb.checked = masterCb.checked; });
    UI_EMP.updateSelectionUI();
};

/* ═══════════════════════ SEARCH ═══════════════════════ */

window.handleSearch = async (e) => {
    if (e) e.preventDefault();

    const tbody       = document.getElementById('albaranResults');
    const tableFooter = document.getElementById('tableFooter');
    const cbAll       = document.getElementById('cb-select-all');

    tbody.innerHTML = '<tr><td colspan="14" class="p-10 text-center italic text-slate-400 animate-pulse">Sincronizando cobros...</td></tr>';
    tableFooter?.classList.add('hidden');
    if (cbAll) { cbAll.checked = false; cbAll.indeterminate = false; }
    document.getElementById('selectedCount')?.classList.add('hidden');

    const form       = document.getElementById('searchForm');
    const formData   = new FormData(form);
    const cobradoVal = formData.get('cobrado');

    const searchParams = {
        mode    : STATE.searchMode,
        licencia: formData.get('licencia_ref') || '',
        empresa : formData.get('empresa_ref')  || '',
        ref     : formData.get('referencia')   || '',
        desde   : formData.get('fecha_desde')  || '',
        hasta   : formData.get('fecha_hasta')  || '',
        palabra : document.getElementById('palabra')?.value || '',
        enviado : true
    };

    try {
        const token = localStorage.getItem('token');
        const res   = await fetch('/api/v1/albaranes/search?enviado=true', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const json    = await res.json();
        const rawData = Array.isArray(json.data) ? json.data : (Array.isArray(json) ? json : []);

        let filtered = SearchEngine.applyFilters(rawData, searchParams);

        if (cobradoVal !== '') {
            const want = cobradoVal === 'true';
            filtered = filtered.filter(alb => {
                const esCobrado = alb.cobrado === true || alb.cobrado === 1 || alb.cobrado === '1';
                return want ? esCobrado : !esCobrado;
            });
        }

        STATE.allData     = filtered;
        STATE.currentPage = 1;
        renderTable();
    } catch {
        UI_EMP.alertMessage('Error de conexión', 'error');
    }

    // Guardar en historial sólo si lo disparó el usuario
    if (e instanceof Event) SearchHistory.push(SearchHistory.capture());
};

/* ═══════════════════════ RENDER ═══════════════════════ */

function renderTable() {
    const tbody       = document.getElementById('albaranResults');
    const tableFooter = document.getElementById('tableFooter');
    if (!tbody) return;
    tbody.innerHTML = '';

    const cbAll = document.getElementById('cb-select-all');
    if (cbAll) { cbAll.checked = false; cbAll.indeterminate = false; }
    document.getElementById('selectedCount')?.classList.add('hidden');

    const start    = (STATE.currentPage - 1) * STATE.pageSize;
    const pageData = STATE.allData.slice(start, start + STATE.pageSize);

    if (!pageData.length) {
        tbody.innerHTML = '<tr><td colspan="14" class="p-20 text-center font-black text-slate-300 uppercase tracking-widest">Sin registros encontrados</td></tr>';
        tableFooter?.classList.add('hidden');
        updatePaginationUI();
        return;
    }

    let suma = 0;

    pageData.forEach(alb => {
        const imp     = parseFloat(alb.importe_total || 0);
        suma         += imp;
        const isCob   = alb.cobrado === true || alb.cobrado === 1 || alb.cobrado === '1';
        const isPag   = alb.pagado  === true || alb.pagado  === 1 || alb.pagado  === '1';
        const isEnv   = alb.enviado === true || alb.enviado === 1 || alb.enviado === '1';

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-orange-50/30 transition-colors border-b border-slate-50 group';
        tr.innerHTML = `
            <td class="p-3 text-center">
                <input type="checkbox" value="${alb.id}" data-licencia="${alb.licencia_ref}"
                    class="cb-seleccion h-4 w-4 rounded border-slate-300 cursor-pointer accent-orange-500"
                    ${isCob ? 'disabled checked' : ''}
                    onchange="UI_EMP.updateSelectionUI()">
            </td>
            <td class="p-3 text-slate-400 font-mono text-[11px]">#${alb.id}</td>
            <td class="p-3 font-black text-slate-800 text-[11px]">${alb.numero_albaran}</td>
            <td class="p-3 font-bold text-blue-600 uppercase text-[11px]">${SearchEngine.getLicenciaNumero(alb)}</td>
            <td class="p-3 font-medium text-slate-500 text-[11px]">${UI_EMP.formatDate(alb.fecha)}</td>
            <td class="p-3 font-bold text-slate-700 uppercase truncate text-[11px]">${SearchEngine.getEmpresaNombre(alb)}</td>
            <td class="p-3 font-bold text-slate-500 uppercase text-[11px] truncate">${alb.referencia || '-'}</td>
            <td class="p-3 font-bold text-slate-500 text-[11px] truncate">${alb.num_factura || '-'}</td>
            <td class="p-3 text-right font-black text-primary-link text-sm bg-orange-50/20">€${imp.toFixed(2)}</td>
            <td class="p-3 text-center">${UI_EMP.boolIcon(isEnv)}</td>
            <td class="p-3 text-center">${UI_EMP.boolIcon(isCob)}</td>
            <td class="p-3 text-center">${UI_EMP.boolIcon(isPag)}</td>
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

/* ═══════════════════════ BULK PAY ═══════════════════════ */

window.handleBulkPay = async () => {
    const boxes = Array.from(document.querySelectorAll('.cb-seleccion:checked:not(:disabled)'));
    if (!boxes.length) return UI_EMP.alertMessage('Selecciona al menos un registro pendiente', 'error');
    if (!confirm(`¿Confirmas marcar como COBRADOS ${boxes.length} albarán(es)?`)) return;

    UI_EMP.alertMessage(`Procesando ${boxes.length} cobro(s)...`, 'info');
    const token    = localStorage.getItem('token');
    const fechaHoy = new Date().toISOString().substring(0, 10);
    let errores = 0;

    for (const cb of boxes) {
        try {
            const res = await fetch(`/api/v1/albaranes/id/${cb.value}`, {
                method : 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body   : JSON.stringify({ cobrado: true, fecha_cobro: fechaHoy, licencia_ref: parseInt(cb.dataset.licencia) || 0 })
            });
            if (!res.ok) errores++;
        } catch { errores++; }
    }

    UI_EMP.alertMessage(
        errores === 0 ? `✅ ${boxes.length} albarán(es) marcado(s) como cobrados` : `⚠️ Completado con ${errores} error(es)`,
        errores === 0 ? 'success' : 'error'
    );
    window.handleSearch();
};

/* ═══════════════════════ SORT / PAGINACIÓN ═══════════════════════ */

window.handleSort = (key, type) => {
    STATE.sortDir = (STATE.sortKey === key && STATE.sortDir === 'asc') ? 'desc' : 'asc';
    STATE.sortKey = key;
    STATE.allData.sort((a, b) => {
        let vA = a[key] || '', vB = b[key] || '';
        if (type === 'number') { vA = parseFloat(vA) || 0; vB = parseFloat(vB) || 0; }
        if (type === 'date')   { vA = new Date(vA).getTime(); vB = new Date(vB).getTime(); }
        return STATE.sortDir === 'asc' ? (vA < vB ? -1 : 1) : (vA < vB ? 1 : -1);
    });
    renderTable();
};

function updatePaginationUI() {
    const total      = STATE.allData.length;
    const totalPages = Math.ceil(total / STATE.pageSize) || 1;
    const elRes = document.getElementById('resultsCount');
    const elPag = document.getElementById('pageInfo');
    if (elRes) elRes.textContent = total;
    if (elPag) elPag.textContent = `Página ${STATE.currentPage} / ${totalPages}`;
    document.getElementById('prevPageBtn').disabled = STATE.currentPage === 1;
    document.getElementById('nextPageBtn').disabled = STATE.currentPage >= totalPages;
    if (window.lucide) lucide.createIcons();
}

/* ═══════════════════════ EXPORT / MISC ═══════════════════════ */

window.handleGeneratePDF  = () => { if (!STATE.allData.length) return alert('No hay datos'); Oficina.generarPDF('Cobros_Empresas',   STATE.allData); };
window.handleGenerateXLSX = () => { if (!STATE.allData.length) return alert('No hay datos'); Oficina.generarExcel('Cobros_Empresas', STATE.allData); };

window.handleClearAllFilters = () => {
    document.getElementById('searchForm')?.reset();
    const pal = document.getElementById('palabra');
    if (pal) pal.value = '';
    window.handleSearch();
};

window.handleLogout = () => { localStorage.removeItem('token'); window.location.href = '/login'; };

document.addEventListener('DOMContentLoaded', async () => {
    HistoryUI.render();
    if (window.SearchEngine) await SearchEngine.initCatalog(true);
    document.getElementById('recordsPerPage').onchange = e => { STATE.pageSize = parseInt(e.target.value); STATE.currentPage = 1; renderTable(); };
    document.getElementById('prevPageBtn').onclick = () => { if (STATE.currentPage > 1) { STATE.currentPage--; renderTable(); } };
    document.getElementById('nextPageBtn').onclick = () => { if (STATE.currentPage < Math.ceil(STATE.allData.length / STATE.pageSize)) { STATE.currentPage++; renderTable(); } };
    window.handleSearch();
});