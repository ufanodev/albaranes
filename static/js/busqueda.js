/**
 * ARCHIVO: static/js/busqueda.js
 * IMPORTANCIA: Media (Controlador de Interfaz Específico)
 * FUNCIÓN: Gestión de UI, Paginación, API y Renderizado de la tabla de búsqueda.
 * DEPENDE DE: search.js, albaran_cargar.js y oficina.js
 */

const APP = {
    elements: {
        resultsBody: document.getElementById('albaranResults'),
        totalImporte: document.getElementById('totalImporte'),
        pageInfo: document.getElementById('pageInfo'),
        numLicenciaHeader: document.getElementById('num_licencia_header'),
        licenciaDisplay: document.getElementById('licencia_display'),
        searchForm: document.getElementById('searchForm'),
        palabraInput: document.getElementById('palabra'),
        recordsSelect: document.getElementById('recordsPerPage'),
        prevBtn: document.getElementById('prevPageBtn'),
        nextBtn: document.getElementById('nextPageBtn'),
        tableFooter: document.getElementById('tableFooter')
    },
    state: {
        rawAlbaranes: [],       // Datos brutos de la API
        filteredAlbaranes: [], // Datos después de pasar por SearchEngine
        currentPage: 1,
        pageSize: 25,
        searchMode: 'campos',
        licId: null,
        currentSort: { key: 'fecha', direction: 'desc' }
    }
};

/**
 * 1. INICIALIZACIÓN
 */
async function startApp() {
    console.log("🚀 [BUSQUEDA] Iniciando controlador de vista...");
    try {
        const resp = await fetch('/api/v1/user/licencia_info', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const identity = await resp.json();
        APP.state.licId = identity.licencia_id;
        
        if (APP.elements.numLicenciaHeader) APP.elements.numLicenciaHeader.textContent = identity.licencia_numero;
        if (APP.elements.licenciaDisplay) APP.elements.licenciaDisplay.value = identity.licencia_numero;

        if (window.SearchEngine) {
            await SearchEngine.initCatalog();
        } else {
            console.error("❌ No se encontró SearchEngine. Revisa el orden de carga de scripts.");
        }

        await loadAlbaranes();
        setupEventListeners();

        window.APP_STATE = APP.state;

    } catch (e) {
        console.error("Fallo crítico en startApp:", e);
    }
}

/**
 * 2. LLAMADA A API
 */
async function loadAlbaranes() {
    APP.elements.resultsBody.innerHTML = '<tr><td colspan="8" class="text-center py-20 italic text-gray-400">Sincronizando registros...</td></tr>';
    
    try {
        const response = await fetch(`/api/v1/albaranes/search-user?licencia_ref=${APP.state.licId}&pageSize=5000`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const json = await response.json();
        APP.state.rawAlbaranes = json.data || json || [];
        executeFiltering(); 
    } catch (e) {
        APP.elements.resultsBody.innerHTML = '<tr><td colspan="8" class="text-center py-20 text-red-500 font-bold">Error al conectar con el servidor.</td></tr>';
    }
}

/**
 * 3. LÓGICA DE FILTRADO (DELEGADA)
 */
function executeFiltering(e) {
    if (e) e.preventDefault();
    
    const params = {
        mode: APP.state.searchMode,
        empresa: document.getElementById('empresa').value,
        estado: document.getElementById('state').value,
        ref: document.getElementById('referencia').value,
        desde: document.getElementById('fecha_desde').value,
        hasta: document.getElementById('fecha_hasta').value,
        palabra: APP.elements.palabraInput.value
    };

    if (window.SearchEngine) {
        APP.state.filteredAlbaranes = SearchEngine.applyFilters(APP.state.rawAlbaranes, params);
    }
    
    sortData(APP.state.currentSort.key, true);
    APP.state.currentPage = 1;
    renderTable();
}

/**
 * 4. RENDERIZADO DE TABLA
 */
function renderTable() {
    const { resultsBody, totalImporte, pageInfo, tableFooter } = APP.elements;
    if (!resultsBody) return;

    resultsBody.innerHTML = '';
    
    const start = (APP.state.currentPage - 1) * APP.state.pageSize;
    const pageItems = APP.state.filteredAlbaranes.slice(start, start + APP.state.pageSize);

    if (pageItems.length === 0) {
        resultsBody.innerHTML = '<tr><td colspan="8" class="text-center py-20 text-slate-400 italic font-medium border-b">No se han encontrado albaranes.</td></tr>';
        if (tableFooter) tableFooter.classList.add('hidden');
        return;
    }

    let sumTotalFull = APP.state.filteredAlbaranes.reduce((acc, curr) => acc + parseFloat(curr.importe_total || 0), 0);

    pageItems.forEach(a => {
        const imp = parseFloat(a.importe_total || 0);
        
        // FIX FINAL: Usamos AlbaranLoader para garantizar DD/MM/YYYY
        const fechaDisplay = window.AlbaranLoader 
            ? AlbaranLoader.formatEuropeanDate(a.fecha) 
            : (a.fecha ? a.fecha.substring(0,10) : '-');

        const row = `
            <tr class="hover:bg-orange-50/30 border-b border-gray-100 transition-colors text-sm group">
                <td class="px-4 py-4 font-black text-gray-900">${a.numero_albaran || 'N/A'}</td>
                <td class="px-4 py-4 text-gray-500 font-bold">${fechaDisplay}</td>
                <td class="px-4 py-4 font-bold uppercase text-blue-600">${SearchEngine.getEmpresaNombre(a)}</td>
                <td class="px-4 py-4 text-gray-400 italic text-xs uppercase">${a.referencia || '---'}</td>
                <td class="px-4 py-4 text-gray-600 font-medium uppercase">${a.asalariado || 'TITULAR'}</td>
                <td class="px-4 py-4 text-right font-black text-primary-link text-sm">€${imp.toFixed(2)}</td>
                <td class="px-4 py-4 text-center">${getBadge(a)}</td>
                <td class="px-4 py-4 text-center">
                    <div class="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onclick="window.location.href='/titulares/view/${a.id}'" class="p-2 text-secondary-blue hover:bg-blue-100 rounded-xl transition-all"><i data-lucide="eye" class="w-4 h-4"></i></button>
                    </div>
                </td>
            </tr>`;
        resultsBody.insertAdjacentHTML('beforeend', row);
    });

    totalImporte.textContent = `€${sumTotalFull.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
    if (tableFooter) tableFooter.classList.remove('hidden');
    
    document.getElementById('resultsCount').textContent = `${APP.state.filteredAlbaranes.length} REGISTROS`;
    
    const totalPages = Math.ceil(APP.state.filteredAlbaranes.length / APP.state.pageSize) || 1;
    pageInfo.textContent = `${APP.state.currentPage} / ${totalPages}`;
    
    if (window.lucide) lucide.createIcons();
    updateSortIcons();
}

function getBadge(a) {
    if (a.pagado) return '<span class="bg-green-100 text-green-700 px-3 py-1 rounded-full text-[9px] font-black border border-green-200 uppercase">PAGADO</span>';
    if (a.enviado) return '<span class="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-[9px] font-black border border-blue-200 uppercase">ENVIADO</span>';
    return '<span class="bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-[9px] font-black border border-gray-200 uppercase">CREADO</span>';
}

/**
 * 5. ORDENACIÓN
 */
function sortData(key, isInitial = false) {
    if (!isInitial) {
        APP.state.currentSort.direction = (APP.state.currentSort.key === key && APP.state.currentSort.direction === 'asc') ? 'desc' : 'asc';
        APP.state.currentSort.key = key;
    }
    
    APP.state.filteredAlbaranes.sort((a, b) => {
        let vA = a[key], vB = b[key];
        if (key === 'empresa') { vA = SearchEngine.getEmpresaNombre(a); vB = SearchEngine.getEmpresaNombre(b); }
        if (key === 'importe_total') { vA = parseFloat(vA || 0); vB = parseFloat(vB || 0); }
        if (key === 'fecha') { 
            vA = vA ? new Date(vA).getTime() : 0; 
            vB = vB ? new Date(vB).getTime() : 0; 
        }
        return (vA < vB ? -1 : 1) * (APP.state.currentSort.direction === 'asc' ? 1 : -1);
    });
    if (!isInitial) renderTable();
}

function updateSortIcons() {
    ['numero_albaran', 'fecha', 'empresa', 'referencia', 'importe_total'].forEach(k => {
        const icon = document.getElementById(`sort-${k}`);
        if (!icon) return;
        const isCurrent = k === APP.state.currentSort.key;
        icon.setAttribute('data-lucide', isCurrent ? (APP.state.currentSort.direction === 'asc' ? 'chevron-up' : 'chevron-down') : 'chevrons-up-down');
        icon.className = `w-3 h-3 ml-1 transition-all ${isCurrent ? 'text-primary-link opacity-100' : 'text-gray-400 opacity-30'}`;
    });
    if (window.lucide) lucide.createIcons();
}

/**
 * 6. EVENTOS DE INTERFAZ
 */
function setupEventListeners() {
    APP.elements.searchForm.onsubmit = executeFiltering;

    ['empresa', 'state', 'referencia', 'fecha_desde', 'fecha_hasta'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.onchange = () => executeFiltering();
    });

    APP.elements.recordsSelect.onchange = (e) => {
        const val = e.target.value;
        APP.state.pageSize = val === 'todos' ? 9999 : parseInt(val);
        APP.state.currentPage = 1;
        renderTable();
    };

    APP.elements.prevBtn.onclick = () => { 
        if(APP.state.currentPage > 1) { APP.state.currentPage--; renderTable(); } 
    };

    APP.elements.nextBtn.onclick = () => { 
        const total = Math.ceil(APP.state.filteredAlbaranes.length/APP.state.pageSize);
        if(APP.state.currentPage < total) { APP.state.currentPage++; renderTable(); } 
    };
}

/**
 * 7. HELPERS GLOBALES
 */
window.UI = {
    setSearchModeManual(mode) {
        APP.state.searchMode = mode;
        document.getElementById('palabraSection').classList.toggle('hidden', mode === 'campos');
        document.getElementById('searchForm').classList.toggle('hidden', mode === 'palabra');
        const btnBuscar = document.getElementById('btn-buscar-campos');
        if(btnBuscar) btnBuscar.classList.toggle('hidden', mode === 'palabra');
        
        const btnC = document.getElementById('btn-mode-campos'), btnP = document.getElementById('btn-mode-palabra');
        if (mode === 'campos') {
            btnC.className = "px-4 py-2 rounded-lg bg-secondary-blue text-white font-bold text-[10px] uppercase shadow-md";
            btnP.className = "px-4 py-2 rounded-lg bg-gray-200 text-gray-700 text-[10px] uppercase";
        } else {
            btnP.className = "px-4 py-2 rounded-lg bg-primary-pastel text-black-pure font-bold text-[10px] uppercase shadow-md";
            btnC.className = "px-4 py-2 rounded-lg bg-gray-200 text-gray-700 text-[10px] uppercase";
        }
    }
};

window.sortTable = sortData;
window.handleSearch = executeFiltering;
window.handleClearAllFilters = () => {
    APP.elements.searchForm.reset();
    APP.elements.palabraInput.value = '';
    executeFiltering();
};
window.handleLogout = () => { localStorage.removeItem('token'); window.location.href = '/login'; };

document.addEventListener('DOMContentLoaded', startApp);