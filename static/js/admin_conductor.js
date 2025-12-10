// Archivo: static/js/admin_conductor.js
// ✅ CRUD Gestor Conductores - Lógica de Búsqueda y Renderizado de TABLA (Corregido)
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
            ? `<span class="px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">SÍ</span>`
            : `<span class="px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">NO</span>`;
    },
    alertMessage(message, type = 'info') {
        console.log(`[${type.toUpperCase()}] ${message}`);
        const statusMessage = document.getElementById('statusMessage');
        if (!statusMessage) return;
        statusMessage.textContent = message;
        statusMessage.className = `status-message status-${type}`;
        statusMessage.classList.remove('hidden');
        setTimeout(() => statusMessage.classList.add('hidden'), 5000);
    },
    updatePageInfo() {
        const totalFiltered = APP.state.filteredConductores.length;
        APP.state.totalPages = Math.ceil(totalFiltered / APP.state.pageSize);
        APP.state.currentPage = Math.max(1, Math.min(APP.state.currentPage, APP.state.totalPages || 1));
        const start = totalFiltered > 0 ? (APP.state.currentPage - 1) * APP.state.pageSize + 1 : 0;
        const end = Math.min(APP.state.currentPage * APP.state.pageSize, totalFiltered);
        
        if (APP.elements.pageInfo) APP.elements.pageInfo.textContent = `Página ${APP.state.currentPage} de ${APP.state.totalPages || 1}`;
        if (APP.elements.resultsCount) APP.elements.resultsCount.textContent = `${totalFiltered} resultados`;
        if (document.getElementById('totalLabel')) document.getElementById('totalLabel').textContent = `(${start}-${end} de ${totalFiltered} registros)`;
        
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
        if (formData.get('licencia')) count++;
        if (formData.get('dni')) count++;
        if (formData.get('nombre')) count++;
        if (formData.get('chofer')) count++;
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
        if (formData.get('chofer')) filters.chofer = formData.get('chofer');

        console.log('[FILTERS] Filtros aplicados (FE):', filters); // LOG
        return filters;
    },
    
    applyFrontendFilters(conductores, filters) {
        return conductores.filter(conductor => {
            let matches = true;
            
            if (filters.licencia && conductor.licencia && !conductor.licencia.toLowerCase().includes(filters.licencia.toLowerCase())) matches = false;
            
            if (filters.dni && conductor.dni && !conductor.dni.toLowerCase().includes(filters.dni.toLowerCase())) matches = false;
            
            if (filters.nombre && conductor.nombre && !conductor.nombre.toLowerCase().includes(filters.nombre.toLowerCase())) matches = false;
            
            if (filters.chofer !== undefined && filters.chofer !== '') {
                // Usamos conductor.chofer directamente del objeto si está disponible, sino asumimos el valor de la Licencia
                const conductorChofer = String(conductor.chofer || conductor.socio || 0); // Adaptación: usar socio/chofer si vienen
                if (conductorChofer !== filters.chofer) matches = false;
            }
            
            return matches;
        });
    },

    sortTable(key) {
        const { currentSort } = APP.state;
        let direction = 'asc';
        if (currentSort.key === key && currentSort.direction === 'asc') { direction = 'desc'; }

        APP.state.filteredConductores.sort((a, b) => {
            let valA = a[key] || '';
            let valB = b[key] || '';
            
            const comparison = valA.toString().localeCompare(valB.toString());
            
            return direction === 'asc' ? comparison : comparison * -1;
        });

        APP.state.currentSort = { key, direction };
        APP.state.currentPage = 1;
        DOM.renderResults();
    },
    
    handleClearAllFilters() {
        const { searchForm } = APP.elements;
        searchForm.reset();
        // Recargar con filtros vacíos
        API.loadAllConductores(Filters.getFiltersFromForm());
        UI.alertMessage('✅ Filtros limpiados', 'info');
    }
};

// =================================================================================
// 🌐 API SERVICES
// =================================================================================
const API = {
    async loadAllConductores(filters = {}) {
        const tbody = APP.elements.conductorResults;
        UI.updateActiveFiltersCount();
        console.log('[API] 🌐 Pidiendo lista de conductores...'); // LOG

        try {
            const response = await fetch('/api/v1/conductores'); // RUTA GET /conductores
            
            if (!response.ok) {
                 console.error('[API] ❌ Fallo HTTP:', response.status); // LOG
                 throw new Error(`Error ${response.status} al cargar conductores.`);
            }
            
            const data = await response.json();
            const conductores = data.data || [];
            
            APP.state.allConductores = conductores;
            
            APP.state.filteredConductores = Filters.applyFrontendFilters(conductores, filters);

            Filters.sortTable(APP.state.currentSort.key);
            UI.updatePageInfo();

            if (conductores.length === 0) {
                 UI.alertMessage('ℹ️ No se encontraron conductores.', 'info');
            }
            
        } catch (error) {
            console.error('[API] 🛑 Error cargando conductores:', error); // LOG
            UI.alertMessage(`❌ Error de red al cargar conductores: ${error.message}`, 'error');
            if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-red-500">❌ Error al cargar.</td></tr>';
        }
    }
};

// =================================================================================
// 🖼️ DOM RENDER
// =================================================================================
const DOM = {
    getCurrentPageData() {
        const filtered = APP.state.filteredConductores || [];
        const start = (APP.state.currentPage - 1) * APP.state.pageSize;
        return filtered.slice(start, start + APP.state.pageSize);
    },

    renderResults() {
        const tbody = APP.elements.conductorResults;
        if (!tbody) return;
        tbody.innerHTML = '';

        const pageData = DOM.getCurrentPageData();

        if (pageData.length === 0 && APP.state.filteredConductores.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-gray-500 italic text-sm">No se encontraron conductores.</td></tr>';
            UI.updatePageInfo();
            return;
        }

        pageData.forEach(conductor => {
            // 🔑 CORRECCIÓN: Declarar la variable row como un elemento HTML
            const row = document.createElement('tr'); 
            row.className = 'hover:bg-gray-50';

            const licencia = conductor.licencia;
            
            row.innerHTML = `
                <td class="px-3 py-2 text-xs font-medium text-primary-link">${licencia || '-'}</td>
                <td class="px-3 py-2 text-xs text-gray-800">${conductor.conductor || '-'}</td>
                <td class="px-3 py-2 text-xs text-gray-800">${conductor.nombre || '-'}</td>
                <td class="px-3 py-2 text-xs text-gray-600">${conductor.email || '-'}</td>
                <td class="px-3 py-2 text-xs text-gray-600">${conductor.telefono || '-'}</td>
                <td class="px-3 py-2 whitespace-nowrap text-center text-sm font-medium">
                    <button onclick="handleViewConductor('${licencia}')" class="text-blue-600 hover:text-blue-900 mx-1" title="Ver">
                        <i data-lucide="eye" class="h-4 w-4 inline"></i>
                    </button>
                    <button onclick="handleUpdateConductor('${licencia}')" class="text-yellow-600 hover:text-yellow-900 mx-1" title="Editar">
                        <i data-lucide="edit" class="h-4 w-4 inline"></i>
                    </button>
                    <button onclick="handleDeleteConductor('${licencia}')" class="text-red-600 hover:text-red-900 mx-1" title="Eliminar">
                        <i data-lucide="trash-2" class="h-4 w-4 inline"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });

        UI.updatePageInfo();
        if (window.lucide) window.lucide.createIcons();
    }
};

// =================================================================================
// 🎯 EVENTOS GLOBALES (Mapeo de Rutas y Navegación)
// =================================================================================

function handleCreateConductor() { window.location.href = '/admin/conductor/crear'; }
function handleUpdateConductor(licencia) { window.location.href = `/admin/conductor/update/${licencia}`; }
function handleViewConductor(licencia) { window.location.href = `/admin/conductor/view/${licencia}`; }
function handleDeleteConductor(licencia) {
    if (confirm(`¿Está seguro de ELIMINAR al conductor con Licencia: ${licencia}? Esta acción es irreversible.`)) {
        window.location.href = `/admin/conductor/delete/${licencia}`;
    }
}
function handleSearch(e) {
    if (e) e.preventDefault();
    APP.state.currentPage = 1;
    API.loadAllConductores(Filters.getFiltersFromForm());
}


// =================================================================================
// 🚀 INICIALIZACIÓN
// =================================================================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Iniciando Gestor de Conductores...');

    // Asignar listeners de paginación
    if (APP.elements.prevBtn) APP.elements.prevBtn.addEventListener('click', () => {
        if (APP.state.currentPage > 1) { APP.state.currentPage--; DOM.renderResults(); }
    });
    if (APP.elements.nextBtn) APP.elements.nextBtn.addEventListener('click', () => {
        if (APP.state.currentPage < APP.state.totalPages) { APP.state.currentPage++; DOM.renderResults(); }
    });
    if (APP.elements.recordsSelect) {
        APP.elements.recordsSelect.innerHTML = `<option value="10" selected>10</option><option value="20">20</option><option value="50">50</option><option value="100">100</option>`;
        APP.elements.recordsSelect.addEventListener('change', (e) => {
            APP.state.pageSize = parseInt(e.target.value);
            APP.state.currentPage = 1;
            DOM.renderResults();
        });
    }

    // Exposición global (para el HTML y eventos)
    window.handleSearch = handleSearch;
    window.handleClearAllFilters = Filters.handleClearAllFilters;
    window.sortTable = Filters.sortTable;
    window.handleCreateConductor = handleCreateConductor;
    window.handleUpdateConductor = handleUpdateConductor;
    window.handleViewConductor = handleViewConductor;
    window.handleDeleteConductor = handleDeleteConductor;

    // Carga inicial
    API.loadAllConductores(Filters.getFiltersFromForm());
});