/**
 * busqueda.js - Panel de Usuario (Titular)
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
        currentPage: 1,
        pageSize: 10,
        totalPages: 1,
        userLicenciaId: null,
        userLicenciaNumero: null,
        currentSort: { key: 'fecha', direction: 'desc' },
        searchMode: 'campos' // 'campos' o 'palabra'
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

    /**
     * 🎯 Implementación del cambio de modo solicitado
     */
    setSearchModeManual(mode) {
        APP.state.searchMode = mode;
        const btnCampos = document.getElementById('btn-mode-campos');
        const btnPalabra = document.getElementById('btn-mode-palabra');
        const specificFields = [
            APP.elements.empresaSelect,
            document.getElementById('state'),
            document.getElementById('referencia'),
            document.getElementById('fecha_desde'),
            document.getElementById('fecha_hasta')
        ];

        if (mode === 'campos') {
            // Estética de botones
            btnCampos.classList.replace('bg-gray-200', 'bg-secondary-blue');
            btnCampos.classList.add('text-white');
            btnPalabra.classList.replace('bg-primary-pastel', 'bg-gray-200');
            btnPalabra.classList.remove('text-black-pure');

            // Lógica de inputs
            if(APP.elements.palabraInput) {
                APP.elements.palabraInput.value = '';
                APP.elements.palabraInput.disabled = true;
                APP.elements.palabraInput.classList.add('bg-gray-100', 'cursor-not-allowed');
            }
            specificFields.forEach(f => {
                if(f) {
                    f.disabled = false;
                    f.classList.remove('bg-gray-100', 'cursor-not-allowed');
                }
            });
            UI.alertMessage("Modo: Búsqueda por Campos específicos", "info");

        } else {
            // Estética de botones
            btnPalabra.classList.replace('bg-gray-200', 'bg-primary-pastel');
            btnPalabra.classList.add('text-black-pure');
            btnCampos.classList.replace('bg-secondary-blue', 'bg-gray-200');
            btnCampos.classList.remove('text-white');

            // Lógica de inputs
            if(APP.elements.palabraInput) {
                APP.elements.palabraInput.disabled = false;
                APP.elements.palabraInput.classList.remove('bg-gray-100', 'cursor-not-allowed');
                APP.elements.palabraInput.focus();
            }
            specificFields.forEach(f => {
                if(f) {
                    f.value = ''; // Limpiamos para no mezclar criterios
                    f.disabled = true;
                    f.classList.add('bg-gray-100', 'cursor-not-allowed');
                }
            });
            UI.alertMessage("Modo: Búsqueda Global por Palabra", "info");
        }
    },

    updatePageInfo() {
        const total = APP.state.filteredAlbaranes.length;
        APP.state.totalPages = Math.ceil(total / APP.state.pageSize) || 1;
        if (APP.elements.pageInfo) APP.elements.pageInfo.textContent = `Pág ${APP.state.currentPage} de ${APP.state.totalPages}`;
        const countDisplay = document.getElementById('resultsCount');
        if (countDisplay) countDisplay.textContent = total;
        this.updatePaginationButtons();
        this.updateActiveFiltersCount();
    },

    updatePaginationButtons() {
        const { prevBtn, nextBtn } = APP.elements;
        if(prevBtn) prevBtn.disabled = APP.state.currentPage <= 1;
        if(nextBtn) nextBtn.disabled = APP.state.currentPage >= APP.state.totalPages;
    },

    updateActiveFiltersCount() {
        if (!APP.elements.searchForm) return;
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
        
        const formData = new FormData(APP.elements.searchForm);
        for (let [key, value] of formData.entries()) {
            // El backend ya discrimina si recibe 'palabra' o filtros individuales
            if (value && key !== 'licencia_ref') params.append(key, value);
        }

        try {
            const response = await fetch(`/api/v1/albaranes/search-user?${params.toString()}`);
            const data = await response.json();
            APP.state.filteredAlbaranes = data.data || [];
            APP.state.currentPage = 1;
            DOM.renderResults();
        } catch (e) { DOM.showNoResults(); }
    }
};

// =================================================================================
// 🖼️ DOM RENDERING
// =================================================================================
const DOM = {
    showLoading() { APP.elements.resultsBody.innerHTML = '<tr><td colspan="8" class="text-center py-10 italic">Buscando...</td></tr>'; },
    showNoResults() { APP.elements.resultsBody.innerHTML = '<tr><td colspan="8" class="text-center py-10 text-orange-500 font-bold">No se encontraron albaranes.</td></tr>'; },
    renderResults() {
        if (!APP.elements.resultsBody) return;
        APP.elements.resultsBody.innerHTML = '';
        const start = (APP.state.currentPage - 1) * APP.state.pageSize;
        const pageData = APP.state.filteredAlbaranes.slice(start, start + APP.state.pageSize);
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
                        <button onclick="window.location.href='/titulares/update/${a.id}'" class="p-1 text-orange-600 hover:bg-orange-100 rounded"><i data-lucide="pencil" class="w-4 h-4"></i></button>
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
// 🚀 INITIALIZATION
// =================================================================================
document.addEventListener('DOMContentLoaded', async () => {
    const hasLicense = await API.fetchMyLicencia();
    if (!hasLicense) return;
    await API.loadEmpresas();
    
    // Iniciamos en modo campos por defecto
    UI.setSearchModeManual('campos');
    API.searchAlbaranes();

    if (APP.elements.prevBtn) APP.elements.prevBtn.onclick = () => { if (APP.state.currentPage > 1) { APP.state.currentPage--; DOM.renderResults(); } };
    if (APP.elements.nextBtn) APP.elements.nextBtn.onclick = () => { if (APP.state.currentPage < APP.state.totalPages) { APP.state.currentPage++; DOM.renderResults(); } };
});

window.handleSearch = (e) => { if(e) e.preventDefault(); API.searchAlbaranes(); };
window.handleClearAllFilters = () => {
    if (APP.elements.searchForm) {
        APP.elements.searchForm.reset();
        if (APP.state.userLicenciaId) {
            APP.elements.licenciaInput.value = APP.state.userLicenciaId;
            APP.elements.licenciaDisplay.value = APP.state.userLicenciaNumero;
        }
        UI.setSearchModeManual('campos'); // Al limpiar volvemos a modo campos
        API.searchAlbaranes();
    }
};

window.UI = UI;