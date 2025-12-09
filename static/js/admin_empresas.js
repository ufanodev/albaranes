// Archivo: static/js/admin_empresas.js
// ✅ Versión para Administrador: Gestión de Empresas, tabla principal con búsqueda y paginación.

const APP = {
    elements: {
        // Elementos de Resultados y Paginación
        resultsBody: document.getElementById('empresaResults'), // ID de la tabla en el HTML
        recordsSelect: document.getElementById('recordsPerPage'),
        statusMessage: document.getElementById('statusMessage'),
        pageInfo: document.getElementById('pageInfo'),
        totalLabel: document.getElementById('totalLabel'),
        resultsCount: document.getElementById('resultsCount'),
        prevBtn: document.getElementById('prevPageBtn'),
        nextBtn: document.getElementById('nextPageBtn'),
        
        // Elementos de Filtros (Adaptados para Empresa)
        searchForm: document.getElementById('searchForm'),
        nifInput: document.getElementById('nif'), // NIF
        nombreInput: document.getElementById('nombre'), // Razón Social
        telefonoInput: document.getElementById('telefono'), // Teléfono
        emailInput: document.getElementById('email'), // Email
        activeFiltersCount: document.getElementById('activeFiltersCount'),

        // Campos específicos de búsqueda
        specificFields: [
            document.getElementById('nif'), 
            document.getElementById('nombre'),
            document.getElementById('telefono'),
            document.getElementById('email'),
        ].filter(el => el !== null),
    },
    state: {
        allEmpresas: [],      // Lista completa (data de la API)
        filteredEmpresas: [], // Lista actual mostrada
        currentPage: 1,
        pageSize: 10,
        totalRecords: 0,
        totalPages: 1,
        currentSort: { key: 'nombre', direction: 'asc' }, // Ordenación por defecto: Razón Social
    }
};

// =================================================================================
// 🎨 UI HELPERS & UTILITIES
// =================================================================================

const UI = {
    /** Muestra un mensaje de estado en la interfaz. */
    alertMessage(message, type = 'info') {
        const { statusMessage } = APP.elements;
        if (!statusMessage) return;
        
        statusMessage.textContent = message;
        statusMessage.className = `status-message ${type === 'success' ? 'status-success' : type === 'error' ? 'status-error' : 'status-info'}`;
        statusMessage.classList.remove('hidden');
        setTimeout(() => statusMessage.classList.add('hidden'), 4000);
    },

    /** Actualiza la información de paginación (ej: Página 1 de 5). */
    updatePageInfo() {
        const { pageInfo, totalLabel, resultsCount } = APP.elements;
        const totalFiltered = APP.state.filteredEmpresas.length;
        
        APP.state.totalPages = Math.ceil(totalFiltered / APP.state.pageSize);
        APP.state.currentPage = Math.min(APP.state.currentPage, APP.state.totalPages || 1); 
        APP.state.currentPage = Math.max(1, APP.state.currentPage);

        const startIndex = (APP.state.currentPage - 1) * APP.state.pageSize;
        const endIndex = Math.min(startIndex + APP.state.pageSize, totalFiltered);
        const showing = endIndex - startIndex;

        if (pageInfo) pageInfo.textContent = `Página ${APP.state.currentPage} de ${APP.state.totalPages || 1}`;
        if (totalLabel) totalLabel.textContent = `(${showing} de ${totalFiltered} registros)`;
        
        if (resultsCount) {
            resultsCount.textContent = totalFiltered;
        }
    },

    /** Habilita/Deshabilita los botones de paginación. */
    updatePaginationButtons() {
        const { prevBtn, nextBtn } = APP.elements;
        const totalPages = APP.state.totalPages || 1;
        
        if (prevBtn) prevBtn.disabled = APP.state.currentPage <= 1;
        if (nextBtn) nextBtn.disabled = APP.state.currentPage >= totalPages;
    },
    
    /** Actualiza el contador de filtros activos en la UI. */
    updateActiveFiltersCount() {
        const { searchForm, activeFiltersCount } = APP.elements;
        if (!searchForm || !activeFiltersCount) return;
        
        const formData = new FormData(searchForm);
        let finalCount = 0;
        
        for (let [key, value] of formData.entries()) {
            const val = value.toString().trim();
            if (val !== '' && key !== 'recordsPerPage') { 
                finalCount++;
            }
        }
        
        activeFiltersCount.textContent = finalCount;
        activeFiltersCount.className = finalCount > 0 ? 
            'ml-3 text-sm font-normal bg-yellow-500 text-white px-3 py-1 rounded-full' :
            'ml-3 text-sm font-normal bg-primary-link text-white px-3 py-1 rounded-full';
    },
};

// =================================================================================
// 🔍 FILTER & SORT LOGIC
// =================================================================================
const Filters = {
    /** Obtiene los valores de los filtros del formulario. */
    getFiltersFromForm() {
        const form = APP.elements.searchForm;
        const formData = new FormData(form);
        
        const filters = {
            nif: formData.get('nif') || '', 
            nombre: formData.get('nombre') || '',
            telefono: formData.get('telefono') || '',
            email: formData.get('email') || '',
        };

        return filters;
    },
    
    /** Ordena la tabla por la columna especificada. */
    sortTable(key, dataType = 'string') {
        const { currentSort } = APP.state;
        let direction = 'asc';
        
        if (currentSort.key === key && currentSort.direction === 'asc') {
            direction = 'desc';
        }
        
        APP.state.filteredEmpresas.sort((a, b) => {
            let valA = a[key] || '';
            let valB = b[key] || '';
            
            if (dataType === 'number') {
                valA = parseFloat(valA) || 0;
                valB = parseFloat(valB) || 0;
            }
            
            let comparison = 0;
            if (valA > valB) { comparison = 1; } 
            else if (valA < valB) { comparison = -1; }
            else if (dataType === 'string') {
                comparison = valA.toString().localeCompare(valB.toString());
            }
            
            return direction === 'asc' ? comparison : comparison * -1;
        });
        
        APP.state.currentSort = { key, direction };
        APP.state.currentPage = 1;
        DOM.renderResults();
        Events.updateSortIcons();
    }
};

// =================================================================================
// 🌐 API SERVICES (Conexión a endpoints de Go)
// =================================================================================
const API = {
    /** Carga todas las empresas de la API. */
    async loadAllEmpresas() {
        DOM.showLoading();
        
        try {
            // 🔑 Endpoint GET /api/v1/empresas
            const response = await fetch('/api/v1/empresas'); 
            
            if (response.status === 401) {
                window.location.href = '/login';
                return;
            }
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Error ${response.status} en la API: ${errorText}`);
            }
            
            const data = await response.json();
            // Asumimos que la API devuelve { data: [...] }
            const empresas = Array.isArray(data.data) ? data.data : data; 
            
            APP.state.allEmpresas = empresas;
            APP.state.filteredEmpresas = empresas;
            APP.state.totalRecords = empresas.length;
            APP.state.currentPage = 1;
            
            DOM.renderResults();
            UI.alertMessage(`Cargadas ${empresas.length} empresas disponibles`, 'success');
            
        } catch (error) {
            console.error('Error en carga inicial de empresas:', error);
            UI.alertMessage(`Error de red al cargar empresas. ¿API iniciada?`, 'error');
            DOM.showNoResults();
        }
    },
};

// =================================================================================
// 🖼️ DOM RENDER
// =================================================================================
const DOM = {
    /** Muestra el spinner de carga. */
    showLoading() {
        const { resultsBody, resultsCount } = APP.elements;
        if (resultsBody) {
            resultsBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-12">
                        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-link mx-auto mb-4"></div>
                        Cargando empresas...
                    </td>
                </tr>`;
        }
        if (resultsCount) { resultsCount.textContent = '...'; }
    },

    /** Muestra un mensaje cuando no hay resultados. */
    showNoResults() {
        const { resultsBody, resultsCount } = APP.elements;
        if (resultsBody) {
            resultsBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-12 text-orange-500 font-semibold">
                        📭 No se encontraron empresas que coincidan con los filtros aplicados
                    </td>
                </tr>`;
        }
        if (resultsCount) { resultsCount.textContent = '0'; }
        UI.updatePageInfo();
        UI.updatePaginationButtons();
    },

    /** Renderiza los resultados en la tabla. */
    renderResults() {
        const { resultsBody } = APP.elements;
        if (!resultsBody) return;
        resultsBody.innerHTML = '';
        
        APP.state.totalPages = Math.ceil(APP.state.filteredEmpresas.length / APP.state.pageSize);

        if (APP.state.currentPage > APP.state.totalPages && APP.state.totalPages > 0) {
            APP.state.currentPage = APP.state.totalPages;
        } else if (APP.state.filteredEmpresas.length > 0 && APP.state.currentPage === 0) {
            APP.state.currentPage = 1;
        }
        
        const startIndex = (APP.state.currentPage - 1) * APP.state.pageSize;
        const endIndex = startIndex + APP.state.pageSize;
        const pageData = APP.state.filteredEmpresas.slice(startIndex, endIndex);
        
        if (!pageData.length && APP.state.filteredEmpresas.length === 0) {
            DOM.showNoResults();
            return;
        }

        pageData.forEach(empresa => {
            const id = empresa.id || empresa.ID; 
            const row = `
                <tr class="hover:bg-primary-pastel/30 ${id % 2 === 0 ? 'bg-white' : 'bg-gray-50'} border-b transition-colors">
                    <td class="px-3 py-2 whitespace-nowrap text-xs font-medium text-primary-link">${id || '-'}</td>
                    <td class="px-3 py-2 whitespace-nowrap text-xs text-gray-700">${empresa.nif || '-'}</td>
                    <td class="px-3 py-2 whitespace-nowrap text-xs text-gray-900 font-medium text-truncate" title="${empresa.nombre || '-'}">${empresa.nombre || '-'}</td>
                    <td class="px-3 py-2 text-xs text-gray-600 text-truncate" title="${empresa.direccion || '-'}">${empresa.direccion || '-'}</td>
                    <td class="px-3 py-2 whitespace-nowrap text-xs text-gray-500">${empresa.telefono || '-'}</td>
                    <td class="px-3 py-2 text-xs text-blue-500 text-truncate" title="${empresa.email || '-'}">
                         ${empresa.email ? `<a href="mailto:${empresa.email}" class="hover:underline">${empresa.email}</a>` : '-'}
                    </td>
                    <td class="px-3 py-2 whitespace-nowrap text-center text-xs font-medium">
                        <div class="flex justify-center space-x-1">
                            <button onclick="handleEditActionEmpresa('${id}')" title="Editar empresa" class="text-primary-link hover:text-orange-700 p-0.5 rounded-full hover:bg-orange-100 transition active:scale-90">
                                <i data-lucide="pencil" class="h-3 w-3"></i>
                            </button>
                            <button onclick="handleDeleteActionEmpresa('${id}', '${empresa.nombre}')" title="Eliminar empresa" class="text-red-500 hover:text-red-700 p-0.5 rounded-full hover:bg-red-100 transition active:scale-90">
                                <i data-lucide="trash-2" class="h-3 w-3"></i>
                            </button>
                        </div>
                    </td>
                </tr>`;
            
            resultsBody.insertAdjacentHTML('beforeend', row);
        });

        UI.updatePageInfo();
        UI.updatePaginationButtons();

        if (window.lucide) { window.lucide.createIcons(); }
    },

    /** Inicializa el selector de registros por página. */
    initRecordsSelect() {
        const { recordsSelect } = APP.elements;
        if (!recordsSelect) return;
        
        recordsSelect.innerHTML = `
            <option value="10" selected>10</option>
            <option value="20">20</option>
            <option value="50">50</option>
            <option value="100">100</option>
        `;
        
        recordsSelect.addEventListener('change', (e) => {
            APP.state.pageSize = parseInt(e.target.value);
            APP.state.currentPage = 1;
            DOM.renderResults();
        });
    }
};

// =================================================================================
// 🎯 EVENT HANDLERS
// =================================================================================
const Events = {
    /** Maneja el envío del formulario de búsqueda (filtrado local). */
    async handleSearch(e) {
        if (e) e.preventDefault();
        
        const filters = Filters.getFiltersFromForm();
        const lowerNif = filters.nif.toLowerCase();
        const lowerNombre = filters.nombre.toLowerCase();
        const lowerTelefono = filters.telefono.toLowerCase();
        const lowerEmail = filters.email.toLowerCase();
        
        let filteredResults = APP.state.allEmpresas.filter(empresa => {
            // Lógica de búsqueda local
            const matchesNif = !lowerNif || (empresa.nif && empresa.nif.toLowerCase().includes(lowerNif));
            const matchesNombre = !lowerNombre || (empresa.nombre && empresa.nombre.toLowerCase().includes(lowerNombre));
            const matchesTelefono = !lowerTelefono || (empresa.telefono && empresa.telefono.toLowerCase().includes(lowerTelefono));
            const matchesEmail = !lowerEmail || (empresa.email && empresa.email.toLowerCase().includes(lowerEmail));

            return matchesNif && matchesNombre && matchesTelefono && matchesEmail;
        });

        APP.state.filteredEmpresas = filteredResults;
        APP.state.totalRecords = filteredResults.length;
        APP.state.currentPage = 1;
        
        DOM.renderResults();
        UI.alertMessage(`Encontradas ${filteredResults.length} empresas`, 'success');
        UI.updateActiveFiltersCount();
    },
    
    /** Limpia todos los campos de filtro y reinicia la vista. */
    handleClearAllFilters() {
        const { searchForm, recordsSelect } = APP.elements; 
        if (searchForm) {
            searchForm.reset();
            APP.state.currentPage = 1;
            APP.state.pageSize = 10;
            APP.state.filteredEmpresas = [...APP.state.allEmpresas]; 
            APP.state.currentSort = { key: 'nombre', direction: 'asc' };
            
            if (recordsSelect) recordsSelect.value = '10';
            
            DOM.renderResults();
            UI.alertMessage('✅ Todos los filtros han sido limpiados', 'info');
            UI.updateActiveFiltersCount();
        }
    },
    
    /** Maneja los cambios en los filtros para actualizar el contador. */
    handleFilterChange() {
        UI.updateActiveFiltersCount();
    },
    
    /** Actualiza los iconos de ordenación en la cabecera de la tabla. */
    updateSortIcons() {
        const sortIcons = document.querySelectorAll('.sort-icon');
        sortIcons.forEach(icon => {
            icon.innerHTML = `<svg data-lucide="chevrons-up-down" class="h-3 w-3 text-gray-400"></svg>`;
        });

        const { key, direction } = APP.state.currentSort;
        const activeIcon = document.getElementById(`sort-${key}`);
        if (activeIcon) {
            activeIcon.innerHTML = `<svg data-lucide="chevron-${direction === 'asc' ? 'up' : 'down'}" class="h-3 w-3 text-primary-link"></svg>`;
        }
        if (window.lucide) { window.lucide.createIcons(); }
    },
    
    /** Inicializa todos los event listeners. */
    init() {
        const { searchForm, prevBtn, nextBtn } = APP.elements;
        DOM.initRecordsSelect();

        if (searchForm) {
            searchForm.addEventListener('submit', this.handleSearch.bind(this));
            searchForm.addEventListener('change', this.handleFilterChange.bind(this));
            searchForm.addEventListener('input', this.handleFilterChange.bind(this));
        }
        
        window.handleClearAllFilters = this.handleClearAllFilters.bind(this);
        
        // Handlers de paginación
        if (prevBtn) { prevBtn.addEventListener('click', () => { if (APP.state.currentPage > 1) { APP.state.currentPage--; DOM.renderResults(); } }); }
        if (nextBtn) { nextBtn.addEventListener('click', () => { if (APP.state.currentPage < APP.state.totalPages) { APP.state.currentPage++; DOM.renderResults(); } }); }
        
        window.sortTable = (key, dataType = 'string') => Filters.sortTable(key, dataType);
    }
};

// =================================================================================
// 🌍 FUNCIONES GLOBALES (Redirecciones a CRUD)
// =================================================================================

/** Redirige a la creación de una nueva empresa (CRUD) */
window.handleCreateActionEmpresa = () => {
    window.location.href = `/admin/empresas/crear`; 
};

/** Redirige a la edición de la empresa (CRUD) */
window.handleEditActionEmpresa = (empresaId) => {
    window.location.href = `/admin/empresas/update/${empresaId}`;
};

/** Llama a la función de borrado de la empresa (Redirige a la vista de confirmación) */
window.handleDeleteActionEmpresa = (empresaId, nombre) => {
     if (confirm(`¿Estás seguro de que quieres eliminar la empresa "${nombre}" (ID: ${empresaId})?`)) {
         window.location.href = `/admin/empresas/delete/${empresaId}`;
     }
};


// Funciones de cabecera de Navegación (Asumidas globales)
window.toggleDropdown = (button) => { 
    const parentDropdown = button.closest('.dropdown'); 
    document.querySelectorAll('.dropdown').forEach(dropdown => {
        if (dropdown !== parentDropdown) { dropdown.classList.remove('active'); }
    });
    if (parentDropdown) { parentDropdown.classList.toggle('active'); }
};
window.handleAction = (title, description) => { /* Simulación de modal */ UI.alertMessage(`Acción: ${title}`, 'info'); };
window.handleLogout = () => { UI.alertMessage('Cerrar Sesión simulado...', 'info'); setTimeout(() => window.location.href = '/login', 1500); };
window.toggleMobileMenu = () => { const mobileMenu = document.getElementById('mobileMenu'); if (mobileMenu) mobileMenu.classList.toggle('hidden'); };


// =================================================================================
// 🚀 INICIALIZACIÓN
// =================================================================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('---[ admin_empresas.js ]---------------------------------');
    console.log('✅ 1. Inicio de carga de la página principal de Empresas.');
    
    Events.init();
    
    // Cargar datos iniciales
    await API.loadAllEmpresas();
    
    Events.updateSortIcons();
    Filters.sortTable('nombre'); // Ordenar por nombre al cargar
    
    UI.updateActiveFiltersCount();
    console.log('✅ 2. Carga de datos inicial y UI completada.');
});