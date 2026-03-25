/**
 * ARCHIVO: static/js/admin.js
 */
const APP = {
    elements: {
        resultsBody: document.getElementById('albaranResults'),
        tableFooter: document.getElementById('tableFooter'),
        totalImporte: document.getElementById('totalImporte'),
        searchForm: document.getElementById('searchForm'),
        recordsSelect: document.getElementById('recordsPerPage'),
        statusMessage: document.getElementById('statusMessage'),
        pageInfo: document.getElementById('pageInfo'),
        totalLabel: document.getElementById('totalLabel'),
        resultsCount: document.getElementById('resultsCount'),
        palabraInput: document.getElementById('palabra'),
        prevBtn: document.getElementById('prevPageBtn'),
        nextBtn: document.getElementById('nextPageBtn')
    },
    state: {
        rawAlbaranes: [],
        filteredAlbaranes: [],
        currentPage: 1,
        pageSize: 25,
        searchMode: 'campos',
        currentSort: { key: 'fecha', direction: 'desc' }
    }
};

const UI_ADMIN = {
    alertMessage(message, type = 'info') {
        const s = APP.elements.statusMessage;
        if (!s) return;
        s.textContent = message;
        const bgClass = type === 'success' ? 'bg-green-100 border-green-500 text-green-700' : 'bg-red-100 border-red-500 text-red-700';
        s.className = `status-message ${bgClass} block p-4 rounded-xl shadow-2xl border-2 font-bold`;
        s.classList.remove('hidden');
        setTimeout(() => s.classList.add('hidden'), 5000);
    },
    updateSortIcons() {
        ['numero_albaran', 'fecha', 'licencia', 'empresa_nombre', 'referencia', 'num_factura', 'importe_total'].forEach(k => {
            const span = document.getElementById(`sort-icon-${k}`);
            if (!span) return;
            const isCurrent = k === APP.state.currentSort.key;
            span.innerHTML = isCurrent ? (APP.state.currentSort.direction === 'asc' ? '↑' : '↓') : '↕';
            span.className = `ml-1 transition-all ${isCurrent ? 'text-primary-link font-black opacity-100' : 'opacity-30 italic'}`;
        });
    }
};

async function startAdmin() {
    try {
        await SearchEngine.initCatalog(true);
        await loadData();
        setupEventListeners();
    } catch (e) { console.error(e); }
}

async function loadData() {
    APP.elements.resultsBody.innerHTML = '<tr><td colspan="12" class="p-20 text-center italic text-slate-400">Consultando base de datos...</td></tr>';
    try {
        const res = await fetch('/api/v1/albaranes/search?pageSize=10000', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const json = await res.json();
        APP.state.rawAlbaranes = json.data || json || [];
        handleSearch();
    } catch (e) { console.error(e); }
}

function handleSearch(e) {
    if (e) e.preventDefault();
    const params = {
        mode: APP.state.searchMode,
        licencia: document.getElementById('licenciaSelect').value,
        empresa: document.getElementById('empresaSelect').value,
        estado: document.getElementById('state').value,
        ref: APP.elements.searchForm.querySelector('[name="referencia"]').value,
        num_albaran: APP.elements.searchForm.querySelector('[name="numero_albaran"]').value,
        desde: APP.elements.searchForm.querySelector('[name="fecha_desde"]').value,
        hasta: APP.elements.searchForm.querySelector('[name="fecha_hasta"]').value,
        palabra: APP.elements.palabraInput.value
    };
    APP.state.filteredAlbaranes = SearchEngine.applyFilters(APP.state.rawAlbaranes, params);
    handleSort(APP.state.currentSort.key, true);
    APP.state.currentPage = 1;
    render();
}

function render() {
    const { resultsBody, tableFooter, totalImporte, pageInfo, resultsCount, totalLabel } = APP.elements;
    resultsBody.innerHTML = '';
    const start = (APP.state.currentPage - 1) * APP.state.pageSize;
    const pageItems = APP.state.filteredAlbaranes.slice(start, start + APP.state.pageSize);

    if (pageItems.length === 0) {
        resultsBody.innerHTML = '<tr><td colspan="12" class="p-20 text-center text-orange-500 font-bold uppercase">Sin registros coincidentes</td></tr>';
        if (tableFooter) tableFooter.classList.add('hidden');
        return;
    }

    let sum = 0;
    pageItems.forEach(a => {
        const imp = parseFloat(a.importe_total || 0);
        sum += imp;
        const row = `
            <tr class="hover:bg-orange-50/40 transition-colors group">
                <td class="px-3 py-3 font-bold">${a.numero_albaran || 'N/A'}</td>
                <td class="px-3 py-3 font-bold text-slate-500">${a.fecha ? a.fecha.substring(0,10) : '-'}</td>
                <td class="px-3 py-3 font-black text-blue-600 uppercase tracking-tighter">${SearchEngine.getLicenciaNumero(a)}</td>
                <td class="px-3 py-3 font-bold uppercase truncate">${SearchEngine.getEmpresaNombre(a)}</td>
                <td class="px-3 py-3 text-slate-400 italic font-black uppercase text-[9px]">${a.referencia || '-'}</td>
                <td class="px-3 py-3">${a.num_factura || '-'}</td>
                <td class="px-3 py-3 text-right font-black text-primary-link bg-orange-50/30">€${imp.toFixed(2)}</td>
                <td class="text-center">${a.enviado ? '✅' : '⚪'}</td>
                <td class="text-center">${a.cobrado ? '✅' : '⚪'}</td>
                <td class="text-center">${a.pagado ? '✅' : '⚪'}</td>
                <td class="px-3 py-3 truncate max-w-[120px] text-gray-400">${a.observaciones || '-'}</td>
                <td class="px-3 py-3 text-center">
                    <div class="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onclick="window.location.href='/admin/albaranes/view/${a.id}'" class="p-1 text-blue-500 hover:bg-blue-100 rounded" title="Ver"><i data-lucide="eye" class="w-3.5 h-3.5"></i></button>
                        <button onclick="window.location.href='/admin/albaranes/update/${a.id}'" class="p-1 text-orange-500 hover:bg-orange-100 rounded" title="Editar"><i data-lucide="pencil" class="w-3.5 h-3.5"></i></button>
                        <button onclick="handleDeleteAction(${a.id})" class="p-1 text-red-500 hover:bg-red-100 rounded" title="Borrar"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                    </div>
                </td>
            </tr>`;
        resultsBody.insertAdjacentHTML('beforeend', row);
    });

    totalImporte.textContent = `€${sum.toFixed(2)}`;
    tableFooter.classList.remove('hidden');
    resultsCount.textContent = APP.state.filteredAlbaranes.length;
    const totalPages = Math.ceil(APP.state.filteredAlbaranes.length / APP.state.pageSize) || 1;
    pageInfo.textContent = `${APP.state.currentPage} / ${totalPages}`;
    totalLabel.textContent = `${APP.state.filteredAlbaranes.length} REGISTROS TOTALES`;
    
    if (window.lucide) lucide.createIcons();
    UI_ADMIN.updateSortIcons();
}

function handleSort(key, isInitial = false) {
    if (!isInitial) {
        APP.state.currentSort.direction = (APP.state.currentSort.key === key && APP.state.currentSort.direction === 'asc') ? 'desc' : 'asc';
        APP.state.currentSort.key = key;
    }
    APP.state.filteredAlbaranes.sort((a, b) => {
        let vA = a[key], vB = b[key];
        if (key === 'empresa_nombre') { vA = SearchEngine.getEmpresaNombre(a); vB = SearchEngine.getEmpresaNombre(b); }
        if (key === 'licencia') { vA = SearchEngine.getLicenciaNumero(a); vB = SearchEngine.getLicenciaNumero(b); }
        if (key === 'importe_total') { vA = parseFloat(vA || 0); vB = parseFloat(vB || 0); }
        if (key === 'fecha') { vA = new Date(vA).getTime(); vB = new Date(vB).getTime(); }
        return (vA < vB ? -1 : 1) * (APP.state.currentSort.direction === 'asc' ? 1 : -1);
    });
    if (!isInitial) render();
}

/**
 * GESTIÓN DE EXPORTACIÓN
 */
window.handleGeneratePDF = () => {
    if (APP.state.filteredAlbaranes.length === 0) return;
    
    // Mapeo exacto de los datos para el PDF visual
    const dataClean = APP.state.filteredAlbaranes.map(a => ({
        "Nº ALBARAN": a.numero_albaran,
        "FECHA": a.fecha ? a.fecha.substring(0,10) : "-",
        "LICENCIA": SearchEngine.getLicenciaNumero(a),
        "EMPRESA": SearchEngine.getEmpresaNombre(a),
        "EXPEDIENTE": a.referencia || "-",
        "TOTAL": `€${parseFloat(a.importe_total || 0).toFixed(2)}`
    }));
    
    Oficina.generarPDF("LISTADO_ALBARANES_REGISTRADOS", dataClean);
};

window.handleGenerateXLSX = () => {
    if (APP.state.filteredAlbaranes.length === 0) return;
    const dataClean = APP.state.filteredAlbaranes.map(a => ({
        "Nº ALBARAN": a.numero_albaran,
        "FECHA": a.fecha ? a.fecha.substring(0,10) : "-",
        "LICENCIA": SearchEngine.getLicenciaNumero(a),
        "EMPRESA": SearchEngine.getEmpresaNombre(a),
        "EXPEDIENTE": a.referencia,
        "TOTAL": parseFloat(a.importe_total || 0)
    }));
    Oficina.generarExcel("LISTADO_ALBARANES", dataClean);
};

window.handleDeleteAction = async (id) => {
    if (!confirm("¿Eliminar?")) return;
    try {
        const res = await fetch(`/api/v1/albaranes/${id}`, { 
            method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } 
        });
        if (res.ok) { UI_ADMIN.alertMessage("Eliminado", "success"); loadData(); }
    } catch (e) { console.error(e); }
};

function setupEventListeners() {
    APP.elements.searchForm.onsubmit = handleSearch;
    APP.elements.recordsSelect.onchange = (e) => {
        APP.state.pageSize = e.target.value === 'todos' ? 99999 : parseInt(e.target.value);
        APP.state.currentPage = 1;
        render();
    };
    APP.elements.prevBtn.onclick = () => { if(APP.state.currentPage > 1) { APP.state.currentPage--; render(); } };
    APP.elements.nextBtn.onclick = () => { 
        if(APP.state.currentPage < Math.ceil(APP.state.filteredAlbaranes.length/APP.state.pageSize)) { 
            APP.state.currentPage++; render(); 
        } 
    };
}

window.handleSearch = handleSearch;
window.handleSort = handleSort;
window.handleClearAllFilters = () => { APP.elements.searchForm.reset(); document.getElementById('palabra').value = ''; handleSearch(); };

window.UI = {
    setSearchModeManual(mode) {
        APP.state.searchMode = mode;
        document.getElementById('palabraSection').classList.toggle('hidden', mode === 'campos');
        document.getElementById('searchForm').classList.toggle('hidden', mode === 'palabra');
    }
};

document.addEventListener('DOMContentLoaded', startAdmin);