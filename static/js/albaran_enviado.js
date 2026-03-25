/**
 * ARCHIVO: static/js/albaran_enviado.js
 * FUNCIÓN: Controlador del Histórico con Exportación (PDF/XLSX).
 */

const APP_ENVIADOS = {
    elements: {
        resultsBody: document.getElementById('albaranResults'),
        pageInfo: document.getElementById('pageInfo'),
        activeCount: document.getElementById('activeFiltersCount'),
        recordsPerPage: document.getElementById('recordsPerPage')
    },
    state: {
        rawAlbaranes: [],
        filteredAlbaranes: [],
        currentPage: 1,
        pageSize: 20,
        searchMode: 'campos',
        licId: null,
        currentSort: { key: 'fecha', direction: 'desc' }
    }
};

async function startApp() {
    try {
        const resp = await fetch('/api/v1/user/licencia_info', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const identity = await resp.json();
        APP_ENVIADOS.state.licId = identity.licencia_id;

        await SearchEngine.initCatalog();
        await loadData();
        setupEvents();
        
        // Exponer estado para oficina.js
        window.APP_STATE = APP_ENVIADOS.state;
    } catch (e) { console.error("Error histórico:", e); }
}

async function loadData() {
    APP_ENVIADOS.elements.resultsBody.innerHTML = '<tr><td colspan="9" class="text-center py-20 italic text-slate-400 font-medium">Consultando registros...</td></tr>';
    
    try {
        const response = await fetch(`/api/v1/albaranes/search-user?licencia_ref=${APP_ENVIADOS.state.licId}&pageSize=5000`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const json = await response.json();
        const items = json.data || json || [];

        APP_ENVIADOS.state.rawAlbaranes = items.filter(i => i.enviado || i.cobrado || i.pagado);
        handleSearch(); 
    } catch (e) {
        APP_ENVIADOS.elements.resultsBody.innerHTML = '<tr><td colspan="9" class="text-center py-20 text-red-500 font-bold">Error de conexión</td></tr>';
    }
}

function handleSearch(e) {
    if (e) e.preventDefault();
    const params = {
        mode: APP_ENVIADOS.state.searchMode,
        empresa: document.getElementById('empresa').value,
        ref: document.getElementById('referencia_input').value,
        desde: document.getElementById('fecha_desde').value,
        hasta: document.getElementById('fecha_hasta').value,
        palabra: document.getElementById('palabra').value
    };
    APP_ENVIADOS.state.filteredAlbaranes = SearchEngine.applyFilters(APP_ENVIADOS.state.rawAlbaranes, params);
    sortTable(APP_ENVIADOS.state.currentSort.key, true);
    APP_ENVIADOS.state.currentPage = 1;
    render();
}

function render() {
    const { resultsBody, pageInfo, activeCount } = APP_ENVIADOS.elements;
    if (!resultsBody) return;
    resultsBody.innerHTML = '';

    const start = (APP_ENVIADOS.state.currentPage - 1) * APP_ENVIADOS.state.pageSize;
    const pageItems = APP_ENVIADOS.state.filteredAlbaranes.slice(start, start + APP_ENVIADOS.state.pageSize);

    if (pageItems.length === 0) {
        resultsBody.innerHTML = '<tr><td colspan="9" class="text-center py-24 text-slate-400 italic font-medium">Sin registros históricos.</td></tr>';
        return;
    }

    pageItems.forEach(i => {
        const imp = parseFloat(i.importe_total || 0);
        let badge = i.pagado ? 'Pagado' : (i.cobrado ? 'Cobrado' : 'Enviado');
        let badgeColor = i.pagado ? 'bg-green-100 text-green-700' : (i.cobrado ? 'bg-teal-100 text-teal-700' : 'bg-orange-100 text-orange-700');

        const row = `
            <tr class="hover:bg-slate-50 border-b border-slate-100 transition-colors group">
                <td class="px-4 py-4 font-black text-slate-900">${i.numero_albaran}</td>
                <td class="px-4 py-4 text-slate-500 font-bold">${i.fecha ? i.fecha.substring(0,10) : "-"}</td>
                <td class="px-4 py-4 text-blue-600 font-black">${SearchEngine.getLicenciaNumero(i)}</td>
                <td class="px-4 py-4 font-bold text-slate-700 uppercase truncate max-w-[150px]">${SearchEngine.getEmpresaNombre(i)}</td>
                <td class="px-4 py-4 text-slate-400 italic">${i.referencia || '-'}</td>
                <td class="px-4 py-4 text-slate-600 font-semibold uppercase">${i.asalariado || 'TITULAR'}</td>
                <td class="px-4 py-4 text-right font-black text-slate-900 tracking-tight">€${imp.toFixed(2)}</td>
                <td class="px-4 py-4 text-center"><span class="px-2.5 py-0.5 ${badgeColor} rounded-full text-[9px] font-black uppercase border">${badge}</span></td>
                <td class="px-4 py-4 text-center">
                    <a href="/titulares/view/${i.id}" class="text-slate-400 hover:text-blue-600 transition-transform hover:scale-125 inline-block"><i data-lucide="eye" class="w-5 h-5"></i></a>
                </td>
            </tr>`;
        resultsBody.insertAdjacentHTML('beforeend', row);
    });

    activeCount.textContent = `${APP_ENVIADOS.state.filteredAlbaranes.length} REGISTROS`;
    pageInfo.textContent = `${APP_ENVIADOS.state.currentPage} / ${Math.ceil(APP_ENVIADOS.state.filteredAlbaranes.length / APP_ENVIADOS.state.pageSize) || 1}`;
    if (window.lucide) lucide.createIcons();
    updateSortIcons();
}

/**
 * EXPORTACIÓN
 */
window.handleGeneratePDF = () => {
    const data = APP_ENVIADOS.state.filteredAlbaranes;
    if (data.length === 0) return alert("Sin datos");
    const clean = data.map(i => ({
        "Nº ALBARAN": i.numero_albaran,
        "FECHA": i.fecha ? i.fecha.substring(0,10) : "-",
        "EMPRESA": SearchEngine.getEmpresaNombre(i),
        "EXPEDIENTE": i.referencia || "-",
        "ESTADO": i.pagado ? 'PAGADO' : (i.cobrado ? 'COBRADO' : 'ENVIADO'),
        "TOTAL": `€${parseFloat(i.importe_total || 0).toFixed(2)}`
    }));
    Oficina.generarPDF("HISTORICO_ENVIADOS", clean);
};

window.handleGenerateXLSX = () => {
    const data = APP_ENVIADOS.state.filteredAlbaranes;
    if (data.length === 0) return alert("Sin datos");
    const clean = data.map(i => ({
        "Nº ALBARAN": i.numero_albaran,
        "FECHA": i.fecha ? i.fecha.substring(0,10) : "-",
        "LICENCIA": SearchEngine.getLicenciaNumero(i),
        "EMPRESA": SearchEngine.getEmpresaNombre(i),
        "EXPEDIENTE": i.referencia,
        "IMPORTE": parseFloat(i.importe_total || 0)
    }));
    Oficina.generarExcel("HISTORICO_ENVIADOS", clean);
};

// ... (Resto de funciones sortTable, updateSortIcons, setupEvents, UI) se mantienen igual que tu archivo original ...
function sortTable(key, isInitial = false) {
    if (!isInitial) {
        APP_ENVIADOS.state.currentSort.direction = (APP_ENVIADOS.state.currentSort.key === key && APP_ENVIADOS.state.currentSort.direction === 'asc') ? 'desc' : 'asc';
        APP_ENVIADOS.state.currentSort.key = key;
    }
    APP_ENVIADOS.state.filteredAlbaranes.sort((a, b) => {
        let vA, vB;
        if (key === 'estado') {
            const getWeight = (x) => x.pagado ? 3 : (x.cobrado ? 2 : 1);
            vA = getWeight(a); vB = getWeight(b);
        } else if (key === 'empresa') {
            vA = SearchEngine.getEmpresaNombre(a); vB = SearchEngine.getEmpresaNombre(b);
        } else {
            vA = a[key]; vB = b[key];
            if (key === 'importe_total') { vA = parseFloat(vA || 0); vB = parseFloat(vB || 0); }
            if (key === 'fecha') { vA = new Date(vA).getTime(); vB = new Date(vB).getTime(); }
        }
        return (vA < vB ? -1 : 1) * (APP_ENVIADOS.state.currentSort.direction === 'asc' ? 1 : -1);
    });
    if (!isInitial) render();
}

function updateSortIcons() {
    ['numero_albaran', 'fecha', 'empresa', 'referencia', 'importe_total', 'estado'].forEach(k => {
        const icon = document.getElementById(`sort-${k}`);
        if (!icon) return;
        const isCurrent = k === APP_ENVIADOS.state.currentSort.key;
        icon.setAttribute('data-lucide', isCurrent ? (APP_ENVIADOS.state.currentSort.direction === 'asc' ? 'chevron-up' : 'chevron-down') : 'chevrons-up-down');
        icon.className = `w-3 h-3 ml-1 transition-all ${isCurrent ? 'text-primary-link opacity-100' : 'text-gray-400 opacity-30'}`;
    });
    if (window.lucide) lucide.createIcons();
}

function setupEvents() {
    document.getElementById('searchForm').onsubmit = handleSearch;
    APP_ENVIADOS.elements.recordsPerPage.onchange = (e) => {
        const val = e.target.value;
        APP_ENVIADOS.state.pageSize = val === 'todos' ? 9999 : parseInt(val);
        APP_ENVIADOS.state.currentPage = 1;
        render();
    };
    document.getElementById('prevPageBtn').onclick = () => { if(APP_ENVIADOS.state.currentPage > 1) { APP_ENVIADOS.state.currentPage--; render(); } };
    document.getElementById('nextPageBtn').onclick = () => { 
        if(APP_ENVIADOS.state.currentPage < Math.ceil(APP_ENVIADOS.state.filteredAlbaranes.length/APP_ENVIADOS.state.pageSize)) { 
            APP_ENVIADOS.state.currentPage++; render(); 
        } 
    };
}

window.UI = {
    setSearchModeManual(mode) {
        APP_ENVIADOS.state.searchMode = mode;
        document.getElementById('searchForm').classList.toggle('hidden', mode === 'palabra');
        document.getElementById('palabraSection').classList.toggle('hidden', mode === 'campos');
        const btnC = document.getElementById('btn-mode-campos'), btnP = document.getElementById('btn-mode-palabra');
        btnC.className = mode === 'campos' ? "px-4 py-2 rounded-lg bg-secondary-blue text-white font-black text-[10px] uppercase shadow-md" : "px-4 py-2 rounded-lg bg-white text-slate-400 font-black text-[10px] border";
        btnP.className = mode === 'palabra' ? "px-4 py-2 rounded-lg bg-primary-pastel text-black-pure font-bold text-[10px] uppercase shadow-md" : "px-4 py-2 rounded-lg bg-white text-slate-400 font-black text-[10px] border";
    },
    handleClearAllFilters() {
        document.getElementById('searchForm').reset();
        document.getElementById('palabra').value = '';
        handleSearch();
    }
};

window.sortTable = sortTable;
window.handleSearch = handleSearch;
window.handleLogout = () => { localStorage.removeItem('token'); window.location.href = '/login'; };

document.addEventListener('DOMContentLoaded', startApp);