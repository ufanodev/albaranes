/**
 * ARCHIVO: static/js/albaran_enviado.js
 * FUNCIÓN: Controlador del Histórico (Enviados/Cobrados/Pagados) con FIX en Licencia y Subtotal.
 * ACTUALIZADO: 27/03/2026
 */

const APP_ENVIADOS = {
    elements: {
        resultsBody: document.getElementById('albaranResults'),
        totalFooter: document.getElementById('albaranTotal'), // Añadido
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

        if (window.SearchEngine) {
            await SearchEngine.initCatalog();
        }
        
        await loadData();
        setupEvents();
        
        window.APP_STATE = APP_ENVIADOS.state;
    } catch (e) { 
        console.error("Error al iniciar histórico:", e); 
    }
}

async function loadData() {
    const { resultsBody } = APP_ENVIADOS.elements;
    resultsBody.innerHTML = '<tr><td colspan="9" class="text-center py-20 italic text-slate-400 font-medium">Consultando histórico...</td></tr>';
    
    try {
        const response = await fetch(`/api/v1/albaranes/search-user?licencia_ref=${APP_ENVIADOS.state.licId}&pageSize=5000`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const json = await response.json();
        const items = json.data || json || [];

        APP_ENVIADOS.state.rawAlbaranes = items.filter(i => i.enviado || i.cobrado || i.pagado);
        handleSearch(); 
    } catch (e) {
        resultsBody.innerHTML = '<tr><td colspan="9" class="text-center py-20 text-red-500 font-bold">Error de conexión</td></tr>';
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

    if (window.SearchEngine) {
        APP_ENVIADOS.state.filteredAlbaranes = SearchEngine.applyFilters(APP_ENVIADOS.state.rawAlbaranes, params);
    } else {
        APP_ENVIADOS.state.filteredAlbaranes = APP_ENVIADOS.state.rawAlbaranes;
    }

    sortTable(APP_ENVIADOS.state.currentSort.key, true);
    APP_ENVIADOS.state.currentPage = 1;
    render();
}

function render() {
    const { resultsBody, totalFooter, pageInfo, activeCount } = APP_ENVIADOS.elements;
    if (!resultsBody) return;
    resultsBody.innerHTML = '';

    const start = (APP_ENVIADOS.state.currentPage - 1) * APP_ENVIADOS.state.pageSize;
    const pageItems = APP_ENVIADOS.state.filteredAlbaranes.slice(start, start + APP_ENVIADOS.state.pageSize);

    if (pageItems.length === 0) {
        resultsBody.innerHTML = '<tr><td colspan="9" class="text-center py-24 text-slate-400 italic font-medium">Sin registros históricos coincidentes.</td></tr>';
        if (totalFooter) totalFooter.innerHTML = '';
        return;
    }

    let sumaTotal = 0; // Suma acumulada de la página actual
    pageItems.forEach(i => {
        const imp = parseFloat(i.importe_total || 0);
        sumaTotal += imp;
        
        let numLicencia = "---";
        if (i.licencia_data && i.licencia_data.licencia) {
            numLicencia = i.licencia_data.licencia;
        } else if (i.licencia) {
            numLicencia = i.licencia;
        } else if (window.SearchEngine) {
            numLicencia = SearchEngine.getLicenciaNumero(i);
        }

        let badge = i.pagado ? 'Pagado' : (i.cobrado ? 'Cobrado' : 'Enviado');
        let badgeColor = i.pagado ? 'bg-green-100 text-green-700 border-green-200' : 
                         (i.cobrado ? 'bg-teal-100 text-teal-700 border-teal-200' : 'bg-orange-100 text-orange-700 border-orange-200');

        const row = `
            <tr class="hover:bg-slate-50 border-b border-slate-100 transition-colors group">
                <td class="px-4 py-4 font-black text-slate-900">${i.numero_albaran}</td>
                <td class="px-4 py-4 text-slate-500 font-bold">${i.fecha ? i.fecha.substring(0,10) : "-"}</td>
                <td class="px-4 py-4 text-blue-600 font-black">${numLicencia}</td>
                <td class="px-4 py-4 font-bold text-slate-700 uppercase truncate max-w-[150px]">
                    ${window.SearchEngine ? SearchEngine.getEmpresaNombre(i) : (i.empresa_nombre || '---')}
                </td>
                <td class="px-4 py-4 text-slate-400 italic">${i.referencia || '-'}</td>
                <td class="px-4 py-4 text-slate-600 font-semibold uppercase">${i.asalariado || 'TITULAR'}</td>
                <td class="px-4 py-4 text-right font-black text-slate-900 tracking-tight">€${imp.toFixed(2)}</td>
                <td class="px-4 py-4 text-center">
                    <span class="px-2.5 py-0.5 ${badgeColor} rounded-full text-[9px] font-black uppercase border">${badge}</span>
                </td>
                <td class="px-4 py-4 text-center">
                    <a href="/titulares/view/${i.id}" class="text-slate-400 hover:text-blue-600 transition-transform hover:scale-125 inline-block" title="Ver Detalle">
                        <i data-lucide="eye" class="w-5 h-5"></i>
                    </a>
                </td>
            </tr>`;
        resultsBody.insertAdjacentHTML('beforeend', row);
    });

    // Inyección del Subtotal en el tfoot
    if (totalFooter) {
        totalFooter.innerHTML = `
            <tr>
                <td colspan="6" class="px-4 py-4 text-right text-slate-400 text-[10px] font-black uppercase tracking-tighter">Subtotal Página:</td>
                <td class="px-4 py-4 text-right text-base text-black-pure font-black bg-slate-100/50 border-l border-slate-200">€${sumaTotal.toFixed(2)}</td>
                <td colspan="2"></td>
            </tr>`;
    }

    if (activeCount) activeCount.textContent = `${APP_ENVIADOS.state.filteredAlbaranes.length} REGISTROS`;
    if (pageInfo) {
        const totalP = Math.ceil(APP_ENVIADOS.state.filteredAlbaranes.length / APP_ENVIADOS.state.pageSize) || 1;
        pageInfo.textContent = `${APP_ENVIADOS.state.currentPage} / ${totalP}`;
    }
    
    if (window.lucide) lucide.createIcons();
    updateSortIcons();
}

window.handleGeneratePDF = () => {
    const data = APP_ENVIADOS.state.filteredAlbaranes;
    if (data.length === 0) return alert("Sin datos");
    const clean = data.map(i => ({
        "Nº ALBARAN": i.numero_albaran,
        "FECHA": i.fecha ? i.fecha.substring(0,10) : "-",
        "EMPRESA": window.SearchEngine ? SearchEngine.getEmpresaNombre(i) : (i.empresa_nombre || '---'),
        "EXPEDIENTE": i.referencia || "-",
        "ESTADO": i.pagado ? 'PAGADO' : (i.cobrado ? 'COBRADO' : 'ENVIADO'),
        "TOTAL": `€${parseFloat(i.importe_total || 0).toFixed(2)}`
    }));
    if (window.Oficina) Oficina.generarPDF("HISTORICO_ENVIADOS", clean);
};

window.handleGenerateXLSX = () => {
    const data = APP_ENVIADOS.state.filteredAlbaranes;
    if (data.length === 0) return alert("Sin datos");
    const clean = data.map(i => ({
        "Nº ALBARAN": i.numero_albaran,
        "FECHA": i.fecha ? i.fecha.substring(0,10) : "-",
        "LICENCIA": i.licencia_data ? i.licencia_data.licencia : (i.licencia || "---"),
        "EMPRESA": window.SearchEngine ? SearchEngine.getEmpresaNombre(i) : (i.empresa_nombre || '---'),
        "EXPEDIENTE": i.referencia,
        "IMPORTE": parseFloat(i.importe_total || 0)
    }));
    if (window.Oficina) Oficina.generarExcel("HISTORICO_ENVIADOS", clean);
};

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
        } else if (key === 'empresa' && window.SearchEngine) {
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
    const sForm = document.getElementById('searchForm');
    if (sForm) sForm.onsubmit = handleSearch;
    
    const rPerPage = APP_ENVIADOS.elements.recordsPerPage;
    if (rPerPage) {
        rPerPage.onchange = (e) => {
            const val = e.target.value;
            APP_ENVIADOS.state.pageSize = val === 'todos' ? 9999 : parseInt(val);
            APP_ENVIADOS.state.currentPage = 1;
            render();
        };
    }

    document.getElementById('prevPageBtn').onclick = () => { if(APP_ENVIADOS.state.currentPage > 1) { APP_ENVIADOS.state.currentPage--; render(); } };
    document.getElementById('nextPageBtn').onclick = () => { 
        const totalP = Math.ceil(APP_ENVIADOS.state.filteredAlbaranes.length / APP_ENVIADOS.state.pageSize);
        if(APP_ENVIADOS.state.currentPage < totalP) { 
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
        btnC.className = mode === 'campos' ? "px-4 py-2 rounded-lg bg-secondary-blue text-white font-black text-[10px] uppercase shadow-md transition-all" : "px-4 py-2 rounded-lg bg-white text-slate-400 font-black text-[10px] uppercase border hover:bg-slate-50 transition-all";
        btnP.className = mode === 'palabra' ? "px-4 py-2 rounded-lg bg-primary-pastel text-black-pure font-bold text-[10px] uppercase shadow-md transition-all" : "px-4 py-2 rounded-lg bg-white text-slate-400 font-black text-[10px] uppercase border hover:bg-slate-50 transition-all";
    },
    handleClearAllFilters() {
        const sForm = document.getElementById('searchForm');
        if (sForm) sForm.reset();
        const pInput = document.getElementById('palabra');
        if (pInput) pInput.value = '';
        handleSearch();
    }
};

window.sortTable = sortTable;
window.handleSearch = handleSearch;
window.handleLogout = () => { localStorage.removeItem('token'); window.location.href = '/login'; };

document.addEventListener('DOMContentLoaded', startApp);