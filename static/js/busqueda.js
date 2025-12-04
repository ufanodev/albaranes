// Archivo: static/js/busqueda.js
// ✅ Versión Final con prioridad de estados verificada.

const APP = {
    elements: {
        // Elementos de Resultados y Paginación
        resultsBody: document.getElementById('albaranResults'),
        totalRow: document.getElementById('albaranTotal'),
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
        empresaSelect: document.getElementById('empresa'),
        stateSelect: document.getElementById('state'),
        referenciaInput: document.getElementById('referencia'),
        fechaDesdeInput: document.getElementById('fecha_desde'),
        fechaHastaInput: document.getElementById('fecha_hasta'),
        palabraInput: document.getElementById('palabra'),
        activeFiltersCount: document.getElementById('activeFiltersCount'),
        searchInfo: document.getElementById('searchInfo'),

        // Elementos de Modo Manual
        btnModeCampos: document.getElementById('btn-mode-campos'),
        btnModePalabra: document.getElementById('btn-mode-palabra'),
        btnModeLimpiar: document.getElementById('btn-mode-limpiar'), // Nuevo botón Limpiar

        // Agrupación de campos específicos (MODO CAMPOS)
        specificFields: [
            document.getElementById('empresa'),
            document.getElementById('state'),
            document.getElementById('referencia'),
            document.getElementById('fecha_desde'),
            document.getElementById('fecha_hasta'),
        ],
        // Radio buttons para búsqueda por palabra
        searchTypeRadios: document.querySelectorAll('input[name="search_type"]'), 
    },
    state: {
        allAlbaranes: [],       // Lista completa de la licencia (copia de seguridad)
        filteredAlbaranes: [],  // Lista actual mostrada
        currentLicenciaRef: 0,
        currentPage: 1,
        pageSize: 10,
        totalRecords: 0,
        totalPages: 1,
        currentSort: { key: 'fecha', direction: 'desc' },
        searchMode: 'todos', // 'todos', 'palabra', 'campos'
        modeIsManual: false, // Indica si el modo fue forzado por un botón
    }
};

// =================================================================================
// 🎨 UI HELPERS & MODE MANAGEMENT
// =================================================================================

const UI = {
    formatDate(isoString) { 
        return isoString ? isoString.substring(0, 10) : '-'; 
    },
    
    // ✅ PRIORIDAD: Finalizado > Pagado/Cobrado > Enviado > Creado
    getStateHtml(albaran) {
        if (albaran.finalizado) return `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-200 text-purple-800">Finalizado</span>`;
        
        // Debe ser Pagado si cobrado O pagado es true
        if (albaran.cobrado || albaran.pagado) return `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-200 text-green-800">Pagado</span>`;
        
        if (albaran.enviado) return `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-200 text-blue-800">Enviado</span>`;
        
        return `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-200 text-gray-700">Creado</span>`;
    },

    alertMessage(message, type = 'info') {
        const { statusMessage } = APP.elements;
        if (!statusMessage) return;
        
        statusMessage.textContent = message;
        statusMessage.className = `status-message ${type === 'success' ? 'status-success' : type === 'error' ? 'status-error' : 'status-info'}`;
        statusMessage.classList.remove('hidden');
        setTimeout(() => statusMessage.classList.add('hidden'), 4000);
    },

    updatePageInfo() {
        const { pageInfo, totalLabel, resultsCount } = APP.elements;
        
        // Cálculo del total de páginas usando Math.ceil para el redondeo correcto
        APP.state.totalPages = Math.ceil(APP.state.filteredAlbaranes.length / APP.state.pageSize);
        
        if (pageInfo) {
            pageInfo.textContent = `Página ${APP.state.currentPage} de ${APP.state.totalPages || 1}`;
        }
        
        if (totalLabel) {
            // Cálculo para mostrar cuántos registros se ven en la página actual (e.g., 10 de 13)
            const startIndex = (APP.state.currentPage - 1) * APP.state.pageSize;
            const endIndex = Math.min(startIndex + APP.state.pageSize, APP.state.filteredAlbaranes.length);
            const showing = endIndex - startIndex;

            totalLabel.textContent = `(${showing} de ${APP.state.filteredAlbaranes.length} registros)`;
        }
        
        if (resultsCount) {
            resultsCount.textContent = APP.state.filteredAlbaranes.length;
        }
    },

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
    
    // Función pública llamada por los botones en el HTML
    setSearchModeManual(mode) {
        // Al pulsar el botón, forzamos el modo
        APP.state.modeIsManual = true;
        this.setSearchMode(mode, true);
        
        // 🚀 EJECUTAR BÚSQUEDA TRAS CAMBIAR EL MODO
        Events.handleSearchByMode(mode);
    },
    
    // Nueva función para el botón 'Limpiar y Reiniciar'
    limpiarBusqueda() {
        Events.handleClearAllFilters();
    },

    // --- LÓGICA PRINCIPAL DE MODOS DE BÚSQUEDA ---
    setSearchMode(mode, triggerChange = false) {
        if (APP.state.searchMode === mode && !triggerChange) return;
        
        console.log(`🔄 Cambiando modo de búsqueda a: ${mode.toUpperCase()}`);
        APP.state.searchMode = mode;
        
        const { palabraInput, specificFields, searchTypeRadios, btnModeCampos, btnModePalabra } = APP.elements;
        const palabraContainer = palabraInput.closest('.flex-1'); 
        const radioContainer = searchTypeRadios.length > 0 ? searchTypeRadios[0].closest('.bg-blue-50 > div') : null;

        // Función para obtener el contenedor de filtro (el div que es hijo directo del grid)
        const getFieldContainer = (field) => {
            let container = field.parentElement;
            while(container && !container.parentElement.classList.contains('grid') && container.tagName !== 'BODY') {
                container = container.parentElement;
            }
            return container;
        };
        
        // 1. Limpieza y estado base (deshabilitado/opaco)
        palabraInput.disabled = true;
        palabraInput.classList.remove('bg-yellow-100', 'border-yellow-300');
        if (palabraContainer) palabraContainer.classList.add('opacity-50', 'pointer-events-none');
        if (radioContainer) radioContainer.classList.add('opacity-50', 'pointer-events-none');
        
        specificFields.forEach(field => {
            field.disabled = true;
            const container = getFieldContainer(field);
            if (container) {
                container.classList.add('opacity-50', 'pointer-events-none');
            }
        });
        
        // Estilos de botones de modo (Reset)
        const resetModeButtons = () => {
             [btnModeCampos, btnModePalabra].forEach(btn => {
                if (btn) {
                    btn.classList.remove('bg-secondary-blue', 'text-white');
                    btn.classList.add('bg-primary-pastel', 'text-black-pure');
                }
            });
        };
        resetModeButtons();


        // 2. Aplicar estilos y habilitaciones según el modo
        if (mode === 'palabra') {
            palabraInput.disabled = false;
            palabraInput.classList.add('bg-yellow-100', 'border-yellow-300');
            if (palabraContainer) palabraContainer.classList.remove('opacity-50', 'pointer-events-none');
            if (radioContainer) radioContainer.classList.remove('opacity-50', 'pointer-events-none');
            
            if (btnModePalabra) { // Estilo activo
                 btnModePalabra.classList.remove('bg-primary-pastel', 'text-black-pure');
                 btnModePalabra.classList.add('bg-secondary-blue', 'text-white');
            }

            // Limpiar campos específicos
            specificFields.forEach(field => {
                if (field.id !== 'licencia') {
                    field.value = field.type === 'select-one' ? '' : field.defaultValue || '';
                }
            });
            
        } else if (mode === 'campos') {
            specificFields.forEach(field => {
                const container = getFieldContainer(field);
                if (container) {
                    field.disabled = false;
                    container.classList.remove('opacity-50', 'pointer-events-none');
                }
            });
            
            if (btnModeCampos) { // Estilo activo
                 btnModeCampos.classList.remove('bg-primary-pastel', 'text-black-pure');
                 btnModeCampos.classList.add('bg-secondary-blue', 'text-white');
            }
            
            // Limpiar y desactivar campo palabra/radios
            palabraInput.value = '';
            if (radioContainer) radioContainer.classList.add('opacity-50', 'pointer-events-none');
            
        } else { // 'todos' (Limpieza total o estado inicial)
            
            // Limpiar y habilitar TODOS los elementos
            palabraInput.disabled = false;
            if (palabraContainer) palabraContainer.classList.remove('opacity-50', 'pointer-events-none');
            if (radioContainer) radioContainer.classList.remove('opacity-50', 'pointer-events-none');

            specificFields.forEach(field => {
                const container = getFieldContainer(field);
                if (container) {
                    field.disabled = false;
                    container.classList.remove('opacity-50', 'pointer-events-none');
                }
            });
        }
        
        // Re-renderizar iconos de Lucide (necesario al cambiar visibilidad/estado)
        if (window.lucide) { window.lucide.createIcons(); }
        this.updateActiveFiltersCount();
    },
    
    updateActiveFiltersCount() {
        const { searchForm, activeFiltersCount, searchInfo } = APP.elements;
        if (!searchForm) return;
        
        const formData = new FormData(searchForm);
        
        // Verificar si hay campos específicos o palabra clave activos
        const isPalabraActive = (formData.get('palabra') || '').trim() !== '';
        const isSpecificActive = APP.elements.specificFields.some(field => 
             (field.value && field.value.toString().trim() !== '') && 
             (field.tagName === 'SELECT' ? field.value !== '' : true)
        );
        
        // Determinar el modo de búsqueda y forzar el cambio si es necesario
        if (!APP.state.modeIsManual) {
            if (isPalabraActive && APP.state.searchMode !== 'palabra') {
                 UI.setSearchMode('palabra');
            } else if (isSpecificActive && APP.state.searchMode !== 'campos') {
                UI.setSearchMode('campos');
            } else if (!isPalabraActive && !isSpecificActive && APP.state.searchMode !== 'todos') {
                 UI.setSearchMode('todos');
            }
        }
        
        // Contar campos activos en el formulario (excluyendo licencia y radios)
        let finalCount = 0;
        for (let [key, value] of formData.entries()) {
            if (key !== 'licencia' && key !== 'search_type' && value && value.toString().trim() !== '') {
                // El campo empresa es un select, si el value es vacío no cuenta
                if (key === 'empresa_ref' && value === '') continue;
                finalCount++;
            }
        }
        
        // Actualizar contador en la UI
        if (activeFiltersCount) {
            activeFiltersCount.textContent = finalCount;
            activeFiltersCount.className = finalCount > 0 ? 
                'ml-3 text-sm font-normal bg-yellow-500 text-white px-3 py-1 rounded-full' :
                'ml-3 text-sm font-normal bg-primary-link text-white px-3 py-1 rounded-full';
        }
        
        // Actualizar info de búsqueda
        if (searchInfo) {
            let modeText = '';
            if (APP.state.searchMode === 'palabra') modeText = '(Modo Palabra)';
            if (APP.state.searchMode === 'campos') modeText = '(Modo Campos)';
            
            if (finalCount > 0) {
                searchInfo.textContent = `${finalCount} filtro(s) activo(s) ${modeText} - Listo para buscar`;
                searchInfo.className = 'text-sm text-blue-600 font-medium flex items-center';
            } else {
                searchInfo.textContent = 'Listo para buscar - Mostrará todos los albaranes de su licencia';
                searchInfo.className = 'text-sm text-gray-600 flex items-center';
            }
            if (window.lucide) { window.lucide.createIcons(); } 
        }
    }
};

// =================================================================================
// 🔍 FILTER & SORT LOGIC
// =================================================================================
const Filters = {
    // Obtiene todos los filtros del formulario, aplicando la lógica de modos
    getFiltersFromForm() {
        const form = APP.elements.searchForm;
        const formData = new FormData(form);
        
        const filters = {
            licencia_ref: APP.state.currentLicenciaRef,
            empresa_ref: formData.get('empresa_ref') || '',
            state: formData.get('state') || '',
            referencia: formData.get('referencia') || '',
            fecha_ini: formData.get('fecha_desde') || '',
            fecha_fin: formData.get('fecha_hasta') || '',
            palabra: formData.get('palabra') || '',
            search_type: formData.get('search_type') || 'exacta', 
        };
        
        // Lógica de Modos: Si Palabra está activo, ignorar Campos, y viceversa
        if (APP.state.searchMode === 'palabra') {
             // Modo Palabra: solo usamos licencia, palabra, y search_type
             filters.empresa_ref = '';
             filters.state = '';
             filters.referencia = '';
             filters.fecha_ini = '';
             filters.fecha_fin = '';
        } else if (APP.state.searchMode === 'campos') {
             // Modo Campos: ignoramos palabra y search_type
             filters.palabra = '';
             filters.search_type = '';
        }
        
        return filters;
    },
    
    // Función de ordenación (basada en el array filtrado)
    sortTable(key, dataType = 'string') {
        const { currentSort } = APP.state;
        let direction = 'asc';
        
        if (currentSort.key === key && currentSort.direction === 'asc') {
            direction = 'desc';
        }
        
        APP.state.filteredAlbaranes.sort((a, b) => {
            let valA = a[key] || '';
            let valB = b[key] || '';
            
            if (dataType === 'date') {
                valA = new Date(valA || 0).getTime();
                valB = new Date(valB || 0).getTime();
            } else if (dataType === 'number' || key.includes('importe')) {
                valA = parseFloat(valA) || 0;
                valB = parseFloat(valB) || 0;
            } else if (key === 'licencia') {
                valA = a.LicenciaData?.licencia || a.licencia_ref || 0;
                valB = b.LicenciaData?.licencia || b.licencia_ref || 0;
                valA = parseInt(valA);
                valB = parseInt(valB);
            }
            
            let comparison = 0;
            if (valA > valB) {
                comparison = 1;
            } else if (valA < valB) {
                comparison = -1;
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
// 🌐 API SERVICES
// =================================================================================
const API = {
    async loadEmpresas() {
        try {
            const { empresaSelect } = APP.elements;
            if (!empresaSelect) return;
            
            empresaSelect.innerHTML = '<option value="">Cargando empresas...</option>';
            
            const response = await fetch('/api/v1/empresas');
            if (!response.ok) throw new Error('Error cargando empresas');
            
            const data = await response.json();
            const empresas = Array.isArray(data.data) ? data.data : data;
            
            empresaSelect.innerHTML = `
                <option value="">📋 Todas las empresas</option>
                ${empresas.map(emp => `
                    <option value="${emp.id || emp.ID}">${emp.nombre || 'Sin nombre'}</option>
                `).join('')}
            `;
            
            console.log(`✅ ${empresas.length} empresas cargadas`);
        } catch (error) {
            console.error('Error empresas:', error);
            const { empresaSelect } = APP.elements;
            if (empresaSelect) {
                empresaSelect.innerHTML = '<option value="">❌ Error cargando empresas</option>';
            }
        }
    },

    // 🚨 Función principal de búsqueda/carga
    async searchAlbaranes(filters) {
        if (!APP.state.currentLicenciaRef) {
            UI.alertMessage('No hay licencia asignada', 'error');
            return;
        }

        DOM.showLoading();
        
        // Obtenemos el valor actual del selector de registros (10, 20, 50, o 'todos')
        const recordsSelectElement = APP.elements.recordsSelect;
        const selectedPageSizeValue = recordsSelectElement ? recordsSelectElement.value : '10';

        try {
            // 1. Construir URL para el endpoint search (con todos los filtros)
            const params = new URLSearchParams({
                licencia_ref: filters.licencia_ref
            });
            
            if (filters.empresa_ref) params.append('empresa_ref', filters.empresa_ref);
            if (filters.state) params.append('state', filters.state);
            if (filters.referencia) params.append('referencia', filters.referencia);
            if (filters.fecha_ini) params.append('fecha_ini', filters.fecha_ini);
            if (filters.fecha_fin) params.append('fecha_fin', filters.fecha_fin);
            if (filters.palabra) {
                params.append('palabra', filters.palabra);
                params.append('search_type', filters.search_type);
            }
            
            // Usar un pageSize ALTO (5000) en la API para obtener todo el conjunto filtrado.
            params.append('pageSize', '5000'); 
            
            const url = `/api/v1/albaranes/search?${params.toString()}`;
            console.log('🚀 API Call con filtros:', url);
            
            const response = await fetch(url);
            
            if (response.status === 401) {
                window.location.href = '/login';
                return;
            }
            
            if (!response.ok) {
                 throw new Error('Error en el endpoint de búsqueda avanzada.');
            }
            
            const data = await response.json();
            let albaranes = data.data || [];
            
            // ✅ CORRECCIÓN DEL LÍMITE: Limitamos el resultado a un máximo de 500 registros
            const MAX_RESULTS_LIMIT = 500;
            if (albaranes.length > MAX_RESULTS_LIMIT) {
                 albaranes = albaranes.slice(0, MAX_RESULTS_LIMIT);
                 UI.alertMessage(`⚠️ Advertencia: Resultados limitados a ${MAX_RESULTS_LIMIT} para visualización.`, 'info');
            }

            APP.state.filteredAlbaranes = albaranes;
            APP.state.totalRecords = albaranes.length;
            APP.state.currentPage = 1;
            
            // Restablecer APP.state.pageSize al valor seleccionado
            if (selectedPageSizeValue === 'todos') {
                APP.state.pageSize = albaranes.length || 10;
            } else {
                 APP.state.pageSize = parseInt(selectedPageSizeValue);
            }

            // Si no hay filtros activos (modo 'todos'), guardamos la lista completa
            if (Object.values(filters).every(val => !val || val === APP.state.currentLicenciaRef || val === 'exacta')) {
                APP.state.allAlbaranes = albaranes;
                console.log('✅ Lista completa guardada.');
            }
            
            // Renderizar la tabla con la primera página de los resultados filtrados
            DOM.renderResults();
            UI.alertMessage(`Encontrados ${albaranes.length} albaranes`, 'success');
            
        } catch (error) {
            console.error('Error en búsqueda:', error);
            UI.alertMessage(`Error: ${error.message}`, 'error');
            DOM.showNoResults();
        }
    },
    
    // Carga inicial (Llama a la búsqueda sin filtros)
    async loadAllAlbaranes() {
        console.log('🔍 Carga inicial de albaranes...');
        // Llamar a searchAlbaranes sin filtros para obtener todos los registros de la licencia
        await this.searchAlbaranes(Filters.getFiltersFromForm());
    },

    async initUserSession() {
        try {
            const response = await fetch('/api/v1/user/licencia_ref');
            const { licencia_ref } = await response.json();
            APP.state.currentLicenciaRef = parseInt(licencia_ref) || 0;
            
            const { licenciaInput } = APP.elements;
            if (licenciaInput) {
                // Asegura que el número de licencia se muestra correctamente
                licenciaInput.value = APP.state.currentLicenciaRef || 'No asignada';
            }
            
            console.log('✅ Licencia del usuario:', APP.state.currentLicenciaRef);
            
            if (!APP.state.currentLicenciaRef) {
                UI.alertMessage('Error: No tiene licencia asignada', 'error');
                return false;
            }
            
            return true;
            
        } catch (error) {
            console.error('Error sesión:', error);
            UI.alertMessage('Error al cargar sesión. Intente recargar.', 'error');
            return false;
        }
    }
};

// =================================================================================
// 🖼️ DOM RENDER
// =================================================================================
const DOM = {
    showLoading() {
        const { resultsBody, resultsCount } = APP.elements;
        if (resultsBody) {
            resultsBody.innerHTML = `
                <tr>
                    <td colspan="10" class="text-center py-12">
                        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
                        Buscando albaranes...
                    </td>
                </tr>`;
        }
        if (resultsCount) { resultsCount.textContent = '...'; }
    },

    showNoResults() {
        const { resultsBody, totalRow, resultsCount } = APP.elements;
        
        if (resultsBody) {
            resultsBody.innerHTML = `
                <tr>
                    <td colspan="10" class="text-center py-12 text-orange-500 font-semibold">
                        📭 No se encontraron albaranes con los filtros aplicados
                    </td>
                </tr>`;
        }
        
        if (totalRow) {
            totalRow.innerHTML = '';
        }
        
        if (resultsCount) { resultsCount.textContent = '0'; }
        
        UI.updatePageInfo();
        UI.updatePaginationButtons();
    },

    renderResults() {
        const { resultsBody, totalRow } = APP.elements;
        
        if (!resultsBody) return;
        
        // Limpiar tabla
        resultsBody.innerHTML = '';
        
        // Calcular total de páginas y si es necesario redirigir a la última página válida
        APP.state.totalPages = Math.ceil(APP.state.filteredAlbaranes.length / APP.state.pageSize);
        if (APP.state.currentPage > APP.state.totalPages && APP.state.totalPages > 0) {
            APP.state.currentPage = APP.state.totalPages;
        }
        
        // Calcular datos de la página actual
        const startIndex = (APP.state.currentPage - 1) * APP.state.pageSize;
        const endIndex = startIndex + APP.state.pageSize;
        const pageData = APP.state.filteredAlbaranes.slice(startIndex, endIndex);
        
        if (!pageData.length && APP.state.totalRecords === 0) {
            // Solo mostrar No Results si no hay registros cargados
            DOM.showNoResults();
            return;
        }

        // Calcular total de importe
        let totalImporte = APP.state.filteredAlbaranes.reduce((acc, albaran) => acc + (parseFloat(albaran.importe_total || 0)), 0);
        
        // Renderizar cada fila
        pageData.forEach(albaran => {
            const importe = parseFloat(albaran.importe_total || 0);

            const row = `
                <tr class="hover:bg-gray-50 border-b transition-colors">
                    <td class="px-4 py-3 text-sm font-semibold text-gray-900">
                        ${albaran.numero_albaran || 'N/A'}
                    </td>
                    <td class="px-4 py-3 text-sm text-gray-600">
                        ${UI.formatDate(albaran.fecha)}
                    </td>
                    <td class="px-4 py-3 text-sm font-bold text-blue-600">
                        ${albaran.LicenciaData?.licencia || albaran.licencia_ref || 'N/A'}
                    </td>
                    <td class="px-4 py-3 text-sm text-gray-800">
                        ${albaran.EmpresaData?.nombre || 'N/A'}
                    </td>
                    <td class="px-4 py-3 text-sm text-gray-500">
                        ${albaran.referencia || '-'}
                    </td>
                    <td class="px-4 py-3 text-sm text-gray-700">
                        ${albaran.asalariado || 'Titular'}
                    </td>
                    <td class="px-4 py-3 text-sm text-right font-bold text-green-600">
                        €${importe.toFixed(2)}
                    </td>
                    <td class="px-4 py-3 text-sm">
                        ${UI.getStateHtml(albaran)}
                    </td>
                    <td class="px-4 py-3 text-sm text-gray-600 max-w-xs truncate" title="${albaran.observaciones || ''}">
                        ${albaran.observaciones || '-'}
                    </td>
                    <td class="px-4 py-3 text-center">
                        <div class="flex space-x-2 justify-center">
                            <a href="/titulares/view/${albaran.id || albaran.ID}" 
                               class="p-1.5 hover:bg-blue-50 rounded text-blue-500 hover:text-blue-700 transition"
                               title="Ver detalles">
                                <i data-lucide="eye" class="h-4 w-4"></i>
                            </a>
                            <a href="/titulares/update/${albaran.id || albaran.ID}" 
                               class="p-1.5 hover:bg-orange-50 rounded text-orange-500 hover:text-orange-700 transition"
                               title="Editar">
                                <i data-lucide="pencil" class="h-4 w-4"></i>
                            </a>
                        </div>
                    </td>
                </tr>`;
            
            resultsBody.insertAdjacentHTML('beforeend', row);
        });

        // Renderizar pie de tabla
        if (totalRow) {
            totalRow.innerHTML = `
                <tr class="bg-gradient-to-r from-emerald-50 to-green-50 border-t-4 border-emerald-200">
                    <td colspan="6" class="px-4 py-3 text-right font-bold text-gray-900">
                        TOTAL (${APP.state.filteredAlbaranes.length} registros)
                    </td>
                    <td class="px-4 py-3 text-right text-xl font-black text-emerald-600">
                        €${totalImporte.toFixed(2)}
                    </td>
                    <td colspan="3" class="px-4 py-3 text-center text-sm text-gray-700">
                        Página ${APP.state.currentPage} de ${APP.state.totalPages || 1} - Licencia ${APP.state.currentLicenciaRef}
                    </td>
                </tr>`;
        }

        // Actualizar UI
        UI.updatePageInfo();
        UI.updatePaginationButtons();

        // Inicializar iconos de Lucide
        if (window.lucide) {
            window.lucide.createIcons();
        }
    },

    initRecordsSelect() {
        const { recordsSelect } = APP.elements;
        if (!recordsSelect) return;
        
        // Opciones de paginación solicitadas: 10, 20, 50, Todos
        recordsSelect.innerHTML = `
            <option value="10" selected>10</option>
            <option value="20">20</option>
            <option value="50">50</option>
            <option value="todos">Todos</option>
        `;
        
        recordsSelect.addEventListener('change', (e) => {
            if (e.target.value === 'todos') {
                // Si elige 'Todos', el tamaño de página es igual al total de registros filtrados
                APP.state.pageSize = APP.state.filteredAlbaranes.length || 5000; 
            } else {
                APP.state.pageSize = parseInt(e.target.value);
            }
            
            APP.state.currentPage = 1;
            DOM.renderResults();
        });
    }
};

// =================================================================================
// 🎯 EVENT HANDLERS
// =================================================================================
const Events = {
    // 🚨 AL PULSAR "BUSCAR / MOSTRAR TODOS" (Botón Submit)
    async handleSearch(e) {
        if (e) e.preventDefault();
        
        console.log('🎯 Botón Buscar pulsado. Modo:', APP.state.searchMode);
        
        const filters = Filters.getFiltersFromForm();
        
        // Llamar al API con los filtros del modo activo
        await API.searchAlbaranes(filters);
    },
    
    // 🚀 FUNCIÓN DE BÚSQUEDA POR MODO MANUAL
    async handleSearchByMode(mode) {
        // Obtenemos los filtros del formulario (ya limpios por setSearchMode)
        const filters = Filters.getFiltersFromForm();
        
        // Ejecutamos siempre la búsqueda al pulsar el botón de modo, confiando en que 
        // el usuario quiere ver los resultados de los campos que dejó rellenos en ese modo.
        console.log(`🎯 Buscando por modo: ${mode}`);
        await API.searchAlbaranes(filters);
    },

    // 🚨 AL PULSAR "LIMPIAR Y REINICIAR"
    handleClearAllFilters() {
        const { searchForm, licenciaInput } = APP.elements;
        if (searchForm) {
            // 1. Limpiar formulario (reset)
            searchForm.reset();
            if (licenciaInput) {
                // Restaurar el valor de la licencia (es readonly y debe permanecer)
                licenciaInput.value = APP.state.currentLicenciaRef || 'No asignada';
            }
            
            // 2. Forzar modo TODOS y limpieza mutua (esto es lo que libera los campos y borra valores)
            UI.setSearchMode('todos', true); 
            APP.state.modeIsManual = false; // Resetear bandera manual
            
            // 3. Resetear estado de la tabla
            APP.state.currentPage = 1;
            APP.state.pageSize = 10;
            APP.state.filteredAlbaranes = [...APP.state.allAlbaranes]; // Volver a la lista original
            APP.state.currentFilters = {};
            
            // 4. Resetear UI y mostrar resultados
            const { recordsSelect } = APP.elements;
            if (recordsSelect) recordsSelect.value = '10';
            
            DOM.renderResults();
            UI.alertMessage('✅ Todos los filtros han sido limpiados (Modo TODOS)', 'info');
             
            UI.updateActiveFiltersCount();
        }
    },
    
    // 🚨 Manejar cambios en cualquier campo de búsqueda para cambiar de modo (Auto-Detección)
    handleFilterChange(e) {
        // Al modificar cualquier campo, asumimos que el modo manual ha terminado
        APP.state.modeIsManual = false;

        const { palabraInput, specificFields } = APP.elements;
        const target = e.target;
        
        // Excluir cambios en los radio buttons de tipo de búsqueda
        if (target.name === 'search_type') {
            UI.updateActiveFiltersCount(); 
            return;
        }

        const isPalabraActive = palabraInput.value.trim() !== '';
        const isSpecificActive = specificFields.some(field => 
            (field.value && field.value.toString().trim() !== '') && 
            (field.tagName === 'SELECT' ? field.value !== '' : true)
        );

        if (isPalabraActive) {
            UI.setSearchMode('palabra');
        } else if (isSpecificActive) {
            UI.setSearchMode('campos');
        } else {
            UI.setSearchMode('todos');
        }
        
        UI.updateActiveFiltersCount();
    },
    
    updateSortIcons() {
        const sortIcons = document.querySelectorAll('.sort-icon');
        sortIcons.forEach(icon => {
            icon.dataset.lucide = 'chevrons-up-down';
            icon.classList.remove('rotate-180', 'text-blue-500');
        });

        const { key, direction } = APP.state.currentSort;
        const activeIcon = document.getElementById(`sort-${key}`);
        if (activeIcon) {
            activeIcon.dataset.lucide = direction === 'asc' ? 'chevron-up' : 'chevron-down';
            activeIcon.classList.add('text-blue-500');
            activeIcon.classList.remove('rotate-180');
        }
        if (window.lucide) { window.lucide.createIcons(); }
    },
    
    init() {
        const { searchForm, prevBtn, nextBtn } = APP.elements;

        // Inicializar selector de registros y paginación
        DOM.initRecordsSelect();

        // 🚨 Formulario de búsqueda - EVENTO PRINCIPAL
        if (searchForm) {
            searchForm.addEventListener('submit', this.handleSearch.bind(this));
            console.log('✅ Evento submit configurado para handleSearch');
        }

        // 🚨 Configurar listeners de cambio para gestión de modos
        if (searchForm) {
            searchForm.addEventListener('change', this.handleFilterChange.bind(this));
            searchForm.addEventListener('input', this.handleFilterChange.bind(this));
        }

        // Asignar función de limpiar a la ventana
        window.handleClearAllFilters = this.handleClearAllFilters.bind(this);
        
        // ✅ EVENTOS DE PAGINACIÓN
        if (prevBtn) {
            prevBtn.addEventListener('click', () => { 
                if (APP.state.currentPage > 1) { 
                    APP.state.currentPage--; 
                    DOM.renderResults(); 
                }
            });
        }
        if (nextBtn) {
            nextBtn.addEventListener('click', () => { 
                if (APP.state.currentPage < APP.state.totalPages) { 
                    APP.state.currentPage++; 
                    DOM.renderResults(); 
                }
            });
        }
        
        // Configurar función de ordenación global
        window.sortTable = (key) => Filters.sortTable(key, key.includes('fecha') ? 'date' : key.includes('importe') ? 'number' : 'string');
    }
};

// =================================================================================
// 🚀 INICIALIZACIÓN
// =================================================================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Iniciando aplicación de búsqueda...');
    
    // 1. Inicializar eventos
    Events.init();
    
    // 2. Inicializar sesión del usuario
    const hasSession = await API.initUserSession();
    if (!hasSession) {
        DOM.showNoResults();
        return;
    }
    
    // 3. Cargar empresas
    await API.loadEmpresas();
    
    // 4. Cargar TODOS los albaranes de la licencia (llamará a searchAlbaranes sin filtros)
    await API.loadAllAlbaranes();
    
    // 5. Establecer modo inicial y actualizar UI
    UI.setSearchMode('todos');
    UI.updateActiveFiltersCount();
    Events.updateSortIcons();
    
    console.log('✅ Aplicación lista');
});

// =================================================================================
// 🌍 FUNCIONES GLOBALES (se mantienen)
// =================================================================================
window.handleSearch = Events.handleSearch.bind(Events);
window.handleClearAllFilters = Events.handleClearAllFilters.bind(Events);
// Enlazamos UI.setSearchModeManual al scope global (window)
window.UI = window.UI || {};
window.UI.setSearchModeManual = UI.setSearchModeManual.bind(UI);
window.UI.limpiarBusqueda = Events.handleClearAllFilters.bind(Events); // Enlace para el botón Limpiar

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
window.handleActionModal = (show) => {
    const modal = document.getElementById('actionModal');
    if (modal) {
        if (show === false) {
            modal.classList.add('hidden');
        } else {
            modal.classList.remove('hidden');
        }
    }
};
window.handleLogout = async () => {
    try {
        const response = await fetch('/api/v1/logout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        if (response.ok) {
            window.location.href = '/login';
        } else {
            UI.alertMessage('Error al cerrar sesión', 'error');
        }
    } catch (error) {
        console.error('Logout error:', error);
        UI.alertMessage('Error de conexión', 'error');
    }
};