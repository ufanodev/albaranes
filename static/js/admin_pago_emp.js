// Archivo: static/js/admin_pago_emp.js
// ✅ Versión para Administrador: Gestión de Cobro a Empresas.
// Incluye filtro obligatorio por ENVIADO=1 y COBRADO=0.

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
        licenciaInput: document.getElementById('licencia'), 
        empresaSelect: document.getElementById('empresa'),
        cobradoSelect: document.getElementById('cobrado'),
        referenciaInput: document.getElementById('referencia'),
        fechaDesdeInput: document.getElementById('fecha_desde'),
        fechaHastaInput: document.getElementById('fecha_hasta'),
        palabraInput: document.getElementById('palabra'), 
        
        // Botones de modo de búsqueda
        btnModeCampos: document.getElementById('btn-mode-campos'),
        btnModePalabra: document.getElementById('btn-mode-palabra'),
        
        specificFields: [ /* ... */ ].filter(el => el !== null), 
    },
    state: {
        allAlbaranes: [], 
        filteredAlbaranes: [],
        currentPage: 1,
        pageSize: 10, 
        totalRecords: 0,
        totalPages: 1,
        currentSort: { key: 'fecha', direction: 'desc' },
        searchMode: 'campos', // 🔑 Default: 'campos' o 'palabra'
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
    
    /** 🔑 FUNCIÓN CLAVE: Cambia el modo de búsqueda y actualiza la UI de los botones. */
    setSearchModeManual(mode) {
        APP.state.searchMode = mode;
        const { btnModeCampos, btnModePalabra } = APP.elements;

        if (btnModeCampos) {
            btnModeCampos.classList.toggle('bg-blue-600', mode === 'campos');
            btnModeCampos.classList.toggle('text-white', mode === 'campos');
            btnModeCampos.classList.toggle('bg-primary-pastel', mode !== 'campos');
            btnModeCampos.classList.toggle('text-black-pure', mode !== 'campos');
        }
        
        if (btnModePalabra) {
            btnModePalabra.classList.toggle('bg-blue-600', mode === 'palabra');
            btnModePalabra.classList.toggle('text-white', mode === 'palabra');
            btnModePalabra.classList.toggle('bg-primary-pastel', mode !== 'palabra');
            btnModePalabra.classList.toggle('text-black-pure', mode !== 'palabra');
        }
        
        // Opcional: Ejecutar búsqueda inmediata o limpiar el modo anterior
        // Events.handleSearch(); 
    },
};

// =================================================================================
// 🔑 LÓGICA DE INTERACCIÓN (COBRO Y FECHA)
// =================================================================================

/**
 * Lógica de negocio para marcar un albarán como Cobrado (o actualizar fecha de pago/cobro).
 */
function simulateSaveCobro(id, isPaid, dateString, fieldName = 'cobrado') {
    const isPaidInt = isPaid ? 1 : 0;
    
    const updatePayload = {};
    if (fieldName === 'cobrado') {
        updatePayload.cobrado = isPaidInt;
    } else {
        updatePayload[fieldName] = dateString;
    }
    
    // fetch(`/api/v1/albaranes/${id}`, { method: 'PUT', body: JSON.stringify(updatePayload) })
    
    UI.alertMessage(`Cobro/Pago de albarán #${id} actualizado. Campo: ${fieldName}, Valor: ${dateString || isPaid}`, 'neutral');
    
    const albaranIndex = APP.state.filteredAlbaranes.findIndex(a => a.id === id);
    if (albaranIndex !== -1) {
        if (fieldName === 'cobrado') {
             APP.state.filteredAlbaranes[albaranIndex].cobrado = isPaidInt;
        } else {
             APP.state.filteredAlbaranes[albaranIndex][fieldName] = dateString;
        }
        
        DOM.renderResults(APP.state.filteredAlbaranes); 
    }
}

/**
 * Maneja el cambio en el checkbox de cobro (controla el campo 'cobrado').
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
        fechaCobro = '';
    }

    cobradoDisplay.innerHTML = UI.getBooleanHtml(isChecked);
    
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
            licencia: formData.get('licencia') || '', 
            empresa: formData.get('empresa') || '',
            cobrado: formData.get('cobrado') || '',
            referencia: formData.get('referencia') || '',
            fecha_ini: formData.get('fecha_desde') || '',
            fecha_fin: formData.get('fecha_hasta') || '',
            palabra: formData.get('palabra') || '',
            search_type: formData.get('search_type') || 'exacta', 
        };
        
        filters.enviado = 1; // 🔑 FILTRO CLAVE 1: Forzar solo ENVIADOS

        // 🔑 FILTRO CLAVE 2: COBRADO (Default: 0/No para mostrar pendientes)
        if (filters.cobrado === 'si') {
            filters.cobrado = 1; 
        } else if (filters.cobrado === 'no') {
            filters.cobrado = 0; 
        } else {
            filters.cobrado = 0; 
        }

        if (filters.empresa !== '' && !isNaN(parseInt(filters.empresa))) {
             filters.empresa_ref = parseInt(filters.empresa); 
        } else {
             filters.empresa_ref = ''; 
        }

        return filters;
    },
    
    // Función de ordenación
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
    async searchAlbaranes(filters) {
        const resultsBody = APP.elements.resultsBody;
        if (resultsBody) resultsBody.innerHTML = `<tr><td colspan="11" class="text-center py-4 text-gray-500 italic text-sm">Cargando datos de la API...</td></tr>`;

        try {
            const params = new URLSearchParams({});
            
            params.append('enviado', filters.enviado); 
            if (filters.cobrado !== '') params.append('cobrado', filters.cobrado); 
            
            // Lógica para el filtro avanzado (palabra)
            if (APP.state.searchMode === 'palabra' && filters.palabra) {
                 params.append('palabra', filters.palabra);
                 params.append('search_type', filters.search_type);
            } else if (APP.state.searchMode === 'campos') {
                 // Añadir filtros individuales si estamos en modo campos
                 if (filters.licencia) params.append('licencia', filters.licencia);
                 if (filters.empresa_ref) params.append('empresa_ref', filters.empresa_ref);
                 if (filters.referencia) params.append('referencia', filters.referencia);
                 if (filters.fecha_ini) params.append('fecha_ini', filters.fecha_ini);
                 if (filters.fecha_fin) params.append('fecha_fin', filters.fecha_fin);
            }
            
            const url = `/api/v1/albaranes/search?${params.toString()}`;
            console.log('🚀 API Call para Cobro Empresas:', url);
            
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
            UI.alertMessage(`Cargados ${albaranes.length} albaranes ENVIADOS (Cobrado=${filters.cobrado || 'Todos'}).`, 'success');
            
        } catch (error) {
            UI.alertMessage(`❌ Error cargando datos: ${error.message}`, 'error');
            if (resultsBody) resultsBody.innerHTML = `<tr><td colspan="12" class="text-center py-12 text-red-500">❌ Error al cargar los albaranes.</td></tr>`;
        }
    },
};

// =================================================================================
// 🖼️ DOM RENDER
// =================================================================================
const DOM = {
    getCurrentPageData() {
        return APP.state.filteredAlbaranes.slice(
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
            const isCobrado = albaran.cobrado === 1 || albaran.cobrado === true;
            const fechaCobroActual = albaran.fecha_cobro ? UI.formatDate(albaran.fecha_cobro) : ''; 
            const fechaPagoActual = albaran.fecha_pago ? UI.formatDate(albaran.fecha_pago) : ''; 

            const row = document.createElement('tr');
            row.dataset.id = albaran.id; 
            row.classList.add(albaran.id % 2 === 0 ? 'bg-white' : 'bg-gray-50', 'hover:bg-primary-pastel/30', 'transition-colors');
            
            const empresaNombre = albaran.EmpresaData?.nombre || `Empresa ${albaran.empresa_ref || 'N/A'}`;
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
                <td class="px-4 py-3 text-sm text-gray-700">${licenciaNum || '-'}</td>
                <td class="px-4 py-3 text-sm text-gray-700">${UI.formatDate(albaran.fecha)}</td>
                <td class="px-4 py-3 text-sm text-gray-700">${empresaNombre || '-'}</td>
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
    /** 🔑 FUNCIÓN handleSearch COMPLETADA */
    handleSearch(e) {
        if (e) e.preventDefault();
        
        const filters = Filters.getFiltersFromForm();
        
        // 🔑 NOTA: Aquí iría la lógica de filtrado *local* si APP.state.searchMode fuera 'palabra' o 'campos' 
        // y solo tuviéramos APP.state.allAlbaranes. Pero como estamos llamando a la API,
        // simplemente enviamos los filtros y el modo de búsqueda se maneja en el backend (API.searchAlbaranes).
        
        API.searchAlbaranes(filters);
    },
    
    handleClearAllFilters() {
        const form = APP.elements.searchForm;
        if (form) form.reset();
        
        // Resetear a modo campos por defecto al limpiar
        APP.state.searchMode = 'campos';
        UI.setSearchModeManual('campos');

        API.searchAlbaranes(Filters.getFiltersFromForm());
    },
    
    updateSortIcons() {
        const sortIcons = document.querySelectorAll('th[onclick*="sortTable"]');
        sortIcons.forEach(header => {
             let icon = header.querySelector('.sort-icon');
             if (!icon) {
                 icon = document.createElement('span');
                 icon.className = 'sort-icon ml-2 w-4 h-4 inline-block';
                 header.innerHTML = `<div class="sortable flex items-center">${header.innerHTML}</div>`; // Re-wrap content
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
        const checkedCheckboxes = document.querySelectorAll('#albaranResults .cobro-checkbox:checked');
        const selectedIDs = Array.from(checkedCheckboxes).map(checkbox => {
             const row = checkbox.closest('tr');
             return parseInt(row.dataset.id);
        });

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
             // 🌐 Lógica de llamada a API PUT /api/v1/albaranes/bulk-cobro (ASUMIDO)

             // Lógica simulada de éxito (Actualización del estado):
             const currentDate = UI.formatDate(new Date().toISOString());
             selectedIDs.forEach(id => {
                 const index = APP.state.filteredAlbaranes.findIndex(a => a.id === id);
                 if (index !== -1) {
                     APP.state.filteredAlbaranes[index].cobrado = true;
                     APP.state.filteredAlbaranes[index].fecha_cobro = currentDate;
                 }
             });
             
             UI.alertMessage(`Cobro masivo completado. ${selectedIDs.length} registros actualizados.`, 'success');
             DOM.renderResults(APP.state.filteredAlbaranes); 

        } catch (error) {
            console.error('[BulkPay Error]:', error);
            UI.alertMessage(`Fallo en el cobro masivo: ${error.message}`, 'error');
        }
    },
    
    init() {
        const { searchForm, prevBtn, nextBtn } = APP.elements;
        
        DOM.initRecordsSelect();

        if (searchForm) searchForm.addEventListener('submit', Events.handleSearch);
        
        if (prevBtn) prevBtn.addEventListener('click', () => { if (APP.state.currentPage > 1) { APP.state.currentPage--; DOM.renderResults(APP.state.filteredAlbaranes); } });
        if (nextBtn) nextBtn.addEventListener('click', () => { if (APP.state.currentPage < APP.state.totalPages) { APP.state.currentPage++; DOM.renderResults(APP.state.filteredAlbaranes); } });
        
        window.sortTable = (key, dataType) => Filters.sortTable(key, dataType);
        Events.updateSortIcons();
        
        // 🔑 Inicializar UI de botones de modo (por defecto 'campos')
        UI.setSearchModeManual(APP.state.searchMode);
    }
};

// =================================================================================
// 🚀 INICIALIZACIÓN
// =================================================================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Iniciando Gestión de Cobro a Empresas...');
    
    Events.init();
    
    window.handleCobroToggle = handleCobroToggle; 
    window.simulateSaveCobro = simulateSaveCobro; 
    window.handleBulkPay = Events.handleBulkPay.bind(Events); 
    
    // Cargar tabla inicial (API CALL con filtro ENVIADO=1 y COBRADO=0)
    await API.searchAlbaranes(Filters.getFiltersFromForm()); 
    
    console.log('✅ Aplicación Cobro Empresas lista');
});

// ⚠️ Funciones Globales para la Cabecera (Necesarias para evitar errores en el HTML)
// Estas funciones deben existir globalmente para el correcto funcionamiento de la navegación.
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