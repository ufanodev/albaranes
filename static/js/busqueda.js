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
        console.log(`[UI-LOG] Cambiando modo a: ${mode}`);
        APP.state.searchMode = mode;
        const btnCampos = document.getElementById('btn-mode-campos');
        const btnPalabra = document.getElementById('btn-mode-palabra');
        
        const fields = [
            APP.elements.empresaSelect,
            document.getElementById('state'),
            document.getElementById('referencia'),
            document.getElementById('fecha_desde'),
            document.getElementById('fecha_hasta')
        ];

        if (mode === 'campos') {
            btnCampos.className = "px-4 py-2 rounded-lg transition shadow-md bg-secondary-blue text-white font-bold";
            btnPalabra.className = "px-4 py-2 rounded-lg transition shadow-md bg-gray-200 text-gray-700";
            if(APP.elements.palabraInput) {
                APP.elements.palabraInput.value = '';
                APP.elements.palabraInput.disabled = true;
            }
            fields.forEach(f => { if(f) f.disabled = false; });
        } else {
            btnPalabra.className = "px-4 py-2 rounded-lg transition shadow-md bg-primary-pastel text-black-pure font-bold";
            btnCampos.className = "px-4 py-2 rounded-lg transition shadow-md bg-gray-200 text-gray-700";
            if(APP.elements.palabraInput) {
                APP.elements.palabraInput.disabled = false;
                APP.elements.palabraInput.focus();
            }
            fields.forEach(f => { if(f) { f.value = ''; f.disabled = true; } });
        }
    },

    updatePageInfo() {
        APP.state.totalPages = Math.ceil(APP.state.totalRecords / APP.state.pageSize) || 1;
        if (APP.elements.pageInfo) {
            APP.elements.pageInfo.textContent = `Pág ${APP.state.currentPage} de ${APP.state.totalPages}`;
        }
        const countDisplay = document.getElementById('resultsCount');
        if (countDisplay) {
            countDisplay.textContent = APP.state.totalRecords;
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
        const empresa = document.getElementById('empresa').value;
        const estado = document.getElementById('state').value;
        const referencia = document.getElementById('referencia').value;
        const desde = document.getElementById('fecha_desde').value;
        const hasta = document.getElementById('fecha_hasta').value;
        const palabra = document.getElementById('palabra').value;

        let count = 0;
        if (empresa) count++;
        if (estado) count++;
        if (referencia) count++;
        if (desde) count++;
        if (hasta) count++;
        if (APP.state.searchMode === 'palabra' && palabra) count++;

        if (APP.elements.activeFiltersCount) APP.elements.activeFiltersCount.textContent = count;
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
        
        const empresa = document.getElementById('empresa').value;
        const estado = document.getElementById('state').value;
        const referencia = document.getElementById('referencia').value;
        const desde = document.getElementById('fecha_desde').value;
        const hasta = document.getElementById('fecha_hasta').value;
        const palabra = document.getElementById('palabra').value;

        if (empresa) params.append('empresa_ref', empresa);
        if (estado) params.append('state', estado);
        if (referencia) params.append('referencia', referencia);
        if (desde) params.append('fecha_desde', desde);
        if (hasta) params.append('fecha_hasta', hasta);
        if (APP.state.searchMode === 'palabra' && palabra) params.append('palabra', palabra);

        try {
            const url = `/api/v1/albaranes/search-user?${params.toString()}`;
            const response = await fetch(url);
            const res = await response.json();
            APP.state.filteredAlbaranes = res.data || [];
            APP.state.totalRecords = res.total || 0;
            DOM.renderResults();
        } catch (e) { 
            DOM.showNoResults(); 
        }
    }
};

// =================================================================================
// 🖼️ DOM RENDERING
// =================================================================================
const DOM = {
    showLoading() { APP.elements.resultsBody.innerHTML = '<tr><td colspan="8" class="text-center py-10 italic">Cargando datos...</td></tr>'; },
    showNoResults() { APP.elements.resultsBody.innerHTML = '<tr><td colspan="8" class="text-center py-10 text-orange-500 font-bold">Sin resultados.</td></tr>'; },
    renderResults() {
        if (!APP.elements.resultsBody) return;
        APP.elements.resultsBody.innerHTML = '';
        const pageData = APP.state.filteredAlbaranes;

        if (pageData.length === 0) { this.showNoResults(); return; }

        pageData.forEach(a => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50 border-b border-gray-100 text-sm';
            tr.innerHTML = `
                <td class="px-4 py-3 font-bold">${a.numero_albaran || 'N/A'}</td>
                <td class="px-4 py-3">${UI.formatDate(a.fecha)}</td>
                <td class="px-4 py-3">${a.EmpresaData?.nombre || 'N/A'}</td>
                <td class="px-4 py-3">${a.referencia || '-'}</td>
                <td class="px-4 py-3">${a.asalariado || '-'}</td>
                <td class="px-4 py-3 text-right font-bold">${parseFloat(a.importe_total || 0).toFixed(2)}€</td>
                <td class="px-4 py-3 text-center">${this.getBadge(a)}</td>
                <td class="px-4 py-3 text-center">
                    <div class="flex justify-center space-x-2">
                        <button onclick="window.location.href='/titulares/view/${a.id}'" class="p-1 text-blue-600 hover:bg-blue-50 rounded"><i data-lucide="eye" class="w-4 h-4"></i></button>
                        <button onclick="window.location.href='/titulares/update/${a.id}'" class="p-1 text-orange-600 hover:bg-orange-50 rounded"><i data-lucide="pencil" class="w-4 h-4"></i></button>
                    </div>
                </td>`;
            APP.elements.resultsBody.appendChild(tr);
        });
        UI.updatePageInfo();
        if (window.lucide) lucide.createIcons();
    },
    getBadge(a) {
        if (a.pagado) return '<span class="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-[10px] font-bold">PAGADO</span>';
        if (a.enviado) return '<span class="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-[10px] font-bold">ENVIADO</span>';
        return '<span class="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-[10px] font-bold">CREADO</span>';
    }
};

// =================================================================================
// 🚀 EXPORT FUNCTIONS (NUEVAS)
// =================================================================================

window.handleGeneratePDF = async () => {
    if (APP.state.filteredAlbaranes.length === 0) return alert("No hay datos para exportar");
    
    const payload = {
        reportName: `Albaranes_Licencia_${APP.state.userLicenciaNumero}`,
        data: APP.state.filteredAlbaranes.map(a => ({
            "Nº ALBARÁN": a.numero_albaran,
            "FECHA": UI.formatDate(a.fecha),
            "EMPRESA": a.EmpresaData?.nombre || 'N/A',
            "REFERENCIA": a.referencia || '-',
            "CONDUCTOR": a.asalariado || '-',
            "IMPORTE": `${parseFloat(a.importe_total || 0).toFixed(2)}€`
        }))
    };

    try {
        const response = await fetch('/api/v1/albaranes/export/pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const res = await response.json();
        if (res.downloadURL) window.open(res.downloadURL, '_blank');
    } catch (e) { console.error("Error PDF:", e); }
};

window.handleGenerateXLSX = async () => {
    if (APP.state.filteredAlbaranes.length === 0) return alert("No hay datos para exportar");

    const payload = {
        reportName: `Albaranes_Licencia_${APP.state.userLicenciaNumero}`,
        data: APP.state.filteredAlbaranes.map(a => ({
            "Nº ALBARÁN": a.numero_albaran,
            "FECHA": UI.formatDate(a.fecha),
            "EMPRESA": a.EmpresaData?.nombre || 'N/A',
            "REFERENCIA": a.referencia || '-',
            "CONDUCTOR": a.asalariado || '-',
            "IMPORTE": parseFloat(a.importe_total || 0)
        }))
    };

    try {
        const response = await fetch('/api/v1/albaranes/export/xlsx', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const res = await response.json();
        if (res.downloadURL) window.open(res.downloadURL, '_blank');
    } catch (e) { console.error("Error Excel:", e); }
};

// =================================================================================
// 🚀 INITIALIZATION & ACTIONS
// =================================================================================
document.addEventListener('DOMContentLoaded', async () => {
    const hasLicense = await API.fetchMyLicencia();
    if (!hasLicense) return;
    await API.loadEmpresas();
    UI.setSearchModeManual('campos');
    
    ['empresa', 'state', 'fecha_desde', 'fecha_hasta'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', () => { APP.state.currentPage = 1; API.searchAlbaranes(); });
    });

    if (APP.elements.recordsSelect) {
        APP.elements.recordsSelect.addEventListener('change', (e) => {
            APP.state.pageSize = parseInt(e.target.value);
            APP.state.currentPage = 1; 
            API.searchAlbaranes();
        });
    }

    if (APP.elements.prevBtn) APP.elements.prevBtn.onclick = () => { if (APP.state.currentPage > 1) { APP.state.currentPage--; API.searchAlbaranes(); } };
    if (APP.elements.nextBtn) APP.elements.nextBtn.onclick = () => { if (APP.state.currentPage < APP.state.totalPages) { APP.state.currentPage++; API.searchAlbaranes(); } };

    API.searchAlbaranes();
});

window.handleSearch = (e) => { if(e && e.preventDefault) e.preventDefault(); APP.state.currentPage = 1; API.searchAlbaranes(); };

window.handleClearAllFilters = () => {
    if (APP.elements.searchForm) {
        APP.elements.searchForm.reset();
        if (APP.state.userLicenciaId) {
            APP.elements.licenciaInput.value = APP.state.userLicenciaId;
            APP.elements.licenciaDisplay.value = APP.state.userLicenciaNumero;
        }
        APP.state.currentPage = 1;
        UI.setSearchModeManual('campos'); 
        API.searchAlbaranes();
    }
};

window.handleLogout = async () => { await fetch('/api/v1/logout', { method: 'POST' }); window.location.href = '/login'; };
window.UI = UI;