// Archivo: static/js/admin_pago_emp.js
// ✅ VERSIÓN CORREGIDA - Filtra por cobrado=0 correctamente
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
        currentFilters: {} // Para guardar los filtros actuales
    }
};

// =================================================================================
// 🎨 UI HELPERS
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
// 🔍 FILTROS Y ORDENACIÓN - CORREGIDOS PARA USAR cobrado
// =================================================================================
const Filters = {
    getFiltersFromForm() {
        const formData = new FormData(APP.elements.searchForm);
        const filters = {
            enviado: 1,
            licencia_ref: formData.get('licencia') || '',
            empresa_ref: formData.get('empresa') || '',
            referencia: formData.get('referencia') || '',
            fecha_ini: formData.get('fecha_desde') || '',
            fecha_fin: formData.get('fecha_hasta') || ''
        };
        
        const cobrado = formData.get('cobrado');
        
        // ✅ CORRECTO: Usar cobrado, NO pagado
        if (cobrado === 'si') {
            filters.cobrado = 1;      // Solo COBRADOS
        } else if (cobrado === 'no') {
            filters.cobrado = 0;      // Solo PENDIENTES (por defecto)
        } else if (cobrado === '' || cobrado === null) {
            // Si está vacío o "todos", NO incluir filtro cobrado
            // Así mostrará todos (cobrados y pendientes)
        }
        
        console.log('[FILTERS] Aplicados:', filters);
        
        // Guardar filtros actuales para recargar después
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
// 🔥 CHECKBOX PRINCIPAL
// =================================================================================
function handleCobroToggle(albaranId) {
    console.log(`🔄 [TOGGLE ${albaranId}] Checkbox cambiado`);
    
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
    console.log(`📋 [TOGGLE ${albaranId}] ${isChecked ? '✅ COBRADO' : '❌ PENDIENTE'}`);

    const hoy = new Date().toISOString().split('T')[0];

    if (isChecked) {
        checkbox.checked = true;
        fechaCobroInput.disabled = false;
        fechaPagoInput.disabled = false;
        
        if (!fechaCobroInput.value) fechaCobroInput.value = hoy;
        if (!fechaPagoInput.value) fechaPagoInput.value = hoy;
        
        console.log(`✅ [${albaranId}] Campos desbloqueados`);
    } else {
        checkbox.checked = false;
        fechaCobroInput.disabled = true;
        fechaPagoInput.disabled = true;
        console.log(`🔒 [${albaranId}] Campos bloqueados`);
    }

    cobradoDisplay.innerHTML = UI.getBooleanHtml(isChecked);
    saveCobroState(albaranId, isChecked);
}

// =================================================================================
// 💾 FUNCIONES DE GUARDADO
// =================================================================================
async function saveCobroState(id, isPaid) {
    console.log(`💾 [SAVE STATE ${id}] cobrado=${isPaid ? 1 : 0}`);
    
    const payload = { 
        id: parseInt(id),
        cobrado: isPaid ? 1 : 0,
        pagado: isPaid ? 1 : 0
    };
    
    if (!isPaid) {
        payload.fecha_cobro = null;
        payload.fecha_pago = null;
    }
    
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
            albaran.cobrado = isPaid ? 1 : 0;
            albaran.pagado = isPaid ? 1 : 0;
            
            if (!isPaid) {
                albaran.fecha_cobro = null;
                albaran.fecha_pago = null;
            }
            
            // Si el filtro actual es cobrado=0 y acabamos de marcar como cobrado,
            // debemos recargar la tabla para que desaparezca
            if (isPaid && APP.state.currentFilters.cobrado === 0) {
                console.log(`🔄 Albarán #${id} marcado como cobrado, recargando tabla...`);
                setTimeout(() => {
                    API.searchAlbaranes(APP.state.currentFilters);
                }, 500);
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

async function saveFechaCobro(id, fecha) {
    console.log(`💾 [SAVE FECHA COBRO ${id}] fecha=${fecha}`);
    
    const payload = { 
        id: parseInt(id),
        fecha_cobro: fecha || null,
        cobrado: 1,
        pagado: 1
    };
    
    console.log(`📤 [SAVE FECHA COBRO ${id}] Payload:`, payload);

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
            albaran.fecha_cobro = fecha;
            albaran.cobrado = 1;
            albaran.pagado = 1;
            
            // Si el filtro actual es cobrado=0, recargar tabla
            if (APP.state.currentFilters.cobrado === 0) {
                console.log(`🔄 Fecha cobro actualizada para #${id}, recargando tabla...`);
                setTimeout(() => {
                    API.searchAlbaranes(APP.state.currentFilters);
                }, 500);
            } else {
                DOM.renderResults();
            }
        }

        UI.alertMessage(`✅ Fecha cobro #${id}: ${fecha}`, 'success');
    } catch (error) {
        console.error(`❌ [SAVE FECHA COBRO ${id}]`, error);
        UI.alertMessage(`❌ Error fecha cobro #${id}: ${error.message}`, 'error');
    }
}

async function saveFechaPago(id, fecha) {
    console.log(`💾 [SAVE FECHA PAGO ${id}] fecha=${fecha}`);
    
    const payload = { 
        id: parseInt(id),
        fecha_pago: fecha || null,
        pagado: 1,
        cobrado: 1
    };
    
    console.log(`📤 [SAVE FECHA PAGO ${id}] Payload:`, payload);

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
            albaran.fecha_pago = fecha;
            albaran.pagado = 1;
            albaran.cobrado = 1;
            
            // Si el filtro actual es cobrado=0, recargar tabla
            if (APP.state.currentFilters.cobrado === 0) {
                console.log(`🔄 Fecha pago actualizada para #${id}, recargando tabla...`);
                setTimeout(() => {
                    API.searchAlbaranes(APP.state.currentFilters);
                }, 500);
            } else {
                DOM.renderResults();
            }
        }

        UI.alertMessage(`✅ Fecha pago #${id}: ${fecha}`, 'success');
    } catch (error) {
        console.error(`❌ [SAVE FECHA PAGO ${id}]`, error);
        UI.alertMessage(`❌ Error fecha pago #${id}: ${error.message}`, 'error');
    }
}

// =================================================================================
// 🔥 BULK PAY - CON RECARGA AUTOMÁTICA
// =================================================================================
async function handleBulkPay() {
    console.log('🚀 [BULK PAY] Botón clickeado');
    
    const checkboxes = document.querySelectorAll('#albaranResults .cobro-checkbox:checked');
    const ids = Array.from(checkboxes).map(cb => parseInt(cb.closest('tr').dataset.id));
    
    console.log(`📋 [BULK] IDs: [${ids.join(', ')}] (${ids.length})`);
    
    if (ids.length === 0) {
        return UI.alertMessage('❌ Seleccione albaranes', 'info');
    }

    const albaranes = ids.map(id => APP.state.filteredAlbaranes.find(a => a.id === id)).filter(Boolean);
    const total = albaranes.reduce((sum, a) => sum + parseFloat(a.importe_total || 0), 0).toFixed(2);
    const hoy = new Date().toISOString().split('T')[0];
    
    // Obtener fechas de cada fila
    const albaranesConFechas = ids.map(id => {
        const row = document.querySelector(`tr[data-id="${id}"]`);
        const fechaCobroInput = row?.querySelector('.fecha-cobro-input');
        const fechaPagoInput = row?.querySelector('.fecha-pago-input');
        
        return {
            id,
            fecha_cobro: fechaCobroInput?.value || hoy,
            fecha_pago: fechaPagoInput?.value || hoy
        };
    });
    
    console.log('[BULK] Albaranes con fechas:', albaranesConFechas);
    
    // Validar fechas
    const fechasInvalidas = albaranesConFechas.filter(a => {
        if (a.fecha_cobro && a.fecha_pago) {
            return new Date(a.fecha_pago) < new Date(a.fecha_cobro);
        }
        return false;
    });
    
    if (fechasInvalidas.length > 0) {
        const errores = fechasInvalidas.map(a => 
            `#${a.id}: Cobro ${a.fecha_cobro} > Pago ${a.fecha_pago}`
        ).join('\n');
        
        UI.alertMessage(`❌ Fechas inválidas:\n${errores}\n\nLa fecha de pago no puede ser anterior a la de cobro.`, 'error');
        return;
    }
    
    const confirmMsg = `🔥 COBRO MASIVO ${ids.length} albaranes\n💰 €${total}\n\n¿Confirmar cobro?`;
    if (!confirm(confirmMsg)) return;

    try {
        UI.showLoading('Procesando cobro masivo...');
        UI.alertMessage('⏳ Procesando cobro masivo...', 'info');
        
        // Usar bulk-pay del backend
        const payload = { 
            ids: ids,
            fecha_cobro: hoy,
            fecha_pago: hoy
        };
        
        console.log('[BULK] Usando endpoint bulk-pay:', payload);
        
        const response = await fetch('/api/v1/albaranes/bulk-pay', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        console.log('[BULK] Resultado:', result);

        if (!response.ok) {
            throw new Error(result.error || 'Error servidor');
        }

        // ✅ RECARGAR TABLA DESPUÉS DEL COBRO
        console.log('[BULK] Recargando tabla con filtros actuales...');
        
        // Recargar desde servidor con los mismos filtros
        await API.searchAlbaranes(APP.state.currentFilters);
        
        const mensaje = `✅ ${result.updated || ids.length} albaranes cobrados\n`;
        mensaje += `💰 Importe total: ${UI.formatCurrency(total)}`;
        
        UI.alertMessage(mensaje, 'success');
        
    } catch (error) {
        console.error('[BULK] Error:', error);
        UI.alertMessage(`❌ ${error.message}`, 'error');
    }
}

// =================================================================================
// 🌐 API SERVICES
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
        } catch (e) {
            console.error('Empresas error:', e);
        }
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
        } catch (e) {
            console.error('Licencias error:', e);
        }
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
            
            console.log('[SEARCH] Parámetros enviados:', params.toString());
            
            const res = await fetch(`/api/v1/albaranes/search?${params}`);
            const data = await res.json();
            const albaranes = data.data || [];
            
            console.log(`[SEARCH] ${albaranes.length} albaranes recibidos`);
            
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
// 🖼️ DOM RENDER
// =================================================================================
const DOM = {
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
            row.className = `${albaran.id % 2 ? 'bg-gray-50' : 'bg-white'} hover:bg-blue-50`;

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
                           title="Fecha de cobro (puede ser diferente a fecha de pago)">
                </td>
                <td class="px-4 py-2">
                    <input type="date" class="fecha-pago-input w-28 p-1 border rounded text-sm" 
                           value="${fPago}" ${isCobrado ? '' : 'disabled'}
                           onchange="saveFechaPago(${albaran.id}, this.value)"
                           title="Fecha de pago (debe ser igual o posterior a fecha de cobro)">
                </td>
                <td class="px-4 py-2 text-sm text-gray-600 max-w-xs truncate">${albaran.observaciones_admin || '-'}</td>
            `;
            tbody.appendChild(row);
        });
        
        UI.updatePageInfo();
        UI.updatePaginationButtons();
        if (window.lucide) window.lucide.createIcons();
    }
};

// =================================================================================
// 🎯 EVENTOS
// =================================================================================
const Events = {
    init() {
        // Paginación
        document.getElementById('recordsPerPage')?.addEventListener('change', (e) => {
            APP.state.pageSize = e.target.value === '9999' ? 9999 : +e.target.value;
            APP.state.currentPage = 1;
            DOM.renderResults();
        });
        
        document.getElementById('prevPageBtn')?.addEventListener('click', () => {
            if (APP.state.currentPage > 1) {
                APP.state.currentPage--;
                DOM.renderResults();
            }
        });
        
        document.getElementById('nextPageBtn')?.addEventListener('click', () => {
            if (APP.state.currentPage < APP.state.totalPages) {
                APP.state.currentPage++;
                DOM.renderResults();
            }
        });
        
        APP.elements.searchForm?.addEventListener('submit', (e) => {
            e.preventDefault();
            API.searchAlbaranes(Filters.getFiltersFromForm());
        });
        
        // Botón para recargar manualmente
        document.getElementById('reloadBtn')?.addEventListener('click', () => {
            API.searchAlbaranes(APP.state.currentFilters);
            UI.alertMessage('🔄 Recargando datos...', 'info');
        });
        
        window.sortTable = Filters.sortTable;
    }
};

// =================================================================================
// 🚀 INICIALIZACIÓN
// =================================================================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 admin_pago_emp.js CARGADO - Filtra por cobrado=0 correctamente');
    
    // Funciones globales
    window.handleBulkPay = handleBulkPay;
    window.handleCobroToggle = handleCobroToggle;
    window.saveCobroState = saveCobroState;
    window.saveFechaCobro = saveFechaCobro;
    window.saveFechaPago = saveFechaPago;
    
    // Cargar datos
    await Promise.all([API.loadEmpresas(), API.loadLicencias()]);
    Events.init();
    
    // Cargar inicialmente PENDIENTES (cobrado=0)
    const initialFilters = Filters.getFiltersFromForm();
    // Asegurar que por defecto sea cobrado=0
    if (!initialFilters.hasOwnProperty('cobrado')) {
        initialFilters.cobrado = 0;
    }
    await API.searchAlbaranes(initialFilters);
    
    console.log('✅ Sistema listo - Filtra por cobrado=0 (pendientes)');
});

// Utilidades UI
window.toggleDropdown = (btn) => {
    const dropdown = btn.closest('.dropdown');
    document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('active'));
    dropdown?.classList.toggle('active');
};