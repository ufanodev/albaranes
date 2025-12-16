const APP = {
    elements: {
        resultsBody: document.getElementById('albaranResults'),
        recordsSelect: document.getElementById('recordsPerPage'),
        statusMessage: document.getElementById('statusMessage'),
        pageInfo: document.getElementById('pageInfo'),
        totalLabel: document.getElementById('totalLabel'),
        prevBtn: document.getElementById('prevPageBtn'),
        nextBtn: document.getElementById('nextBtn'),
        
        searchForm: document.getElementById('searchForm'),
        licenciaInput: document.getElementById('licencia'), 
        empresaSelect: document.getElementById('empresa'),
        pagadoSelect: document.getElementById('pagado'),
        referenciaInput: document.getElementById('referencia'),
        fechaDesdeInput: document.getElementById('fecha_desde'),
        fechaHastaInput: document.getElementById('fecha_hasta'),
        palabraInput: document.getElementById('palabra'), 
        
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
        searchMode: 'todos',
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
        
        APP.state.totalPages = Math.ceil(APP.state.filteredAlbaranes.length / APP.state.pageSize);
        APP.state.currentPage = Math.min(APP.state.currentPage, APP.state.totalPages || 1); 
        APP.state.currentPage = Math.max(1, APP.state.currentPage);

        const startIndex = (APP.state.currentPage - 1) * APP.state.pageSize;
        const endIndex = Math.min(startIndex + APP.state.pageSize, APP.state.filteredAlbaranes.length);
        const showing = endIndex - startIndex;

        if (pageInfo) pageInfo.textContent = `Página ${APP.state.currentPage} de ${APP.state.totalPages || 1}`;
        if (totalLabel) totalLabel.textContent = `(${showing} de ${APP.state.filteredAlbaranes.length} registros)`;
    },

    updatePaginationButtons() {
        const { prevBtn, nextBtn } = APP.elements;
        const totalPages = APP.state.totalPages || 1;
        
        if (prevBtn) prevBtn.disabled = APP.state.currentPage <= 1;
        if (nextBtn) nextBtn.disabled = APP.state.currentPage >= totalPages;
    },
};

// =================================================================================
// 🔑 LÓGICA DE INTERACCIÓN (PAGO Y FECHA)
// =================================================================================

function simulateSavePago(id, isPaid, dateString) {
    const albaranIndex = APP.state.filteredAlbaranes.findIndex(a => a.id === id);
    if (albaranIndex !== -1) {
        APP.state.filteredAlbaranes[albaranIndex].pagado = isPaid ? 1 : 0;
        APP.state.filteredAlbaranes[albaranIndex].fecha_pago = dateString;
        DOM.renderResults(APP.state.filteredAlbaranes);
    }
    UI.alertMessage(`Pago de albarán #${id} actualizado. Pagado: ${isPaid ? 'Sí' : 'No'}, Fecha: ${dateString || '-'}`, 'neutral');
}

function handlePagoToggle(albaranId) {
    const row = document.querySelector(`tr[data-id="${albaranId}"]`);
    if (!row) return;

    const checkbox = row.querySelector('.pago-checkbox');
    const fechaInput = row.querySelector('.fecha-pago-input');
    const pagadoDisplay = row.querySelector('.pagado-display');
    
    const isChecked = checkbox.checked;
    let fechaPago = '';
    
    if (isChecked) {
        fechaPago = fechaInput.value || UI.formatDate(new Date().toISOString());
        fechaInput.value = fechaPago;
        
        fechaInput.classList.remove('hidden');
        fechaInput.disabled = false;
    } else {
        fechaInput.classList.add('hidden');
        fechaInput.disabled = true;
        fechaInput.value = '';
        fechaPago = '';
    }

    pagadoDisplay.innerHTML = UI.getBooleanHtml(isChecked);
    
    simulateSavePago(albaranId, isChecked, fechaPago);
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
            pagado: formData.get('pagado') || '',
            referencia: formData.get('referencia') || '',
            fecha_ini: formData.get('fecha_desde') || '',
            fecha_fin: formData.get('fecha_hasta') || '',
            palabra: formData.get('palabra') || '',
            search_type: formData.get('search_type') || 'exacta', 
        };
        
        filters.enviado = 1; // 🔑 FILTRO CLAVE: Forzar solo ENVIADOS

        if (filters.pagado === 'si') {
            filters.pagado = 1; 
        } else if (filters.pagado === 'no') {
            filters.pagado = 0; 
        } else {
            filters.pagado = ''; 
        }

        if (filters.empresa !== '' && !isNaN(parseInt(filters.empresa))) {
             filters.empresa_ref = parseInt(filters.empresa); 
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
            
            Object.keys(filters).forEach(key => {
                if (filters[key] !== '' && filters[key] !== null) {
                    params.append(key, filters[key]);
                }
            });
            
            if (filters.pagado === '') {
                 params.delete('pagado');
            }


            params.append('pageSize', 5000); 
            params.append('page', 1); 
            
            const url = `/api/v1/albaranes/search?${params.toString()}`;
            console.log('🚀 API Call para Pagos:', url);

            const response = await fetch(url);
            
            if (response.status === 401) { 
                console.error("🔴 ERROR 401: Sesión expirada.");
                window.location.href = '/login'; 
                return; 
            }
            if (!response.ok) {
                 const errorText = await response.text();
                 console.error(`🔴 ERROR HTTP ${response.status}: ${errorText}`);
                 throw new Error(`Error en la API. Código: ${response.status}`);
            }
            
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
            console.error('❌ Error en searchAlbaranes:', error);
            if (resultsBody) resultsBody.innerHTML = `<tr><td colspan="11" class="text-center py-12 text-red-500">❌ Error al cargar los albaranes.</td></tr>`;
        }
    },
    async loadSelectData() { /* Implementación para cargar SELECTs */ }
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
            resultsBody.innerHTML = `<tr><td colspan="11" class="text-center py-4 text-gray-500 italic text-sm">No se encontraron albaranes ENVIADOS.</td></tr>`;
            UI.updatePageInfo();
            UI.updatePaginationButtons();
            return;
        }

        pageData.forEach(albaran => {
            const isPaid = albaran.pagado === 1 || albaran.pagado === true;
            const fechaPagoActual = albaran.fecha_pago ? UI.formatDate(albaran.fecha_pago) : '';

            const row = document.createElement('tr');
            row.dataset.id = albaran.id; 
            row.classList.add(albaran.id % 2 === 0 ? 'bg-white' : 'bg-gray-50', 'hover:bg-primary-pastel/30', 'transition-colors');
            
            const empresaNombre = albaran.EmpresaData?.nombre || `Empresa ${albaran.empresa_ref || 'N/A'}`;
            const licenciaNum = albaran.LicenciaData?.licencia || `Lic. ${albaran.licencia_ref || 'N/A'}`;

            row.innerHTML = `
                <td class="px-4 py-3 whitespace-nowrap text-xs font-medium text-center">
                    <input type="checkbox" 
                            class="pago-checkbox form-checkbox h-5 w-5 text-green-600 border-gray-300 rounded focus:ring-green-500" 
                            ${isPaid ? 'checked' : ''}
                            onclick="handlePagoToggle(${albaran.id})"
                            title="Marcar/Desmarcar Pago">
                </td>
                <td class="px-4 py-3 text-sm text-gray-700">${albaran.id}</td> 
                <td class="px-4 py-3 text-sm text-gray-700">${albaran.numero_albaran}</td>
                <td class="px-4 py-3 text-sm text-gray-700">${licenciaNum || '-'}</td>
                <td class="px-4 py-3 text-sm text-gray-700">${UI.formatDate(albaran.fecha)}</td>
                <td class="px-4 py-3 text-sm text-gray-700">${empresaNombre || '-'}</td>
                <td class="px-4 py-3 text-sm text-gray-700 text-truncate">${albaran.referencia || '-'}</td>
                <td class="px-4 py-3 text-sm font-bold text-primary-link text-right">€${parseFloat(albaran.importe_total || 0).toFixed(2)}</td>
                <td class="px-4 py-3 text-sm text-center">
                    <span class="pagado-display">${UI.getBooleanHtml(isPaid)}</span>
                </td>
                <td class="px-4 py-3 text-sm text-gray-500">
                    <input type="date" 
                            class="fecha-pago-input input-field w-32 text-sm" 
                            value="${fechaPagoActual}"
                            ${isPaid ? '' : 'disabled'}
                            data-id="${albaran.id}"
                            onchange="simulateSavePago(${albaran.id}, 1, this.value)">
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
        if (form) form.reset();
        
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
        const visibleAlbaranes = DOM.getCurrentPageData();
        const visibleIDs = visibleAlbaranes.map(a => a.id);
        
        const checkedCheckboxes = document.querySelectorAll('#albaranResults .pago-checkbox:checked');
        const selectedIDs = Array.from(checkedCheckboxes).map(checkbox => {
             const row = checkbox.closest('tr');
             return parseInt(row.dataset.id);
        });

        const selectedAlbaranes = selectedIDs.map(id => 
             APP.state.filteredAlbaranes.find(a => a.id === id)
        ).filter(a => a !== undefined);

        if (selectedIDs.length === 0) {
            UI.alertMessage("Por favor, marque los albaranes que desea pagar.", 'info');
            return;
        }

        const refList = selectedAlbaranes.map(a => a.referencia || `ALB #${a.id}`).join(', ');
        const confirmationMessage = 
            `¿Está seguro que desea marcar ${selectedIDs.length} albarán(es) como PAGADOS con la fecha de hoy?\n\n` +
            `Albaranes afectados (Ref.): ${refList}`;

        if (!confirm(confirmationMessage)) {
            return;
        }

        UI.alertMessage("Procesando pago masivo...", 'neutral');

        try {
            const response = await fetch('/api/v1/albaranes/bulk-pay', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ ids: selectedIDs }) 
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || `Error ${response.status} al procesar el pago.`);
            }
            
            const currentDate = UI.formatDate(new Date().toISOString());
            selectedIDs.forEach(id => {
                 const index = APP.state.filteredAlbaranes.findIndex(a => a.id === id);
                 if (index !== -1) {
                     APP.state.filteredAlbaranes[index].pagado = true;
                     APP.state.filteredAlbaranes[index].fecha_pago = currentDate;
                 }
            });

            UI.alertMessage(result.message || `Pago masivo completado. ${result.updated} registros actualizados.`, 'success');
            
            DOM.renderResults(APP.state.filteredAlbaranes);

        } catch (error) {
            console.error('[BulkPay Error]:', error);
            UI.alertMessage(`Fallo en el pago masivo: ${error.message}`, 'error');
        }
    },
    
    init() {
        const { searchForm, prevBtn, nextBtn } = APP.elements;
        
        DOM.initRecordsSelect();

        if (searchForm) searchForm.addEventListener('submit', Events.handleSearch);
        
        if (prevBtn) prevBtn.addEventListener('click', () => { if (APP.state.currentPage > 1) { APP.state.currentPage--; DOM.renderResults(APP.state.filteredAlbaranes); } });
        if (nextBtn) nextBtn.addEventListener('click', () => { if (APP.state.currentPage < APP.state.totalPages) { APP.state.currentPage++; DOM.renderResults(APP.state.filteredAlbaranes); } });
        
        window.sortTable = (key, dataType) => Filters.sortTable(key, dataType);
    }
};

// =================================================================================
// 📄 EXPORTATION LOGIC (IIFE para garantizar la definición inmediata y corregir JSON)
// =================================================================================
(function() {
    const Exportation = {
        /** Formatea los datos de Albaranes para el backend de exportación genérica. */
        formatDataForExport() {
             return APP.state.filteredAlbaranes.map(a => ({
                // 🛑 CORRECCIÓN CLAVE: Forzar String() para ID.
                "ID": String(a.id || 'N/A'), 
                "N_Alb": a.numero_albaran || '-', 
                "Licencia": a.LicenciaData?.licencia || `ID ${a.licencia_ref || 'N/A'}`,
                "Fecha_Emision": UI.formatDate(a.fecha) || '-', 
                "Empresa": a.EmpresaData?.nombre || `ID ${a.empresa_ref || 'N/A'}`,
                "Referencia": a.referencia || '-',
                
                // Importe Total debe ser String para map[string]string
                "Importe_Total": parseFloat(a.importe_total || 0).toFixed(2), 
                
                "Pagado": a.pagado ? 'Sí' : 'No',
                "Fecha_Pago": UI.formatDate(a.fecha_pago) || '-', 
                "Observaciones": a.observaciones_admin || '-',
            }));
        },

        /**
         * Prepara los datos y llama a la API de Go para generar el archivo.
         * @param {string} format 'pdf' o 'xlsx'
         */
        async exportAlbaranes(format) {
            if (!APP.state.filteredAlbaranes.length) {
                UI.alertMessage(`No hay albaranes filtrados para exportar a ${format.toUpperCase()}.`, 'info');
                return;
            }

            const endpoint = `/api/v1/albaranes/export/${format}`; 
            UI.alertMessage(`Generando ${format.toUpperCase()}. Por favor, espere...`, 'info');

            const dataToExport = this.formatDataForExport();
            
            const titleElement = document.querySelector('title');
            const reportName = (titleElement ? titleElement.textContent.trim().replace('🚕', '').replace('🏢', '') : 'Pagos/Albaranes').trim() + ' (' + format.toUpperCase() + ')';

            try {
                // Logueamos el JSON de salida antes de enviar (para depuración)
                console.log("➡️ JSON Enviando al Backend:", JSON.stringify({ reportName: reportName, data: dataToExport }));
                
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        reportName: reportName, 
                        data: dataToExport
                    }),
                });

                const result = await response.json();

                if (!response.ok || !result.success) {
                    const message = result.message || `Error desconocido al generar el ${format.toUpperCase()}.`;
                    throw new Error(`[${response.status}] ${result.message}`);
                }

                UI.alertMessage(`✅ Archivo ${format.toUpperCase()} generado con éxito. Iniciando descarga...`, 'success');
                window.open(result.downloadURL, '_blank');
                
            } catch (error) {
                console.error(`Error al generar ${format.toUpperCase()}:`, error);
                UI.alertMessage(`❌ Error al generar el ${format.toUpperCase()}: ${error.message}`, 'error');
            }
        }
    };

    // Exportación inmediata de los handlers al objeto window (Resuelve ReferenceError)
    window.handleGeneratePDF = () => { Exportation.exportAlbaranes('pdf'); };
    window.handleGenerateXLSX = () => { Exportation.exportAlbaranes('xlsx'); }; 
})();


// =================================================================================
// 🚀 INICIALIZACIÓN
// =================================================================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Iniciando Gestión de Pagos de Titulares...');
    
    Events.init();
    
    window.handlePagoToggle = handlePagoToggle;
    window.handleBulkPay = Events.handleBulkPay.bind(Events); 
    
    // Cargar tabla inicial
    await API.searchAlbaranes(Filters.getFiltersFromForm()); 
    
    console.log('✅ Aplicación Pagos Titulares lista');
});

// =================================================================================
// 🌍 FUNCIONES GLOBALES (Menú y Modal) 
// =================================================================================

/** Muestra/oculta el modal de mensajes (expuesta globalmente). */
window.showModal = (show, title = '', body = '') => {
    const modal = document.getElementById('actionModal');
    if (!modal) return;
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').textContent = body;
    modal.classList.toggle('hidden', !show);
};

/** Simula una acción y muestra el resultado en un modal. */
window.handleAction = (title, description) => {
    window.showModal(true, title, description);
};

/** Lógica de Cierre de Sesión */
window.handleLogout = () => {
    window.handleAction('Cerrar Sesión', 'Se ha simulado el cierre de sesión. Redireccionando...');
    setTimeout(() => {
        window.location.href = '/login'; 
    }, 1500);
};

/** Alterna el menú desplegable (expuesta globalmente). */
window.toggleDropdown = (button) => {
    const parentDropdown = button.closest('.dropdown'); 
    document.querySelectorAll('.dropdown').forEach(dropdown => {
        if (dropdown !== parentDropdown) {
            dropdown.classList.remove('active');
        }
    });
    if (parentDropdown) {
        parentDropdown.classList.toggle('active');
    }
};

/** Alterna el menú móvil */
window.toggleMobileMenu = () => {
    const mobileMenu = document.getElementById('mobileMenu');
    if (mobileMenu) mobileMenu.classList.toggle('hidden');
};