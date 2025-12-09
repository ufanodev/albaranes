// Archivo: static/js/admin_pago_emp.js
// ✅ Versión para Administrador: Gestión de Cobro a Empresas.

const APP = {
    elements: {
        // Elementos de Resultados y Paginación
        resultsBody: document.getElementById('albaranResults'),
        recordsSelect: document.getElementById('recordsPerPage'),
        statusMessage: document.getElementById('statusMessage'),
        pageInfo: document.getElementById('pageInfo'),
        totalLabel: document.getElementById('totalLabel'),
        prevBtn: document.getElementById('prevPageBtn'),
        nextBtn: document.getElementById('nextPageBtn'),
        
        // Elementos de Filtros
        searchForm: document.getElementById('searchForm'),
        licenciaSelect: document.getElementById('licenciaSelect'),
        empresaSelect: document.getElementById('empresa'),
        cobradoSelect: document.getElementById('cobrado'),
        referenciaInput: document.getElementById('referencia'),
        fechaDesdeInput: document.getElementById('fecha_desde'),
        fechaHastaInput: document.getElementById('fecha_hasta'),
        palabraInput: document.getElementById('palabra'), 
        
        // Botones de modo de búsqueda
        btnModeCampos: document.getElementById('btn-mode-campos'),
        btnModePalabra: document.getElementById('btn-mode-palabra'),
        activeFiltersCount: document.getElementById('activeFiltersCount'),
        
        // Todos los inputs relevantes para el modo 'campos'
        specificFields: [ 
            document.getElementById('licenciaSelect'), 
            document.getElementById('empresa'),
            document.getElementById('cobrado'),
            document.getElementById('referencia'),
            document.getElementById('fecha_desde'),
            document.getElementById('fecha_hasta'),
        ].filter(el => el !== null),
    },
    state: {
        allAlbaranes: [], 
        filteredAlbaranes: [],
        currentPage: 1,
        pageSize: 10, 
        totalRecords: 0,
        totalPages: 1,
        currentSort: { key: 'fecha', direction: 'desc' },
        searchMode: 'campos', 
    }
};

// =================================================================================
// 🎨 UI HELPERS & UTILITIES
// =================================================================================

const UI = {
    formatDate(isoString) { 
        return isoString ? isoString.substring(0, 10) : '-'; 
    },
    
    alertMessage(message, type = 'info') {
        const statusMessage = document.getElementById('statusMessage');
        if (!statusMessage) return;
        
        statusMessage.textContent = message;
        statusMessage.className = `status-message ${type === 'success' ? 'status-success' : type === 'error' ? 'status-error' : 'status-info'}`;
        statusMessage.classList.remove('hidden');
        setTimeout(() => statusMessage.classList.add('hidden'), 4000);
    },
    
    getBooleanHtml(value) {
        const isTrue = (value === 1 || value === true || value === 'Sí');
        if (isTrue) {
            return `<span class="px-1.5 py-0.5 inline-flex text-xs leading-4 font-semibold rounded-full bg-green-100 text-green-800">Sí</span>`;
        } else {
            return `<span class="px-1.5 py-0.5 inline-flex text-xs leading-4 font-semibold rounded-full bg-red-100 text-red-800">No</span>`;
        }
    },
    
    updatePageInfo() {
        const { pageInfo, totalLabel } = APP.elements;
        const totalFiltered = APP.state.filteredAlbaranes.length;
        
        APP.state.totalPages = Math.ceil(totalFiltered / APP.state.pageSize);
        APP.state.currentPage = Math.min(APP.state.currentPage, APP.state.totalPages || 1); 
        APP.state.currentPage = Math.max(1, APP.state.currentPage);

        const startIndex = (APP.state.currentPage - 1) * APP.state.pageSize;
        const endIndex = Math.min(startIndex + APP.state.pageSize, totalFiltered);
        const showing = endIndex - startIndex;

        if (pageInfo) pageInfo.textContent = `Página ${APP.state.currentPage} de ${APP.state.totalPages || 1}`;
        if (totalLabel) totalLabel.textContent = `(${showing} de ${totalFiltered} registros)`;
    },

    updatePaginationButtons() {
        const { prevBtn, nextBtn } = APP.elements;
        const totalPages = APP.state.totalPages || 1;
        
        if (prevBtn) prevBtn.disabled = APP.state.currentPage <= 1;
        if (nextBtn) nextBtn.disabled = APP.state.currentPage >= totalPages;
    },
    
    setSearchModeManual(mode) {
        APP.state.searchMode = mode;
        const { btnModeCampos, btnModePalabra, palabraInput, specificFields } = APP.elements;

        // Limpiar estilos/habilitación general
        const getFieldContainer = (field) => field.closest('.grid > div');

        specificFields.forEach(field => {
            const container = getFieldContainer(field);
            if (container) {
                field.disabled = true;
                container.classList.add('opacity-50', 'pointer-events-none');
            }
        });
        
        if (palabraInput) {
            palabraInput.disabled = true;
            const palabraContainer = palabraInput.closest('.lg\\:col-span-4') || palabraInput.closest('.bg-gray-50');
            if (palabraContainer) palabraContainer.classList.add('opacity-50', 'pointer-events-none');
        }

        // Aplicar estilos de modo (Solo si los botones existen)
        if (btnModeCampos && btnModePalabra) {
            [btnModeCampos, btnModePalabra].forEach(btn => {
                const isActive = (btn.id === 'btn-mode-campos' && mode === 'campos') || (btn.id === 'btn-mode-palabra' && mode === 'palabra');
                btn.classList.toggle('bg-blue-600', isActive);
                btn.classList.toggle('text-white', isActive);
                btn.classList.toggle('bg-primary-pastel', !isActive);
                btn.classList.toggle('text-black-pure', !isActive);
            });
        }


        // Habilitar campos según el modo
        if (mode === 'campos') {
            specificFields.forEach(field => {
                const container = getFieldContainer(field);
                if (container) {
                    field.disabled = false;
                    container.classList.remove('opacity-50', 'pointer-events-none');
                }
            });
            if (palabraInput) palabraInput.value = ''; 
        } else if (mode === 'palabra') {
            if (palabraInput) {
                palabraInput.disabled = false;
                const palabraContainer = palabraInput.closest('.lg\\:col-span-4') || palabraInput.closest('.bg-gray-50');
                if (palabraContainer) palabraContainer.classList.remove('opacity-50', 'pointer-events-none');
            }
            specificFields.forEach(field => field.value = field.tagName === 'SELECT' ? '' : '');
        }

        Events.handleSearch(); 
    },
    
    updateActiveFiltersCount() {
        const { searchForm, activeFiltersCount } = APP.elements;
        if (!searchForm || !activeFiltersCount) return;
        
        const formData = new FormData(searchForm);
        let finalCount = 0;
        
        for (let [key, value] of formData.entries()) {
            if (key !== 'search_type' && key !== 'palabra' && value && value.toString().trim() !== '') {
                finalCount++;
            }
            if (key === 'palabra' && APP.state.searchMode === 'palabra' && value.toString().trim() !== '') {
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
// 🔑 LÓGICA DE INTERACCIÓN (COBRO Y FECHA)
// =================================================================================

async function simulateSaveCobro(id, isPaid, dateString, fieldName = 'cobrado') {
    const isPaidInt = isPaid ? 1 : 0;
    
    // 🔑 Mapeamos los campos de la UI a los nombres reales de la DB para la actualización individual
    const updatePayload = {};
    if (fieldName === 'cobrado') {
        updatePayload.pagado = isPaidInt;         // 🔑 Actualizar campo 36: pagado
        updatePayload.fecha_pago = dateString;    // 🔑 Actualizar campo 37: fecha_pago
        // Si el backend espera 'cobrado' para marcar el TINYINT:
        updatePayload.cobrado = isPaidInt; 
        updatePayload.fecha_cobro = dateString;
    } else if (fieldName === 'fecha_pago') {
        updatePayload.fecha_pago = dateString;    // Actualizar solo fecha_pago
    } else if (fieldName === 'fecha_cobro') {
        updatePayload.fecha_cobro = dateString;   // Actualizar solo fecha_cobro
    }
    
    console.log(`[INDIVIDUAL LOG] 📦 PUT /api/v1/albaranes/${id} | Payload:`, updatePayload); // LOG

    try {
        const response = await fetch(`/api/v1/albaranes/${id}`, { 
            method: 'PUT', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatePayload) 
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Error ${response.status} en la actualización individual.`);
        }

        UI.alertMessage(`Cobro/Pago de albarán #${id} actualizado.`, 'success');
        
        // Actualizar estado local (para evitar un fetch completo)
        const albaranIndex = APP.state.filteredAlbaranes.findIndex(a => a.id === id);
        if (albaranIndex !== -1) {
            // Actualización de estado local con los campos de la DB
            if (fieldName === 'cobrado') {
                 APP.state.filteredAlbaranes[albaranIndex].pagado = isPaidInt;
                 APP.state.filteredAlbaranes[albaranIndex].fecha_pago = dateString; 
                 APP.state.filteredAlbaranes[albaranIndex].cobrado = isPaidInt; 
                 APP.state.filteredAlbaranes[albaranIndex].fecha_cobro = dateString;
            } else {
                 APP.state.filteredAlbaranes[albaranIndex][fieldName] = dateString;
            }
            DOM.renderResults(APP.state.filteredAlbaranes); 
        }

    } catch (error) {
        console.error(`[INDIVIDUAL LOG] ❌ Error al guardar ${fieldName} para ID ${id}:`, error);
        UI.alertMessage(`❌ Error: No se pudo actualizar el albarán #${id}. ${error.message}`, 'error');
    }
}

/**
 * Maneja el cambio en el checkbox de cobro (controla el campo 'cobrado' y F. Cobro).
 */
function handleCobroToggle(albaranId) {
    const row = document.querySelector(`tr[data-id="${albaranId}"]`);
    if (!row) return;

    const checkbox = row.querySelector('.cobro-checkbox');
    const fechaCobroInput = row.querySelector('.fecha-cobro-input'); 
    const cobradoDisplay = row.querySelector('.cobrado-display');
    
    const isChecked = checkbox.checked;
    let fechaCobro = ''; 
    
    if (isChecked) {
        fechaCobro = fechaCobroInput.value || UI.formatDate(new Date().toISOString());
        fechaCobroInput.value = fechaCobro;
        
        fechaCobroInput.disabled = false;
    } else {
        fechaCobroInput.disabled = true;
        fechaCobroInput.value = '';
        fechaCobro = ''; // Enviamos un string vacío para establecer NULL en la DB
    }

    cobradoDisplay.innerHTML = UI.getBooleanHtml(isChecked);
    
    // 🔑 Llamada para actualizar el estado Cobrado (UI) / Pagado (DB) y la fecha_pago (DB)
    // El 'fecha_cobro' en el parámetro se usará para actualizar both: fecha_cobro y fecha_pago en el payload
    simulateSaveCobro(albaranId, isChecked, fechaCobro, 'cobrado'); 
}

// =================================================================================
// 🔍 FILTER & SORT LOGIC
// =================================================================================
const Filters = {
    getFiltersFromForm() {
        const form = APP.elements.searchForm;
        const formData = new FormData(form);
        
        const filters = {
            licencia_ref: formData.get('licencia') || '', 
            empresa_ref: formData.get('empresa') || '',
            cobrado: formData.get('cobrado') || '', // Filtro UI
            referencia: formData.get('referencia') || '',
            fecha_ini: formData.get('fecha_desde') || '',
            fecha_fin: formData.get('fecha_hasta') || '',
            palabra: formData.get('palabra') || '',
            search_type: formData.get('search_type') || 'exacta', 
        };
        
        filters.enviado = 1; 
        
        // 🔑 Mapeo de Filtro UI ('cobrado') a Filtro DB ('pagado')
        if (filters.cobrado === 'si') { filters.pagado = 1; } 
        else if (filters.cobrado === 'no') { filters.pagado = 0; } 
        else { delete filters.pagado; } 
        
        delete filters.cobrado; // Eliminamos la clave de filtro UI

        if (filters.empresa_ref !== '' && !isNaN(parseInt(filters.empresa_ref))) {
             filters.empresa_ref = parseInt(filters.empresa_ref); 
        } else {
             filters.empresa_ref = ''; 
        }
        
        // Limpiar campos que no son relevantes para el modo de búsqueda actual
        if (APP.state.searchMode === 'palabra') {
            delete filters.licencia_ref; delete filters.empresa_ref; delete filters.cobrado;
            delete filters.referencia; delete filters.fecha_ini; delete filters.fecha_fin;
        } else if (APP.state.searchMode === 'campos') {
            delete filters.palabra; delete filters.search_type;
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
            }
            
            let comparison = 0;
            if (valA > valB) { comparison = 1; } 
            else if (valA < valB) { comparison = -1; }
            
            return direction === 'asc' ? comparison : comparison * -1;
        });
        
        APP.state.currentSort = { key, direction };
        APP.state.currentPage = 1;
        DOM.renderResults(APP.state.filteredAlbaranes); 
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
            if (!response.ok) throw new Error(`Error ${response.status} cargando empresas.`);
            
            const data = await response.json();
            const empresas = Array.isArray(data.data) ? data.data : data; 
            
            empresaSelect.innerHTML = `
                <option value="">📋 Todas las empresas</option>
                ${empresas.map(emp => `
                    <option value="${emp.id || emp.ID}">${emp.nombre || 'Sin nombre'}</option>
                `).join('')}
            `;
            
        } catch (error) {
            console.error('Error cargando empresas:', error);
            UI.alertMessage(`Error de red al cargar empresas.`, 'error');
        }
    },
    
    async loadLicencias() {
        try {
            const { licenciaSelect } = APP.elements;
            if (!licenciaSelect) return;
            
            licenciaSelect.innerHTML = '<option value="">Cargando licencias...</option>';
            
            const response = await fetch('/api/v1/licencias'); 
            if (!response.ok) throw new Error(`Error ${response.status} cargando licencias.`);
            
            const data = await response.json();
            const licencias = Array.isArray(data.data) ? data.data : data;
            
            licenciaSelect.innerHTML = `
                <option value="">🆔 Todas las licencias</option>
                ${licencias.map(lic => {
                    const displayValue = lic.licencia || 'N/A';
                    return `<option value="${lic.id || lic.ID}">${displayValue}</option>`;
                }).join('')}
            `;
            
        } catch (error) {
            console.error('Error cargando licencias:', error);
            UI.alertMessage(`Error de red al cargar licencias.`, 'error');
        }
    },

    async searchAlbaranes(filters) {
        const resultsBody = APP.elements.resultsBody;
        if (resultsBody) resultsBody.innerHTML = `<tr><td colspan="12" class="text-center py-4 text-gray-500 italic text-sm">Cargando datos de la API...</td></tr>`;

        try {
            const params = new URLSearchParams({});
            
            Object.keys(filters).forEach(key => {
                if (filters[key] !== '' && key !== 'search_type') {
                    params.append(key, filters[key]);
                }
            });
            
            const url = `/api/v1/albaranes/search?${params.toString()}`;
            
            const response = await fetch(url);
            
            if (!response.ok) throw new Error(`Error en la API: ${response.status}`);
            
            const data = await response.json();
            
            let albaranes = data.data || []; 

            APP.state.allAlbaranes = albaranes;
            APP.state.filteredAlbaranes = albaranes;
            APP.state.totalRecords = albaranes.length;
            
            Filters.sortTable(APP.state.currentSort.key, 'date'); 
            APP.state.currentPage = 1;

            DOM.renderResults(APP.state.filteredAlbaranes);
            UI.alertMessage(`Cargados ${albaranes.length} albaranes ENVIADOS.`, 'success');
            
        } catch (error) {
            UI.alertMessage(`❌ Error cargando datos: ${error.message}`, 'error');
            const resultsBody = APP.elements.resultsBody;
            if (resultsBody) resultsBody.innerHTML = `<tr><td colspan="12" class="text-center py-12 text-red-500">❌ Error al cargar los albaranes.</td></tr>`;
        }
    },
};

// =================================================================================
// 🖼️ DOM RENDER
// =================================================================================
const DOM = {
    getCurrentPageData() {
        const filtered = Array.isArray(APP.state.filteredAlbaranes) ? APP.state.filteredAlbaranes : [];
        return filtered.slice(
            (APP.state.currentPage - 1) * APP.state.pageSize, 
            APP.state.currentPage * APP.state.pageSize
        );
    },

    renderResults(data) {
        const resultsBody = APP.elements.resultsBody;
        if (!resultsBody) return;
        resultsBody.innerHTML = '';
        
        const pageData = DOM.getCurrentPageData();

        if (pageData.length === 0) {
            resultsBody.innerHTML = `<tr><td colspan="12" class="text-center py-4 text-gray-500 italic text-sm">No se encontraron albaranes PENDIENTES DE COBRO.</td></tr>`;
            UI.updatePageInfo();
            UI.updatePaginationButtons();
            return;
        }

        pageData.forEach(albaran => {
            // 🔑 Usamos el campo PAGADO (DB: pagado) para determinar el estado visual 'Cobrado'
            const isCobrado = albaran.pagado === 1 || albaran.pagado === true; 
            const fechaCobroActual = albaran.fecha_cobro ? UI.formatDate(albaran.fecha_cobro) : ''; 
            const fechaPagoActual = albaran.fecha_pago ? UI.formatDate(albaran.fecha_pago) : ''; 

            const row = document.createElement('tr');
            row.dataset.id = albaran.id; 
            row.classList.add(albaran.id % 2 === 0 ? 'bg-white' : 'bg-gray-50', 'hover:bg-primary-pastel/30', 'transition-colors');
            
            const empresaNombre = albaran.EmpresaData?.nombre || `Emp. ${albaran.empresa_ref || 'N/A'}`;
            const licenciaNum = albaran.LicenciaData?.licencia || `Lic. ${albaran.licencia_ref || 'N/A'}`;

            row.innerHTML = `
                <td class="px-4 py-3 whitespace-nowrap text-xs font-medium text-center">
                    <input type="checkbox" 
                           class="cobro-checkbox form-checkbox h-5 w-5 text-green-600 border-gray-300 rounded focus:ring-green-500" 
                           ${isCobrado ? 'checked' : ''}
                           onclick="handleCobroToggle(${albaran.id})"
                           title="Marcar/Desmarcar Cobro">
                </td>
                <td class="px-4 py-3 text-sm text-gray-700">${albaran.id}</td> 
                <td class="px-4 py-3 text-sm text-gray-700">${albaran.numero_albaran}</td>
                <td class="px-4 py-3 text-sm text-gray-700">${licenciaNum}</td>
                <td class="px-4 py-3 text-sm text-gray-700">${UI.formatDate(albaran.fecha)}</td>
                <td class="px-4 py-3 text-sm text-gray-700">${empresaNombre}</td>
                <td class="px-4 py-3 text-sm text-gray-700 text-truncate">${albaran.referencia || '-'}</td>
                <td class="px-4 py-3 text-sm font-bold text-primary-link text-right">€${parseFloat(albaran.importe_total || 0).toFixed(2)}</td>
                
                <td class="px-4 py-3 text-sm text-center">
                    <span class="cobrado-display">${UI.getBooleanHtml(isCobrado)}</span>
                </td>
                
                <td class="px-4 py-3 text-sm text-gray-500">
                    <input type="date" 
                           class="fecha-cobro-input input-field w-32 text-sm" 
                           value="${fechaCobroActual}"
                           ${isCobrado ? '' : 'disabled'}
                           data-id="${albaran.id}"
                           onchange="simulateSaveCobro(${albaran.id}, 1, this.value, 'fecha_cobro')">
                </td>
                
                <td class="px-4 py-3 text-sm text-gray-500">
                    <input type="date" 
                           class="fecha-pago-input input-field w-32 text-sm" 
                           value="${fechaPagoActual}"
                           data-id="${albaran.id}"
                           onchange="simulateSaveCobro(${albaran.id}, 1, this.value, 'fecha_pago')">
                </td>
                
                <td class="px-4 py-3 text-sm text-gray-600 text-truncate max-w-xs">${albaran.observaciones_admin || '-'}</td>
            `;

            resultsBody.appendChild(row);
        });
        
        if (window.lucide) { window.lucide.createIcons(); }
        UI.updatePageInfo();
        UI.updatePaginationButtons();
    },
    
    initRecordsSelect() {
        const { recordsSelect } = APP.elements;
        if (!recordsSelect) return;
        
        recordsSelect.innerHTML = `
             <option value="10" selected>10</option>
             <option value="30">30</option>
             <option value="50">50</option>
             <option value="9999">Todos</option>
        `;
        
        recordsSelect.addEventListener('change', (e) => {
            const val = e.target.value;
            APP.state.pageSize = (val === '9999') ? APP.state.filteredAlbaranes.length || 10 : parseInt(val);
            APP.state.currentPage = 1;
            DOM.renderResults(APP.state.filteredAlbaranes);
        });
    }
};

// =================================================================================
// 🎯 EVENT HANDLERS
// =================================================================================
const Events = {
    handleSearch(e) {
        if (e) e.preventDefault();
        const filters = Filters.getFiltersFromForm();
        API.searchAlbaranes(filters);
    },
    
    handleClearAllFilters() {
        const form = APP.elements.searchForm;
        if (!form) return;

        // 1. Limpieza explícita de selects/inputs de filtro
        if (APP.elements.licenciaSelect) APP.elements.licenciaSelect.value = '';
        if (APP.elements.empresaSelect) APP.elements.empresaSelect.value = '';
        if (APP.elements.cobradoSelect) APP.elements.cobradoSelect.value = '';
        if (APP.elements.referenciaInput) APP.elements.referenciaInput.value = '';
        if (APP.elements.fechaDesdeInput) APP.elements.fechaDesdeInput.value = '';
        if (APP.elements.fechaHastaInput) APP.elements.fechaHastaInput.value = '';
        if (APP.elements.palabraInput) APP.elements.palabraInput.value = '';

        // 2. Resetear modo de búsqueda a 'campos'
        APP.state.searchMode = 'campos';
        
        // 3. Aplicar cambios de UI y buscar
        UI.setSearchModeManual('campos'); // Esto llama a Events.handleSearch()

        UI.alertMessage('✅ Filtros limpiados y modo de búsqueda restablecido.', 'info');
    },
    
    updateSortIcons() {
        const sortIcons = document.querySelectorAll('th[onclick*="sortTable"]');
        sortIcons.forEach(header => {
             let icon = header.querySelector('.sort-icon');
             if (!icon) {
                 icon = document.createElement('span');
                 icon.className = 'sort-icon ml-2 w-4 h-4 inline-block';
                 header.innerHTML = `<div class="sortable flex items-center">${header.innerHTML}</div>`; 
                 header.querySelector('.sortable').appendChild(icon);
             }
             icon.innerHTML = `<svg data-lucide="chevrons-up-down" class="h-3 w-3 text-gray-400"></svg>`;
        });
        const { key, direction } = APP.state.currentSort;
        const activeHeader = document.querySelector(`[onclick*="sortTable('${key}'"]`);
        if (activeHeader) {
            const activeIcon = activeHeader.querySelector('.sort-icon');
            if (activeIcon) activeIcon.innerHTML = `<svg data-lucide="chevron-${direction === 'asc' ? 'up' : 'down'}" class="h-3 w-3 text-primary-link"></svg>`;
        }
        if (window.lucide) { window.lucide.createIcons(); }
    },

    async handleBulkPay() {
        // 1. Identificar IDs seleccionados
        const checkedCheckboxes = document.querySelectorAll('#albaranResults .cobro-checkbox:checked');
        const selectedIDs = Array.from(checkedCheckboxes).map(checkbox => {
             const row = checkbox.closest('tr');
             return parseInt(row.dataset.id);
        });

        console.log(`[BULK PAY LOG] IDs Seleccionados para cobro: ${selectedIDs.join(', ')}`);
        
        const selectedAlbaranes = selectedIDs.map(id => 
            APP.state.filteredAlbaranes.find(a => a.id === id)
        ).filter(a => a !== undefined);

        if (selectedIDs.length === 0) {
            UI.alertMessage("Por favor, marque los albaranes que desea cobrar.", 'info');
            return;
        }

        const refList = selectedAlbaranes.map(a => a.referencia || `ALB #${a.id}`).join(', ');
        const confirmationMessage = 
            `¿Está seguro que desea marcar ${selectedIDs.length} albarán(es) como COBRADOS con la fecha de hoy?\n\n` +
            `Albaranes afectados (Ref.): ${refList}`;

        if (!confirm(confirmationMessage)) {
            return;
        }

        UI.alertMessage("Procesando cobro masivo...", 'neutral');

        try {
            const payload = { ids: selectedIDs };

            // 🌐 LLAMADA API REAL: PUT /api/v1/albaranes/bulk-pay (llama a BulkChargeAlbaranes en Go)
            const response = await fetch('/api/v1/albaranes/bulk-pay', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload) 
            });

            const result = await response.json();

            if (!response.ok) {
                console.error('[BulkPay Error]', result);
                throw new Error(result.error || `Fallo en la API: Código ${response.status}`);
            }
            
            // 🔑 Actualizar estado de los albaranes en el frontend
            const currentDate = UI.formatDate(new Date().toISOString());
            selectedIDs.forEach(id => {
                const index = APP.state.filteredAlbaranes.findIndex(a => a.id === id);
                if (index !== -1) {
                    // Actualizamos PAGADO (campo 36) y FECHA_PAGO (campo 37)
                    APP.state.filteredAlbaranes[index].pagado = true; 
                    APP.state.filteredAlbaranes[index].fecha_pago = currentDate; 
                    
                    // También actualizamos COBRADO (34) y FECHA_COBRO (35) para la UI/coherencia local
                    APP.state.filteredAlbaranes[index].cobrado = true;
                    APP.state.filteredAlbaranes[index].fecha_cobro = currentDate;
                }
            });
            
            UI.alertMessage(result.message || `Cobro masivo completado. ${result.updated} registros actualizados.`, 'success');
            
            // Refrescar la tabla para aplicar filtros (ej. ocultar cobrados)
            Events.handleSearch(); 

        } catch (error) {
            console.error('[BulkPay Catch Error]:', error);
            UI.alertMessage(`❌ Fallo en el cobro masivo: ${error.message}`, 'error');
        }
    },
    
    init() {
        const { searchForm, prevBtn, nextBtn } = APP.elements;
        
        DOM.initRecordsSelect();

        if (searchForm) searchForm.addEventListener('submit', Events.handleSearch);
        
        if (prevBtn) prevBtn.addEventListener('click', () => { if (APP.state.currentPage > 1) { APP.state.currentPage--; DOM.renderResults(); } });
        if (nextBtn) nextBtn.addEventListener('click', () => { if (APP.state.currentPage < APP.state.totalPages) { APP.state.currentPage++; DOM.renderResults(); } });
        
        window.sortTable = (key, dataType) => Filters.sortTable(key, dataType);
        Events.updateSortIcons();
        
        if (APP.elements.btnModeCampos) {
            UI.setSearchModeManual(APP.state.searchMode);
        }
    }
};

// =================================================================================
// 🚀 INICIALIZACIÓN
// =================================================================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Iniciando Gestión de Cobro a Empresas...');
    
    // 1. Cargar Selects (Empresas y Licencias)
    await API.loadEmpresas(); 
    await API.loadLicencias(); 
    
    Events.init();
    
    // 🔑 EXPOSICIÓN GLOBAL DE FUNCIONES
    window.handleClearAllFilters = Events.handleClearAllFilters.bind(Events);
    window.handleBulkPay = Events.handleBulkPay.bind(Events); 
    
    window.handleCobroToggle = handleCobroToggle; 
    window.simulateSaveCobro = simulateSaveCobro; 
    
    // 2. Cargar tabla inicial (API CALL con filtro ENVIADO=1 y COBRADO=0)
    await API.searchAlbaranes(Filters.getFiltersFromForm()); 
    
    console.log('✅ Aplicación Cobro Empresas lista');
});

// ⚠️ Funciones Globales para la Cabecera (Necesarias para el HTML)
window.toggleDropdown = (button) => { 
    const parentDropdown = button.closest('.dropdown'); 
    document.querySelectorAll('.dropdown').forEach(dropdown => {
        if (dropdown !== parentDropdown) { dropdown.classList.remove('active'); }
    });
    if (parentDropdown) { parentDropdown.classList.toggle('active'); }
};
window.showModal = (show, title = '', body = '') => { 
    const modal = document.getElementById('actionModal');
    if (!modal) return;
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').textContent = body;
    modal.classList.toggle('hidden', !show);
};
window.handleAction = (title, description) => { 
    window.showModal(true, title, description);
};
window.handleLogout = () => { 
    window.handleAction('Cerrar Sesión', 'Se ha simulado el cierre de sesión. Redirigiendo...'); 
    setTimeout(() => window.location.href = '/login', 1500); 
};
window.toggleMobileMenu = () => { const mobileMenu = document.getElementById('mobileMenu'); if (mobileMenu) mobileMenu.classList.toggle('hidden'); };