// Archivo: static/js/admin_titular.js
// ✅ Versión para Administrador: Gestión de Titulares/Licencias, tabla principal.

const APP = {
    elements: {
        // Elementos de Resultados y Paginación
        resultsBody: document.getElementById('titularResults'),
        recordsSelect: document.getElementById('recordsPerPage'),
        statusMessage: document.getElementById('statusMessage'),
        pageInfo: document.getElementById('pageInfo'),
        totalLabel: document.getElementById('totalLabel'),
        resultsCount: document.getElementById('resultsCount'),
        prevBtn: document.getElementById('prevPageBtn'),
        nextBtn: document.getElementById('nextPageBtn'),
        
        // Elementos de Filtros
        searchForm: document.getElementById('searchForm'),
        licenciaInput: document.getElementById('licencia'),
        dniInput: document.getElementById('dni'),
        nombreInput: document.getElementById('nombre'),
        socioSelect: document.getElementById('socio'),
        choferSelect: document.getElementById('chofer'),
        activeFiltersCount: document.getElementById('activeFiltersCount'),

        // Campos específicos de búsqueda de Titulares
        specificFields: [
            document.getElementById('licencia'), 
            document.getElementById('dni'),
            document.getElementById('nombre'),
            document.getElementById('socio'),
            document.getElementById('chofer'),
        ],
    },
    state: {
        allTitulares: [],      // Lista completa (data de la API)
        filteredTitulares: [], // Lista actual mostrada
        currentPage: 1,
        pageSize: 10,
        totalRecords: 0,
        totalPages: 1,
        currentSort: { key: 'licencia', direction: 'asc' }, // Ordenación por defecto
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
        
        APP.state.totalPages = Math.ceil(APP.state.filteredTitulares.length / APP.state.pageSize);
        
        if (pageInfo) {
            APP.state.currentPage = Math.min(APP.state.currentPage, APP.state.totalPages || 1); 
            pageInfo.textContent = `Página ${APP.state.currentPage} de ${APP.state.totalPages || 1}`;
        }
        
        if (totalLabel) {
            const startIndex = (APP.state.currentPage - 1) * APP.state.pageSize;
            const endIndex = Math.min(startIndex + APP.state.pageSize, APP.state.filteredTitulares.length);
            const showing = endIndex - startIndex;

            totalLabel.textContent = `(${showing} de ${APP.state.filteredTitulares.length} registros)`;
        }
        
        if (resultsCount) {
            resultsCount.textContent = APP.state.filteredTitulares.length;
        }
    },

    /** Habilita/Deshabilita los botones de paginación. */
    updatePaginationButtons() {
        const { prevBtn, nextBtn } = APP.elements;
        const totalPages = APP.state.totalPages || 1;
        
        if (prevBtn) {
            prevBtn.disabled = APP.state.currentPage <= 1;
            prevBtn.classList.toggle('opacity-50', APP.state.currentPage <= 1);
            prevBtn.classList.toggle('cursor-not-allowed', APP.state.currentPage <= 1);
        }
        
        if (nextBtn) {
            nextBtn.disabled = APP.state.currentPage >= totalPages;
            nextBtn.classList.toggle('opacity-50', APP.state.currentPage >= totalPages);
            nextBtn.classList.toggle('cursor-not-allowed', APP.state.currentPage >= totalPages);
        }
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

    /** Devuelve el HTML para los campos booleanos (Sí/No). */
    getBooleanHtml(value) {
        if (value === 1 || value === true) {
            return `<span class="px-1.5 py-0.5 inline-flex text-xs leading-4 font-semibold rounded-full bg-green-100 text-green-800">Sí</span>`;
        } else {
            return `<span class="px-1.5 py-0.5 inline-flex text-xs leading-4 font-semibold rounded-full bg-red-100 text-red-800">No</span>`;
        }
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
            licencia: formData.get('licencia') || '', 
            dni: formData.get('dni') || '',
            nombre: formData.get('nombre') || '',
            socio: formData.get('socio') || '', 
            chofer: formData.get('chofer') || '', 
        };

        if (filters.socio !== '') filters.socio = parseInt(filters.socio);
        if (filters.chofer !== '') filters.chofer = parseInt(filters.chofer);

        return filters;
    },
    
    /** Ordena la tabla por la columna especificada. */
    sortTable(key, dataType = 'string') {
        const { currentSort } = APP.state;
        let direction = 'asc';
        
        if (currentSort.key === key && currentSort.direction === 'asc') {
            direction = 'desc';
        }
        
        APP.state.filteredTitulares.sort((a, b) => {
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
    /** Carga todos los titulares de la API. */
    async loadAllTitulares() {
        DOM.showLoading();
        
        try {
            // Endpoint GetLicencias: /api/v1/licencias. Esto traerá solo activos (Estado=true) por defecto.
            const response = await fetch('/api/v1/licencias'); 
            
            if (response.status === 401) {
                window.location.href = '/login';
                return;
            }
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Error ${response.status} en la API: ${errorText}`);
            }
            
            const data = await response.json();
            const titulares = Array.isArray(data.data) ? data.data : data; 
            
            APP.state.allTitulares = titulares;
            APP.state.filteredTitulares = titulares;
            APP.state.totalRecords = titulares.length;
            APP.state.currentPage = 1;
            
            DOM.renderResults();
            UI.alertMessage(`Cargados ${titulares.length} titulares disponibles`, 'success');
            
        } catch (error) {
            console.error('Error en carga inicial de titulares:', error);
            UI.alertMessage(`Error de red al cargar titulares. ¿API iniciada?`, 'error');
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
                    <td colspan="10" class="text-center py-12">
                        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-link mx-auto mb-4"></div>
                        Cargando titulares...
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
                    <td colspan="10" class="text-center py-12 text-orange-500 font-semibold">
                        📭 No se encontraron titulares que coincidan con los filtros aplicados
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
        
        APP.state.totalPages = Math.ceil(APP.state.filteredTitulares.length / APP.state.pageSize);

        if (APP.state.currentPage > APP.state.totalPages && APP.state.totalPages > 0) {
            APP.state.currentPage = APP.state.totalPages;
        } else if (APP.state.filteredTitulares.length > 0 && APP.state.currentPage === 0) {
            APP.state.currentPage = 1;
        }
        
        const startIndex = (APP.state.currentPage - 1) * APP.state.pageSize;
        const endIndex = startIndex + APP.state.pageSize;
        const pageData = APP.state.filteredTitulares.slice(startIndex, endIndex);
        
        if (!pageData.length && APP.state.filteredTitulares.length === 0) {
            DOM.showNoResults();
            return;
        }

        pageData.forEach(titular => {
            const id = titular.id || titular.ID; 
            const row = `
                <tr class="hover:bg-primary-pastel/30 ${id % 2 === 0 ? 'bg-white' : 'bg-gray-50'} border-b transition-colors">
                    <td class="px-3 py-2 whitespace-nowrap text-xs font-medium text-primary-link">${titular.licencia || 'N/A'}</td>
                    <td class="px-3 py-2 whitespace-nowrap text-xs text-gray-700">${titular.dni || '-'}</td>
                    <td class="px-3 py-2 whitespace-nowrap text-xs text-gray-900 font-medium text-truncate" title="${titular.nombre || '-'}">${titular.nombre || '-'}</td>
                    <td class="px-3 py-2 text-xs text-gray-600 text-truncate max-w-[150px]" title="${titular.direccion || '-'}">${titular.direccion || '-'}</td>
                    <td class="px-3 py-2 whitespace-nowrap text-xs text-gray-500">${titular.cp || '-'}</td>
                    <td class="px-3 py-2 whitespace-nowrap text-xs text-gray-500">${titular.telefono || '-'}</td>
                    <td class="px-3 py-2 text-xs text-blue-500 text-truncate max-w-[100px]" title="${titular.email || '-'}">
                         ${titular.email ? `<a href="mailto:${titular.email}" class="hover:underline">${titular.email}</a>` : '-'}
                    </td>
                    <td class="px-3 py-2 whitespace-nowrap text-xs text-center">${UI.getBooleanHtml(titular.socio)}</td>
                    <td class="px-3 py-2 whitespace-nowrap text-xs text-center">${UI.getBooleanHtml(titular.chofer)}</td>
                    <td class="px-3 py-2 whitespace-nowrap text-center text-xs font-medium">
                        <div class="flex justify-center space-x-1">
                            <button onclick="handleViewActionTitular('${id}')" title="Ver detalle" class="text-blue-500 hover:text-blue-700 p-0.5 rounded-full hover:bg-blue-100 transition active:scale-90">
                                <i data-lucide="eye" class="h-3 w-3"></i>
                            </button>
                            <button onclick="handleEditActionTitular('${id}')" title="Editar titular" class="text-primary-link hover:text-orange-700 p-0.5 rounded-full hover:bg-orange-100 transition active:scale-90">
                                <i data-lucide="pencil" class="h-3 w-3"></i>
                            </button>
                            <button onclick="handleDeleteActionTitular('${id}', '${titular.licencia}')" title="Eliminar titular" class="text-red-500 hover:text-red-700 p-0.5 rounded-full hover:bg-red-100 transition active:scale-90">
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
        
        let filteredResults = APP.state.allTitulares.filter(titular => {
            const matchesLicencia = !filters.licencia || (titular.licencia && titular.licencia.toLowerCase().includes(filters.licencia.toLowerCase()));
            const matchesDni = !filters.dni || (titular.dni && titular.dni.toLowerCase().includes(filters.dni.toLowerCase()));
            const matchesNombre = !filters.nombre || (titular.nombre && titular.nombre.toLowerCase().includes(filters.nombre.toLowerCase()));
            const matchesSocio = filters.socio === '' || titular.socio === filters.socio;
            const matchesChofer = filters.chofer === '' || titular.chofer === filters.chofer;

            return matchesLicencia && matchesDni && matchesNombre && matchesSocio && matchesChofer;
        });

        APP.state.filteredTitulares = filteredResults;
        APP.state.totalRecords = filteredResults.length;
        APP.state.currentPage = 1;
        
        DOM.renderResults();
        UI.alertMessage(`Encontrados ${filteredResults.length} titulares`, 'success');
    },
    
    /** Limpia todos los campos de filtro y reinicia la vista. */
    handleClearAllFilters() {
        const { searchForm, recordsSelect } = APP.elements; 
        if (searchForm) {
            searchForm.reset();
            APP.state.currentPage = 1;
            APP.state.pageSize = 10;
            APP.state.filteredTitulares = [...APP.state.allTitulares]; 
            APP.state.currentSort = { key: 'licencia', direction: 'asc' };
            
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
        
        if (prevBtn) { prevBtn.addEventListener('click', () => { if (APP.state.currentPage > 1) { APP.state.currentPage--; DOM.renderResults(); } }); }
        if (nextBtn) { nextBtn.addEventListener('click', () => { if (APP.state.currentPage < APP.state.totalPages) { APP.state.currentPage++; DOM.renderResults(); } }); }
        
        window.sortTable = (key) => Filters.sortTable(key, key === 'socio' || key === 'chofer' ? 'number' : 'string');
    }
};

// =================================================================================
// 🚀 INICIALIZACIÓN
// =================================================================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('---[ admin_titular.js ]---------------------------------');
    console.log('✅ 1. Inicio de carga de la página principal de Titulares.');
    
    Events.init();
    
    await API.loadAllTitulares();
    
    Events.updateSortIcons();
    Filters.sortTable('licencia');
    
    UI.updateActiveFiltersCount();
    console.log('✅ 2. Carga de datos inicial y UI completada.');
});

// =================================================================================
// 🌍 FUNCIONES GLOBALES (Redirecciones y Modales)
// =================================================================================

/** Redirige a la vista del titular (Acción 'Ver Detalle') */
window.handleViewActionTitular = (titularId) => {
    console.log(`➡️ 3. Botón 'Ver Detalle' pulsado para ID: ${titularId}.`);
    const url = `/admin/titulares/view/${titularId}`; 
    console.log(`➡️ 4. Redirigiendo a CRUD (VIEW): ${url}`);
    window.location.href = url;
};

/** Redirige a la edición del titular (Acción 'Editar') */
window.handleEditActionTitular = (titularId) => {
    console.log(`➡️ 3. Botón 'Editar' pulsado para ID: ${titularId}.`);
    const url = `/admin/titulares/update/${titularId}`;
    console.log(`➡️ 4. Redirigiendo a CRUD (EDIT): ${url}`);
    window.location.href = url;
};

/** Redirige a la confirmación de borrado lógico (Acción 'Eliminar') */
window.handleDeleteActionTitular = (titularId, licencia) => {
    console.log(`➡️ 3. Botón 'Eliminar' pulsado para ID: ${titularId}.`);
    const url = `/admin/titulares/delete/${titularId}`; 
    console.log(`➡️ 4. Redirigiendo a CRUD (DELETE): ${url}`);
    window.location.href = url;
};

/** Redirige a la creación de un nuevo titular (Acción 'Nuevo Titular') */
window.handleCreateActionTitular = () => {
    console.log("➡️ Botón 'Nuevo Titular' pulsado. Redirigiendo a modo CREATE.");
    const url = `/admin/titulares/crear`; 
    window.location.href = url;
};


// Funciones de utilidad de la UI (Para el header/modal)
window.showModal = (show) => {
    const modal = document.getElementById('actionModal');
    if (modal) modal.classList.toggle('hidden', !show);
};

window.handleAction = (title, description) => {
    const modal = document.getElementById('actionModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    
    if (modal && modalTitle && modalBody) {
        modalTitle.textContent = title;
        modalBody.textContent = description;
        modal.classList.remove('hidden');
    }
};

window.handleLogout = () => {
    window.handleAction('Cerrar Sesión', 'Se ha simulado el cierre de sesión. Redireccionando...');
    setTimeout(() => {
        window.location.href = '/login'; 
    }, 1500);
};

window.toggleDropdown = (button) => {
    document.querySelectorAll('.dropdown').forEach(dropdown => {
        if (dropdown !== button.parentElement) {
            dropdown.classList.remove('active');
        }
    });
    button.parentElement.classList.toggle('active');
};

window.toggleMobileMenu = () => {
    const mobileMenu = document.getElementById('mobileMenu');
    mobileMenu.classList.toggle('hidden');
};