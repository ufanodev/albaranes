/**
 * admin.js - Gestión Maestra de Albaranes
 * Versión: MASTER (Logs de Trazabilidad, Búsqueda Pro, Diccionarios y Acciones CRUD)
 */

const APP = {
    elements: {
        resultsBody: document.getElementById('albaranResults'),
        searchForm: document.getElementById('searchForm'),
        recordsSelect: document.getElementById('recordsPerPage'),
        statusMessage: document.getElementById('statusMessage'),
        pageInfo: document.getElementById('pageInfo'),
        totalLabel: document.getElementById('totalLabel'),
        resultsCount: document.getElementById('resultsCount'),
        prevBtn: document.getElementById('prevPageBtn'),
        nextBtn: document.getElementById('nextPageBtn'),
        licenciaSelect: document.getElementById('licenciaSelect'),
        empresaSelect: document.getElementById('empresa'),
        stateSelect: document.getElementById('state'),
        referenciaInput: document.getElementById('referencia'),
        fechaDesdeInput: document.getElementById('fecha_desde'),
        fechaHastaInput: document.getElementById('fecha_hasta'),
        palabraInput: document.getElementById('palabra'),
        activeFiltersCount: document.getElementById('activeFiltersCount'),
        specificFields: [
            document.getElementById('licenciaSelect'), 
            document.getElementById('empresa'),
            document.getElementById('state'),
            document.getElementById('referencia'),
            document.getElementById('fecha_desde'),
            document.getElementById('fecha_hasta'),
        ]
    },
    state: {
        allAlbaranes: [],
        filteredAlbaranes: [],
        currentPage: 1,
        pageSize: 10,
        totalPages: 1,
        currentSort: { key: 'fecha', direction: 'desc' },
        searchMode: 'todos',
        modeIsManual: false
    }
};

// =================================================================================
// 🎨 UI HELPERS & MODE MANAGEMENT
// =================================================================================

const UI = {
    formatDate(isoString) { return isoString ? isoString.substring(0, 10) : '-'; },

    alertMessage(message, type = 'info') {
        const s = APP.elements.statusMessage;
        if (!s) return;
        s.textContent = message;
        s.className = `status-message status-${type} p-3 rounded-md mb-4 text-center font-medium border block`;
        s.classList.remove('hidden');
        setTimeout(() => s.classList.add('hidden'), 5000);
    },

    setSearchModeManual(mode) {
        APP.state.modeIsManual = true;
        console.log(`🔄 [MODE] Cambio manual de búsqueda a: ${mode.toUpperCase()}`);
        this.setSearchMode(mode);
        API.searchAlbaranes(Filters.getFiltersFromForm());
    },

    setSearchMode(mode) {
        APP.state.searchMode = mode;
        const { palabraInput, specificFields } = APP.elements;
        
        if (mode === 'palabra') {
            if(palabraInput) {
                palabraInput.disabled = false;
                palabraInput.parentElement.style.opacity = "1";
            }
            specificFields.forEach(f => { 
                if(f) { f.disabled = true; f.classList.add('bg-gray-100'); f.parentElement.style.opacity = "0.5"; }
            });
        } else if (mode === 'campos') {
            if(palabraInput) {
                palabraInput.disabled = true;
                palabraInput.value = '';
                palabraInput.classList.add('bg-gray-100');
                palabraInput.parentElement.style.opacity = "0.5";
            }
            specificFields.forEach(f => { 
                if(f) { f.disabled = false; f.classList.remove('bg-gray-100'); f.parentElement.style.opacity = "1"; }
            });
        }
        UI.updateActiveFiltersCount();
    },

    updatePageInfo() {
        const total = APP.state.filteredAlbaranes.length;
        APP.state.totalPages = Math.ceil(total / APP.state.pageSize) || 1;
        if (APP.elements.pageInfo) APP.elements.pageInfo.textContent = `Página ${APP.state.currentPage} de ${APP.state.totalPages}`;
        if (APP.elements.resultsCount) APP.elements.resultsCount.textContent = total;
        
        if (APP.elements.totalLabel) {
            const start = total === 0 ? 0 : (APP.state.currentPage - 1) * APP.state.pageSize + 1;
            const end = Math.min(start + APP.state.pageSize - 1, total);
            APP.elements.totalLabel.textContent = total > 0 ? `(Viendo ${start}-${end} de ${total})` : "";
        }
        this.updatePaginationButtons();
    },

    updatePaginationButtons() {
        const { prevBtn, nextBtn } = APP.elements;
        if(prevBtn) prevBtn.disabled = APP.state.currentPage <= 1;
        if(nextBtn) nextBtn.disabled = APP.state.currentPage >= (APP.state.totalPages || 1);
    },

    updateActiveFiltersCount() {
        const filters = Filters.getFiltersFromForm();
        let count = 0;
        Object.entries(filters).forEach(([k, v]) => { if (k !== 'search_type' && v && v !== '') count++; });
        if (APP.elements.activeFiltersCount) APP.elements.activeFiltersCount.textContent = count;
    }
};

// =================================================================================
// 🔍 FILTER & SORT LOGIC
// =================================================================================

const Filters = {
    getFiltersFromForm() {
        const formData = new FormData(APP.elements.searchForm);
        const f = {
            licencia_ref: formData.get('licencia_ref') || '',
            empresa_ref: formData.get('empresa_ref') || '',
            state: formData.get('state') || '',
            referencia: formData.get('referencia') || '',
            fecha_ini: formData.get('fecha_desde') || '',
            fecha_fin: formData.get('fecha_hasta') || '',
            palabra: formData.get('palabra') || '',
            search_type: formData.get('search_type') || 'exacta'
        };
        return f;
    }
};

// =================================================================================
// 🌐 API SERVICES
// =================================================================================

const API = {
    async loadEmpresas() {
        console.log("📡 [API] Cargando empresas...");
        try {
            const r = await fetch('/api/v1/empresas');
            const d = await r.json();
            const list = d.data || d;
            if (APP.elements.empresaSelect) {
                APP.elements.empresaSelect.innerHTML = '<option value="">📋 Todas las empresas</option>' + 
                    list.map(e => `<option value="${e.id}">${e.nombre}</option>`).join('');
            }
            console.log(`✅ [API] ${list.length} empresas cargadas.`);
        } catch (e) { console.error("❌ [API] Error empresas:", e); }
    },

    async loadLicencias() {
        console.log("📡 [API] Cargando licencias...");
        try {
            const r = await fetch('/api/v1/licencias');
            const d = await r.json();
            const list = d.data || d;
            if (APP.elements.licenciaSelect) {
                APP.elements.licenciaSelect.innerHTML = '<option value="">🆔 Todas las licencias</option>' + 
                    list.map(l => `<option value="${l.id}">${l.licencia}</option>`).join('');
            }
            console.log(`✅ [API] ${list.length} licencias cargadas.`);
        } catch (e) { console.error("❌ [API] Error licencias:", e); }
    },

    async searchAlbaranes(filters) {
        DOM.showLoading();
        console.log("🔍 [BUSCADOR] Iniciando búsqueda con filtros:", filters);
        try {
            const params = new URLSearchParams();
            Object.entries(filters).forEach(([k, v]) => { if(v) params.append(k, v); });
            params.append('pageSize', '5000');

            const response = await fetch(`/api/v1/albaranes/search?${params.toString()}`);
            const data = await response.json();
            
            APP.state.filteredAlbaranes = data.data || [];
            console.log(`📥 [BUSCADOR] ${APP.state.filteredAlbaranes.length} registros encontrados.`);
            
            APP.state.currentPage = 1;
            DOM.renderResults();
        } catch (e) { 
            console.error("❌ [BUSCADOR] Error en búsqueda:", e);
            UI.alertMessage("Error de conexión", "error"); 
            DOM.showNoResults(); 
        }
    }
};

// =================================================================================
// 🖼️ DOM RENDER
// =================================================================================

const DOM = {
    showLoading() { if(APP.elements.resultsBody) APP.elements.resultsBody.innerHTML = '<tr><td colspan="11" class="text-center py-10 italic">Buscando en la base de datos...</td></tr>'; },
    showNoResults() { if(APP.elements.resultsBody) APP.elements.resultsBody.innerHTML = '<tr><td colspan="11" class="text-center py-10 text-red-500 font-bold">📭 No se han encontrado albaranes activos</td></tr>'; },

    renderResults() {
        const { resultsBody } = APP.elements;
        if (!resultsBody) return;
        resultsBody.innerHTML = '';

        const start = (APP.state.currentPage - 1) * APP.state.pageSize;
        const pageData = APP.state.filteredAlbaranes.slice(start, start + APP.state.pageSize);

        if (pageData.length === 0) { this.showNoResults(); return; }

        pageData.forEach(a => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50 border-b border-gray-100 transition-colors';
            
            tr.innerHTML = `
                <td class="px-3 py-2 text-xs font-bold text-gray-900">${a.numero_albaran || 'N/A'}</td>
                <td class="px-3 py-2 text-xs text-gray-600">${UI.formatDate(a.fecha)}</td>
                <td class="px-3 py-2 text-xs font-bold text-blue-600">${a.LicenciaData?.licencia || a.licencia || 'N/A'}</td>
                <td class="px-3 py-2 text-xs text-gray-800">${a.EmpresaData?.nombre || a.empresa_nombre || 'N/A'}</td>
                <td class="px-3 py-2 text-xs text-gray-500">${a.referencia || '-'}</td>
                <td class="px-3 py-2 text-xs text-gray-500">${a.num_factura || '-'}</td>
                <td class="px-3 py-2 text-xs text-center">${a.enviado ? '✅' : '❌'}</td>
                <td class="px-3 py-2 text-xs text-center">${a.cobrado ? '✅' : '❌'}</td>
                <td class="px-3 py-2 text-xs text-center">${a.pagado ? '✅' : '❌'}</td>
                <td class="px-3 py-2 text-xs text-gray-500 max-w-[120px] truncate" title="${a.observaciones_admin || ''}">${a.observaciones_admin || '-'}</td>
                <td class="px-3 py-2 text-center whitespace-nowrap">
                    <div class="flex justify-center space-x-1">
                        <button onclick="handleViewAction(${a.id})" class="p-1.5 bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200 transition" title="Ver"><i data-lucide="eye" class="w-3.5 h-3.5"></i></button>
                        <button onclick="handleEditAction(${a.id})" class="p-1.5 bg-orange-100 text-orange-600 rounded-full hover:bg-orange-200 transition" title="Editar"><i data-lucide="pencil" class="w-3.5 h-3.5"></i></button>
                        <button onclick="handleCopyAction(${a.id})" class="p-1.5 bg-purple-100 text-purple-600 rounded-full hover:bg-purple-200 transition" title="Duplicar"><i data-lucide="copy" class="w-3.5 h-3.5"></i></button>
                        <button onclick="handleDeleteAction(${a.id})" class="p-1.5 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition" title="Eliminar"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                    </div>
                </td>`;
            resultsBody.appendChild(tr);
        });

        UI.updatePageInfo();
        if (window.lucide) lucide.createIcons();
    }
};

// =================================================================================
// 🌍 GLOBAL BINDINGS & DELETE LOGIC
// =================================================================================

window.handleSearch = (e) => { if(e) e.preventDefault(); API.searchAlbaranes(Filters.getFiltersFromForm()); };
window.handleClearAllFilters = () => { console.log("🧹 [SISTEMA] Limpiando filtros..."); APP.elements.searchForm.reset(); APP.state.searchMode = 'todos'; UI.setSearchMode('todos'); API.searchAlbaranes({}); };

window.handleViewAction = (id) => {
    console.log(`👁️ Cargando vista para ID: ${id}`);
    window.location.href = `/admin/albaranes/view/${id}`;
};

window.handleEditAction = (id) => {
    console.log(`✏️ Cargando edición para ID: ${id}`);
    window.location.href = `/admin/albaranes/update/${id}`;
};

window.handleCopyAction = (id) => {
    console.log(`👯 Copiando registro ID: ${id}`);
    window.location.href = `/admin/albaranes/copiar/${id}`;
};

// 🗑️ BORRADO LÓGICO INTEGRADO CON LOGS
window.handleDeleteAction = async (id) => {
    console.log(`--- 🗑️ INICIO PROCESO BORRADO (ID: ${id}) ---`);
    const albaran = APP.state.filteredAlbaranes.find(a => a.id === id);
    
    if (!albaran) {
        console.error(`❌ [ERROR] ID ${id} no localizado en memoria local.`);
        return;
    }

    const nAlb   = albaran.numero_albaran || 'N/A';
    const fecha  = UI.formatDate(albaran.fecha);
    const lic    = albaran.LicenciaData?.licencia || albaran.licencia || 'N/A';
    
    console.log(`📄 [DATA] Confirmando borrado: Alb=${nAlb}, Fecha=${fecha}, Lic=${lic}`);

    const confirmMsg = `¿ESTÁ SEGURO DE ELIMINAR ESTE ALBARÁN?\n\n` +
                       `🆔 ID: ${id}\n` +
                       `📄 Nº Albarán: ${nAlb}\n` +
                       `📅 Fecha: ${fecha}\n` +
                       `🪪 Licencia: ${lic}\n\n` +
                       `Esta acción realizará un borrado lógico.`;

    if (confirm(confirmMsg)) {
        console.log(`📡 [API] Enviando petición DELETE a /api/v1/albaranes/${id}`);
        try {
            const response = await fetch(`/api/v1/albaranes/${id}`, { method: 'DELETE' });
            const result = await response.json();

            if (response.ok) {
                console.log(`✅ [SUCCESS] Servidor confirmó borrado lógico.`);
                alert(`✅ OPERACIÓN EXITOSA\n\nEl albarán #${id} (Nº ${nAlb}) ha sido eliminado correctamente.`);
                
                APP.state.filteredAlbaranes = APP.state.filteredAlbaranes.filter(a => a.id !== id);
                DOM.renderResults();
                UI.alertMessage(`✅ Albarán ${nAlb} borrado`, "success");
            } else {
                console.error(`🔴 [API ERROR] ${result.error}`);
                throw new Error(result.error);
            }
        } catch (err) {
            console.error(`❌ [CRITICAL]`, err);
            alert(`❌ ERROR AL BORRAR: ${err.message}`);
        }
    }
    console.log(`--- 🏁 FIN PROCESO BORRADO ---`);
};

window.toggleDropdown = (btn) => { 
    const d = btn.closest('.dropdown'); 
    document.querySelectorAll('.dropdown').forEach(x => { if(x !== d) x.classList.remove('active'); }); 
    d?.classList.toggle('active'); 
};
window.handleLogout = () => { console.log("🚪 Cerrando sesión..."); window.location.href = '/login'; };
window.UI = UI;

// =================================================================================
// 🚀 INITIALIZATION
// =================================================================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 [SISTEMA] Panel Administrador Iniciado.");
    
    console.time("⏱️ Carga Diccionarios");
    await Promise.all([API.loadEmpresas(), API.loadLicencias()]);
    console.timeEnd("⏱️ Carga Diccionarios");

    if (APP.elements.recordsSelect) {
        APP.elements.recordsSelect.onchange = (e) => {
            APP.state.pageSize = e.target.value === 'todos' ? 9999 : parseInt(e.target.value);
            APP.state.currentPage = 1;
            DOM.renderResults();
        };
    }
    
    if(APP.elements.prevBtn) APP.elements.prevBtn.onclick = () => { if (APP.state.currentPage > 1) { APP.state.currentPage--; DOM.renderResults(); } };
    if(APP.elements.nextBtn) APP.elements.nextBtn.onclick = () => { if (APP.state.currentPage < APP.state.totalPages) { APP.state.currentPage++; DOM.renderResults(); } };

    UI.setSearchMode('todos');
    API.searchAlbaranes(Filters.getFiltersFromForm());
});