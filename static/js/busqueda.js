/**
 * busqueda.js - Panel de Usuario (Titular)
 * Gestión de albaranes con logs de auditoría para sincronización con Go.
 */

const APP = {
    elements: {
        resultsBody: document.getElementById('albaranResults'),
        statusMessage: document.getElementById('statusMessage'),
        numLicenciaHeader: document.getElementById('num_licencia_header'),
        licenciaDisplay: document.getElementById('licencia_display'),
        licenciaInput: document.getElementById('licencia_ref'), 
        searchForm: document.getElementById('searchForm'),
        recordsSelect: document.getElementById('recordsPerPage'),
        pageInfo: document.getElementById('pageInfo'),
        prevBtn: document.getElementById('prevPageBtn'),
        nextBtn: document.getElementById('nextPageBtn'),
        activeFiltersCount: document.getElementById('activeFiltersCount'),
        empresaSelect: document.getElementById('empresa'),
        palabraInput: document.getElementById('palabra')
    },
    state: {
        filteredAlbaranes: [],
        totalRecords: 0,      
        currentPage: 1,       
        pageSize: 25,         
        totalPages: 1,        
        userLicenciaId: null,
        userLicenciaNumero: null,
        currentSort: { key: 'fecha', direction: 'desc' },
        searchMode: 'campos' 
    }
};

// =================================================================================
// 🎨 UI HELPERS
// =================================================================================
const UI = {
    formatDate(isoString) { return isoString ? isoString.substring(0, 10) : '-'; },

    setSearchModeManual(mode) {
        APP.state.searchMode = mode;
        const btnCampos = document.getElementById('btn-mode-campos');
        const btnPalabra = document.getElementById('btn-mode-palabra');
        const palabraSection = document.getElementById('palabraSection');
        const searchForm = document.getElementById('searchForm');

        if (mode === 'campos') {
            btnCampos.className = "px-4 py-2 rounded-lg transition shadow-md bg-secondary-blue text-white font-bold text-[10px] uppercase";
            btnPalabra.className = "px-4 py-2 rounded-lg transition shadow-md bg-gray-200 text-gray-700 text-[10px] uppercase";
            if(palabraSection) palabraSection.classList.add('hidden');
            if(searchForm) searchForm.classList.remove('hidden');
        } else {
            btnPalabra.className = "px-4 py-2 rounded-lg transition shadow-md bg-primary-pastel text-black-pure font-bold text-[10px] uppercase";
            btnCampos.className = "px-4 py-2 rounded-lg transition shadow-md bg-gray-200 text-gray-700 text-[10px] uppercase";
            if(palabraSection) {
                palabraSection.classList.remove('hidden');
                if(APP.elements.palabraInput) APP.elements.palabraInput.focus();
            }
            if(searchForm) searchForm.classList.add('hidden');
        }
    },

    updatePageInfo() {
        // Calcular total de páginas basándose en el total de registros de la API
        APP.state.totalPages = Math.ceil(APP.state.totalRecords / APP.state.pageSize) || 1;
        
        // 1. Actualizar indicador de página (Ej: 1 / 2)
        if (APP.elements.pageInfo) {
            APP.elements.pageInfo.textContent = `${APP.state.currentPage} / ${APP.state.totalPages}`;
        }
        
        // 2. Actualizar el Badge de Registros (Ej: 18 REGISTROS)
        const countDisplay = document.getElementById('resultsCount');
        if (countDisplay) {
            countDisplay.textContent = `${APP.state.totalRecords} REGISTROS`;
        }
        
        this.updatePaginationButtons();
        this.updateActiveFiltersCount();
    },

    updatePaginationButtons() {
        const { prevBtn, nextBtn } = APP.elements;
        if(prevBtn) prevBtn.disabled = APP.state.currentPage <= 1;
        if(nextBtn) nextBtn.disabled = APP.state.currentPage >= APP.state.totalPages;
    },

    updateActiveFiltersCount() {
        const filters = ['empresa', 'state', 'referencia', 'fecha_desde', 'fecha_hasta', 'palabra'];
        let count = 0;
        filters.forEach(id => {
            const val = document.getElementById(id)?.value;
            if (val && val !== "") count++;
        });
        // Sincronizar el texto del badge de filtros si existe
        const activeCountEl = document.getElementById('activeFiltersCount');
        if (activeCountEl) activeCountEl.textContent = count;
    },

    updateSortIcons() {
        const { key, direction } = APP.state.currentSort;
        const sortKeys = ['numero_albaran', 'fecha', 'empresa', 'referencia', 'importe_total', 'estado'];
        
        sortKeys.forEach(k => {
            const icon = document.getElementById(`sort-${k}`);
            if (icon) {
                if (k === key) {
                    icon.setAttribute('data-lucide', direction === 'asc' ? 'chevron-up' : 'chevron-down');
                    icon.classList.replace('opacity-50', 'opacity-100');
                } else {
                    icon.setAttribute('data-lucide', 'chevrons-up-down');
                    icon.classList.replace('opacity-100', 'opacity-50');
                }
            }
        });
        if (window.lucide) lucide.createIcons();
    }
};

// =================================================================================
// 📡 API SERVICES
// =================================================================================
const API = {
    async fetchMyLicencia() {
        try {
            const response = await fetch('/api/v1/user/licencia_info');
            const data = await response.json();
            if (data && data.licencia_id !== undefined) {
                APP.state.userLicenciaId = data.licencia_id;
                APP.state.userLicenciaNumero = data.licencia_numero || "S/N";
                if (APP.elements.licenciaDisplay) APP.elements.licenciaDisplay.value = APP.state.userLicenciaNumero;
                if (APP.elements.licenciaInput) APP.elements.licenciaInput.value = data.licencia_id;
                if (APP.elements.numLicenciaHeader) APP.elements.numLicenciaHeader.textContent = APP.state.userLicenciaNumero;
                return true;
            }
            return false;
        } catch (e) { return false; }
    },

    async loadEmpresas() {
        try {
            const r = await fetch('/api/v1/empresas');
            const d = await r.json();
            const list = d.data || d;
            if(APP.elements.empresaSelect) {
                let html = '<option value="">Todas las empresas</option>';
                list.forEach(e => { html += `<option value="${e.id}">${e.nombre}</option>`; });
                APP.elements.empresaSelect.innerHTML = html;
            }
        } catch (e) { console.error(e); }
    },

    async searchAlbaranes() {
        if (APP.state.userLicenciaId === null) return;
        DOM.showLoading();
        
        const params = new URLSearchParams();
        params.append('licencia_ref', APP.state.userLicenciaId);
        params.append('page', APP.state.currentPage);
        params.append('pageSize', APP.state.pageSize);
        
        // Captura de filtros dinámicos
        const empresa = document.getElementById('empresa').value;
        const estado = document.getElementById('state').value;
        const referencia = document.getElementById('referencia').value;
        const desde = document.getElementById('fecha_desde').value;
        const hasta = document.getElementById('fecha_hasta').value;
        const palabra = document.getElementById('palabra').value;

        if (APP.state.searchMode === 'campos') {
            if (empresa) params.append('empresa_ref', empresa);
            if (estado) params.append('state', estado);
            if (referencia) params.append('referencia', referencia);
            if (desde) params.append('fecha_desde', desde);
            if (hasta) params.append('fecha_hasta', hasta);
        } else {
            if (palabra) params.append('palabra', palabra);
        }

        try {
            const url = `/api/v1/albaranes/search-user?${params.toString()}`;
            const response = await fetch(url);
            const res = await response.json();
            APP.state.filteredAlbaranes = res.data || [];
            APP.state.totalRecords = res.total || 0;
            
            this.applyLocalSort();
            DOM.renderResults();
        } catch (e) { 
            DOM.showNoResults(); 
        }
    },

    applyLocalSort() {
        const { key, direction } = APP.state.currentSort;
        APP.state.filteredAlbaranes.sort((a, b) => {
            let valA, valB;
            switch(key) {
                case 'fecha':
                    valA = new Date(a.fecha || 0).getTime();
                    valB = new Date(b.fecha || 0).getTime();
                    break;
                case 'importe_total':
                    valA = parseFloat(a.importe_total || 0);
                    valB = parseFloat(b.importe_total || 0);
                    break;
                case 'empresa':
                    valA = (a.EmpresaData?.nombre || '').toLowerCase();
                    valB = (b.EmpresaData?.nombre || '').toLowerCase();
                    break;
                case 'estado':
                    const score = (i) => i.pagado ? 2 : (i.enviado ? 1 : 0);
                    valA = score(a); valB = score(b);
                    break;
                default:
                    valA = (a[key] || '').toString().toLowerCase();
                    valB = (b[key] || '').toString().toLowerCase();
            }
            if (valA < valB) return direction === 'asc' ? -1 : 1;
            if (valA > valB) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    }
};

// =================================================================================
// 🖼️ DOM RENDERING
// =================================================================================
const DOM = {
    showLoading() { APP.elements.resultsBody.innerHTML = '<tr><td colspan="8" class="text-center py-20 italic text-gray-400">Cargando datos...</td></tr>'; },
    showNoResults() { APP.elements.resultsBody.innerHTML = '<tr><td colspan="8" class="text-center py-20 text-orange-500 font-bold">No se han encontrado resultados.</td></tr>'; },
    renderResults() {
        if (!APP.elements.resultsBody) return;
        APP.elements.resultsBody.innerHTML = '';
        if (APP.state.filteredAlbaranes.length === 0) { this.showNoResults(); return; }

        APP.state.filteredAlbaranes.forEach(a => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-orange-50/30 border-b border-gray-100 transition-colors text-sm';
            tr.innerHTML = `
                <td class="px-4 py-4 font-black text-gray-900">${a.numero_albaran || 'N/A'}</td>
                <td class="px-4 py-4 text-gray-500">${UI.formatDate(a.fecha)}</td>
                <td class="px-4 py-4 font-medium text-gray-700">${a.EmpresaData?.nombre || 'N/A'}</td>
                <td class="px-4 py-4 text-gray-400 italic text-xs">${a.referencia || '-'}</td>
                <td class="px-4 py-4 text-gray-600">${a.asalariado || '-'}</td>
                <td class="px-4 py-4 text-right font-black text-primary-link text-sm">€${parseFloat(a.importe_total || 0).toFixed(2)}</td>
                <td class="px-4 py-4 text-center">${this.getBadge(a)}</td>
                <td class="px-4 py-4 text-center">
                    <div class="flex justify-center space-x-2">
                        <button onclick="window.location.href='/titulares/view/${a.id}'" class="p-1.5 text-secondary-blue hover:bg-blue-50 rounded-lg transition-colors"><i data-lucide="eye" class="w-4 h-4"></i></button>
                        <button onclick="window.location.href='/titulares/update/${a.id}'" class="p-1.5 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"><i data-lucide="pencil" class="w-4 h-4"></i></button>
                    </div>
                </td>`;
            APP.elements.resultsBody.appendChild(tr);
        });
        UI.updatePageInfo();
        UI.updateSortIcons();
    },
    getBadge(a) {
        if (a.pagado) return '<span class="bg-green-100 text-green-700 px-2.5 py-1 rounded-full text-[9px] font-black uppercase border border-green-200">PAGADO</span>';
        if (a.enviado) return '<span class="bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full text-[9px] font-black uppercase border border-blue-200">ENVIADO</span>';
        return '<span class="bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full text-[9px] font-black uppercase border border-gray-200">CREADO</span>';
    }
};

// =================================================================================
// 🚀 ORDENACIÓN Y EXPORTACIÓN
// =================================================================================
window.sortTable = function(key) {
    const { currentSort } = APP.state;
    if (currentSort.key === key) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.key = key;
        currentSort.direction = 'asc';
    }
    API.applyLocalSort();
    DOM.renderResults();
};

window.handleGeneratePDF = async () => {
    if (APP.state.filteredAlbaranes.length === 0) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'pt', 'a4');
    const rows = APP.state.filteredAlbaranes.map(a => [a.numero_albaran, UI.formatDate(a.fecha), a.EmpresaData?.nombre || 'N/A', a.referencia || '-', `${parseFloat(a.importe_total || 0).toFixed(2)}€`]);
    doc.setFontSize(16); doc.text(`Informe de Albaranes - Licencia ${APP.state.userLicenciaNumero}`, 40, 30);
    doc.autoTable({ head: [['Nº Albarán', 'Fecha', 'Empresa', 'Ref', 'Total']], body: rows, startY: 50, headStyles: { fillColor: [255, 140, 0] } });
    doc.save(`Busqueda_Licencia_${APP.state.userLicenciaNumero}.pdf`);
};

window.handleGenerateXLSX = async () => {
    if (APP.state.filteredAlbaranes.length === 0) return;
    const data = APP.state.filteredAlbaranes.map(a => ({ "Nº Albarán": a.numero_albaran, "Fecha": UI.formatDate(a.fecha), "Empresa": a.EmpresaData?.nombre, "Importe": a.importe_total }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Albaranes");
    XLSX.writeFile(wb, `Busqueda_Licencia_${APP.state.userLicenciaNumero}.xlsx`);
};

// =================================================================================
// 🚀 INITIALIZATION
// =================================================================================
document.addEventListener('DOMContentLoaded', async () => {
    if (await API.fetchMyLicencia()) {
        await API.loadEmpresas();
        UI.setSearchModeManual('campos');
        
        // Listeners automáticos para filtros
        ['empresa', 'state', 'fecha_desde', 'fecha_hasta'].forEach(id => {
            document.getElementById(id)?.addEventListener('change', () => { APP.state.currentPage = 1; API.searchAlbaranes(); });
        });

        // Paginación y Registros
        APP.elements.recordsSelect.onchange = (e) => {
            APP.state.pageSize = e.target.value === 'todos' ? 9999 : parseInt(e.target.value);
            APP.state.currentPage = 1; API.searchAlbaranes();
        };
        APP.elements.prevBtn.onclick = () => { if (APP.state.currentPage > 1) { APP.state.currentPage--; API.searchAlbaranes(); } };
        APP.elements.nextBtn.onclick = () => { if (APP.state.currentPage < APP.state.totalPages) { APP.state.currentPage++; API.searchAlbaranes(); } };

        API.searchAlbaranes();
    }
});

window.handleSearch = (e) => { if(e) e.preventDefault(); APP.state.currentPage = 1; API.searchAlbaranes(); };
window.handleClearAllFilters = () => {
    if (APP.elements.searchForm) APP.elements.searchForm.reset();
    if (document.getElementById('palabra')) document.getElementById('palabra').value = '';
    APP.elements.licenciaDisplay.value = APP.state.userLicenciaNumero;
    APP.state.currentPage = 1;
    UI.setSearchModeManual('campos');
    API.searchAlbaranes();
};
window.handleLogout = async () => { await fetch('/api/v1/logout', { method: 'POST' }); window.location.href = '/login'; };