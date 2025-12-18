/**
 * busqueda.js - Panel de Usuario (Titular)
 * Gestión de albaranes con trazabilidad completa y seguridad por licencia.
 */

const APP = {
    elements: {
        resultsBody: document.getElementById('albaranResults'),
        resultsCount: document.getElementById('resultsCount'),
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
        palabraInput: document.getElementById('palabra'),
        specificFields: [
            document.getElementById('empresa'),
            document.getElementById('state'),
            document.getElementById('referencia'),
            document.getElementById('fecha_desde'),
            document.getElementById('fecha_hasta'),
        ]
    },
    state: {
        filteredAlbaranes: [],
        currentPage: 1,
        pageSize: 10, // Límite inicial de 10 como solicitaste
        totalPages: 1,
        userLicenciaId: null,
        userLicenciaNumero: null,
        currentSort: { key: 'fecha', direction: 'desc' }
    }
};

// =================================================================================
// 🎨 UI HELPERS
// =================================================================================
const UI = {
    formatDate(isoString) { return isoString ? isoString.substring(0, 10) : '-'; },

    alertMessage(message, type = 'info') {
        const s = APP.elements.statusMessage;
        if (!s) return;
        s.textContent = message;
        s.className = `status-message status-${type} block p-3 rounded mb-4 text-center border font-bold`;
        s.classList.remove('hidden');
        if (type !== 'error') setTimeout(() => s.classList.add('hidden'), 5000);
    },

    updatePageInfo() {
        const total = APP.state.filteredAlbaranes.length;
        APP.state.totalPages = Math.ceil(total / APP.state.pageSize) || 1;
        if (APP.elements.pageInfo) APP.elements.pageInfo.textContent = `Pág ${APP.state.currentPage} de ${APP.state.totalPages}`;
        if (APP.elements.resultsCount) APP.elements.resultsCount.textContent = total;
        this.updatePaginationButtons();
    },

    updatePaginationButtons() {
        const { prevBtn, nextBtn } = APP.elements;
        if(prevBtn) prevBtn.disabled = APP.state.currentPage <= 1;
        if(nextBtn) nextBtn.disabled = APP.state.currentPage >= APP.state.totalPages;
    },

    updateActiveFiltersCount() {
        const formData = new FormData(APP.elements.searchForm);
        let count = 0;
        for (let [key, value] of formData.entries()) {
            if (key !== 'search_type' && key !== 'licencia_ref' && value && value.trim() !== '') count++;
        }
        if (APP.elements.activeFiltersCount) APP.elements.activeFiltersCount.textContent = count;
    }
};

// =================================================================================
// 📡 API SERVICES
// =================================================================================
const API = {
    /**
     * Recupera la licencia del token JWT.
     */
    async fetchMyLicencia() {
        const endpoint = '/api/v1/user/licencia_info';
        console.log(`📡 [AUTH] Solicitando identidad a: ${endpoint}`);
        
        try {
            const response = await fetch(endpoint);
            const data = await response.json();

            if (response.status === 401) {
                UI.alertMessage("Sesión caducada. Por favor, reincie sesión.", "error");
                return false;
            }

            // Manejamos el ID 1 y Licencia 001 que proporcionaste
            if (data && data.licencia_id !== undefined) {
                APP.state.userLicenciaId = data.licencia_id;
                APP.state.userLicenciaNumero = data.licencia_numero || "S/N";

                console.log(`🎯 [UI] Licencia detectada: ${APP.state.userLicenciaNumero}`);
                
                if (APP.elements.numLicenciaHeader) APP.elements.numLicenciaHeader.textContent = APP.state.userLicenciaNumero;
                if (APP.elements.licenciaDisplay) APP.elements.licenciaDisplay.value = APP.state.userLicenciaNumero;
                if (APP.elements.licenciaInput) APP.elements.licenciaInput.value = data.licencia_id;

                return true;
            }
            return false;
        } catch (e) {
            console.error("❌ [AUTH] Fallo crítico:", e);
            return false;
        }
    },

    async loadEmpresas() {
        try {
            const r = await fetch('/api/v1/empresas');
            const d = await r.json();
            const list = d.data || d;
            if(APP.elements.empresaSelect) {
                APP.elements.empresaSelect.innerHTML = '<option value="">Todas las empresas</option>' + 
                    list.map(e => `<option value="${e.id}">${e.nombre}</option>`).join('');
            }
        } catch (e) { console.error("❌ [DATA] Error empresas:", e); }
    },

    async searchAlbaranes() {
        if (APP.state.userLicenciaId === null) return;

        DOM.showLoading();
        const params = new URLSearchParams();
        
        // Aplicamos el límite de 10 solicitado
        params.append('pageSize', APP.state.pageSize.toString());
        params.append('licencia_ref', APP.state.userLicenciaId);

        const formData = new FormData(APP.elements.searchForm);
        for (let [key, value] of formData.entries()) {
            if (value && key !== 'licencia_ref') params.append(key, value);
        }

        try {
            const response = await fetch(`/api/v1/albaranes/search-user?${params.toString()}`);
            const data = await response.json();
            
            APP.state.filteredAlbaranes = data.data || [];
            APP.state.currentPage = 1;
            DOM.renderResults();
        } catch (e) {
            console.error("❌ [SEARCH] Error:", e);
            DOM.showNoResults();
        }
    }
};

// =================================================================================
// 🖼️ DOM RENDERING
// =================================================================================
const DOM = {
    showLoading() { APP.elements.resultsBody.innerHTML = '<tr><td colspan="8" class="text-center py-10 italic">Buscando...</td></tr>'; },
    showNoResults() { APP.elements.resultsBody.innerHTML = '<tr><td colspan="8" class="text-center py-10 text-orange-500 font-bold">No se encontraron albaranes.</td></tr>'; },

    renderResults() {
        const { resultsBody } = APP.elements;
        if (!resultsBody) return;
        resultsBody.innerHTML = '';

        const start = (APP.state.currentPage - 1) * APP.state.pageSize;
        const pageData = APP.state.filteredAlbaranes.slice(start, start + APP.state.pageSize);

        if (pageData.length === 0) { this.showNoResults(); return; }

        pageData.forEach(a => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50 border-b border-gray-100 transition-colors text-sm';
            tr.innerHTML = `
                <td class="px-4 py-3 font-bold text-gray-900">${a.numero_albaran || 'N/A'}</td>
                <td class="px-4 py-3 text-gray-600">${UI.formatDate(a.fecha)}</td>
                <td class="px-4 py-3 text-gray-800">${a.EmpresaData?.nombre || 'N/A'}</td>
                <td class="px-4 py-3 text-gray-500">${a.referencia || '-'}</td>
                <td class="px-4 py-3 text-gray-500">${a.asalariado || '-'}</td>
                <td class="px-4 py-3 text-right font-bold text-gray-900">${parseFloat(a.importe_total || 0).toFixed(2)}€</td>
                <td class="px-4 py-3 text-center">${this.getBadge(a)}</td>
                <td class="px-4 py-3 text-center">
                    <div class="flex justify-center space-x-2">
                        <button onclick="window.location.href='/titulares/view/${a.id}'" class="p-1.5 text-blue-600 hover:bg-blue-100 rounded-full transition" title="Ver"><i data-lucide="eye" class="w-4 h-4"></i></button>
                        <button onclick="window.location.href='/titulares/update/${a.id}'" class="p-1.5 text-orange-600 hover:bg-orange-100 rounded-full transition" title="Editar"><i data-lucide="pencil" class="w-4 h-4"></i></button>
                    </div>
                </td>`;
            resultsBody.appendChild(tr);
        });

        UI.updatePageInfo();
        if (window.lucide) lucide.createIcons();
    },

    getBadge(a) {
        if (a.pagado) return '<span class="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">PAGADO</span>';
        if (a.enviado) return '<span class="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">ENVIADO</span>';
        return '<span class="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">CREADO</span>';
    }
};

// =================================================================================
// 🚀 INITIALIZATION
// =================================================================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 [SYSTEM] Iniciando Panel de Usuario.");
    
    const hasLicense = await API.fetchMyLicencia();
    if (!hasLicense) {
        console.error("🛑 [INIT] No se pudo identificar la licencia.");
        return;
    }

    await API.loadEmpresas();
    API.searchAlbaranes();

    if (APP.elements.prevBtn) APP.elements.prevBtn.onclick = () => { if (APP.state.currentPage > 1) { APP.state.currentPage--; DOM.renderResults(); } };
    if (APP.elements.nextBtn) APP.elements.nextBtn.onclick = () => { if (APP.state.currentPage < APP.state.totalPages) { APP.state.currentPage++; DOM.renderResults(); } };
    
    if (APP.elements.recordsSelect) {
        APP.elements.recordsSelect.onchange = (e) => {
            APP.state.pageSize = parseInt(e.target.value);
            APP.state.currentPage = 1;
            DOM.renderResults();
        };
    }
});

window.handleSearch = (e) => { e.preventDefault(); API.searchAlbaranes(); };
window.handleClearAllFilters = () => {
    APP.elements.searchForm.reset();
    if (APP.state.userLicenciaId) APP.elements.licenciaInput.value = APP.state.userLicenciaId;
    API.searchAlbaranes();
};
window.sortTable = (key) => {
    let dir = (APP.state.currentSort.key === key && APP.state.currentSort.direction === 'asc') ? 'desc' : 'asc';
    APP.state.filteredAlbaranes.sort((a, b) => {
        let va = a[key] || '', vb = b[key] || '';
        return dir === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });
    APP.state.currentSort = { key, direction: dir };
    DOM.renderResults();
};
window.UI = UI;