// Archivo: static/js/busqueda.js
// ✅ FIJADO: Renderiza estructura REAL del backend + solo licencia logueada

// =================================================================================
// 🎛️ CONFIGURACIÓN
// =================================================================================
const APP = {
    elements: {
        resultsBody: document.getElementById('albaranResults'),
        totalRow: document.getElementById('albaranTotal'),
        recordsSelect: document.getElementById('recordsPerPage'),
        statusMessage: document.getElementById('statusMessage'),
        searchForm: document.getElementById('searchForm')
    },
    state: {
        currentData: [],
        currentLicenciaRef: 0
    },
    constants: {
        TOTAL_COLUMNS: 10,
        INITIAL_PAGE_SIZE: 10
    }
};

// =================================================================================
// 🎨 UI HELPERS
// =================================================================================
const UI = {
    formatDate(isoString) {
        return isoString ? isoString.substring(0, 10) : '-';
    },

    getStateHtml(enviado, cobrado, pagado) {
        if (cobrado) return `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-200 text-green-800">Cobrado</span>`;
        if (enviado) return `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-200 text-blue-800">Enviado</span>`;
        return `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-200 text-gray-700">Creado</span>`;
    },

    alertMessage(message, type = 'info') {
        const { statusMessage } = APP.elements;
        if (!statusMessage) return;
        statusMessage.textContent = message;
        statusMessage.className = 'status-message';
        const classes = { success: 'status-success', error: 'status-error', info: 'status-info' };
        statusMessage.classList.add(classes[type] || classes.info);
        statusMessage.classList.remove('hidden');
        setTimeout(() => statusMessage.classList.add('hidden'), 3000);
    }
};

// =================================================================================
// 🔍 DATA PROCESSING
// =================================================================================
const Data = {
    getFiltersFromForm() {
        const { searchForm } = APP.elements;
        if (!searchForm) return {};
        const formData = new FormData(searchForm);
        const filters = Object.fromEntries(formData.entries());
        console.log('📋 FILTROS:', filters);
        return filters;
    },

    // ✅ FILTRA CLIENT-SIDE solo licencia logueada (temporal)
    filterByLicencia(data, licenciaRef) {
        return data.filter(item => 
            (item.licencia_ref == licenciaRef) || 
            (item.LicenciaData?.licencia == licenciaRef)
        );
    }
};

// =================================================================================
// 🌐 API
// =================================================================================
const API = {
    async loadAlbaranes(filters = {}, pageSize = 10, page = 1) {
        if (APP.state.currentLicenciaRef === 0) return;

        DOM.showLoading();

        try {
            let apiPath = `/api/v1/albaranes/search?licencia_ref=${APP.state.currentLicenciaRef}&page=${page}&pageSize=${pageSize}`;
            
            if (filters.empresa_ref) apiPath += `&empresa_ref=${filters.empresa_ref}`;
            if (filters.referencia) apiPath += `&referencia=${encodeURIComponent(filters.referencia)}`;
            if (filters.state) apiPath += `&state=${encodeURIComponent(filters.state)}`;
            if (filters.fecha_ini) apiPath += `&fecha_ini=${filters.fecha_ini}`;
            if (filters.fecha_fin) apiPath += `&fecha_fin=${filters.fecha_fin}`;

            console.log('🚀 API:', apiPath);

            const response = await fetch(apiPath);
            if (response.status === 401) {
                window.location.href = '/login';
                return;
            }
            const data = await response.json();
            
            // ✅ FILTRA solo albaranes de MI licencia (temporal)
            const myAlbaranes = Data.filterByLicencia(data.data || [], APP.state.currentLicenciaRef);
            
            console.log('🔍 TOTAL API:', data.data?.length, '→ MÍOS:', myAlbaranes.length);
            
            APP.state.currentData = myAlbaranes.slice(0, pageSize); // ✅ 10 primeros
            DOM.renderAlbaranes(APP.state.currentData);
            
        } catch (error) {
            console.error('Error:', error);
            UI.alertMessage(`Error: ${error.message}`, 'error');
        }
    },

    async initUserSession() {
        try {
            const response = await fetch('/api/v1/user/licencia_ref');
            if (!response.ok) throw new Error('Error sesión');
            const { licencia_ref } = await response.json();
            APP.state.currentLicenciaRef = licencia_ref;
            const licInput = document.getElementById('licencia');
            if (licInput) licInput.value = licencia_ref;
            return licencia_ref > 0;
        } catch (error) {
            console.error('Error:', error);
            return false;
        }
    }
};

// =================================================================================
// 🖼️ DOM RENDER (FIJADO para tu estructura REAL)
// =================================================================================
const DOM = {
    showLoading() {
        const { resultsBody } = APP.elements;
        if (resultsBody) resultsBody.innerHTML = '<tr><td colspan="10" class="text-center py-6">Cargando...</td></tr>';
    },

    renderAlbaranes(data) {
        const { resultsBody, totalRow } = APP.elements;
        if (!resultsBody) return;

        resultsBody.innerHTML = '';
        let totalImporte = 0;

        if (!data?.length) {
            resultsBody.innerHTML = '<tr><td colspan="10" class="text-center py-6 text-gray-500">No hay albaranes</td></tr>';
            return;
        }

        data.forEach((item, index) => {
            const importe = parseFloat(item.importe_total || 0);
            totalImporte += importe;

            // ✅ ESTRUCTURA REAL de tu backend
            const numeroAlbaran = item.numero_albaran;
            const fecha = UI.formatDate(item.fecha);
            const licencia = item.LicenciaData?.licencia || item.licencia_ref;
            const empresa = item.EmpresaData?.nombre || 'N/A';
            const referencia = item.referencia || '-';
            const conductor = item.asalariado || item.LicenciaData?.nombre || 'Titular';
            const id = item.id || item.ID;

            const row = `
                <tr class="hover:bg-gray-100 transition duration-150">
                    <td class="px-4 py-3 text-sm font-medium text-gray-900">${numeroAlbaran}</td>
                    <td class="px-4 py-3 text-sm text-gray-500">${fecha}</td>
                    <td class="px-4 py-3 text-sm text-gray-700">${licencia}</td>
                    <td class="px-4 py-3 text-sm text-gray-500">${empresa}</td>
                    <td class="px-4 py-3 text-sm text-gray-500">${referencia}</td>
                    <td class="px-4 py-3 text-sm text-gray-600">${conductor}</td>
                    <td class="px-4 py-3 text-sm text-gray-900 font-semibold text-right">€${importe.toFixed(2)}</td>
                    <td class="px-4 py-3 text-sm">${UI.getStateHtml(item.enviado, item.cobrado, item.pagado)}</td>
                    <td class="px-4 py-3 text-sm text-gray-500 max-w-xs truncate" title="${item.observaciones}">${item.observaciones || '-'}</td>
                    <td class="px-4 py-3 text-center">
                        <div class="flex justify-center space-x-2">
                            <a href="/titulares/view/${id}" class="text-blue-500 hover:text-blue-700 p-2" title="Ver">
                                <i data-lucide="eye" class="h-5 w-5"></i>
                            </a>
                            <a href="/titulares/update/${id}" class="text-orange-500 hover:text-orange-700 p-2" title="Editar">
                                <i data-lucide="pencil" class="h-5 w-5"></i>
                            </a>
                        </div>
                    </td>
                </tr>`;
            resultsBody.insertAdjacentHTML('beforeend', row);
        });

        // Total
        if (totalRow) {
            totalRow.innerHTML = `
                <tr class="total-row bg-gray-50 font-bold border-t-2 border-gray-200">
                    <td colspan="6" class="px-4 py-3 text-right font-semibold text-lg">TOTAL</td>
                    <td class="px-4 py-3 text-right text-xl font-bold text-green-600">€${totalImporte.toFixed(2)}</td>
                    <td colspan="3"></td>
                </tr>`;
        }

        window.lucide?.createIcons();
        UI.alertMessage(`Mostrando ${data.length} albaranes de licencia ${APP.state.currentLicenciaRef}`, 'success');
    }
};

// =================================================================================
// 🎯 EVENTOS
// =================================================================================
const Events = {
    async handleSearch(e) {
        e.preventDefault();
        const filters = Data.getFiltersFromForm();
        const pageSize = parseInt(APP.elements.recordsSelect?.value) || 20;
        await API.loadAlbaranes(filters, pageSize, 1);
    },

    init() {
        const { searchForm, recordsSelect } = APP.elements;
        if (searchForm) searchForm.addEventListener('submit', Events.handleSearch);
        if (recordsSelect) recordsSelect.addEventListener('change', Events.handleSearch);
    }
};

// =================================================================================
// 🚀 INIT
// =================================================================================
document.addEventListener('DOMContentLoaded', async () => {
    const hasSession = await API.initUserSession();
    if (hasSession) {
        // ✅ CARGA INICIAL: 10 ÚLTIMOS de MI licencia
        await API.loadAlbaranes({}, APP.constants.INITIAL_PAGE_SIZE, 1);
    }
    Events.init();
});

window.handleSearch = Events.handleSearch;
