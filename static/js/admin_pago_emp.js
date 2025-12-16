// Archivo: static/js/admin_pago_emp.js
// ✅ VERSIÓN FINAL - Gestión de Cobros a Empresas (Bulk Charge)
// =================================================================================

const APP = {
    elements: {
        resultsBody: document.getElementById('albaranResults'),
        recordsSelect: document.getElementById('recordsPerPage'),
        statusMessage: document.getElementById('statusMessage'),
        pageInfo: document.getElementById('pageInfo'),
        totalLabel: document.getElementById('totalLabel'),
        prevBtn: document.getElementById('prevPageBtn'),
        nextBtn: document.getElementById('nextPageBtn'),
        searchForm: document.getElementById('searchForm'),
        licenciaSelect: document.getElementById('licenciaSelect'),
        empresaSelect: document.getElementById('empresa'),
        cobradoSelect: document.getElementById('cobrado'),
        referenciaInput: document.getElementById('referencia'),
        fechaDesdeInput: document.getElementById('fecha_desde'),
        fechaHastaInput: document.getElementById('fecha_hasta'),
        palabraInput: document.getElementById('palabra'),
        btnModeCampos: document.getElementById('btn-mode-campos'),
        btnModePalabra: document.getElementById('btn-mode-palabra'),
        activeFiltersCount: document.getElementById('activeFiltersCount'),
        selectAllCheckbox: document.getElementById('selectAllCheckbox')
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
        selectedIds: new Set(),
        isBulkProcessing: false,
        currentFilters: {}
    }
};

// =================================================================================
// 🎨 UI HELPERS & UTILITIES
// =================================================================================
const UI = {
    formatDate(isoString) { 
        if (!isoString || isoString === '0000-00-00' || isoString === 'null') return '';
        try {
            const date = new Date(isoString);
            if (isNaN(date.getTime())) return '';
            return date.toISOString().split('T')[0];
        } catch {
            return isoString.substring(0, 10) || '';
        }
    },
    
    formatCurrency(amount) {
        if (!amount && amount !== 0) return '€0.00';
        return `€${parseFloat(amount).toFixed(2)}`;
    },
    
    getBooleanHtml(value) {
        const isTrue = (value === 1 || value === true);
        return isTrue ? 
            `<span class="px-2 py-1 bg-green-100 text-green-800 text-xs font-bold rounded-full">✅ SÍ</span>` :
            `<span class="px-2 py-1 bg-red-100 text-red-800 text-xs font-bold rounded-full">❌ NO</span>`;
    },
    
    alertMessage(message, type = 'info') {
        console.log(`[${type.toUpperCase()}] ${message}`);
        const statusMessage = document.getElementById('statusMessage');
        if (!statusMessage) return;
        
        statusMessage.textContent = message;
        statusMessage.className = `status-message ${type === 'success' ? 'status-success' : 
                                     type === 'error' ? 'status-error' : 'status-info'}`;
        statusMessage.classList.remove('hidden');
        setTimeout(() => statusMessage.classList.add('hidden'), 5000);
    },
    
    showLoading(message = 'Cargando...') {
        const tbody = document.getElementById('albaranResults');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="12" class="text-center py-8">
                        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mb-2"></div>
                        <p class="text-gray-600">${message}</p>
                    </td>
                </tr>
            `;
        }
    },
    
    updatePageInfo() {
        const totalFiltered = APP.state.filteredAlbaranes.length;
        APP.state.totalPages = Math.ceil(totalFiltered / APP.state.pageSize);
        APP.state.currentPage = Math.max(1, Math.min(APP.state.currentPage, APP.state.totalPages));
        
        const start = (APP.state.currentPage - 1) * APP.state.pageSize + 1;
        const end = Math.min(APP.state.currentPage * APP.state.pageSize, totalFiltered);
        
        const pageInfo = document.getElementById('pageInfo');
        const totalLabel = document.getElementById('totalLabel');
        if (pageInfo) pageInfo.textContent = `Página ${APP.state.currentPage} de ${APP.state.totalPages}`;
        if (totalLabel) totalLabel.textContent = `(${start}-${end} de ${totalFiltered})`;
    },
    
    updatePaginationButtons() {
        const prevBtn = document.getElementById('prevPageBtn');
        const nextBtn = document.getElementById('nextPageBtn');
        if (prevBtn) prevBtn.disabled = APP.state.currentPage <= 1;
        if (nextBtn) nextBtn.disabled = APP.state.currentPage >= APP.state.totalPages;
    }
};

// =================================================================================
// 🔍 FILTROS Y ORDENACIÓN
// =================================================================================
const Filters = {
    getFiltersFromForm() {
        const formData = new FormData(APP.elements.searchForm);
        const filters = {
            enviado: 1, // Siempre se filtra por enviados
            licencia_ref: formData.get('licencia') || '',
            empresa_ref: formData.get('empresa') || '',
            referencia: formData.get('referencia') || '',
            fecha_ini: formData.get('fecha_desde') || '',
            fecha_fin: formData.get('fecha_hasta') || ''
        };
        
        const cobrado = formData.get('cobrado');
        
        if (cobrado === 'si') {
            filters.cobrado = 1; 
        } else if (cobrado === 'no') {
            filters.cobrado = 0;      
        } 
        
        // Asumiendo que el filtro inicial no está en el formulario y queremos 'no' por defecto
        if (!cobrado) {
             filters.cobrado = 0; // Mostrar solo pendientes de cobro inicialmente
        }
        
        console.log('[FILTERS] Aplicados:', filters);
        
        APP.state.currentFilters = { ...filters };
        
        return filters;
    },
    
    sortTable(key, type = 'string') {
        const dir = APP.state.currentSort.key === key && APP.state.currentSort.direction === 'asc' ? 'desc' : 'asc';
        APP.state.currentSort = { key, direction: dir };
        
        APP.state.filteredAlbaranes.sort((a, b) => {
            let va = a[key] || '', vb = b[key] || '';
            if (type === 'date') { va = new Date(va).getTime(); vb = new Date(vb).getTime(); }
            if (type === 'number') { va = parseFloat(va) || 0; vb = parseFloat(vb) || 0; }
            return va > vb ? (dir === 'asc' ? 1 : -1) : va < vb ? (dir === 'asc' ? -1 : 1) : 0;
        });
        
        APP.state.currentPage = 1;
        DOM.renderResults();
    }
};

// =================================================================================
// 🔥 CHECKBOX PRINCIPAL & GUARDADO INDIVIDUAL
// =================================================================================
function handleCobroToggle(albaranId) {
    const row = document.querySelector(`tr[data-id="${albaranId}"]`);
    if (!row) return console.error(`❌ Row no encontrada: ${albaranId}`);

    const checkbox = row.querySelector('.cobro-checkbox');
    const fechaCobroInput = row.querySelector('.fecha-cobro-input');
    const fechaPagoInput = row.querySelector('.fecha-pago-input');
    const cobradoDisplay = row.querySelector('.cobrado-display');
    
    if (!checkbox || !fechaCobroInput || !fechaPagoInput || !cobradoDisplay) {
        return console.error(`❌ Elementos faltantes en fila ${albaranId}`);
    }

    const isChecked = checkbox.checked;
    const hoy = UI.formatDate(new Date().toISOString());

    if (isChecked) {
        fechaCobroInput.disabled = false;
        fechaPagoInput.disabled = false;
        
        if (!fechaCobroInput.value) fechaCobroInput.value = hoy;
        if (!fechaPagoInput.value) fechaPagoInput.value = hoy;
        
    } else {
        fechaCobroInput.disabled = true;
        fechaPagoInput.disabled = true;
    }

    cobradoDisplay.innerHTML = UI.getBooleanHtml(isChecked);
    saveCobroState(albaranId, isChecked, fechaCobroInput.value, fechaPagoInput.value);
}

async function saveCobroState(id, isPaid, fCobro, fPago) {
    const payload = { 
        id: parseInt(id),
        cobrado: isPaid ? 1 : 0,
        pagado: isPaid ? 1 : 0, // Cobro implica pago al titular
        fecha_cobro: isPaid ? (fCobro || UI.formatDate(new Date().toISOString())) : null,
        fecha_pago: isPaid ? (fPago || UI.formatDate(new Date().toISOString())) : null
    };
    
    console.log(`📤 [SAVE STATE ${id}] Payload:`, payload);

    try {
        const response = await fetch(`/api/v1/albaranes/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || `HTTP ${response.status}`);
        }

        const idx = APP.state.filteredAlbaranes.findIndex(a => a.id == id);
        if (idx !== -1) {
            const albaran = APP.state.filteredAlbaranes[idx];
            albaran.cobrado = payload.cobrado;
            albaran.pagado = payload.pagado;
            albaran.fecha_cobro = payload.fecha_cobro;
            albaran.fecha_pago = payload.fecha_pago;
            
            // Recargar si hemos cobrado y el filtro es "solo pendientes"
            if (isPaid && APP.state.currentFilters.cobrado === 0) {
                setTimeout(() => { API.searchAlbaranes(APP.state.currentFilters); }, 500);
            } else {
                DOM.renderResults();
            }
        }

        UI.alertMessage(`✅ Albarán #${id} ${isPaid ? 'cobrado' : 'pendiente'}`, 'success');
    } catch (error) {
        console.error(`❌ [SAVE STATE ${id}]`, error);
        UI.alertMessage(`❌ Error #${id}: ${error.message}`, 'error');
    }
}

// --------------------------------------------------------------------------------
// Funciones de guardado de fecha individuales (llamadas desde el evento onchange)
// --------------------------------------------------------------------------------
async function saveFechaCobro(id, fecha) {
    const row = document.querySelector(`tr[data-id="${id}"]`);
    const fechaPagoInput = row?.querySelector('.fecha-pago-input');
    await saveCobroState(id, true, fecha, fechaPagoInput?.value);
}

async function saveFechaPago(id, fecha) {
    const row = document.querySelector(`tr[data-id="${id}"]`);
    const fechaCobroInput = row?.querySelector('.fecha-cobro-input');
    await saveCobroState(id, true, fechaCobroInput?.value, fecha);
}

// =================================================================================
// 🔥 BULK PAY / BULK CHARGE
// =================================================================================
async function handleBulkCharge() {
    const checkboxes = document.querySelectorAll('#albaranResults .cobro-checkbox:checked');
    const ids = Array.from(checkboxes).map(cb => parseInt(cb.closest('tr').dataset.id));
    
    if (ids.length === 0) {
        return UI.alertMessage('❌ Seleccione albaranes', 'info');
    }

    const albaranes = ids.map(id => APP.state.filteredAlbaranes.find(a => a.id === id)).filter(Boolean);
    const total = albaranes.reduce((sum, a) => sum + parseFloat(a.importe_total || 0), 0).toFixed(2);
    const hoy = UI.formatDate(new Date().toISOString());
    
    const confirmMsg = `🔥 COBRO MASIVO ${ids.length} albaranes\n💰 ${UI.formatCurrency(total)}\n\n¿Confirmar cobro y pago (Fecha: ${hoy})?`;
    if (!confirm(confirmMsg)) return;

    try {
        UI.showLoading('Procesando cobro masivo...');
        UI.alertMessage('⏳ Procesando cobro masivo...', 'info');
        
        // Usar bulk-charge (PUT /api/v1/albaranes/bulk-charge)
        const payload = { 
            ids: ids,
            fecha_cobro: hoy,
            fecha_pago: hoy 
        };
        
        const response = await fetch('/api/v1/albaranes/bulk-charge', { 
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        console.log('[BULK CHARGE] Resultado:', result);

        if (!response.ok) {
            throw new Error(result.error || 'Error servidor');
        }

        // ✅ RECARGAR TABLA DESPUÉS DEL COBRO para aplicar filtros
        await API.searchAlbaranes(Filters.getFiltersFromForm());
        
        const mensaje = `✅ ${result.updated || ids.length} albaranes cobrados\n`;
        mensaje += `💰 Importe total: ${UI.formatCurrency(total)}`;
        
        UI.alertMessage(mensaje, 'success');
        
    } catch (error) {
        console.error('[BULK CHARGE] Error:', error);
        UI.alertMessage(`❌ ${error.message}`, 'error');
    }
}

// =================================================================================
// 🌐 API SERVICES (Carga de selects y Search)
// =================================================================================
const API = {
    async loadEmpresas() {
        const select = document.getElementById('empresa');
        if (!select) return;
        try {
            const res = await fetch('/api/v1/empresas');
            const data = await res.json();
            const empresas = Array.isArray(data.data) ? data.data : data;
            select.innerHTML = '<option value="">Todas</option>' + 
                empresas.map(e => `<option value="${e.id}">${e.nombre}</option>`).join('');
        } catch (e) { console.error('Empresas error:', e); }
    },
    
    async loadLicencias() {
        const select = document.getElementById('licenciaSelect');
        if (!select) return;
        try {
            const res = await fetch('/api/v1/licencias');
            const data = await res.json();
            const licencias = Array.isArray(data.data) ? data.data : data;
            select.innerHTML = '<option value="">Todas</option>' + 
                licencias.map(l => `<option value="${l.id}">${l.licencia}</option>`).join('');
        } catch (e) { console.error('Licencias error:', e); }
    },
    
    async searchAlbaranes(filters) {
        UI.showLoading('Buscando albaranes...');
        
        try {
            const params = new URLSearchParams();
            Object.entries(filters).forEach(([k, v]) => {
                if (v !== undefined && v !== null && v !== '') {
                    params.append(k, v);
                }
            });
            
            params.append('pageSize', 5000); // Forzar carga de todos para filtrado local
            params.append('page', 1);
            
            const res = await fetch(`/api/v1/albaranes/search?${params}`);
            const data = await res.json();
            const albaranes = data.data || [];
            
            APP.state.allAlbaranes = albaranes;
            APP.state.filteredAlbaranes = albaranes;
            
            Filters.sortTable('fecha', 'date');
            
            if (albaranes.length === 0) {
                UI.alertMessage('ℹ️ No se encontraron albaranes con los filtros aplicados', 'info');
            } else {
                UI.alertMessage(`${albaranes.length} albaranes cargados`, 'success');
            }
        } catch (e) {
            console.error('Search error:', e);
            UI.alertMessage(`Error: ${e.message}`, 'error');
        }
    }
};

// =================================================================================
// 🖼️ DOM RENDER (Paginación y Tabla)
// =================================================================================
const DOM = {
    // ... (DOM.getCurrentPageData se mantiene igual) ...
    getCurrentPageData() {
        const data = APP.state.filteredAlbaranes || [];
        const start = (APP.state.currentPage - 1) * APP.state.pageSize;
        return data.slice(start, start + APP.state.pageSize);
    },
    
    renderResults() {
        const tbody = document.getElementById('albaranResults');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        const pageData = DOM.getCurrentPageData();
        
        if (!pageData.length) {
            tbody.innerHTML = '<tr><td colspan="12" class="text-center py-8 text-gray-500">Sin albaranes</td></tr>';
            UI.updatePageInfo(); 
            UI.updatePaginationButtons();
            return;
        }

        pageData.forEach(albaran => {
            const isCobrado = albaran.cobrado === 1;
            const fCobro = UI.formatDate(albaran.fecha_cobro);
            const fPago = UI.formatDate(albaran.fecha_pago);

            const row = document.createElement('tr');
            row.dataset.id = albaran.id;
            row.className = `${albaran.id % 2 ? 'bg-gray-50' : 'bg-white'} hover:bg-primary-pastel/30`;

            row.innerHTML = `
                <td class="px-4 py-3 text-center">
                    <input type="checkbox" class="cobro-checkbox h-5 w-5 rounded border-gray-300" 
                            ${isCobrado ? 'checked' : ''} onclick="handleCobroToggle(${albaran.id})">
                </td>
                <td class="px-4 py-2 text-sm font-medium">${albaran.id}</td>
                <td class="px-4 py-2 text-sm">${albaran.numero_albaran}</td>
                <td class="px-4 py-2 text-sm">${albaran.LicenciaData?.licencia || albaran.licencia_ref}</td>
                <td class="px-4 py-2 text-sm">${UI.formatDate(albaran.fecha)}</td>
                <td class="px-4 py-2 text-sm">${albaran.EmpresaData?.nombre || albaran.empresa_ref}</td>
                <td class="px-4 py-2 text-sm">${albaran.referencia || '-'}</td>
                <td class="px-4 py-2 font-bold text-green-600 text-right">€${parseFloat(albaran.importe_total||0).toFixed(2)}</td>
                <td class="px-4 py-2 text-center"><span class="cobrado-display">${UI.getBooleanHtml(isCobrado)}</span></td>
                <td class="px-4 py-2">
                    <input type="date" class="fecha-cobro-input w-28 p-1 border rounded text-sm" 
                            value="${fCobro}" ${isCobrado ? '' : 'disabled'}
                            onchange="saveFechaCobro(${albaran.id}, this.value)"
                            title="Fecha de cobro">
                </td>
                <td class="px-4 py-2">
                    <input type="date" class="fecha-pago-input w-28 p-1 border rounded text-sm" 
                            value="${fPago}" ${isCobrado ? '' : 'disabled'}
                            onchange="saveFechaPago(${albaran.id}, this.value)"
                            title="Fecha de pago">
                </td>
                <td class="px-4 py-2 text-sm text-gray-600 max-w-xs truncate">${albaran.observaciones_admin || '-'}</td>
            `;
            tbody.appendChild(row);
        });
        
        UI.updatePageInfo();
        UI.updatePaginationButtons();
        if (window.lucide) window.lucide.createIcons();
    },

    initRecordsSelect() {
        const select = document.getElementById('recordsPerPage');
        if (!select) return;
        select.innerHTML = `<option value="10" selected>10</option><option value="30">30</option><option value="50">50</option><option value="9999">Todos</option>`;
        select.addEventListener('change', (e) => {
            APP.state.pageSize = e.target.value === '9999' ? 9999 : +e.target.value;
            APP.state.currentPage = 1;
            DOM.renderResults();
        });
    }
};

// =================================================================================
// 🎯 EVENTOS
// =================================================================================
const Events = {
    init() {
        // Inicialización de selectores
        DOM.initRecordsSelect();

        // Paginación y Búsqueda
        document.getElementById('prevPageBtn')?.addEventListener('click', () => { if (APP.state.currentPage > 1) { APP.state.currentPage--; DOM.renderResults(); } });
        document.getElementById('nextPageBtn')?.addEventListener('click', () => { if (APP.state.currentPage < APP.state.totalPages) { APP.state.currentPage++; DOM.renderResults(); } });
        APP.elements.searchForm?.addEventListener('submit', (e) => { e.preventDefault(); API.searchAlbaranes(Filters.getFiltersFromForm()); });
        
        // Recargar (Asumiendo que hay un botón de limpiar que llama a handleClearAllFilters)
        window.handleClearAllFilters = () => {
             APP.elements.searchForm?.reset();
             // Forzar el filtro inicial (pendientes)
             const initialFilters = Filters.getFiltersFromForm();
             initialFilters.cobrado = 0; 
             API.searchAlbaranes(initialFilters);
        };
        
        window.sortTable = Filters.sortTable;
    }
};


// =================================================================================
// 🚀 INICIALIZACIÓN
// =================================================================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 admin_pago_emp.js CARGADO - Inicializando Cobros a Empresas');
    
    // 1. Cargar datos de selects
    await Promise.all([API.loadEmpresas(), API.loadLicencias()]);
    
    // 2. Inicializar eventos
    Events.init();
    
    // 3. Cargar inicialmente PENDIENTES (cobrado=0)
    const initialFilters = Filters.getFiltersFromForm();
    initialFilters.cobrado = 0; 
    await API.searchAlbaranes(initialFilters);
    
    console.log('✅ Sistema listo - Cobros a Empresas');
});


// =================================================================================
// 🌍 FUNCIONES GLOBALES (Exportación y Navegación) - Definición en ámbito raíz
// =================================================================================

// Funciones de guardado de fecha individuales (llamadas desde el evento onchange)
window.saveFechaCobro = saveFechaCobro;
window.saveFechaPago = saveFechaPago;

// Exportación masiva / Cobro masivo
window.handleBulkPay = handleBulkCharge; 
window.handleCobroToggle = handleCobroToggle;

// Utilidades UI (Sobrescribe las dummies del HTML)
window.handleAction = (title, description) => { if (typeof UI !== 'undefined') UI.alertMessage(`Acción: ${title}`, 'info'); }; 
window.handleLogout = () => { if (typeof UI !== 'undefined') UI.alertMessage('Cerrar Sesión simulado...', 'info'); setTimeout(() => window.location.href = '/login', 1500); };
window.toggleDropdown = (btn) => { const dropdown = btn.closest('.dropdown'); document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('active')); dropdown?.classList.toggle('active'); };

// Lógica de Exportación (PDF/XLSX)
(function() {
    const Exportation = {
        formatDataForExport() {
             return APP.state.filteredAlbaranes.map(a => ({
                "ID": String(a.id || 'N/A'), 
                "N_Alb": a.numero_albaran || '-',
                "Licencia": a.LicenciaData?.licencia || `ID ${a.licencia_ref || 'N/A'}`,
                "Fecha_Emision": UI.formatDate(a.fecha) || '-',
                "Empresa": a.EmpresaData?.nombre || `ID ${a.empresa_ref || 'N/A'}`,
                "Referencia": a.referencia || '-',
                "Importe_Total": parseFloat(a.importe_total || 0).toFixed(2), 
                "Cobrado": a.cobrado ? 'Sí' : 'No',
                "Pagado": a.pagado ? 'Sí' : 'No',
                "Fecha_Cobro": UI.formatDate(a.fecha_cobro) || '-',
                "Fecha_Pago": UI.formatDate(a.fecha_pago) || '-',
                "Observaciones": a.observaciones_admin || '-',
            }));
        },
        async exportAlbaranes(format) {
            // ... (Lógica de exportación) ...
            if (!APP.state.filteredAlbaranes.length) { UI.alertMessage(`No hay albaranes para exportar a ${format.toUpperCase()}.`, 'info'); return; }
            const endpoint = `/api/v1/albaranes/export/${format}`; 
            UI.alertMessage(`Generando ${format.toUpperCase()}. Por favor, espere...`, 'info');
            const payload = { reportName: `Cobros_Empresas_(${format.toUpperCase()})`, data: this.formatDataForExport() };
            try {
                console.log("➡️ JSON Enviando al Backend (Export Cobros):", JSON.stringify(payload));
                const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                
                if (!response.ok) {
                    const errorText = await response.text(); 
                    let errorJson = { message: errorText };
                    try { errorJson = JSON.parse(errorText); } catch (e) { }
                    console.error(`🔴 Error HTTP ${response.status} en la API de exportación.`, errorJson);
                    throw new Error(`[${response.status}] ${errorJson.message || 'Error desconocido'}`);
                }
                const result = await response.json();
                UI.alertMessage(`✅ Archivo ${format.toUpperCase()} generado con éxito.`, 'success');
                window.open(result.downloadURL, '_blank');
            } catch (error) {
                console.error(`❌ Error final al generar ${format.toUpperCase()}:`, error);
                UI.alertMessage(`❌ Error al generar el ${format.toUpperCase()}: ${error.message}`, 'error');
            }
        }
    };
    
    window.handleGeneratePDF = () => { Exportation.exportAlbaranes('pdf'); };
    window.handleGenerateXLSX = () => { Exportation.exportAlbaranes('xlsx'); }; 
    window.toggleMobileMenu = () => { const mobileMenu = document.getElementById('mobileMenu'); if (mobileMenu) mobileMenu.classList.toggle('hidden'); }; 
})();