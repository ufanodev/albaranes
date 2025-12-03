// Archivo: static/js/busqueda.js
// ✅ FIX: Paginación CLIENT-SIDE + recordsSelect MUESTRA el número correcto

const APP = {
    elements: {
        resultsBody: document.getElementById('albaranResults'),
        totalRow: document.getElementById('albaranTotal'),
        recordsSelect: document.getElementById('recordsPerPage'),
        statusMessage: document.getElementById('statusMessage'),
        searchForm: document.getElementById('searchForm'),
        licenciaInput: document.getElementById('licencia'),
        empresaSelect: document.getElementById('empresa')
    },
    state: {
        currentData: [],        // ✅ TODOS los albaranes filtrados
        filteredData: [],       // ✅ Datos después de filtros
        currentLicenciaRef: 0,
        currentPage: 1,
        totalAlbaranesLicencia: 0
    },
    constants: {
        TOTAL_COLUMNS: 10,
        ALL_RECORDS: 1000       // ✅ Pide TODOS al backend
    }
};

const UI = {
    formatDate(isoString) { return isoString ? isoString.substring(0, 10) : '-'; },
    
    getStateHtml(enviado, cobrado, pagado) {
        if (cobrado) return `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-200 text-green-800">Cobrado</span>`;
        if (enviado) return `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-200 text-blue-800">Enviado</span>`;
        return `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-200 text-gray-700">Creado</span>`;
    },

    alertMessage(message, type = 'info') {
        const { statusMessage } = APP.elements;
        if (!statusMessage) return;
        statusMessage.textContent = message;
        statusMessage.className = `status-message ${type === 'success' ? 'status-success' : type === 'error' ? 'status-error' : 'status-info'}`;
        statusMessage.classList.remove('hidden');
        setTimeout(() => statusMessage.classList.add('hidden'), 4000);
    }
};

const Data = {
    filterByLicencia(data, licenciaRef) {
        return data.filter(item => 
            item.licencia_ref == licenciaRef || 
            item.LicenciaData?.licencia == licenciaRef
        );
    },

    getFiltersFromForm() {
        const formData = new FormData(APP.elements.searchForm);
        const filters = Object.fromEntries(formData.entries());
        
        const mappedFilters = {
            licencia_ref: APP.state.currentLicenciaRef.toString(),
            empresa_ref: filters.empresa_ref || '',
            state: filters.state || '',
            referencia: filters.referencia || '',
            fecha_ini: filters.fecha_desde || filters.fecha_ini || '',
            fecha_fin: filters.fecha_hasta || filters.fecha_fin || ''
        };
        
        Object.keys(mappedFilters).forEach(key => {
            if (!mappedFilters[key]) delete mappedFilters[key];
        });
        
        return mappedFilters;
    }
};

const API = {
    // ✅ PIDE TODOS los albaranes (sin limit)
    async loadAllAlbaranes(filters = {}) {
        if (APP.state.currentLicenciaRef === 0) return;

        DOM.showLoading();

        try {
            let apiPath = `/api/v1/albaranes/search?licencia_ref=${APP.state.currentLicenciaRef}&page=1&pageSize=${APP.constants.ALL_RECORDS}`;
            
            if (filters.empresa_ref) apiPath += `&empresa_ref=${filters.empresa_ref}`;
            if (filters.state) apiPath += `&state=${encodeURIComponent(filters.state)}`;
            if (filters.referencia) apiPath += `&referencia=${encodeURIComponent(filters.referencia)}`;
            if (filters.fecha_ini) apiPath += `&fecha_ini=${filters.fecha_ini}`;
            if (filters.fecha_fin) apiPath += `&fecha_fin=${filters.fecha_fin}`;

            console.log('🚀 CARGANDO TODOS:', apiPath);

            const response = await fetch(apiPath);
            if (response.status === 401) {
                window.location.href = '/login';
                return;
            }

            const data = await response.json();
            console.log('📦 TOTAL API:', data.data?.length || 0);
            
            // ✅ FILTRA solo mi licencia
            APP.state.currentData = Data.filterByLicencia(data.data || [], APP.state.currentLicenciaRef);
            APP.state.totalAlbaranesLicencia = APP.state.currentData.length;
            
            console.log('✅ MÍOS:', APP.state.currentData.length);
            DOM.renderPage(1); // ✅ Renderiza página 1
            
        } catch (error) {
            console.error('Error:', error);
            UI.alertMessage(`Error: ${error.message}`, 'error');
        }
    },

    async initUserSession() {
        try {
            const response = await fetch('/api/v1/user/licencia_ref');
            const { licencia_ref } = await response.json();
            APP.state.currentLicenciaRef = parseInt(licencia_ref);
            APP.elements.licenciaInput.value = APP.state.currentLicenciaRef;
            return true;
        } catch (error) {
            console.error('Sesión:', error);
            return false;
        }
    }
};

const DOM = {
    showLoading() {
        const tbody = APP.elements.resultsBody;
        if (tbody) tbody.innerHTML = '<tr><td colspan="10" class="text-center py-8">🔄 Cargando TODOS los albaranes...</td></tr>';
    },

    renderPage(page = 1) {
        const pageSize = parseInt(APP.elements.recordsSelect.value) || 10;
        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        const pageData = APP.state.currentData.slice(start, end);
        
        APP.state.currentPage = page;
        
        DOM.renderAlbaranes(pageData);
        DOM.updatePagination(page, Math.ceil(APP.state.currentData.length / pageSize));
        UI.alertMessage(`Página ${page} - ${pageData.length}/${APP.state.currentData.length} albaranes`, 'success');
    },

    updatePagination(currentPage, totalPages) {
        // ✅ Actualiza "Todos (X)" en recordsSelect
        const todosOption = Array.from(APP.elements.recordsSelect.options).find(opt => opt.value === 'todos');
        if (todosOption) {
            todosOption.textContent = `Todos (${APP.state.currentData.length})`;
        }
    },

    renderAlbaranes(data) {
        const tbody = APP.elements.resultsBody;
        const tfoot = APP.elements.totalRow;
        
        tbody.innerHTML = '';
        let totalImporte = 0;

        if (!data?.length) {
            tbody.innerHTML = '<tr><td colspan="10" class="text-center py-12 text-orange-500">No hay albaranes</td></tr>';
            return;
        }

        data.forEach(item => {
            const importe = parseFloat(item.importe_total || 0);
            totalImporte += importe;

            const row = `
                <tr class="hover:bg-gray-50 border-b">
                    <td class="px-4 py-3 font-mono font-semibold">${item.numero_albaran}</td>
                    <td class="px-4 py-3 text-sm">${UI.formatDate(item.fecha)}</td>
                    <td class="px-4 py-3 text-sm font-bold text-blue-600">${item.LicenciaData?.licencia || item.licencia_ref}</td>
                    <td class="px-4 py-3 text-sm">${item.EmpresaData?.nombre || 'N/A'}</td>
                    <td class="px-4 py-3 text-sm">${item.referencia || '-'}</td>
                    <td class="px-4 py-3 text-sm">${item.asalariado || 'Titular'}</td>
                    <td class="px-4 py-3 text-right font-bold text-green-600">€${importe.toFixed(2)}</td>
                    <td class="px-4 py-3 text-sm">${UI.getStateHtml(item.enviado, item.cobrado, item.pagado)}</td>
                    <td class="px-4 py-3 text-sm max-w-xs truncate" title="${item.observaciones}">${item.observaciones || '-'}</td>
                    <td class="px-4 py-3 text-center">
                        <div class="flex space-x-2">
                            <a href="/titulares/view/${item.id}" class="p-2 hover:bg-blue-50 rounded text-blue-500" title="Ver">
                                <i data-lucide="eye" class="h-4 w-4"></i>
                            </a>
                            <a href="/titulares/update/${item.id}" class="p-2 hover:bg-orange-50 rounded text-orange-500" title="Editar">
                                <i data-lucide="pencil" class="h-4 w-4"></i>
                            </a>
                        </div>
                    </td>
                </tr>`;
            tbody.insertAdjacentHTML('beforeend', row);
        });

        if (tfoot) {
            tfoot.innerHTML = `
                <tr class="bg-gradient-to-r from-emerald-50 to-green-50 border-t-4 border-emerald-200">
                    <td colspan="6" class="text-right font-bold text-xl">TOTAL</td>
                    <td class="text-right text-2xl font-black text-emerald-600">€${totalImporte.toFixed(2)}</td>
                    <td colspan="3" class="text-center text-sm">Página ${APP.state.currentPage}</td>
                </tr>`;
        }

        window.lucide?.createIcons();
    }
};

const Events = {
    async handleSearch(e) {
        if (e) e.preventDefault();
        const filters = Data.getFiltersFromForm();
        await API.loadAllAlbaranes(filters); // ✅ Recarga TODOS con filtros
    },

    handleRecordsChange() {
        DOM.renderPage(1); // ✅ Renderiza página 1 con nuevo pageSize
    },

    init() {
        const { searchForm, recordsSelect } = APP.elements;
        
        // ✅ recordsSelect CORRECTO
        if (recordsSelect) {
            recordsSelect.innerHTML = `
                <option value="10" selected>10</option>
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="todos">Todos (calculando...)</option>
            `;
            recordsSelect.addEventListener('change', Events.handleRecordsChange);
        }
        
        if (searchForm) {
            searchForm.addEventListener('submit', Events.handleSearch);
        }
    }
};

// 🚀 INIT
document.addEventListener('DOMContentLoaded', async () => {
    Events.init();
    
    const hasSession = await API.initUserSession();
    if (hasSession) {
        await API.loadAllAlbaranes({}); // ✅ Carga inicial TODOS
    }
});

window.handleSearch = Events.handleSearch;
