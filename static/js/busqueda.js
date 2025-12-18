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

    alertMessage(message, type = 'info') {
        const s = APP.elements.statusMessage;
        if (!s) return;
        s.textContent = message;
        s.className = `status-message status-${type} block p-3 rounded mb-4 text-center border font-bold`;
        s.classList.remove('hidden');
        if (type !== 'error') setTimeout(() => s.classList.add('hidden'), 5000);
    },

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
        // Contamos cuántos campos tienen valor real
        const params = new URLSearchParams();
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
        // Siempre enviamos la licencia por seguridad
        params.append('licencia_ref', APP.state.userLicenciaId);
        
        // --- CAPTURA DE CAMPOS DINÁMICA ---
        const empresa = document.getElementById('empresa').value;
        const estado = document.getElementById('state').value;
        const referencia = document.getElementById('referencia').value;
        const desde = document.getElementById('fecha_desde').value;
        const hasta = document.getElementById('fecha_hasta').value;
        const palabra = document.getElementById('palabra').value;

        console.log("--- [FRONTEND-LOG] PREPARANDO QUERY ---");
        if (empresa) params.append('empresa_ref', empresa);
        if (estado) params.append('state', estado);
        if (referencia) params.append('referencia', referencia);
        if (desde) params.append('fecha_desde', desde);
        if (hasta) params.append('fecha_hasta', hasta);
        
        if (APP.state.searchMode === 'palabra' && palabra) {
            params.append('palabra', palabra);
        }

        try {
            const url = `/api/v1/albaranes/search-user?${params.toString()}`;
            console.log(`[FRONTEND-LOG] GET REQUEST: ${url}`);
            
            const response = await fetch(url);
            const data = await response.json();
            
            APP.state.filteredAlbaranes = data.data || [];
            APP.state.currentPage = 1;
            DOM.renderResults();
            UI.updateActiveFiltersCount(); // Actualizar contador visual
        } catch (e) { 
            console.error("[FRONTEND-LOG] Error:", e);
            DOM.showNoResults(); 
        }
    }
};

// =================================================================================
// 🖼️ DOM RENDERING
// =================================================================================
const DOM = {
    showLoading() { APP.elements.resultsBody.innerHTML = '<tr><td colspan="8" class="text-center py-10 italic">Buscando...</td></tr>'; },
    showNoResults() { APP.elements.resultsBody.innerHTML = '<tr><td colspan="8" class="text-center py-10 text-orange-500 font-bold">Sin resultados.</td></tr>'; },
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
// 🚀 INITIALIZATION & ACTIONS
// =================================================================================
document.addEventListener('DOMContentLoaded', async () => {
    const hasLicense = await API.fetchMyLicencia();
    if (!hasLicense) return;
    await API.loadEmpresas();
    UI.setSearchModeManual('campos');
    
    // --- EVENT LISTENERS PARA BÚSQUEDA AUTOMÁTICA ---
    // Esto hace que al cambiar la empresa o el estado, busque solo
    document.getElementById('empresa').addEventListener('change', () => API.searchAlbaranes());
    document.getElementById('state').addEventListener('change', () => API.searchAlbaranes());
    document.getElementById('fecha_desde').addEventListener('change', () => API.searchAlbaranes());
    document.getElementById('fecha_hasta').addEventListener('change', () => API.searchAlbaranes());

    API.searchAlbaranes();

    if (APP.elements.prevBtn) APP.elements.prevBtn.onclick = () => { if (APP.state.currentPage > 1) { APP.state.currentPage--; DOM.renderResults(); } };
    if (APP.elements.nextBtn) APP.elements.nextBtn.onclick = () => { if (APP.state.currentPage < APP.state.totalPages) { APP.state.currentPage++; DOM.renderResults(); } };
});

window.handleSearch = (e) => { if(e) e.preventDefault(); API.searchAlbaranes(); };

window.handleLogout = async () => { 
    await fetch('/api/v1/logout', { method: 'POST' }); 
    window.location.href = '/login'; 
};

window.handleClearAllFilters = () => {
    if (APP.elements.searchForm) {
        APP.elements.searchForm.reset();
        if (APP.state.userLicenciaId) {
            APP.elements.licenciaInput.value = APP.state.userLicenciaId;
            APP.elements.licenciaDisplay.value = APP.state.userLicenciaNumero;
        }
        UI.setSearchModeManual('campos'); 
        API.searchAlbaranes();
    }
};

window.UI = UI;