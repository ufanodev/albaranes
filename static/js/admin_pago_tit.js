/**
 * ARCHIVO: static/js/admin_pago_tit.js
 * DESCRIPCIÓN: Gestión Maestra de Pagos a Titulares.
 * ACTUALIZADO: 04/06/2026
 *   - FIX: tableFooter ahora es un <div> fuera de la tabla (resuelve corte del importe)
 *   - NEW: Columnas Nº, Nº Albarán, Licencia, Fecha, Empresa, Exp, Fac, Importe, Env, Cob, Pag, Obs, Ver
 *   - NEW: Botón Ver → /admin/albaranes/view/:id
 *   - NEW: Checkbox "Seleccionar Todo"
 *   - NEW: Contador de seleccionados
 *   - FIX: Los checkboxes ya pagados quedan disabled
 */

const STATE = {
    allData: [],
    filteredData: [],
    currentPage: 1,
    pageSize: 25,
    sortKey: 'fecha',
    sortDir: 'desc',
    searchMode: 'campos'
};

const UI_PAGOS = {
    formatDate(iso) {
        if (!iso || iso.startsWith('0001')) return '-';
        return iso.substring(0, 10);
    },

    boolIcon(val) {
        const active = val === true || val === 1 || val === '1';
        return active
            ? '<span class="text-green-500 font-black text-base">✅</span>'
            : '<span class="text-red-400 font-black text-base">✗</span>';
    },

    alertMessage(message, type = 'info') {
        const s = document.getElementById('statusMessage');
        if (!s) return;
        s.textContent = message;
        const border = type === 'success' ? 'border-green-500 text-green-600' :
                       type === 'error'   ? 'border-red-500 text-red-600'
                                          : 'border-blue-400 text-blue-600';
        s.className = `fixed bottom-5 right-5 z-[2000] p-4 rounded-xl shadow-2xl border-2 bg-white font-black text-xs uppercase tracking-widest transition-all duration-300 ${border}`;
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

        if (mode === 'palabra') {
            pSec?.classList.remove('hidden');
            cSec?.classList.add('hidden');
            if (btnP) btnP.className = "px-4 py-2 rounded-lg bg-primary-link text-white font-black text-[10px] uppercase shadow-md transition-all";
            if (btnC) btnC.className = "px-4 py-2 rounded-lg bg-white text-slate-400 font-black text-[10px] border uppercase transition-all";
            document.getElementById('palabra')?.focus();
        } else {
            pSec?.classList.add('hidden');
            cSec?.classList.remove('hidden');
            if (btnC) btnC.className = "px-4 py-2 rounded-lg bg-primary-link text-white font-black text-[10px] uppercase shadow-md transition-all";
            if (btnP) btnP.className = "px-4 py-2 rounded-lg bg-white text-slate-400 font-black text-[10px] border uppercase transition-all";
        }
        window.handleSearch();
    }
};

window.handleSelectAll = (masterCb, event) => {
    if (event) event.stopPropagation();
    document.querySelectorAll('.cb-seleccion:not(:disabled)').forEach(cb => { cb.checked = masterCb.checked; });
    UI_PAGOS.updateSelectionUI();
};

async function initPagoTit() {
    await SearchEngine.initCatalog(true);
    await loadData();
    setupTableEvents();
}

async function loadData() {
    const tbody = document.getElementById('albaranResults');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="14" class="p-10 text-center italic text-gray-400 animate-pulse font-bold uppercase tracking-widest">Sincronizando Liquidaciones...</td></tr>';

    const cbAll = document.getElementById('cb-select-all');
    if (cbAll) { cbAll.checked = false; cbAll.indeterminate = false; }
    document.getElementById('selectedCount')?.classList.add('hidden');

    try {
        const token   = localStorage.getItem('token');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const res     = await fetch('/api/v1/albaranes/search?pageSize=10000', { headers });
        const json    = await res.json();
        const data    = Array.isArray(json.data) ? json.data : (Array.isArray(json) ? json : []);

        STATE.allData = data.filter(a => {
            const cob = a.cobrado;
            return cob === true || cob === 1 || cob === '1';
        });
        window.handleSearch();
    } catch (err) {
        UI_PAGOS.alertMessage("Error al conectar con la base de datos", "error");
    }
}

window.handleSearch = (e) => {
    if (e) e.preventDefault();

    const cbAll = document.getElementById('cb-select-all');
    if (cbAll) { cbAll.checked = false; cbAll.indeterminate = false; }
    document.getElementById('selectedCount')?.classList.add('hidden');

    const pagadoVal  = document.getElementById('pagado')?.value ?? '';
    const fechaDesde = document.getElementById('fecha_desde')?.value || '';
    const fechaHasta = document.getElementById('fecha_hasta')?.value || '';

    const params = {
        mode    : STATE.searchMode,
        licencia: document.getElementById('licenciaSelect')?.value || '',
        empresa : document.getElementById('empresa')?.value || '',
        ref     : document.getElementById('referencia')?.value || '',
        palabra : document.getElementById('palabra')?.value || ''
    };

    let filtered = SearchEngine.applyFilters(STATE.allData, params);

    if (pagadoVal !== '') {
        const quierePagado = pagadoVal === 'true';
        filtered = filtered.filter(alb => {
            const p = alb.pagado;
            const esPagado = p === true || p === 1 || p === '1';
            return quierePagado ? esPagado : !esPagado;
        });
    }

    if (fechaDesde) filtered = filtered.filter(alb => alb.fecha && alb.fecha.substring(0, 10) >= fechaDesde);
    if (fechaHasta) filtered = filtered.filter(alb => alb.fecha && alb.fecha.substring(0, 10) <= fechaHasta);

    STATE.filteredData = filtered;
    handleSort(STATE.sortKey, 'string', true);
    STATE.currentPage = 1;
    renderTable();
};

function renderTable() {
    const tbody       = document.getElementById('albaranResults');
    const tableFooter = document.getElementById('tableFooter');
    if (!tbody) return;
    tbody.innerHTML = '';

    const cbAll = document.getElementById('cb-select-all');
    if (cbAll) { cbAll.checked = false; cbAll.indeterminate = false; }
    document.getElementById('selectedCount')?.classList.add('hidden');

    const start    = (STATE.currentPage - 1) * STATE.pageSize;
    const pageData = STATE.filteredData.slice(start, start + STATE.pageSize);

    if (pageData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="14" class="p-10 text-center font-bold text-orange-500 uppercase tracking-widest">Sin resultados coincidentes</td></tr>';
        if (tableFooter) tableFooter.classList.add('hidden');
        updatePaginationUI();
        return;
    }

    let sumaTotalPagina = 0;

    pageData.forEach(alb => {
        const importe    = parseFloat(alb.importe_total || 0);
        sumaTotalPagina += importe;

        const isPagado  = alb.pagado   === true || alb.pagado   === 1 || alb.pagado   === '1';
        const isCobrado = alb.cobrado  === true || alb.cobrado  === 1 || alb.cobrado  === '1';
        const isEnviado = alb.enviado  === true || alb.enviado  === 1 || alb.enviado  === '1';

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-orange-50/50 transition-colors border-b border-slate-50 group';

        tr.innerHTML = `
            <td class="p-3 text-center">
                <input type="checkbox" value="${alb.id}" data-licencia="${alb.licencia_ref}"
                    class="cb-seleccion h-4 w-4 rounded border-gray-300 cursor-pointer accent-orange-500"
                    ${isPagado ? 'disabled checked' : ''}
                    onchange="UI_PAGOS.updateSelectionUI()">
            </td>
            <td class="p-3 text-slate-400 font-mono text-[11px]">#${alb.id}</td>
            <td class="p-3 font-black text-slate-800 text-[11px]">${alb.numero_albaran}</td>
            <td class="p-3 font-bold text-blue-600 uppercase text-[11px]">${SearchEngine.getLicenciaNumero(alb)}</td>
            <td class="p-3 font-medium text-slate-500 text-[11px]">${UI_PAGOS.formatDate(alb.fecha)}</td>
            <td class="p-3 font-bold text-slate-700 uppercase truncate text-[11px]">${SearchEngine.getEmpresaNombre(alb)}</td>
            <td class="p-3 font-bold text-slate-500 uppercase text-[11px] truncate">${alb.referencia || '-'}</td>
            <td class="p-3 font-bold text-slate-500 text-[11px] truncate">${alb.num_factura || '-'}</td>
            <td class="p-3 text-right font-black text-primary-link text-sm bg-orange-50/20">€${importe.toFixed(2)}</td>
            <td class="p-3 text-center">${UI_PAGOS.boolIcon(isEnviado)}</td>
            <td class="p-3 text-center">${UI_PAGOS.boolIcon(isCobrado)}</td>
            <td class="p-3 text-center">${UI_PAGOS.boolIcon(isPagado)}</td>
            <td class="p-3 text-slate-500 text-[10px] truncate" title="${alb.observaciones || ''}">${alb.observaciones || '-'}</td>
            <td class="p-3 text-center">
                <button onclick="window.location.href='/admin/albaranes/view/${alb.id}'"
                    class="bg-slate-100 hover:bg-primary-link hover:text-white text-slate-500 p-2 rounded-xl transition active:scale-95"
                    title="Ver albarán">
                    <i data-lucide="eye" class="w-4 h-4"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    const elTotal = document.getElementById('totalImporte');
    if (elTotal) elTotal.textContent = `€${sumaTotalPagina.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
    if (tableFooter) tableFooter.classList.remove('hidden');
    updatePaginationUI();
    if (window.lucide) lucide.createIcons();
}

window.handleBulkPay = async () => {
    const checkedBoxes = Array.from(document.querySelectorAll('.cb-seleccion:checked:not(:disabled)'));
    if (checkedBoxes.length === 0) return UI_PAGOS.alertMessage("Selecciona registros pendientes para liquidar", "error");
    if (!confirm(`¿Confirmar liquidación de ${checkedBoxes.length} albarán(es)?`)) return;

    UI_PAGOS.alertMessage(`Procesando ${checkedBoxes.length} pago(s)...`, "info");
    const token    = localStorage.getItem('token');
    const fechaHoy = new Date().toISOString().substring(0, 10);
    let errores = 0;

    for (const cb of checkedBoxes) {
        try {
            const res = await fetch(`/api/v1/albaranes/id/${cb.value}`, {
                method : 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ pagado: true, cobrado: true, fecha_pago: fechaHoy, licencia_ref: parseInt(cb.dataset.licencia) || 0 })
            });
            if (!res.ok) errores++;
        } catch { errores++; }
    }

    if (errores === 0) UI_PAGOS.alertMessage(`✅ ${checkedBoxes.length} albarán(es) liquidado(s) correctamente`, "success");
    else UI_PAGOS.alertMessage(`⚠️ Completado con ${errores} error(es)`, "error");
    await loadData();
};

window.handleSort = (key, type, isInitial = false) => {
    if (!isInitial) {
        STATE.sortDir = (STATE.sortKey === key && STATE.sortDir === 'asc') ? 'desc' : 'asc';
        STATE.sortKey = key;
    }
    STATE.filteredData.sort((a, b) => {
        let vA = a[key] || '', vB = b[key] || '';
        if (key === 'licencia_ref')   { vA = SearchEngine.getLicenciaNumero(a); vB = SearchEngine.getLicenciaNumero(b); }
        if (key === 'empresa_nombre') { vA = SearchEngine.getEmpresaNombre(a);  vB = SearchEngine.getEmpresaNombre(b); }
        if (type === 'number' || key === 'importe_total') { vA = parseFloat(vA); vB = parseFloat(vB); }
        if (type === 'date'   || key === 'fecha')         { vA = new Date(vA).getTime(); vB = new Date(vB).getTime(); }
        return STATE.sortDir === 'asc' ? (vA < vB ? -1 : 1) : (vA < vB ? 1 : -1);
    });
    if (!isInitial) renderTable();
};

function updatePaginationUI() {
    const total      = STATE.filteredData.length;
    const totalPages = Math.ceil(total / STATE.pageSize) || 1;
    const elRes = document.getElementById('resultsCount');
    const elPag = document.getElementById('pageInfo');
    if (elRes) elRes.textContent = total;
    if (elPag) elPag.textContent = `Página ${STATE.currentPage} / ${totalPages}`;
    document.getElementById('prevPageBtn').disabled = STATE.currentPage === 1;
    document.getElementById('nextPageBtn').disabled = STATE.currentPage >= totalPages;
    if (window.lucide) lucide.createIcons();
}

function setupTableEvents() {
    const recs = document.getElementById('recordsPerPage');
    if (recs) recs.onchange = (e) => { STATE.pageSize = parseInt(e.target.value); STATE.currentPage = 1; renderTable(); };
    document.getElementById('prevPageBtn').onclick = () => { if (STATE.currentPage > 1) { STATE.currentPage--; renderTable(); } };
    document.getElementById('nextPageBtn').onclick = () => {
        if (STATE.currentPage < Math.ceil(STATE.filteredData.length / STATE.pageSize)) { STATE.currentPage++; renderTable(); }
    };
    document.getElementById('palabra')?.addEventListener('input', () => {
        if (STATE.searchMode === 'palabra') window.handleSearch();
    });
}

window.handleExportPDF  = () => { if (!STATE.filteredData.length) return alert("No hay datos para exportar"); Oficina.generarPDF('Liquidacion_Titulares',   STATE.filteredData); };
window.handleExportXLSX = () => { if (!STATE.filteredData.length) return alert("No hay datos para exportar"); Oficina.generarExcel('Liquidacion_Titulares', STATE.filteredData); };

window.handleClearAllFilters = () => {
    document.getElementById('searchForm')?.reset();
    const elPal = document.getElementById('palabra');
    if (elPal) elPal.value = '';
    window.handleSearch();
};

window.handleLogout = () => { localStorage.removeItem('token'); window.location.href = '/login'; };
window.UI_PAGOS = UI_PAGOS;

document.addEventListener('DOMContentLoaded', initPagoTit);