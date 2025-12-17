// Archivo: static/js/admin_conductor.js
// ✅ CRUD Gestor Conductores - Lógica de Búsqueda, Renderizado y EXPORTACIÓN
// =================================================================================

const APP = {
    elements: {
        conductorResults: document.getElementById('conductorResults'),
        searchForm: document.getElementById('searchForm'),
        licenciaFiltro: document.getElementById('licencia_filtro'),
        dniFiltro: document.getElementById('dni_filtro'),
        nombreFiltro: document.getElementById('nombre_filtro'),
        choferFiltro: document.getElementById('chofer_filtro'),
        resultsCount: document.getElementById('resultsCount'),
        activeFiltersCount: document.getElementById('activeFiltersCount'),
        prevBtn: document.getElementById('prevPageBtn'),
        nextBtn: document.getElementById('nextPageBtn'),
        recordsSelect: document.getElementById('recordsPerPage'), 
        pageInfo: document.getElementById('pageInfo'),
    },
    state: {
        allConductores: [],
        filteredConductores: [],
        currentPage: 1,
        pageSize: 10,
        totalPages: 1,
        currentSort: { key: 'licencia', direction: 'asc' }, 
    }
};

// =================================================================================
// 🎨 UI HELPERS
// =================================================================================
const UI = {
    getBooleanHtml(value) {
        const isTrue = (value === 1 || value === '1' || value === true);
        return isTrue
            ? `<span class="px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">ACTIVO</span>`
            : `<span class="px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">INACTIVO</span>`;
    },
    alertMessage(message, type = 'info') {
        const statusMessage = document.getElementById('statusMessage');
        if (!statusMessage) return;
        statusMessage.textContent = message;
        statusMessage.className = `status-message status-${type} p-3 rounded-md mb-4 text-center font-medium border`;
        statusMessage.classList.remove('hidden');
        setTimeout(() => statusMessage.classList.add('hidden'), 5000);
    },
    updatePageInfo() {
        const totalFiltered = APP.state.filteredConductores.length;
        APP.state.totalPages = Math.ceil(totalFiltered / APP.state.pageSize);
        APP.state.currentPage = Math.max(1, Math.min(APP.state.currentPage, APP.state.totalPages || 1));
        if (APP.elements.pageInfo) APP.elements.pageInfo.textContent = `Página ${APP.state.currentPage} de ${APP.state.totalPages || 1}`;
        if (APP.elements.resultsCount) APP.elements.resultsCount.textContent = `${totalFiltered} resultados`;
        UI.updatePaginationButtons();
    },
    updatePaginationButtons() {
        if (APP.elements.prevBtn) APP.elements.prevBtn.disabled = APP.state.currentPage <= 1;
        if (APP.elements.nextBtn) APP.elements.nextBtn.disabled = APP.state.currentPage >= APP.state.totalPages;
    },
    updateActiveFiltersCount() {
        const { searchForm, activeFiltersCount } = APP.elements;
        if (!searchForm || !activeFiltersCount) return;
        const formData = new FormData(searchForm);
        let count = 0;
        ['licencia', 'dni', 'nombre', 'chofer'].forEach(field => {
            const value = formData.get(field);
            if (value && String(value).trim() !== '' && String(value) !== 'Todos') count++;
        });
        activeFiltersCount.textContent = `${count} filtro(s) activo(s)`;
    }
};

// =================================================================================
// 🔍 FILTER & SORT LOGIC
// =================================================================================
const Filters = {
    getFiltersFromForm() {
        const form = APP.elements.searchForm;
        if (!form) return {};
        const formData = new FormData(form);
        const filters = {};
        if (formData.get('licencia')) filters.licencia = formData.get('licencia');
        if (formData.get('dni')) filters.dni = formData.get('dni');
        if (formData.get('nombre')) filters.nombre = formData.get('nombre');
        const choferValue = formData.get('chofer');
        if (choferValue !== "" && choferValue !== null) filters.activo = (choferValue === '1' || choferValue === 'true');
        return filters;
    },
    applyFrontendFilters(conductores, filters) {
        return conductores.filter(c => {
            let m = true;
            if (filters.licencia && !c.licencia?.toLowerCase().includes(filters.licencia.toLowerCase())) m = false;
            if (filters.dni && !c.conductor?.toLowerCase().includes(filters.dni.toLowerCase())) m = false;
            if (filters.nombre && !c.nombre?.toLowerCase().includes(filters.nombre.toLowerCase())) m = false;
            if (filters.activo !== undefined && (c.activo === true) !== filters.activo) m = false;
            return m;
        });
    },
    sortTable(key) {
        const { currentSort } = APP.state;
        let direction = currentSort.key === key && currentSort.direction === 'asc' ? 'desc' : 'asc';
        APP.state.filteredConductores.sort((a, b) => {
            let valA = (a[key] || '').toString(), valB = (b[key] || '').toString();
            return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        });
        APP.state.currentSort = { key, direction };
        DOM.renderResults();
    }
};

// =================================================================================
// 📄 EXPORTATION LOGIC (PDF/XLSX)
// =================================================================================
const Exportation = {
    formatData() {
        console.log("🛠️ EXPORT: Formateando datos de conductores...");
        const data = APP.state.filteredConductores.map(c => ({
            "ID": String(c.id || '-'),
            "Licencia": String(c.licencia || '-'),
            "N_Cond": String(c.conductor || '-'),
            "Nombre": String(c.nombre || '-'),
            "Email": String(c.email || '-'),
            "Telefono": String(c.telefono || '-'),
            "Estado": c.activo ? 'ACTIVO' : 'INACTIVO'
        }));
        console.log("📦 EXPORT: Datos preparados. Total:", data.length);
        return data;
    },
    async handle(fmt) {
        if (!APP.state.filteredConductores.length) return UI.alertMessage("No hay datos para exportar", "info");

        const payload = {
            reportName: `Listado_Conductores_${fmt.toUpperCase()}`,
            data: this.formatData()
        };

        console.log(`🚀 EXPORT: Iniciando envío a /api/v1/conductores/export/${fmt}`);
        console.log("📤 JSON ENTRADA (Payload):", JSON.stringify(payload));

        UI.alertMessage(`Generando ${fmt.toUpperCase()}...`, "info");
        try {
            const response = await fetch(`/api/v1/conductores/export/${fmt}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            console.log("📥 JSON SALIDA (Respuesta):", result);

            if (response.ok && result.success) {
                UI.alertMessage("✅ Exportación generada con éxito", "success");
                window.open(result.downloadURL, '_blank');
            } else {
                throw new Error(result.message || "Error desconocido en servidor");
            }
        } catch (error) {
            console.error("❌ EXPORT ERROR:", error);
            UI.alertMessage("Error al exportar conductores", "error");
        }
    }
};

// =================================================================================
// 🌐 API SERVICES
// =================================================================================
const API = {
    async loadAllConductores(filters = {}) {
        const tbody = APP.elements.conductorResults;
        UI.updateActiveFiltersCount();
        if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 italic">Cargando API...</td></tr>';
        try {
            const response = await fetch('/api/v1/conductores');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            APP.state.allConductores = data.data || [];
            APP.state.filteredConductores = Filters.applyFrontendFilters(APP.state.allConductores, filters);
            Filters.sortTable(APP.state.currentSort.key);
        } catch (error) {
            UI.alertMessage(`Error: ${error.message}`, 'error');
            if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-red-500">Error al cargar listado.</td></tr>';
        }
    }
};

// =================================================================================
// 🖼️ DOM RENDER
// =================================================================================
const DOM = {
    renderResults() {
        const tbody = APP.elements.conductorResults;
        if (!tbody) return;
        tbody.innerHTML = '';
        const start = (APP.state.currentPage - 1) * APP.state.pageSize;
        const pageData = APP.state.filteredConductores.slice(start, start + APP.state.pageSize);

        if (!pageData.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4">Sin resultados</td></tr>';
            UI.updatePageInfo(); return;
        }

        pageData.forEach(c => {
            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-50 border-b border-gray-100';
            const safeLic = (c.licencia || '').replace(/'/g, "\\'");
            const safeNum = (c.conductor || '').replace(/'/g, "\\'");
            const safeNom = (c.nombre || '').replace(/'/g, "\\'");

            row.innerHTML = `
                <td class="px-3 py-2 text-xs font-medium text-primary-link">${c.licencia}</td>
                <td class="px-3 py-2 text-xs text-gray-800">${c.conductor}</td>
                <td class="px-3 py-2 text-xs text-gray-800">${c.nombre}</td>
                <td class="px-3 py-2 text-xs text-gray-600">${c.email || '-'}</td>
                <td class="px-3 py-2 text-xs text-gray-600">${c.telefono || '-'}</td>
                <td class="px-3 py-2 text-center">${UI.getBooleanHtml(c.activo)}</td>
                <td class="px-3 py-2 text-center whitespace-nowrap">
                    <button onclick="handleViewConductor('${safeLic}', '${safeNum}')" class="text-blue-600 mx-1"><i data-lucide="eye" class="h-4 w-4"></i></button>
                    <button onclick="handleUpdateConductor('${safeLic}', '${safeNum}')" class="text-primary-link mx-1"><i data-lucide="edit" class="h-4 w-4"></i></button>
                    <button onclick="handleDeleteConductorByID(${c.id}, '${safeNom}')" class="text-red-600 mx-1"><i data-lucide="trash-2" class="h-4 w-4"></i></button>
                </td>`;
            tbody.appendChild(row);
        });
        UI.updatePageInfo();
        if (window.lucide) lucide.createIcons();
    }
};

// =================================================================================
// 🎯 EXPOSICIÓN GLOBAL
// =================================================================================
window.handleGeneratePDF = () => { console.log("🔘 Click: PDF Conductores"); Exportation.handle('pdf'); };
window.handleGenerateXLSX = () => { console.log("🔘 Click: XLSX Conductores"); Exportation.handle('xlsx'); };
window.handleSearch = (e) => { if(e) e.preventDefault(); APP.state.currentPage = 1; API.loadAllConductores(Filters.getFiltersFromForm()); };
window.handleClearAllFilters = () => { if(APP.elements.searchForm) APP.elements.searchForm.reset(); window.handleSearch(); };
window.handleCreateConductor = () => window.location.href = '/admin/conductor/crear';
window.handleViewConductor = (lic, num) => window.location.href = `/admin/conductor/view/${lic}/${num}`;
window.handleUpdateConductor = (lic, num) => window.location.href = `/admin/conductor/update/${lic}/${num}`;
window.handleDeleteConductorByID = (id, nom) => { if(confirm(`¿Desactivar a ${nom} (ID: ${id})?`)) window.location.href = `/admin/conductor/delete_by_id/${id}`; };
window.sortTable = (key) => Filters.sortTable(key);

document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 admin_conductor.js: Iniciando...");
    API.loadAllConductores(Filters.getFiltersFromForm());
    
    if (APP.elements.prevBtn) APP.elements.prevBtn.onclick = () => { if (APP.state.currentPage > 1) { APP.state.currentPage--; DOM.renderResults(); } };
    if (APP.elements.nextBtn) APP.elements.nextBtn.onclick = () => { if (APP.state.currentPage < APP.state.totalPages) { APP.state.currentPage++; DOM.renderResults(); } };
});