/**
 * ARCHIVO: static/js/busqueda.js
 * DESCRIPCIÓN: Lógica completa de búsqueda, paginación y exportación.
 * FIX: Carga inicial forzada en orden DESCENDENTE por fecha.
 */

const APP = {
    elements: {
        resultsBody: document.getElementById('albaranResults'),
        tableFooter: document.getElementById('tableFooter'),
        totalImporte: document.getElementById('totalImporte'),
        numLicenciaHeader: document.getElementById('num_licencia_header'),
        licenciaDisplay: document.getElementById('licencia_display'),
        licenciaInput: document.getElementById('licencia_ref'), 
        searchForm: document.getElementById('searchForm'),
        recordsSelect: document.getElementById('recordsPerPage'),
        pageInfo: document.getElementById('pageInfo'),
        prevBtn: document.getElementById('prevPageBtn'),
        nextBtn: document.getElementById('nextPageBtn'),
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
        // ✅ FIX: Forzamos el estado inicial a fecha DESC
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
        console.log(`%c[AUDITORÍA] Cambio de modo: ${mode}`, "color: #FF8C00; font-weight: bold;");
        APP.state.searchMode = mode;
        const btnCampos = document.getElementById('btn-mode-campos');
        const btnPalabra = document.getElementById('btn-mode-palabra');
        const palabraSection = document.getElementById('palabraSection');
        const searchForm = document.getElementById('searchForm');

        if (mode === 'campos') {
            if(btnCampos) btnCampos.className = "px-4 py-2 rounded-lg transition shadow-md bg-secondary-blue text-white font-bold text-[10px] uppercase";
            if(btnPalabra) btnPalabra.className = "px-4 py-2 rounded-lg transition shadow-md bg-gray-200 text-gray-700 text-[10px] uppercase";
            if(palabraSection) palabraSection.classList.add('hidden');
            if(searchForm) searchForm.classList.remove('hidden');
        } else {
            if(btnPalabra) btnPalabra.className = "px-4 py-2 rounded-lg transition shadow-md bg-primary-pastel text-black-pure font-bold text-[10px] uppercase";
            if(btnCampos) btnCampos.className = "px-4 py-2 rounded-lg transition shadow-md bg-gray-200 text-gray-700 text-[10px] uppercase";
            if(palabraSection) {
                palabraSection.classList.remove('hidden');
                if(APP.elements.palabraInput) APP.elements.palabraInput.focus();
            }
            if(searchForm) searchForm.classList.add('hidden');
        }
        API.searchAlbaranes();
    },

    updatePageInfo() {
        APP.state.totalPages = Math.ceil(APP.state.totalRecords / APP.state.pageSize) || 1;
        if (APP.elements.pageInfo) {
            APP.elements.pageInfo.textContent = `${APP.state.currentPage} / ${APP.state.totalPages}`;
        }
        const countDisplay = document.getElementById('resultsCount');
        if (countDisplay) countDisplay.textContent = `${APP.state.totalRecords} REGISTROS`;
        this.updatePaginationButtons();
    },

    updatePaginationButtons() {
        const { prevBtn, nextBtn } = APP.elements;
        if(prevBtn) prevBtn.disabled = APP.state.currentPage <= 1;
        if(nextBtn) nextBtn.disabled = APP.state.currentPage >= APP.state.totalPages;
    },

    updateSortIcons() {
        const { key, direction } = APP.state.currentSort;
        const sortKeys = ['numero_albaran', 'fecha', 'empresa', 'referencia', 'importe_total', 'estado'];
        sortKeys.forEach(k => {
            const icon = document.getElementById(`sort-${k}`);
            if (icon) {
                if (k === key) {
                    icon.setAttribute('data-lucide', direction === 'asc' ? 'chevron-up' : 'chevron-down');
                    icon.className = "w-3 h-3 ml-1 text-primary-link opacity-100 transition-all";
                } else {
                    icon.setAttribute('data-lucide', 'chevrons-up-down');
                    icon.className = "w-3 h-3 ml-1 text-gray-400 opacity-30 group-hover:opacity-100 transition-all";
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
            if(APP.elements.empresaSelect && Array.isArray(list)) {
                let html = '<option value="">🎯 Todas las empresas</option>';
                list.sort((a,b) => a.nombre.localeCompare(b.nombre)).forEach(e => { 
                    html += `<option value="${e.id}">${e.nombre.toUpperCase()}</option>`; 
                });
                APP.elements.empresaSelect.innerHTML = html;
            }
        } catch (e) { console.error("Error empresas:", e); }
    },

    async searchAlbaranes() {
        if (APP.state.userLicenciaId === null) return;
        DOM.showLoading();
        
        const params = new URLSearchParams();
        params.append('licencia_ref', APP.state.userLicenciaId);
        params.append('page', APP.state.currentPage);
        params.append('pageSize', APP.state.pageSize);
        
        if (APP.state.searchMode === 'campos') {
            const empresa = document.getElementById('empresa').value;
            const estado = document.getElementById('state').value;
            const referencia = document.getElementById('referencia').value;
            const fDesde = document.getElementById('fecha_desde').value;
            const fHasta = document.getElementById('fecha_hasta').value;

            if (empresa) params.append('empresa_ref', empresa);
            if (referencia) params.append('referencia', referencia);
            if (fDesde) params.append('fecha_desde', fDesde);
            if (fHasta) params.append('fecha_hasta', fHasta);

            if (estado === 'pagado') params.append('pagado', 'true');
            if (estado === 'enviado') params.append('enviado', 'true');
            if (estado === 'creado') {
                params.append('enviado', 'false');
                params.append('pagado', 'false');
            }
        } else {
            const palabra = document.getElementById('palabra').value;
            if (palabra) params.append('palabra', palabra);
        }

        try {
            const url = `/api/v1/albaranes/search-user?${params.toString()}`;
            const response = await fetch(url);
            const res = await response.json();
            
            APP.state.filteredAlbaranes = res.data || [];
            APP.state.totalRecords = res.total || 0;
            
            // ✅ APLICAR ORDENACIÓN INMEDIATAMENTE
            this.applyLocalSort();
            DOM.renderResults();
            UI.updatePageInfo();
        } catch (e) { 
            console.error("❌ Error en búsqueda:", e);
            DOM.showNoResults(); 
        }
    },

    applyLocalSort() {
        const { key, direction } = APP.state.currentSort;
        console.log(`📊 [ORDENACIÓN] Aplicando: ${key} | ${direction}`);
        
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
                    valA = (a.empresa_nombre || '').toLowerCase();
                    valB = (b.empresa_nombre || '').toLowerCase();
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
    showLoading() { 
        APP.elements.resultsBody.innerHTML = '<tr><td colspan="8" class="text-center py-20 italic text-gray-400">Consultando...</td></tr>'; 
    },
    showNoResults() { 
        APP.elements.resultsBody.innerHTML = '<tr><td colspan="8" class="text-center py-20 text-orange-500 font-bold">No hay resultados que coincidan.</td></tr>'; 
    },
    
    renderResults() {
        if (!APP.elements.resultsBody) return;
        APP.elements.resultsBody.innerHTML = '';
        if (APP.state.filteredAlbaranes.length === 0) { this.showNoResults(); return; }

        let sumatorio = 0;
        APP.state.filteredAlbaranes.forEach(a => {
            const importe = parseFloat(a.importe_total || 0);
            sumatorio += importe;
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-orange-50/30 border-b border-gray-100 transition-colors text-sm group';
            tr.innerHTML = `
                <td class="px-4 py-4 font-black text-gray-900">${a.numero_albaran || 'N/A'}</td>
                <td class="px-4 py-4 text-gray-500 font-bold">${UI.formatDate(a.fecha)}</td>
                <td class="px-4 py-4 font-medium text-gray-700 uppercase">${a.empresa_nombre || '-'}</td>
                <td class="px-4 py-4 text-gray-400 italic text-xs uppercase">${a.referencia || '-'}</td>
                <td class="px-4 py-4 text-gray-600 font-medium uppercase">${a.asalariado || 'TITULAR'}</td>
                <td class="px-4 py-4 text-right font-black text-primary-link text-sm">€${importe.toFixed(2)}</td>
                <td class="px-4 py-4 text-center">${this.getBadge(a)}</td>
                <td class="px-4 py-4 text-center">
                    <div class="flex justify-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onclick="window.location.href='/titulares/view/${a.id}'" class="p-2 text-secondary-blue hover:bg-blue-100 rounded-xl transition-all" title="Ver detalle"><i data-lucide="eye" class="w-4 h-4"></i></button>
                        <button onclick="window.location.href='/titulares/update/${a.id}'" class="p-2 text-orange-600 hover:bg-orange-100 rounded-xl transition-all" title="Editar"><i data-lucide="pencil" class="w-4 h-4"></i></button>
                    </div>
                </td>`;
            APP.elements.resultsBody.appendChild(tr);
        });

        APP.elements.totalImporte.textContent = `€${sumatorio.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
        if(APP.elements.tableFooter) APP.elements.tableFooter.classList.remove('hidden');
        UI.updatePageInfo();
        UI.updateSortIcons();
    },

    getBadge(a) {
        if (a.pagado) return '<span class="bg-green-100 text-green-700 px-3 py-1 rounded-full text-[9px] font-black border border-green-200">PAGADO</span>';
        if (a.enviado) return '<span class="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-[9px] font-black border border-blue-200">ENVIADO</span>';
        return '<span class="bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-[9px] font-black border border-gray-200">CREADO</span>';
    }
};

// =================================================================================
// 🚀 EVENTOS GLOBALES
// =================================================================================

window.sortTable = (key) => {
    if (APP.state.currentSort.key === key) {
        APP.state.currentSort.direction = APP.state.currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        APP.state.currentSort.key = key;
        APP.state.currentSort.direction = 'asc';
    }
    API.applyLocalSort();
    DOM.renderResults();
};

window.handleSearch = (e) => { 
    if(e) e.preventDefault(); 
    APP.state.currentPage = 1; 
    API.searchAlbaranes(); 
};

window.handleClearAllFilters = () => {
    if(APP.elements.searchForm) APP.elements.searchForm.reset();
    if(APP.elements.palabraInput) APP.elements.palabraInput.value = '';
    APP.state.currentPage = 1;
    // Forzamos el orden por fecha al limpiar
    APP.state.currentSort = { key: 'fecha', direction: 'desc' };
    API.searchAlbaranes();
};

// =================================================================================
// 🏁 INICIALIZACIÓN
// =================================================================================
document.addEventListener('DOMContentLoaded', async () => {
    if (await API.fetchMyLicencia()) {
        await API.loadEmpresas();
        
        ['empresa', 'state', 'fecha_desde', 'fecha_hasta'].forEach(id => {
            document.getElementById(id)?.addEventListener('change', () => { 
                APP.state.currentPage = 1; 
                API.searchAlbaranes(); 
            });
        });

        const recordsSelect = document.getElementById('recordsPerPage');
        if(recordsSelect) {
            recordsSelect.onchange = (e) => {
                const val = e.target.value;
                APP.state.pageSize = val === 'todos' ? 99999 : parseInt(val);
                APP.state.currentPage = 1;
                API.searchAlbaranes();
            };
        }

        const prevBtn = document.getElementById('prevPageBtn');
        const nextBtn = document.getElementById('nextPageBtn');
        if(prevBtn) prevBtn.onclick = () => { if (APP.state.currentPage > 1) { APP.state.currentPage--; API.searchAlbaranes(); } };
        if(nextBtn) nextBtn.onclick = () => { if (APP.state.currentPage < APP.state.totalPages) { APP.state.currentPage++; API.searchAlbaranes(); } };
        
        // Carga inicial
        API.searchAlbaranes();
    }
});