/**
 * busqueda.js - Panel de Usuario (Titular)
 * Gestión de albaranes con Búsqueda Pro y botón de Limpiar Inteligente.
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
        licenciaDisplay: document.getElementById('licencia_display'),
        licenciaInput: document.getElementById('licencia_ref'), 
        empresaSelect: document.getElementById('empresa'),
        stateSelect: document.getElementById('state'),
        referenciaInput: document.getElementById('referencia'),
        fechaDesdeInput: document.getElementById('fecha_desde'),
        fechaHastaInput: document.getElementById('fecha_hasta'),
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
// 🎨 UI HELPERS & MODE MANAGEMENT
// =================================================================================

const UI = {
    formatDate(isoString) { return isoString ? isoString.substring(0, 10) : '-'; },

    setSearchModeManual(mode) {
        console.log(`%c🔄 [MODO] Cambio a: ${mode.toUpperCase()}`, "color: #FF8C00; font-weight: bold;");
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
        } catch (e) { console.error("❌ Error Licencia:", e); }
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
        const filtros = UI.getCleanParams();
        const params = new URLSearchParams(filtros);

        console.log("%c📤 [ENVÍO] URLParams:", "color: #9333ea; font-weight: bold;", filtros);
        
        try {
            const response = await fetch(`/api/v1/albaranes/search-user?${params.toString()}`, { credentials: 'include' });
            const result = await response.json();
            console.log("%c📥 [RECIBO] Respuesta:", "color: #16a34a; font-weight: bold;", result);
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
                        <button onclick="window.location.href='/titulares/view/${a.id}'" class="p-1.5 text-blue-600 hover:bg-blue-100 rounded-full"><i data-lucide="eye" class="w-4 h-4"></i></button>
                        <button onclick="window.location.href='/titulares/update/${a.id}'" class="p-1.5 text-orange-600 hover:bg-orange-100 rounded-full"><i data-lucide="pencil" class="w-4 h-4"></i></button>
                    </div>
                </td>`;
            resultsBody.appendChild(tr);
        });
        UI.updatePageInfo();
        if (window.lucide) lucide.createIcons();
    },
    getBadge(a) {
        if (a.pagado && a.cobrado) return '<span class="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">FINALIZADO</span>';
        if (a.pagado) return '<span class="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">PAGADO</span>';
        if (a.enviado) return '<span class="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">ENVIADO</span>';
        return '<span class="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">CREADO</span>';
    }
};

// =================================================================================
// 🧹 LÓGICA DE LIMPIEZA (Corregida)
// =================================================================================

window.handleClearAllFilters = () => {
    console.log("%c🧹 [LIMPIAR] Reseteando filtros... conservando ID de licencia.", "color: #ef4444; font-weight: bold;");
    
    // 1. Resetear el formulario (borra todo)
    if (APP.elements.searchForm) APP.elements.searchForm.reset();

    // 2. RE-INYECTAR LICENCIA (Obligatorio para seguridad)
    if (APP.state.userLicenciaId) {
        if (APP.elements.licenciaInput) APP.elements.licenciaInput.value = APP.state.userLicenciaId;
        if (APP.elements.licenciaDisplay) APP.elements.licenciaDisplay.value = APP.state.userLicenciaNumero;
    }

    // 3. Volver al modo por defecto
    UI.setSearchMode('campos');
    APP.state.currentPage = 1;

    // 4. Ejecutar búsqueda limpia
    API.searchAlbaranes();
    UI.showStatusMessage("Búsqueda reiniciada", "info");
};

// =================================================================================
// 🚀 INICIALIZACIÓN
// =================================================================================

document.addEventListener('DOMContentLoaded', async () => {
    APP.elements.btnModeCampos?.addEventListener('click', () => UI.setSearchModeManual('campos'));
    APP.elements.btnModePalabra?.addEventListener('click', () => UI.setSearchModeManual('palabra'));

    const ok = await API.fetchMyLicencia();
    if (ok) {
        await API.loadEmpresas();
        UI.setSearchModeManual('campos');
    }

    // Listener para el botón limpiar del HTML
    const btnClean = document.getElementById('btn-limpiar');
    if (btnClean) btnClean.onclick = window.handleClearAllFilters;

    if (APP.elements.prevBtn) APP.elements.prevBtn.onclick = () => { if (APP.state.currentPage > 1) { APP.state.currentPage--; DOM.renderResults(); } };
    if (APP.elements.nextBtn) APP.elements.nextBtn.onclick = () => { if (APP.state.currentPage < APP.state.totalPages) { APP.state.currentPage++; DOM.renderResults(); } };
});

window.handleSearch = (e) => { if(e) e.preventDefault(); APP.state.currentPage = 1; API.searchAlbaranes(); };
window.handleLogout = () => { if(confirm("¿Cerrar sesión?")) window.location.href = '/logout'; };