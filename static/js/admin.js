/**
 * admin.js - Gestión de Albaranes para Administrador
 * Versión: 2.5 (Con Logs de Entrada/Salida y Exportación)
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
        palabraInput: document.getElementById('palabra'),
        activeFiltersCount: document.getElementById('activeFiltersCount')
    },
    state: {
        allAlbaranes: [],
        filteredAlbaranes: [],
        currentPage: 1,
        pageSize: 10,
        totalPages: 1,
        currentSort: { key: 'fecha', direction: 'desc' }
    }
};

// =================================================================================
// 🎨 UI HELPERS
// =================================================================================
const UI = {
    formatDate(isoString) { 
        return isoString ? isoString.substring(0, 10) : '-'; 
    },

    alertMessage(message, type = 'info') {
        const s = APP.elements.statusMessage;
        if (!s) return;
        s.textContent = message;
        s.className = `status-message status-${type} p-3 rounded-md mb-4 text-center font-medium border block`;
        s.classList.remove('hidden');
        setTimeout(() => s.classList.add('hidden'), 5000);
    },

    updatePageInfo() {
        const total = APP.state.filteredAlbaranes.length;
        APP.state.totalPages = Math.ceil(total / APP.state.pageSize);
        if (APP.elements.pageInfo) APP.elements.pageInfo.textContent = `Página ${APP.state.currentPage} de ${APP.state.totalPages || 1}`;
        if (APP.elements.resultsCount) APP.elements.resultsCount.textContent = total;
        this.updatePaginationButtons();
    },

    updatePaginationButtons() {
        const { prevBtn, nextBtn } = APP.elements;
        if (prevBtn) prevBtn.disabled = APP.state.currentPage <= 1;
        if (nextBtn) nextBtn.disabled = APP.state.currentPage >= (APP.state.totalPages || 1);
    },

    updateActiveFiltersCount() {
        const formData = new FormData(APP.elements.searchForm);
        let count = 0;
        for (let [key, value] of formData.entries()) {
            if (key !== 'search_type' && value && value.trim() !== '') count++;
        }
        if (APP.elements.activeFiltersCount) APP.elements.activeFiltersCount.textContent = count;
    }
};

// =================================================================================
// 🔍 FILTROS Y ORDENACIÓN
// =================================================================================
const Filters = {
    getFiltersFromForm() {
        const formData = new FormData(APP.elements.searchForm);
        return {
            licencia_ref: formData.get('licencia_ref') || '',
            empresa_ref: formData.get('empresa_ref') || '',
            state: formData.get('state') || '',
            referencia: formData.get('referencia') || '',
            fecha_ini: formData.get('fecha_desde') || '',
            fecha_fin: formData.get('fecha_hasta') || '',
            palabra: formData.get('palabra') || '',
            search_type: formData.get('search_type') || 'exacta'
        };
    },

    sortTable(key) {
        console.log(`🔘 Ordenando por columna: ${key}`);
        const { currentSort } = APP.state;
        let direction = (currentSort.key === key && currentSort.direction === 'asc') ? 'desc' : 'asc';
        
        APP.state.filteredAlbaranes.sort((a, b) => {
            let va = a[key] || '', vb = b[key] || '';
            if (key === 'fecha') { va = new Date(va).getTime(); vb = new Date(vb).getTime(); }
            return direction === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
        });

        APP.state.currentSort = { key, direction };
        APP.state.currentPage = 1;
        DOM.renderResults();
    }
};

// =================================================================================
// 📄 MÓDULO EXPORTACIÓN (LOGS INTEGRADOS)
// =================================================================================
const Exportation = {
    formatData() {
        console.log("🛠️ [EXPORT] Preparando payload de datos...");
        const data = APP.state.filteredAlbaranes.map(a => ({
            "ID": String(a.id),
            "N_Alb": String(a.numero_albaran || '-'),
            "Fecha": UI.formatDate(a.fecha),
            "Licencia": String(a.LicenciaData?.licencia || a.licencia_ref || '-'),
            "Empresa": String(a.EmpresaData?.nombre || a.empresa_ref || '-'),
            "Referencia": String(a.referencia || '-'),
            "Importe": parseFloat(a.importe_total || 0).toFixed(2) + "€",
            "Env": a.enviado ? 'S' : 'N',
            "Cob": a.cobrado ? 'S' : 'N',
            "Pag": a.pagado ? 'S' : 'N'
        }));
        console.log("📤 [ENTRADA JS -> GIN] Datos preparados:", data.slice(0, 2), `(+ ${data.length - 2} más)`);
        return data;
    },

    async handle(fmt) {
        if (!APP.state.filteredAlbaranes.length) return UI.alertMessage("No hay datos para exportar", "error");

        const endpoint = `/api/v1/albaranes/export/${fmt}`;
        const payload = {
            reportName: `Reporte_Admin_${fmt.toUpperCase()}_${new Date().getTime()}`,
            data: this.formatData()
        };

        console.log(`🚀 [HTTP POST] ${endpoint}`);
        console.log("📦 [JSON PAYLOAD]:", JSON.stringify(payload));

        UI.alertMessage(`Generando ${fmt.toUpperCase()}...`, "info");
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            console.log("📥 [SALIDA GIN -> JS] Respuesta:", result);

            if (response.ok && result.success) {
                UI.alertMessage("✅ Exportación lista", "success");
                window.open(result.downloadURL, '_blank');
            } else {
                throw new Error(result.message || "Error en el servidor");
            }
        } catch (e) {
            console.error("❌ Error exportación:", e);
            UI.alertMessage("Error al exportar archivo", "error");
        }
    }
};

// =================================================================================
// 🌐 API SERVICES
// =================================================================================
const API = {
    async loadEmpresas() {
        const r = await fetch('/api/v1/empresas');
        const d = await r.json();
        const list = d.data || d;
        APP.elements.empresaSelect.innerHTML = '<option value="">📋 Todas las empresas</option>' + 
            list.map(e => `<option value="${e.id}">${e.nombre}</option>`).join('');
    },

    async loadLicencias() {
        const r = await fetch('/api/v1/licencias');
        const d = await r.json();
        const list = d.data || d;
        APP.elements.licenciaSelect.innerHTML = '<option value="">🆔 Todas las licencias</option>' + 
            list.map(l => `<option value="${l.id}">${l.licencia}</option>`).join('');
    },

    async searchAlbaranes(filters) {
        DOM.showLoading();
        try {
            const params = new URLSearchParams();
            Object.entries(filters).forEach(([k, v]) => { if(v) params.append(k, v); });
            params.append('pageSize', '5000');

            const response = await fetch(`/api/v1/albaranes/search?${params.toString()}`);
            const data = await response.json();
            console.log(`📥 [API] Albaranes encontrados: ${data.data?.length || 0}`);
            
            APP.state.filteredAlbaranes = data.data || [];
            APP.state.currentPage = 1;
            DOM.renderResults();
        } catch (e) {
            UI.alertMessage("Error al buscar datos", "error");
            DOM.showNoResults();
        }
    }
};

// =================================================================================
// 🖼️ DOM RENDER
// =================================================================================
const DOM = {
    showLoading() { APP.elements.resultsBody.innerHTML = '<tr><td colspan="11" class="text-center py-10 italic">Buscando...</td></tr>'; },
    showNoResults() { APP.elements.resultsBody.innerHTML = '<tr><td colspan="11" class="text-center py-10 text-red-500">No hay resultados</td></tr>'; },

    renderResults() {
        const { resultsBody } = APP.elements;
        if (!resultsBody) return;
        resultsBody.innerHTML = '';

        const start = (APP.state.currentPage - 1) * APP.state.pageSize;
        const pageData = APP.state.filteredAlbaranes.slice(start, start + APP.state.pageSize);

        if (pageData.length === 0) { this.showNoResults(); return; }

        pageData.forEach(a => {
            const row = `
                <tr class="hover:bg-gray-50 border-b">
                    <td class="px-3 py-2 text-xs font-bold text-gray-900">${a.numero_albaran}</td>
                    <td class="px-3 py-2 text-xs">${UI.formatDate(a.fecha)}</td>
                    <td class="px-3 py-2 text-xs text-blue-600 font-medium">${a.LicenciaData?.licencia || 'N/A'}</td>
                    <td class="px-3 py-2 text-xs">${a.EmpresaData?.nombre || 'N/A'}</td>
                    <td class="px-3 py-2 text-xs">${a.referencia || '-'}</td>
                    <td class="px-3 py-2 text-xs">${a.num_factura || '-'}</td>
                    <td class="px-3 py-2 text-xs text-center">${a.enviado ? '✅' : '❌'}</td>
                    <td class="px-3 py-2 text-xs text-center">${a.cobrado ? '✅' : '❌'}</td>
                    <td class="px-3 py-2 text-xs text-center">${a.pagado ? '✅' : '❌'}</td>
                    <td class="px-3 py-2 text-xs text-gray-500 text-truncate">${a.observaciones_admin || ''}</td>
                    <td class="px-3 py-2 text-center whitespace-nowrap">
                        <div class="flex justify-center space-x-1">
                            <button onclick="handleViewAction(${a.id})" class="p-1 text-blue-600 hover:bg-blue-100 rounded-full"><i data-lucide="eye" class="w-3 h-3"></i></button>
                            <button onclick="handleEditAction(${a.id})" class="p-1 text-orange-600 hover:bg-orange-100 rounded-full"><i data-lucide="pencil" class="w-3 h-3"></i></button>
                            <button onclick="handleDeleteAction(${a.id})" class="p-1 text-red-600 hover:bg-red-100 rounded-full"><i data-lucide="trash-2" class="w-3 h-3"></i></button>
                        </div>
                    </td>
                </tr>`;
            resultsBody.insertAdjacentHTML('beforeend', row);
        });

        UI.updatePageInfo();
        if (window.lucide) lucide.createIcons();
    }
};

// =================================================================================
// 🌍 EXPOSICIÓN GLOBAL (VINCULACIÓN HTML)
// =================================================================================
window.handleGeneratePDF = () => { console.log("🔘 Click: PDF"); Exportation.handle('pdf'); };
window.handleGenerateXLSX = () => { console.log("🔘 Click: XLSX"); Exportation.handle('xlsx'); };
window.handleSearch = (e) => { if(e) e.preventDefault(); API.searchAlbaranes(Filters.getFiltersFromForm()); };
window.handleClearAllFilters = () => { APP.elements.searchForm.reset(); UI.updateActiveFiltersCount(); API.searchAlbaranes({}); };
window.sortTable = (k) => Filters.sortTable(k);
window.handleViewAction = (id) => window.location.href = `/albaranes/view/${id}`;
window.handleEditAction = (id) => window.location.href = `/admin/albaranes/update/${id}`;
window.handleDeleteAction = (id) => { if(confirm("¿Seguro?")) window.location.href = `/admin/albaranes/borrar/${id}`; };

// Paginación
APP.elements.prevBtn.onclick = () => { if (APP.state.currentPage > 1) { APP.state.currentPage--; DOM.renderResults(); } };
APP.elements.nextBtn.onclick = () => { if (APP.state.currentPage < APP.state.totalPages) { APP.state.currentPage++; DOM.renderResults(); } };

// Inicialización
document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 admin.js: Sistema iniciado.");
    await Promise.all([API.loadEmpresas(), API.loadLicencias()]);
    API.searchAlbaranes(Filters.getFiltersFromForm());
    
    if (APP.elements.recordsSelect) {
        APP.elements.recordsSelect.addEventListener('change', (e) => {
            APP.state.pageSize = e.target.value === 'todos' ? 9999 : parseInt(e.target.value);
            APP.state.currentPage = 1;
            DOM.renderResults();
        });
    }
});