/**
 * busqueda.js - Panel de Usuario (Titular)
 * Gestión de albaranes, Búsqueda Pro, Exportaciones y Sesión.
 */

const APP = {
    elements: {
        resultsBody: document.getElementById('albaranResults'),
        searchForm: document.getElementById('searchForm'),
        recordsSelect: document.getElementById('recordsPerPage'),
        statusMessage: document.getElementById('statusMessage'),
        pageInfo: document.getElementById('pageInfo'),
        resultsCount: document.getElementById('resultsCount'),
        prevBtn: document.getElementById('prevPageBtn'),
        nextBtn: document.getElementById('nextPageBtn'),
        numLicenciaHeader: document.getElementById('num_licencia_header'),
        licenciaDisplay: document.getElementById('licencia_display'),
        licenciaInput: document.getElementById('licencia_ref'), 
        empresaSelect: document.getElementById('empresa'),
        stateSelect: document.getElementById('state'),
        palabraInput: document.getElementById('palabra'),
        activeFiltersCount: document.getElementById('activeFiltersCount'),
        btnModeCampos: document.getElementById('btn-mode-campos'),
        btnModePalabra: document.getElementById('btn-mode-palabra'),
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
        pageSize: 10,
        totalPages: 1,
        userLicenciaId: null,
        userLicenciaNumero: null,
        searchMode: 'campos' 
    }
};

// =================================================================================
// 🎨 UI HELPERS & MODES
// =================================================================================
const UI = {
    formatDate(isoString) { return isoString ? isoString.substring(0, 10) : '-'; },

    setSearchModeManual(mode) {
        this.setSearchMode(mode);
        API.searchAlbaranes(); 
    },

    setSearchMode(mode) {
        APP.state.searchMode = mode;
        const { palabraInput, specificFields, btnModeCampos, btnModePalabra } = APP.elements;
        
        if (btnModeCampos && btnModePalabra) {
            const isCampos = mode === 'campos';
            btnModeCampos.className = isCampos ? "px-4 py-2 rounded-lg transition shadow-md bg-secondary-blue text-white" : "px-4 py-2 rounded-lg transition shadow-md bg-primary-pastel text-black-pure";
            btnModePalabra.className = isCampos ? "px-4 py-2 rounded-lg transition shadow-md bg-primary-pastel text-black-pure" : "px-4 py-2 rounded-lg transition shadow-md bg-secondary-blue text-white";
        }

        if (mode === 'palabra') {
            if(palabraInput) { palabraInput.disabled = false; palabraInput.parentElement.parentElement.style.opacity = "1"; }
            specificFields.forEach(f => { if(f) { f.disabled = true; f.classList.add('bg-gray-100'); f.parentElement.style.opacity = "0.5"; } });
        } else {
            if(palabraInput) { palabraInput.disabled = true; palabraInput.value = ''; palabraInput.parentElement.parentElement.style.opacity = "0.5"; }
            specificFields.forEach(f => { if(f) { f.disabled = false; f.classList.remove('bg-gray-100'); f.parentElement.style.opacity = "1"; } });
        }
        this.updateActiveFiltersCount();
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
        const params = this.getCleanParams();
        let count = 0;
        Object.keys(params).forEach(k => { if (k !== 'licencia_ref' && params[k]) count++; });
        if (APP.elements.activeFiltersCount) APP.elements.activeFiltersCount.textContent = count;
    },

    getCleanParams() {
        const data = {};
        if (APP.state.userLicenciaId) data['licencia_ref'] = APP.state.userLicenciaId;
        if (APP.state.searchMode === 'campos') {
            ['empresa_ref', 'state', 'referencia', 'fecha_desde', 'fecha_hasta'].forEach(name => {
                const el = APP.elements.searchForm.querySelector(`[name="${name}"]`);
                if (el && !el.disabled && el.value && el.value.trim() !== '') data[name] = el.value.trim();
            });
        } else {
            const p = APP.elements.palabraInput;
            if (p && !p.disabled && p.value.trim() !== '') data['palabra'] = p.value.trim();
        }
        return data;
    },

    showStatusMessage(message, type = 'info') {
        const s = APP.elements.statusMessage;
        if (!s) return;
        s.textContent = message;
        s.className = `status-message mt-4 p-3 rounded-md font-medium text-center block ${type === 'success' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`;
        s.classList.remove('hidden');
        setTimeout(() => s.classList.add('hidden'), 4000);
    }
};

// =================================================================================
// 📡 API SERVICES
// =================================================================================
const API = {
    async fetchMyLicencia() {
        try {
            const response = await fetch('/api/v1/user/licencia_info', { credentials: 'include' });
            const data = await response.json();
            if (data && data.licencia_id) {
                APP.state.userLicenciaId = data.licencia_id;
                APP.state.userLicenciaNumero = data.licencia_numero;
                if (APP.elements.licenciaDisplay) APP.elements.licenciaDisplay.value = data.licencia_numero;
                if (APP.elements.licenciaInput) APP.elements.licenciaInput.value = data.licencia_id;
                if (APP.elements.numLicenciaHeader) APP.elements.numLicenciaHeader.textContent = data.licencia_numero;
                return true;
            }
        } catch (e) { console.error("❌ Error Identidad:", e); }
        return false;
    },

    async loadEmpresas() {
        try {
            const r = await fetch('/api/v1/empresas', { credentials: 'include' });
            const d = await r.json();
            const list = d.data || d;
            if(APP.elements.empresaSelect) {
                APP.elements.empresaSelect.innerHTML = '<option value="">Todas las empresas</option>' + 
                    list.map(e => `<option value="${e.id}">${e.nombre}</option>`).join('');
            }
        } catch (e) { console.error("❌ Error Empresas:", e); }
    },

    async searchAlbaranes() {
        if (!APP.state.userLicenciaId) return;
        DOM.showLoading();
        const params = new URLSearchParams(UI.getCleanParams());
        try {
            const response = await fetch(`/api/v1/albaranes/search-user?${params.toString()}`, { credentials: 'include' });
            const result = await response.json();
            APP.state.filteredAlbaranes = result.data || [];
            DOM.renderResults();
        } catch (e) { DOM.showNoResults(); }
    }
};

// =================================================================================
// 🖼️ DOM RENDERING
// =================================================================================
const DOM = {
    showLoading() { APP.elements.resultsBody.innerHTML = '<tr><td colspan="8" class="text-center py-10 italic">Buscando...</td></tr>'; },
    showNoResults() { APP.elements.resultsBody.innerHTML = '<tr><td colspan="8" class="text-center py-10 text-orange-500 font-bold">No se encontraron registros.</td></tr>'; },
    renderResults() {
        const { resultsBody } = APP.elements;
        if (!resultsBody) return;
        resultsBody.innerHTML = '';
        const start = (APP.state.currentPage - 1) * APP.state.pageSize;
        const pageData = APP.state.filteredAlbaranes.slice(start, start + APP.state.pageSize);
        if (pageData.length === 0) { this.showNoResults(); return; }
        pageData.forEach(a => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50 border-b text-sm transition-colors';
            tr.innerHTML = `
                <td class="px-4 py-3 font-bold text-gray-900">${a.numero_albaran}</td>
                <td class="px-4 py-3 text-gray-600">${UI.formatDate(a.fecha)}</td>
                <td class="px-4 py-3 text-gray-800">${a.EmpresaData?.nombre || 'N/A'}</td>
                <td class="px-4 py-3 text-gray-500">${a.referencia || '-'}</td>
                <td class="px-4 py-3 text-gray-500">${a.asalariado || '-'}</td>
                <td class="px-4 py-3 text-right font-bold text-gray-900">${parseFloat(a.importe_total).toFixed(2)}€</td>
                <td class="px-4 py-3 text-center">${this.getBadge(a)}</td>
                <td class="px-4 py-3 text-center">
                    <div class="flex justify-center space-x-2">
                        <button onclick="window.location.href='/titulares/view/${a.id}'" class="p-1 text-blue-600"><i data-lucide="eye" class="w-4 h-4"></i></button>
                    </div>
                </td>`;
            resultsBody.appendChild(tr);
        });
        UI.updatePageInfo();
        if (window.lucide) lucide.createIcons();
    },
    getBadge(a) {
        if (a.pagado) return '<span class="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold">PAGADO</span>';
        if (a.enviado) return '<span class="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold">ENVIADO</span>';
        return '<span class="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-[10px] font-bold">CREADO</span>';
    }
};

// =================================================================================
// 🚀 ACCIONES GLOBALES (LOGOUT & EXPORT)
// =================================================================================

window.handleLogout = async () => {
    if (!confirm("¿Cerrar sesión?")) return;
    try {
        await fetch('/api/v1/logout', { method: 'POST', credentials: 'include' });
        window.location.href = '/login';
    } catch (e) { window.location.href = '/login'; }
};

window.handleExportAction = async (format) => {
    if (APP.state.filteredAlbaranes.length === 0) return alert("No hay datos para exportar");
    
    const endpoint = format === 'PDF' ? '/api/v1/export/pdf' : '/api/v1/export/xlsx';
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                reportName: `Listado_${format}_Lic_${APP.state.userLicenciaNumero}`, 
                data: APP.state.filteredAlbaranes 
            })
        });
        const res = await response.json();
        if (res.downloadURL) window.open(res.downloadURL, '_blank');
    } catch (e) { console.error(e); }
};

window.handleClearAllFilters = () => {
    APP.elements.searchForm.reset();
    if (APP.state.userLicenciaId) {
        APP.elements.licenciaInput.value = APP.state.userLicenciaId;
        APP.elements.licenciaDisplay.value = APP.state.userLicenciaNumero;
    }
    UI.setSearchMode('campos');
    API.searchAlbaranes();
};

window.handleSearch = (e) => { e.preventDefault(); APP.state.currentPage = 1; API.searchAlbaranes(); };
window.handleActionModal = (show) => { document.getElementById('actionModal').classList.toggle('hidden', !show); };

// =================================================================================
// 🏁 INITIALIZATION
// =================================================================================
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Cargar Identidad
    const ok = await API.fetchMyLicencia();
    if (ok) {
        await API.loadEmpresas();
        UI.setSearchMode('campos');
        API.searchAlbaranes();
    } else {
        window.location.href = '/login';
    }

    // 2. Listeners de Modo
    APP.elements.btnModeCampos?.addEventListener('click', () => UI.setSearchModeManual('campos'));
    APP.elements.btnModePalabra?.addEventListener('click', () => UI.setSearchModeManual('palabra'));

    // 3. Paginación
    if (APP.elements.prevBtn) APP.elements.prevBtn.onclick = () => { if (APP.state.currentPage > 1) { APP.state.currentPage--; DOM.renderResults(); } };
    if (APP.elements.nextBtn) APP.elements.nextBtn.onclick = () => { if (APP.state.currentPage < APP.state.totalPages) { APP.state.currentPage++; DOM.renderResults(); } };
    if (APP.elements.recordsSelect) APP.elements.recordsSelect.onchange = (e) => { 
        APP.state.pageSize = parseInt(e.target.value); 
        APP.state.currentPage = 1; 
        DOM.renderResults(); 
    };
});