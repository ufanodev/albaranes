// Archivo: static/js/admin_conductor.js
// ✅ CRUD Gestor Conductores - Lógica de Búsqueda y Renderizado de TABLA (Listado)
// =================================================================================

const APP = {
    elements: {
        conductorResults: document.getElementById('conductorResults'),
        searchForm: document.getElementById('searchForm'),
        // Inputs de filtro:
        licenciaFiltro: document.getElementById('licencia_filtro'),
        dniFiltro: document.getElementById('dni_filtro'),
        nombreFiltro: document.getElementById('nombre_filtro'),
        choferFiltro: document.getElementById('chofer_filtro'), // Usado como filtro Activo/Inactivo
        
        resultsCount: document.getElementById('resultsCount'),
        activeFiltersCount: document.getElementById('activeFiltersCount'),
        prevBtn: document.getElementById('prevPageBtn'),
        nextBtn: document.getElementById('nextPageBtn'),
        // No hay recordsPerPage en el HTML, pero mantenemos la lógica por si se añade
        recordsSelect: document.getElementById('recordsPerPage'), 
        pageInfo: document.getElementById('pageInfo'),
    },
    state: {
        allConductores: [],
        filteredConductores: [],
        currentPage: 1,
        pageSize: 10, // Default page size
        totalPages: 1,
        currentSort: { key: 'licencia', direction: 'asc' }, 
    }
};

// =================================================================================
// 🎨 UI HELPERS
// =================================================================================
const UI = {
    // Retorna HTML para el estado Activo/Inactivo
    getBooleanHtml(value) {
        // En el modelo Go, el campo es 'activo' (bool). En MySQL es tinyint(1)
        const isTrue = (value === 1 || value === '1' || value === true);
        return isTrue
            ? `<span class="px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">ACTIVO</span>`
            : `<span class="px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">INACTIVO</span>`;
    },
    alertMessage(message, type = 'info') {
        const statusMessage = document.getElementById('statusMessage');
        if (!statusMessage) return;
        
        statusMessage.textContent = message;
        statusMessage.classList.remove('status-success', 'status-error', 'status-info', 'status-neutral', 'hidden');
        statusMessage.className = `status-message status-${type}`;
        
        setTimeout(() => statusMessage.classList.add('hidden'), 5000);
    },
    updatePageInfo() {
        const totalFiltered = APP.state.filteredConductores.length;
        APP.state.totalPages = Math.ceil(totalFiltered / APP.state.pageSize);
        APP.state.currentPage = Math.max(1, Math.min(APP.state.currentPage, APP.state.totalPages || 1));
        
        // Actualizar contador y paginación
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
        
        // Contar filtros activos
        ['licencia', 'dni', 'nombre', 'chofer'].forEach(field => {
            const value = formData.get(field);
            if (value && String(value).trim() !== '' && String(value) !== 'Todos') {
                count++;
            }
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
        
        // Recoger solo si el valor no está vacío
        if (formData.get('licencia')) filters.licencia = formData.get('licencia');
        if (formData.get('dni')) filters.dni = formData.get('dni');
        if (formData.get('nombre')) filters.nombre = formData.get('nombre');
        
        // Filtro Activo/Inactivo (chofer_filtro en el HTML)
        const choferFiltroValue = formData.get('chofer');
        if (choferFiltroValue !== "" && choferFiltroValue !== null) {
             // Convertir 1/0 a booleano, o usar el valor si viene como booleano en la data
             filters.activo = choferFiltroValue === '1' || choferFiltroValue === 'true';
        }

        return filters;
    },
    
    applyFrontendFilters(conductores, filters) {
        return conductores.filter(conductor => {
            let matches = true;
            
            // 1. Filtrar por Licencia
            if (filters.licencia && conductor.licencia && !conductor.licencia.toLowerCase().includes(filters.licencia.toLowerCase())) matches = false;
            
            // 2. Filtrar por Nº Conductor (asumimos que 'dni' en el filtro mapea a 'conductor' en el modelo)
            if (filters.dni && conductor.conductor && !conductor.conductor.toLowerCase().includes(filters.dni.toLowerCase())) matches = false;
            
            // 3. Filtrar por Nombre
            if (filters.nombre && conductor.nombre && !conductor.nombre.toLowerCase().includes(filters.nombre.toLowerCase())) matches = false;
            
            // 4. Filtrar por Estado (activo)
            if (filters.activo !== undefined && filters.activo !== null) {
                // Compara el valor booleano del filtro con el valor booleano del conductor
                const conductorActivo = conductor.activo === true; 
                if (conductorActivo !== filters.activo) matches = false;
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
            
            // Tratamiento de strings
            const comparison = valA.toString().localeCompare(valB.toString(), 'es', { sensitivity: 'base' });
            
            return direction === 'asc' ? comparison : comparison * -1;
        });
        
        // Actualizar íconos de ordenación
        document.querySelectorAll('.sort-icon').forEach(icon => icon.innerHTML = '');
        const sortIcon = document.getElementById(`sort-${key}`);
        if (sortIcon) {
            sortIcon.innerHTML = direction === 'asc' 
                ? '<i data-lucide="chevron-up" class="h-4 w-4 inline ml-1"></i>' 
                : '<i data-lucide="chevron-down" class="h-4 w-4 inline ml-1"></i>';
            if (window.lucide) window.lucide.createIcons();
        }

        APP.state.currentSort = { key, direction };
        APP.state.currentPage = 1;
        DOM.renderResults();
    },
    
    handleClearAllFilters() {
        const { searchForm } = APP.elements;
        if (searchForm) {
            searchForm.reset();
            // Recargar con filtros vacíos (lo que equivale a todos los conductores)
            API.loadAllConductores(Filters.getFiltersFromForm());
            UI.alertMessage('✅ Filtros limpiados. Recargando listado completo.', 'info');
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
        
        if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-gray-500 italic text-sm">Cargando datos de la API...</td></tr>';
        
        try {
            // Llama al endpoint GET /api/v1/conductores
            const response = await fetch('/api/v1/conductores'); 
            
            if (response.status === 401) { 
                 window.location.href = '/login'; // Redirigir si no está autenticado
                 return;
            }
            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: 'Respuesta no JSON' }));
                throw new Error(`Error ${response.status}: ${error.error || 'Fallo de servidor'}`);
            }
            
            const data = await response.json();
            const conductores = data.data || [];
            
            APP.state.allConductores = conductores;
            
            // Aplicar filtros de frontend
            APP.state.filteredConductores = Filters.applyFrontendFilters(conductores, filters);

            // Ordenar por el criterio actual (por defecto Licencia ASC)
            Filters.sortTable(APP.state.currentSort.key); 
            
            if (conductores.length === 0) {
                 UI.alertMessage('ℹ️ No se encontraron conductores.', 'info');
            }
            
        } catch (error) {
            console.error('[API] 🛑 Error cargando conductores:', error); 
            UI.alertMessage(`❌ Error al cargar conductores: ${error.message}`, 'error');
            if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-red-500">❌ Error al cargar listado.</td></tr>';
            
            APP.state.filteredConductores = []; // Limpiar para que la UI se actualice
            UI.updatePageInfo();
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

        if (pageData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-gray-500 italic text-sm">No se encontraron conductores con los filtros aplicados.</td></tr>';
            UI.updatePageInfo();
            return;
        }

        pageData.forEach(conductor => {
            const row = document.createElement('tr'); 
            row.className = 'hover:bg-gray-50 border-b border-gray-100';

            // Extraemos los identificadores clave, incluyendo ID único.
            const id = conductor.id;
            const licencia = conductor.licencia;
            const conductorNum = conductor.conductor; // <-- ¡CLAVE! Número de Conductor
            const nombreCompleto = conductor.nombre; // 🔑 CAPTURAMOS EL NOMBRE
            const activoHtml = UI.getBooleanHtml(conductor.activo);

            // 🔧 ESCAPAR caracteres especiales para onclick
            const safeLicencia = (licencia || '').replace(/'/g, "\\'").replace(/"/g, '\\"');
            const safeConductorNum = (conductorNum || '').replace(/'/g, "\\'").replace(/"/g, '\\"');
            const safeNombre = (nombreCompleto || '').replace(/'/g, "\\'").replace(/"/g, '\\"'); // 🔑 ESCAPAMOS EL NOMBRE
            
            row.innerHTML = `
                <td class="px-3 py-2 text-xs font-medium text-primary-link whitespace-nowrap">${licencia || '-'}</td>
                <td class="px-3 py-2 text-xs text-gray-800 whitespace-nowrap">${conductorNum || '-'}</td>
                <td class="px-3 py-2 text-xs text-gray-800 whitespace-nowrap">${nombreCompleto || '-'}</td>
                <td class="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">${conductor.email || '-'}</td>
                <td class="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">${conductor.telefono || '-'}</td>
                <td class="px-3 py-2 text-center">${activoHtml}</td>
                
                <td class="px-3 py-2 whitespace-nowrap text-center text-sm font-medium">
                    <div class="flex space-x-2 justify-center">
                        <button onclick="handleViewConductor('${safeLicencia}', '${safeConductorNum}')" 
                                class="text-blue-600 hover:text-blue-900 mx-1 p-1 rounded-full hover:bg-blue-100 transition" 
                                title="Ver detalle">
                            <i data-lucide="eye" class="h-4 w-4 inline"></i>
                        </button>
                        <button onclick="handleUpdateConductor('${safeLicencia}', '${safeConductorNum}')" 
                                class="text-primary-link hover:text-orange-700 mx-1 p-1 rounded-full hover:bg-orange-100 transition" 
                                title="Editar">
                            <i data-lucide="edit" class="h-4 w-4 inline"></i>
                        </button>
                        <button onclick="handleDeleteConductorByID(${id}, '${safeNombre}')" 
                                class="text-red-600 hover:text-red-900 mx-1 p-1 rounded-full hover:bg-red-100 transition" 
                                title="Desactivar/Eliminar">
                            <i data-lucide="trash-2" class="h-4 w-4 inline"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });

        UI.updatePageInfo();
        if (window.lucide) window.lucide.createIcons();
    }
};

// =================================================================================
// 🎯 EVENTOS GLOBALES (Mapeo de Rutas y Navegación) - SISTEMA HÍBRIDO
// =================================================================================

function handleCreateConductor() { 
    window.location.href = '/admin/conductor/crear'; 
}

/**
 * 👁️ VER (preciso: licencia + conductor)
 */
function handleViewConductor(licencia, conductorNum) { 
    const url = `/admin/conductor/view/${licencia}/${conductorNum}`;
    console.log('🔗 Navegando a VER:', url);
    window.location.href = url;
}

/**
 * ✏️ EDITAR (preciso: licencia + conductor)
 */
function handleUpdateConductor(licencia, conductorNum) { 
    const url = `/admin/conductor/update/${licencia}/${conductorNum}`;
    console.log('🔗 Navegando a EDITAR:', url);
    window.location.href = url;
}

/**
 * 🗑️ BORRADO POR ID (Recomendado para listado)
 * ✅ Muestra el nombre en la confirmación.
 */
function handleDeleteConductorByID(id, nombre = 'desconocido') {
    if (confirm(`¿Está seguro de DESACTIVAR (Borrado Lógico) al conductor ID: ${id} (${nombre})?`)) {
        const url = `/admin/conductor/delete_by_id/${id}`;
        console.log('🔗 Navegando a BORRAR (por ID):', url);
        window.location.href = url;
    }
}

// Nota: Las funciones handleDeleteConductorPrecise y handleDeleteConductorLegacy 
// se mantienen en el script por si el usuario las necesita, pero la tabla usa handleDeleteConductorByID.

// 🔍 BUSCAR
function handleSearch(e) {
    if (e) e.preventDefault();
    APP.state.currentPage = 1;
    API.loadAllConductores(Filters.getFiltersFromForm());
}

// =================================================================================
// 🚀 INICIALIZACIÓN
// =================================================================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Iniciando Gestor de Conductores (sistema híbrido)...');

    // Asignamos la función legacy original al nombre legacy (para la compatibilidad manual)
    const originalDeleteHandler = window.handleDeleteConductor || ((lic) => {
        if (confirm(`¿Está seguro de DESACTIVAR (Borrado Lógico) al conductor con Licencia: ${lic}? (LEGACY)`)) {
             window.location.href = `/admin/conductor/delete/${lic}`;
        }
    });

    // Asignar listeners de paginación
    if (APP.elements.prevBtn) {
        APP.elements.prevBtn.addEventListener('click', () => {
            if (APP.state.currentPage > 1) { 
                APP.state.currentPage--; 
                DOM.renderResults(); 
            }
        });
    }
    
    if (APP.elements.nextBtn) {
        APP.elements.nextBtn.addEventListener('click', () => {
            if (APP.state.currentPage < APP.state.totalPages) { 
                APP.state.currentPage++; 
                DOM.renderResults(); 
            }
        });
    }
    
    // Asignar el submit del formulario de búsqueda
    if (APP.elements.searchForm) {
        APP.elements.searchForm.addEventListener('submit', handleSearch);
    }

    // Exposición global (para el HTML y eventos)
    window.handleSearch = handleSearch;
    window.handleClearAllFilters = Filters.handleClearAllFilters;
    window.sortTable = Filters.sortTable;
    window.handleCreateConductor = handleCreateConductor;
    window.handleUpdateConductor = handleUpdateConductor;
    window.handleViewConductor = handleViewConductor;
    
    // 🎯 Reemplazo de DELETE: Exponemos los nuevos handlers, manteniendo el legacy si era necesario.
    window.handleDeleteConductor = originalDeleteHandler; // Mantiene el handler legacy si el HTML antiguo lo usaba
    window.handleDeleteConductorByID = handleDeleteConductorByID; 
    
    // Carga inicial
    API.loadAllConductores(Filters.getFiltersFromForm());
    
    // Logs de confirmación
    console.log('✅ Sistema híbrido activado:');
    console.log('    - Botón Editar/Ver: Navega a /update/:licencia/:nconductor (Preciso)');
    console.log('    - Botón Borrar: Navega a /delete_by_id/:id (Recomendado)');
});