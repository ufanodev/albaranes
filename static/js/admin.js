// Archivo: static/js/admin.js
// ✅ Versión para Administrador: Búsqueda GLOBAL (API real) con filtro por Licencia.

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
        licenciaSelect: document.getElementById('licenciaSelect'), // Usar el SELECT
        empresaSelect: document.getElementById('empresa'),
        stateSelect: document.getElementById('state'),
        referenciaInput: document.getElementById('referencia'),
        fechaDesdeInput: document.getElementById('fecha_desde'),
        fechaHastaInput: document.getElementById('fecha_hasta'),
        palabraInput: document.getElementById('palabra'),
        activeFiltersCount: document.getElementById('activeFiltersCount'),
        searchInfo: document.getElementById('searchInfo') || document.createElement('div'), 

        // Elementos de Modo Manual
        btnModeCampos: document.getElementById('btn-mode-campos'),
        btnModePalabra: document.getElementById('btn-mode-palabra'),
        btnModeLimpiar: document.getElementById('btn-limpiar'), 

        // Agrupación de campos específicos (MODO CAMPOS)
        specificFields: [
            document.getElementById('licenciaSelect'), 
            document.getElementById('empresa'),
            document.getElementById('state'),
            document.getElementById('referencia'),
            document.getElementById('fecha_desde'),
            document.getElementById('fecha_hasta'),
        ],
        searchTypeRadios: document.querySelectorAll('input[name="search_type"]'), 
    },
    state: {
        allAlbaranes: [],       // Lista completa (copia de seguridad)
        filteredAlbaranes: [],  // Lista actual mostrada
        currentPage: 1,
        pageSize: 10,
        totalRecords: 0,
        totalPages: 1,
        currentSort: { key: 'fecha', direction: 'desc' },
        searchMode: 'todos',
        modeIsManual: false,
    }
};

// =================================================================================
// 🎨 UI HELPERS & MODE MANAGEMENT
// =================================================================================

const UI = {
    formatDate(isoString) { 
        return isoString ? isoString.substring(0, 10) : '-'; 
    },
    
    getStateHtml(albaran) {
        if (albaran.finalizado) return `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-200 text-purple-800">Finalizado</span>`;
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
        
        APP.state.totalPages = Math.ceil(APP.state.filteredAlbaranes.length / APP.state.pageSize);
        
        if (pageInfo) {
            pageInfo.textContent = `Página ${APP.state.currentPage} de ${APP.state.totalPages || 1}`;
        }
        
        if (totalLabel) {
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
    
    setSearchModeManual(mode) {
        APP.state.modeIsManual = true;
        this.setSearchMode(mode, true);
        
        Events.handleSearchByMode(mode); 
    },

    // --- LÓGICA PRINCIPAL DE MODOS DE BÚSQUEDA ---
    setSearchMode(mode, triggerChange = false) {
        if (APP.state.searchMode === mode && !triggerChange) return;
        
        console.log(`🔄 Cambiando modo de búsqueda a: ${mode.toUpperCase()}`);
        APP.state.searchMode = mode;
        
        const { palabraInput, specificFields, searchTypeRadios, btnModeCampos, btnModePalabra } = APP.elements;
        const palabraContainer = palabraInput.closest('.flex-1'); 
        const radioContainer = searchTypeRadios.length > 0 ? searchTypeRadios[0].closest('.bg-blue-50 > div') : null;

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
            if (field) {
                field.disabled = true;
                const container = getFieldContainer(field);
                if (container) {
                    container.classList.add('opacity-50', 'pointer-events-none');
                }
            }
        });
        
        // Estilos de botones de modo (Reset)
        const resetModeButtons = () => {
             [btnModeCampos, btnModePalabra].forEach(btn => {
                 if (btn) {
                     btn.classList.remove('bg-blue-600', 'text-white'); 
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
                 btnModePalabra.classList.add('bg-blue-600', 'text-white'); 
            }

            specificFields.forEach(field => {
                if (field) {
                    field.value = field.type === 'select-one' ? '' : field.defaultValue || '';
                }
            });
            
        } else if (mode === 'campos') {
            specificFields.forEach(field => {
                if (field) {
                    const container = getFieldContainer(field);
                    if (container) {
                        field.disabled = false;
                        container.classList.remove('opacity-50', 'pointer-events-none');
                    }
                }
            });
            
            if (btnModeCampos) { // Estilo activo
                 btnModeCampos.classList.remove('bg-primary-pastel', 'text-black-pure');
                 btnModeCampos.classList.add('bg-blue-600', 'text-white'); 
            }
            
            palabraInput.value = '';
            if (radioContainer) radioContainer.classList.add('opacity-50', 'pointer-events-none');
            
        } else { // 'todos' (Limpieza total o estado inicial)
            
            palabraInput.disabled = false;
            if (palabraContainer) palabraContainer.classList.remove('opacity-50', 'pointer-events-none');
            if (radioContainer) radioContainer.classList.remove('opacity-50', 'pointer-events-none');

            specificFields.forEach(field => {
                 if (field) {
                    const container = getFieldContainer(field);
                    if (container) {
                        field.disabled = false;
                        container.classList.remove('opacity-50', 'pointer-events-none');
                    }
                 }
            });
        }
        
        if (window.lucide) { window.lucide.createIcons(); }
        this.updateActiveFiltersCount();
    },
    
    updateActiveFiltersCount() {
        const { searchForm, activeFiltersCount, searchInfo } = APP.elements;
        if (!searchForm) return;
        
        const formData = new FormData(searchForm);
        
        const isPalabraActive = (formData.get('palabra') || '').trim() !== '';
        
        const isSpecificActive = APP.elements.specificFields.some(field => {
            if (!field) return false;
            const value = field.value || '';
            return value.toString().trim() !== ''; 
        });

        
        if (!APP.state.modeIsManual) {
            if (isPalabraActive && APP.state.searchMode !== 'palabra') {
                 UI.setSearchMode('palabra');
            } else if (isSpecificActive && APP.state.searchMode !== 'campos') {
                UI.setSearchMode('campos');
            } else if (!isPalabraActive && !isSpecificActive && APP.state.searchMode !== 'todos') {
                 UI.setSearchMode('todos');
            }
        }
        
        let finalCount = 0;
        for (let [key, value] of formData.entries()) {
            if (key !== 'search_type' && value && value.toString().trim() !== '') {
                if ((key === 'empresa_ref' || key === 'licencia_ref' || key === 'state') && value === '') continue;
                finalCount++;
            }
        }
        
        if (activeFiltersCount) {
            activeFiltersCount.textContent = finalCount;
            activeFiltersCount.className = finalCount > 0 ? 
                'ml-3 text-sm font-normal bg-yellow-500 text-white px-3 py-1 rounded-full' :
                'ml-3 text-sm font-normal bg-primary-link text-white px-3 py-1 rounded-full';
        }
        
        if (searchInfo) {
            let modeText = '';
            if (APP.state.searchMode === 'palabra') modeText = '(Modo Palabra)';
            if (APP.state.searchMode === 'campos') modeText = '(Modo Campos)';
            
            if (finalCount > 0) {
                searchInfo.textContent = `${finalCount} filtro(s) activo(s) ${modeText} - Listo para buscar`;
                searchInfo.className = 'text-sm text-blue-600 font-medium flex items-center';
            } else {
                searchInfo.textContent = 'Listo para buscar - Mostrará todos los albaranes disponibles';
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
    getFiltersFromForm() {
        const form = APP.elements.searchForm;
        const formData = new FormData(form);
        
        const filters = {
            licencia_ref: formData.get('licencia_ref') || '', 
            empresa_ref: formData.get('empresa_ref') || '',
            state: formData.get('state') || '',
            referencia: formData.get('referencia') || '',
            fecha_ini: formData.get('fecha_desde') || '',
            fecha_fin: formData.get('fecha_hasta') || '',
            palabra: formData.get('palabra') || '',
            search_type: formData.get('search_type') || 'exacta', 
        };
        
        if (APP.state.searchMode === 'palabra') {
             filters.empresa_ref = ''; filters.state = ''; filters.referencia = '';
             filters.fecha_ini = ''; filters.fecha_fin = '';
        } else if (APP.state.searchMode === 'campos') {
             filters.palabra = ''; filters.search_type = '';
        }
        
        // Convertir IDs numéricos (si no están vacíos)
        if (filters.licencia_ref !== '' && !isNaN(parseInt(filters.licencia_ref))) {
             filters.licencia_ref = parseInt(filters.licencia_ref); 
        } else {
             filters.licencia_ref = ''; 
        }
        if (filters.empresa_ref !== '' && !isNaN(parseInt(filters.empresa_ref))) {
             filters.empresa_ref = parseInt(filters.empresa_ref); 
        } else {
             filters.empresa_ref = ''; 
        }

        return filters;
    },
    
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
                valA = a.LicenciaData?.licencia || a.licencia_ref || '';
                valB = b.LicenciaData?.licencia || b.licencia_ref || '';
            }
            
            let comparison = 0;
            if (valA > valB) { comparison = 1; } 
            else if (valA < valB) { comparison = -1; }
            
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
    // FUNCIÓN PARA CARGAR EMPRESAS DESDE LA API REAL
    async loadEmpresas() {
        try {
            const { empresaSelect } = APP.elements;
            if (!empresaSelect) return;
            
            empresaSelect.innerHTML = '<option value="">Cargando empresas...</option>';
            
            const response = await fetch('/api/v1/empresas'); 
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Error ${response.status} cargando empresas: ${errorText}`);
            }
            
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
            UI.alertMessage(`Error de red al cargar empresas. Revise la consola.`, 'error');
        }
    },
    
    // FUNCIÓN PARA CARGAR LICENCIAS DESDE LA API REAL
    async loadLicencias() {
        try {
            const { licenciaSelect } = APP.elements;
            if (!licenciaSelect) return;
            
            licenciaSelect.innerHTML = '<option value="">Cargando licencias...</option>';
            
            const response = await fetch('/api/v1/licencias'); 
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Error ${response.status} cargando licencias: ${errorText}`);
            }
            
            const data = await response.json();
            const licencias = Array.isArray(data.data) ? data.data : data;
            
            licenciaSelect.innerHTML = `
                <option value="">🆔 Todas las licencias</option>
                ${licencias.map(lic => {
                    const displayValue = lic.licencia ? lic.licencia.replace(/[^0-9]/g, '') : 'N/A';
                    return `<option value="${lic.id || lic.ID}">${displayValue}</option>`;
                }).join('')}
            `;
            
            console.log(`✅ ${licencias.length} licencias cargadas`);
            
        } catch (error) {
            console.error('Error licencias:', error);
            const { licenciaSelect } = APP.elements;
            if (licenciaSelect) {
                licenciaSelect.innerHTML = '<option value="">❌ Error cargando licencias</option>';
            }
            UI.alertMessage(`Error de red al cargar licencias. Revise la consola.`, 'error');
        }
    },

    // FUNCIÓN PARA BUSCAR ALBARANES DESDE LA API REAL
    async searchAlbaranes(filters) {
        DOM.showLoading();
        
        const recordsSelectElement = APP.elements.recordsSelect;
        const selectedPageSizeValue = recordsSelectElement ? recordsSelectElement.value : '10';

        try {
            const params = new URLSearchParams({});
            
            // Adjuntar filtros SOLO si NO están vacíos, para evitar problemas de Bad Request (400)
            if (filters.licencia_ref !== '') params.append('licencia_ref', filters.licencia_ref); 
            if (filters.empresa_ref !== '') params.append('empresa_ref', filters.empresa_ref);
            if (filters.state !== '') params.append('state', filters.state);
            if (filters.referencia !== '') params.append('referencia', filters.referencia);
            if (filters.fecha_ini !== '') params.append('fecha_ini', filters.fecha_ini);
            if (filters.fecha_fin !== '') params.append('fecha_fin', filters.fecha_fin);
            if (filters.palabra !== '') {
                params.append('palabra', filters.palabra);
                params.append('search_type', filters.search_type);
            }
            
            params.append('pageSize', '5000'); 
            
            const url = `/api/v1/albaranes/search?${params.toString()}`; // Endpoint real
            console.log('🚀 API Call con filtros:', url);
            
            const response = await fetch(url);
            
            if (response.status === 401) {
                window.location.href = '/login';
                return;
            }
            
            if (!response.ok) {
                const errorText = await response.text();
                 throw new Error(`Error ${response.status} en el endpoint de búsqueda avanzada: ${errorText}`);
            }
            
            const data = await response.json();
            let albaranes = data.data || [];
            
            const MAX_RESULTS_LIMIT = 500;
            if (albaranes.length > MAX_RESULTS_LIMIT) {
                 albaranes = albaranes.slice(0, MAX_RESULTS_LIMIT);
                 UI.alertMessage(`⚠️ Advertencia: Resultados limitados a ${MAX_RESULTS_LIMIT} para visualización.`, 'info');
            }

            APP.state.filteredAlbaranes = albaranes;
            APP.state.totalRecords = albaranes.length;
            APP.state.currentPage = 1;
            
            if (selectedPageSizeValue === 'todos') {
                APP.state.pageSize = albaranes.length || 10;
            } else {
                 APP.state.pageSize = parseInt(selectedPageSizeValue);
            }
            
            const filtersActive = Object.values(filters).some(val => val && val !== 'exacta' && val !== '');
            if (!filtersActive) {
                APP.state.allAlbaranes = albaranes;
                console.log('✅ Lista completa (Global Admin) guardada.');
            }
            
            DOM.renderResults();
            UI.alertMessage(`Encontrados ${albaranes.length} albaranes`, 'success');
            
        } catch (error) {
            console.error('Error en búsqueda:', error);
            UI.alertMessage(`Error: ${error.message}`, 'error');
            DOM.showNoResults();
        }
    },
    
    async loadAllAlbaranes() {
        console.log('🔍 Carga inicial de albaranes (GLOBAL)...');
        await this.searchAlbaranes(Filters.getFiltersFromForm());
    },
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
                    <td colspan="11" class="text-center py-12">
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
                    <td colspan="11" class="text-center py-12 text-orange-500 font-semibold">
                        📭 No se encontraron albaranes con los filtros aplicados
                    </td>
                </tr>`;
        }
        
        if (totalRow) { totalRow.innerHTML = ''; }
        if (resultsCount) { resultsCount.textContent = '0'; }
        
        UI.updatePageInfo();
        UI.updatePaginationButtons();
    },

    renderResults() {
        const { resultsBody, totalRow } = APP.elements;
        
        if (!resultsBody) return;
        resultsBody.innerHTML = '';
        
        APP.state.totalPages = Math.ceil(APP.state.filteredAlbaranes.length / APP.state.pageSize);
        if (APP.state.currentPage > APP.state.totalPages && APP.state.totalPages > 0) {
            APP.state.currentPage = APP.state.totalPages;
        }
        
        const startIndex = (APP.state.currentPage - 1) * APP.state.pageSize;
        const endIndex = startIndex + APP.state.pageSize;
        const pageData = APP.state.filteredAlbaranes.slice(startIndex, endIndex);
        
        if (!pageData.length && APP.state.totalRecords === 0) {
            DOM.showNoResults();
            return;
        }

        let totalImporte = APP.state.filteredAlbaranes.reduce((acc, albaran) => acc + (parseFloat(albaran.importe_total || 0)), 0);
        
        pageData.forEach(albaran => {
            const row = `
                <tr class="hover:bg-gray-50 border-b transition-colors">
                    <td class="px-3 py-2 text-xs font-semibold text-gray-900 whitespace-nowrap">${albaran.numero_albaran || 'N/A'}</td>
                    <td class="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">${UI.formatDate(albaran.fecha)}</td>
                    <td class="px-3 py-2 text-xs font-bold text-blue-600 whitespace-nowrap">${albaran.LicenciaData?.licencia || 'N/A'}</td>
                    <td class="px-3 py-2 text-xs text-gray-800 text-truncate">${albaran.EmpresaData?.nombre || 'N/A'}</td>
                    <td class="px-3 py-2 text-xs text-gray-500 text-truncate">${albaran.referencia || '-'}</td>
                    <td class="px-3 py-2 text-xs text-gray-500 text-truncate">${albaran.num_factura || '-'}</td>
                    <td class="px-3 py-2 text-xs text-center">${getBooleanHtml(albaran.enviado)}</td>
                    <td class="px-3 py-2 text-xs text-center">${getBooleanHtml(albaran.cobrado)}</td>
                    <td class="px-3 py-2 text-xs text-center">${getBooleanHtml(albaran.pagado)}</td>
                    <td class="px-3 py-2 text-xs text-gray-600 max-w-[120px] text-truncate" title="${albaran.observaciones_admin || ''}">${albaran.observaciones_admin || '-'}</td>
                    <td class="px-3 py-2 whitespace-nowrap text-center text-xs font-medium">
                        <div class="flex space-x-1 justify-center">
                            <button onclick="handleViewAction('${albaran.id || albaran.numero_albaran}')" title="Ver detalle" class="text-blue-500 hover:text-blue-700 p-0.5 rounded-full hover:bg-blue-100 transition active:scale-90">
                                <i data-lucide="eye" class="h-3 w-3"></i>
                            </button>
                            <button onclick="handleAction('Editar', '${albaran.numero_albaran}')" title="Editar albarán" class="text-primary-link hover:text-orange-700 p-0.5 rounded-full hover:bg-orange-100 transition active:scale-90">
                                <i data-lucide="pencil" class="h-3 w-3"></i>
                            </button>
                            <button onclick="handleAction('Copiar', '${albaran.numero_albaran}')" title="Duplicar albarán" class="text-purple-500 hover:text-purple-700 p-0.5 rounded-full hover:bg-purple-100 transition active:scale-90">
                                <i data-lucide="copy" class="h-3 w-3"></i>
                            </button>
                            <button onclick="handleAction('Eliminar', '${albaran.numero_albaran}')" title="Eliminar albarán" class="text-red-500 hover:text-red-700 p-0.5 rounded-full hover:bg-red-100 transition active:scale-90">
                                <i data-lucide="trash-2" class="h-3 w-3"></i>
                            </button>
                        </div>
                    </td>
                </tr>`;
            
            resultsBody.insertAdjacentHTML('beforeend', row);
        });

        if (totalRow) { totalRow.innerHTML = ''; }

        UI.updatePageInfo();
        UI.updatePaginationButtons();

        if (window.lucide) { window.lucide.createIcons(); }
    },

    initRecordsSelect() {
        const { recordsSelect } = APP.elements;
        if (!recordsSelect) return;
        
        recordsSelect.innerHTML = `
            <option value="10" selected>10</option>
            <option value="20">20</option>
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="todos">Todos</option>
        `;
        
        recordsSelect.addEventListener('change', (e) => {
            const pageSizeValue = e.target.value;
            if (pageSizeValue === 'todos') {
                APP.state.pageSize = APP.state.filteredAlbaranes.length || 5000; 
            } else {
                APP.state.pageSize = parseInt(pageSizeValue);
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
    async handleSearch(e) {
        if (e) e.preventDefault();
        console.log('🎯 Botón Buscar pulsado. Modo:', APP.state.searchMode);
        const filters = Filters.getFiltersFromForm();
        await API.searchAlbaranes(filters);
    },
    
    async handleSearchByMode(mode) {
        const filters = Filters.getFiltersFromForm();
        console.log(`🎯 Buscando por modo: ${mode}`);
        await API.searchAlbaranes(filters); 
    },

    handleClearAllFilters() {
        const { searchForm, licenciaSelect, empresaSelect, recordsSelect } = APP.elements; 
        if (searchForm) {
            // 1. Limpiar todos los campos del formulario
            searchForm.reset();
            
            // 2. Asegurar que los selects vuelven a la opción 'Todas' (valor vacío)
            if (licenciaSelect) licenciaSelect.value = '';
            if (empresaSelect) empresaSelect.value = '';

            // 3. Resetear modo, paginación y cargar datos originales
            UI.setSearchMode('todos', true); 
            APP.state.modeIsManual = false; 
            
            APP.state.currentPage = 1;
            APP.state.pageSize = 10;
            APP.state.filteredAlbaranes = [...APP.state.allAlbaranes]; 
            
            if (recordsSelect) recordsSelect.value = '10'; // Volver a la paginación por defecto
            
            DOM.renderResults();
            UI.alertMessage('✅ Todos los filtros han sido limpiados (Modo TODOS)', 'info');
            UI.updateActiveFiltersCount();
        }
    },
    
    handleFilterChange(e) {
        APP.state.modeIsManual = false; 

        const { palabraInput, specificFields } = APP.elements;
        const target = e.target;
        
        if (target.name === 'search_type') {
            UI.updateActiveFiltersCount(); 
            return;
        }

        const isPalabraActive = palabraInput.value.trim() !== '';
        
        const isSpecificActive = specificFields.some(field => {
            if (!field) return false;
            const value = field.value || '';
            return value.toString().trim() !== ''; 
        });

        if (isPalabraActive) { UI.setSearchMode('palabra'); } 
        else if (isSpecificActive) { UI.setSearchMode('campos'); } 
        else { UI.setSearchMode('todos'); }
        
        UI.updateActiveFiltersCount();
    },
    
    updateSortIcons() {
        const sortIcons = document.querySelectorAll('.sort-icon');
        sortIcons.forEach(icon => {
            icon.innerHTML = `<svg data-lucide="chevrons-up-down" class="h-3 w-3 text-gray-400"></svg>`;
        });

        const { key, direction } = APP.state.currentSort;
        const activeIcon = document.getElementById(`sort-${key}`);
        if (activeIcon) {
            activeIcon.innerHTML = `<svg data-lucide="chevron-${direction === 'asc' ? 'up' : 'down'}" class="h-3 w-3 text-blue-500"></svg>`;
        }
        if (window.lucide) { window.lucide.createIcons(); }
    },
    
    init() {
        const { searchForm, prevBtn, nextBtn } = APP.elements;
        DOM.initRecordsSelect();

        if (searchForm) {
            searchForm.addEventListener('submit', this.handleSearch.bind(this));
            searchForm.addEventListener('change', this.handleFilterChange.bind(this));
            searchForm.addEventListener('input', this.handleFilterChange.bind(this));
        }

        // CORRECCIÓN FINAL DEL BOTÓN LIMPIAR: Enlazar la función global
        window.handleClearAllFilters = this.handleClearAllFilters.bind(this);
        
        if (prevBtn) { prevBtn.addEventListener('click', () => { if (APP.state.currentPage > 1) { APP.state.currentPage--; DOM.renderResults(); } }); }
        if (nextBtn) { nextBtn.addEventListener('click', () => { if (APP.state.currentPage < APP.state.totalPages) { APP.state.currentPage++; DOM.renderResults(); } }); }
        
        window.sortTable = (key) => Filters.sortTable(key, key.includes('fecha') ? 'date' : key.includes('importe') ? 'number' : 'string');
    }
};

// =================================================================================
// 🚀 INICIALIZACIÓN
// =================================================================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Iniciando aplicación de búsqueda (MODO ADMIN - API REAL)...');
    
    Events.init();
    
    // 1. Cargar Empresas
    await API.loadEmpresas();
    
    // 2. Cargar Licencias
    await API.loadLicencias(); 
    
    // 3. Cargar Albaranes Iniciales (Muestra todos si no hay filtro)
    await API.loadAllAlbaranes();
    
    UI.setSearchMode('todos');
    UI.updateActiveFiltersCount();
    Events.updateSortIcons();
    
    console.log('✅ Aplicación lista');
});

// =================================================================================
// 🌍 FUNCIONES GLOBALES (Ayuda y Enlaces)
// =================================================================================
window.handleSearch = Events.handleSearch.bind(Events);
window.UI = window.UI || {};
window.UI.setSearchModeManual = UI.setSearchModeManual.bind(UI);
// Nota: UI.limpiarBusqueda ahora está enlazado a window.handleClearAllFilters en el HTML
// y aquí ya no se necesita, ya que handleClearAllFilters ya es global.
// Para mantener la consistencia con el código anterior:
window.UI.limpiarBusqueda = Events.handleClearAllFilters.bind(Events);

// ✅ NUEVA FUNCIÓN: Redirige a la vista del albarán
window.handleViewAction = (albaranId) => {
    // Asumiendo que la ruta de la vista es /albaranes/view/<ID>
    const url = `/albaranes/view/${albaranId}`;
    console.log(`👁️ Navegando a la vista del albarán: ${url}`);
    window.location.href = url;
};

window.showModal = (show) => {
    const modal = document.getElementById('actionModal');
    if (modal) modal.classList.toggle('hidden', !show);
};

// Función existente (ahora solo para acciones que usan el modal, como Editar, Copiar, Eliminar)
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

function getBooleanHtml(value) {
    if (value === 1 || value === true) {
        return `<span class="px-1.5 py-0.5 inline-flex text-xs leading-4 font-semibold rounded-full bg-green-100 text-green-800">Sí</span>`;
    } else {
        return `<span class="px-1.5 py-0.5 inline-flex text-xs leading-4 font-semibold rounded-full bg-red-100 text-red-800">No</span>`;
    }
}