// Archivo: static/js/busqueda.js
// ✅ CORREGIDO: Filtra por licencia + Filtros funcionan al pulsar Buscar

const APP = {
    elements: {
        resultsBody: document.getElementById('albaranResults'),
        totalRow: document.getElementById('albaranTotal'),
        recordsSelect: document.getElementById('recordsPerPage'),
        statusMessage: document.getElementById('statusMessage'),
        searchForm: document.getElementById('searchForm'),
        licenciaInput: document.getElementById('licencia'),
        empresaSelect: document.getElementById('empresa'),
        stateSelect: document.getElementById('state'),
        referenciaInput: document.getElementById('referencia'),
        fechaDesdeInput: document.getElementById('fecha_desde'),
        fechaHastaInput: document.getElementById('fecha_hasta'),
        totalLabel: document.getElementById('totalLabel'),
        prevBtn: document.querySelector('button[title="Anterior"]'),
        nextBtn: document.querySelector('button[title="Siguiente"]'),
        pageInfo: document.querySelector('.text-sm.text-gray-600.font-medium')
    },
    state: {
        allAlbaranes: [],           // Todos los albaranes (backend debería filtrar)
        filteredAlbaranes: [],      // Albaranes después de filtros
        currentLicenciaRef: 0,
        currentPage: 1,
        pageSize: 10,
        totalRecords: 0,
        totalPages: 1,
        currentFilters: {}
    }
};

// =================================================================================
// 🎨 UI HELPERS
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
        const { pageInfo, totalLabel } = APP.elements;
        
        if (pageInfo) {
            pageInfo.textContent = `Página ${APP.state.currentPage} de ${APP.state.totalPages}`;
        }
        
        if (totalLabel) {
            const showing = Math.min(APP.state.pageSize, APP.state.filteredAlbaranes.length);
            totalLabel.textContent = `(${showing} de ${APP.state.filteredAlbaranes.length} registros)`;
        }
    },

    updatePaginationButtons() {
        const { prevBtn, nextBtn } = APP.elements;
        
        if (prevBtn) {
            prevBtn.disabled = APP.state.currentPage <= 1;
            prevBtn.classList.toggle('opacity-50', APP.state.currentPage <= 1);
            prevBtn.classList.toggle('cursor-not-allowed', APP.state.currentPage <= 1);
        }
        
        if (nextBtn) {
            nextBtn.disabled = APP.state.currentPage >= APP.state.totalPages;
            nextBtn.classList.toggle('opacity-50', APP.state.currentPage >= APP.state.totalPages);
            nextBtn.classList.toggle('cursor-not-allowed', APP.state.currentPage >= APP.state.totalPages);
        }
    }
};

// =================================================================================
// 🔍 FILTER FUNCTIONS
// =================================================================================
const Filters = {
    // ✅ Obtiene filtros del formulario
    getFiltersFromForm() {
        const form = APP.elements.searchForm;
        const formData = new FormData(form);
        
        return {
            empresa_ref: formData.get('empresa_ref') || '',
            state: formData.get('state') || '',
            referencia: formData.get('referencia') || '',
            fecha_ini: formData.get('fecha_desde') || '',
            fecha_fin: formData.get('fecha_hasta') || ''
        };
    },

    // ✅ Filtra localmente por licencia (seguridad adicional)
    filterByLicencia(albaranes, licenciaRef) {
        if (!licenciaRef) return albaranes;
        
        return albaranes.filter(albaran => {
            // Verificar licencia de varias formas posibles
            const licenciaAlbaran = albaran.licencia_ref || 
                                  albaran.LicenciaData?.licencia || 
                                  albaran.LicenciaData?.id;
            
            return String(licenciaAlbaran) === String(licenciaRef);
        });
    },

    // ✅ Aplica filtros locales (para cuando el backend no filtra)
    applyLocalFilters(albaranes, filters) {
        let filtered = [...albaranes];
        
        console.log('🔍 Aplicando filtros locales:', filters);
        console.log('📊 Antes de filtrar:', filtered.length);
        
        // 1. Filtrar por empresa
        if (filters.empresa_ref) {
            filtered = filtered.filter(albaran => {
                const empresaId = albaran.empresa_ref || albaran.EmpresaData?.id;
                return String(empresaId) === String(filters.empresa_ref);
            });
            console.log(`🏢 Después de empresa: ${filtered.length}`);
        }
        
        // 2. Filtrar por estado
        if (filters.state) {
            filtered = filtered.filter(albaran => {
                switch(filters.state) {
                    case 'creado':
                        return !albaran.enviado && !albaran.cobrado && !albaran.finalizado;
                    case 'enviado':
                        return albaran.enviado && !albaran.cobrado && !albaran.finalizado;
                    case 'pagado':
                        return albaran.cobrado || albaran.pagado;
                    case 'finalizado':
                        return albaran.finalizado;
                    default:
                        return true;
                }
            });
            console.log(`📊 Después de estado: ${filtered.length}`);
        }
        
        // 3. Filtrar por referencia
        if (filters.referencia) {
            const ref = filters.referencia.toLowerCase();
            filtered = filtered.filter(albaran => {
                return (albaran.referencia || '').toLowerCase().includes(ref) ||
                       (albaran.numero_albaran || '').toLowerCase().includes(ref);
            });
            console.log(`🔤 Después de referencia: ${filtered.length}`);
        }
        
        // 4. Filtrar por fechas
        if (filters.fecha_ini || filters.fecha_fin) {
            filtered = filtered.filter(albaran => {
                if (!albaran.fecha) return false;
                
                const fechaAlbaran = new Date(albaran.fecha);
                
                if (filters.fecha_ini) {
                    const desde = new Date(filters.fecha_ini);
                    if (fechaAlbaran < desde) return false;
                }
                
                if (filters.fecha_fin) {
                    const hasta = new Date(filters.fecha_fin);
                    hasta.setHours(23, 59, 59, 999);
                    if (fechaAlbaran > hasta) return false;
                }
                
                return true;
            });
            console.log(`📅 Después de fecha: ${filtered.length}`);
        }
        
        return filtered;
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

    // ✅ Carga inicial TODOS los albaranes (backend DEBERÍA filtrar por licencia)
    async loadAllAlbaranes() {
        if (!APP.state.currentLicenciaRef) {
            UI.alertMessage('No hay licencia asignada', 'error');
            return;
        }

        DOM.showLoading();

        try {
            // Intentar usar el endpoint search para que el backend filtre
            const url = `/api/v1/albaranes/search?licencia_ref=${APP.state.currentLicenciaRef}&pageSize=1000`;
            console.log('🔍 Cargando TODOS los albaranes de mi licencia:', url);

            const response = await fetch(url);
            
            if (response.status === 401) {
                window.location.href = '/login';
                return;
            }
            
            if (!response.ok) {
                // Si falla search, intentar con el endpoint normal
                console.warn('Search falló, usando endpoint normal');
                return await this.loadAlbaranesNormal();
            }

            const data = await response.json();
            
            // ✅ FILTRO DE SEGURIDAD: Asegurar que solo muestra mi licencia
            let albaranes = data.data || [];
            albaranes = Filters.filterByLicencia(albaranes, APP.state.currentLicenciaRef);
            
            APP.state.allAlbaranes = albaranes;
            APP.state.filteredAlbaranes = [...albaranes];
            APP.state.totalRecords = albaranes.length;
            
            console.log(`✅ ${albaranes.length} albaranes de licencia ${APP.state.currentLicenciaRef}`);
            
            // Renderizar primera página
            APP.state.currentPage = 1;
            DOM.renderResults();
            
            UI.alertMessage(`Cargados ${albaranes.length} albaranes`, 'success');
            
        } catch (error) {
            console.error('Error cargando albaranes:', error);
            UI.alertMessage(`Error: ${error.message}`, 'error');
            DOM.showNoResults();
        }
    },

    // ✅ Endpoint alternativo si search no funciona
    async loadAlbaranesNormal() {
        try {
            const url = `/api/v1/albaranes?licencia_ref=${APP.state.currentLicenciaRef}&pageSize=1000`;
            const response = await fetch(url);
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            let albaranes = data.data || [];
            
            // ✅ FILTRADO LOCAL POR LICENCIA (IMPORTANTE)
            albaranes = Filters.filterByLicencia(albaranes, APP.state.currentLicenciaRef);
            
            APP.state.allAlbaranes = albaranes;
            APP.state.filteredAlbaranes = [...albaranes];
            APP.state.totalRecords = albaranes.length;
            
            DOM.renderResults();
            UI.alertMessage(`Cargados ${albaranes.length} albaranes`, 'success');
            
        } catch (error) {
            console.error('Error endpoint normal:', error);
            throw error;
        }
    },

    // ✅ BÚSQUEDA CON FILTROS (al pulsar "Buscar")
    async searchWithFilters() {
        if (!APP.state.currentLicenciaRef) {
            UI.alertMessage('No hay licencia asignada', 'error');
            return;
        }

        DOM.showLoading();
        
        try {
            // 1. Obtener filtros del formulario
            const filters = Filters.getFiltersFromForm();
            APP.state.currentFilters = filters;
            
            console.log('🔍 Buscando con filtros:', filters);
            
            // 2. Construir URL para el endpoint search
            const params = new URLSearchParams({
                licencia_ref: APP.state.currentLicenciaRef
            });
            
            // Añadir filtros al API call
            if (filters.empresa_ref) params.append('empresa_ref', filters.empresa_ref);
            if (filters.state) params.append('state', filters.state);
            if (filters.referencia) params.append('referencia', filters.referencia);
            if (filters.fecha_ini) params.append('fecha_ini', filters.fecha_ini);
            if (filters.fecha_fin) params.append('fecha_fin', filters.fecha_fin);
            
            const url = `/api/v1/albaranes/search?${params.toString()}`;
            console.log('🚀 API Call:', url);
            
            const response = await fetch(url);
            
            if (response.status === 401) {
                window.location.href = '/login';
                return;
            }
            
            if (!response.ok) {
                // Si el backend no soporta search, filtrar localmente
                console.warn('Search no disponible, filtrando localmente');
                return this.filterLocally(filters);
            }
            
            const data = await response.json();
            let albaranes = data.data || [];
            
            // ✅ FILTRO DE SEGURIDAD: Asegurar licencia
            albaranes = Filters.filterByLicencia(albaranes, APP.state.currentLicenciaRef);
            
            APP.state.filteredAlbaranes = albaranes;
            APP.state.totalRecords = albaranes.length;
            APP.state.currentPage = 1;
            
            DOM.renderResults();
            UI.alertMessage(`Encontrados ${albaranes.length} albaranes`, 'success');
            
        } catch (error) {
            console.error('Error en búsqueda:', error);
            UI.alertMessage(`Error: ${error.message}`, 'error');
            DOM.showNoResults();
        }
    },

    // ✅ Filtrado local si el backend no soporta search
    filterLocally(filters) {
        console.log('🔍 Filtrando localmente con:', filters);
        
        // 1. Partir de todos los albaranes de mi licencia
        let filtered = [...APP.state.allAlbaranes];
        
        // 2. Aplicar filtros adicionales
        filtered = Filters.applyLocalFilters(filtered, filters);
        
        APP.state.filteredAlbaranes = filtered;
        APP.state.totalRecords = filtered.length;
        APP.state.currentPage = 1;
        
        DOM.renderResults();
        UI.alertMessage(`Encontrados ${filtered.length} albaranes (filtrado local)`, 'success');
    },

    async initUserSession() {
        try {
            const response = await fetch('/api/v1/user/licencia_ref');
            const { licencia_ref } = await response.json();
            APP.state.currentLicenciaRef = parseInt(licencia_ref) || 0;
            
            const { licenciaInput } = APP.elements;
            if (licenciaInput) {
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
            UI.alertMessage('Error al cargar sesión', 'error');
            return false;
        }
    }
};

// =================================================================================
// 🖼️ DOM RENDER
// =================================================================================
const DOM = {
    showLoading() {
        const { resultsBody } = APP.elements;
        if (resultsBody) {
            resultsBody.innerHTML = `
                <tr>
                    <td colspan="10" class="text-center py-12">
                        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
                        Buscando albaranes...
                    </td>
                </tr>`;
        }
    },

    showNoResults() {
        const { resultsBody, totalRow } = APP.elements;
        
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
        
        UI.updatePageInfo();
        UI.updatePaginationButtons();
    },

    renderResults() {
        const { resultsBody, totalRow } = APP.elements;
        
        if (!resultsBody) return;
        
        // Limpiar tabla
        resultsBody.innerHTML = '';
        
        // Calcular datos de la página actual
        const startIndex = (APP.state.currentPage - 1) * APP.state.pageSize;
        const endIndex = startIndex + APP.state.pageSize;
        const pageData = APP.state.filteredAlbaranes.slice(startIndex, endIndex);
        
        // Calcular total de páginas
        APP.state.totalPages = Math.ceil(APP.state.filteredAlbaranes.length / APP.state.pageSize);
        
        if (!pageData.length) {
            DOM.showNoResults();
            return;
        }
        
        // Calcular total de importe
        let totalImporte = 0;
        
        // Renderizar cada fila
        pageData.forEach(albaran => {
            const importe = parseFloat(albaran.importe_total || 0);
            totalImporte += importe;

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
                        Página ${APP.state.currentPage} de ${APP.state.totalPages} - Licencia ${APP.state.currentLicenciaRef}
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
        
        recordsSelect.innerHTML = `
            <option value="10" selected>10</option>
            <option value="20">20</option>
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="todos">Todos</option>
        `;
        
        recordsSelect.addEventListener('change', (e) => {
            if (e.target.value === 'todos') {
                APP.state.pageSize = APP.state.filteredAlbaranes.length;
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
    // ✅ AL PULSAR "BUSCAR / MOSTRAR TODOS"
    async handleSearch(e) {
        if (e) e.preventDefault();
        
        console.log('🎯 Botón Buscar pulsado');
        
        // Obtener filtros del formulario
        const filters = Filters.getFiltersFromForm();
        console.log('🔍 Filtros obtenidos:', filters);
        
        // Realizar búsqueda con filtros
        await API.searchWithFilters();
    },

    handlePrevPage() {
        if (APP.state.currentPage > 1) {
            APP.state.currentPage--;
            DOM.renderResults();
        }
    },

    handleNextPage() {
        if (APP.state.currentPage < APP.state.totalPages) {
            APP.state.currentPage++;
            DOM.renderResults();
        }
    },

    handleClearForm() {
        const { searchForm } = APP.elements;
        if (searchForm) {
            searchForm.reset();
            
            // Restaurar licencia
            const { licenciaInput } = APP.elements;
            if (licenciaInput) {
                licenciaInput.value = APP.state.currentLicenciaRef;
            }
            
            // Resetear estado
            APP.state.currentPage = 1;
            APP.state.pageSize = 10;
            APP.state.filteredAlbaranes = [...APP.state.allAlbaranes];
            APP.state.currentFilters = {};
            
            // Resetear selector
            const { recordsSelect } = APP.elements;
            if (recordsSelect) {
                recordsSelect.value = '10';
            }
            
            // Renderizar
            DOM.renderResults();
            UI.alertMessage('Filtros limpiados', 'info');
        }
    },

    init() {
        const { searchForm, prevBtn, nextBtn } = APP.elements;
        
        // Inicializar selector de registros
        DOM.initRecordsSelect();
        
        // ✅ Formulario de búsqueda - IMPORTANTE
        if (searchForm) {
            // Remover event listener antiguo si existe
            searchForm.removeEventListener('submit', this.handleSearch);
            // Añadir nuevo
            searchForm.addEventListener('submit', this.handleSearch.bind(this));
            console.log('✅ Evento submit configurado para formulario');
        }
        
        // Botones de paginación
        if (prevBtn) {
            prevBtn.addEventListener('click', this.handlePrevPage.bind(this));
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', this.handleNextPage.bind(this));
        }
        
        // Botón de limpiar
        const clearBtn = document.querySelector('button[onclick*="reset"]');
        if (clearBtn) {
            // Remover onclick original y añadir event listener
            clearBtn.removeAttribute('onclick');
            clearBtn.addEventListener('click', this.handleClearForm.bind(this));
        }
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
    
    // 4. Cargar TODOS los albaranes de la licencia
    await API.loadAllAlbaranes();
    
    console.log('✅ Aplicación lista');
});

// =================================================================================
// 🌍 FUNCIONES GLOBALES
// =================================================================================
// ✅ Asegurar que handleSearch funciona desde el HTML
window.handleSearch = Events.handleSearch.bind(Events);

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
            headers: {
                'Content-Type': 'application/json'
            }
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