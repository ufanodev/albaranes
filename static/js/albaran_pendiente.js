// Archivo: static/js/albaran_pendiente.js (Renombrado Lógicamente a albaran_enviado.js si se usa para Enviados)

// =================================================================================
// 🖼️ DOM RENDER & EVENTS (CORREGIDO PARA 10 COLUMNAS SIN CHECKBOX)
// =================================================================================

const DOM = {
    showLoading() {
        if (RESULTS_BODY) {
            RESULTS_BODY.innerHTML = `
                <tr>
                    <td colspan="10" class="text-center py-12">
                        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
                        Buscando albaranes pendientes...
                    </td>
                </tr>`;
        }
    },

    showNoResults() {
    if (RESULTS_BODY) {
        RESULTS_BODY.innerHTML = `
        <tr>
            <td colspan="10" class="text-center py-12 text-orange-500 font-semibold">
            🎉 No tiene albaranes pendientes.
            </td>
        </tr>`;
    }
    if (ALBARAN_TOTAL) ALBARAN_TOTAL.innerHTML = '';
    updatePaginationUI();
    },


    renderResults() {
        if (!RESULTS_BODY) return;
        
        RESULTS_BODY.innerHTML = '';
        
        updatePaginationUI();
        
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const pageData = currentData.slice(startIndex, endIndex);
        
        if (pageData.length === 0) {
            return DOM.showNoResults();
        }

        let totalImporte = 0;
        pageData.forEach(albaran => {
            const importe = parseFloat(albaran.importe_total || albaran.ImporteTotal || 0); 
            totalImporte += importe;

            const id = albaran.ID || albaran.id;
            const num = albaran.numero_albaran || albaran.NumeroAlbaran || id;
            const fecha = albaran.fecha || albaran.Fecha;
            const ref = albaran.referencia || albaran.Referencia || '-';
            const obs = albaran.observaciones || albaran.Observaciones || '-';
            
            const licCode = albaran.LicenciaData?.licencia || albaran.licencia_ref || 'N/A';
            const empName = albaran.EmpresaData?.nombre || 'N/A';

            let conductor = albaran.asalariado || 'Titular';
            if (albaran.asalariado || albaran.Asalariado) conductor = albaran.asalariado || albaran.Asalariado;
            else if (albaran.LicenciaData?.nombre) conductor = albaran.LicenciaData.nombre;

            const row = `
                <tr class="hover:bg-yellow-50 transition duration-150">
                                        <td class="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900">${num}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${formatDate(fecha)}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-blue-600 font-medium">${licCode}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-800">${empName}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${ref}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">${conductor}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-semibold text-right">€${importe.toFixed(2)}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm">${getStateHtml(albaran)}</td>
                    <td class="px-4 py-3 text-sm text-gray-500 max-w-xs truncate" title="${obs}">${obs}</td>
                    
                    <td class="px-4 py-3 whitespace-nowrap text-center text-sm font-medium">
                        <div class="flex justify-center items-center space-x-4">
                            <a href="/titulares/view/${id}" title="Ver detalle" class="text-blue-500 hover:text-blue-700 p-1 transition transform hover:scale-110">
                                <i data-lucide="eye" class="h-4 w-4"></i>
                            </a>
                            <a href="/titulares/update/${id}" title="Editar" class="text-orange-500 hover:text-orange-700 p-1 transition transform hover:scale-110">
                                <i data-lucide="pencil" class="h-4 w-4"></i>
                            </a>
                        </div>
                    </td>
                </tr>`;
            
            RESULTS_BODY.insertAdjacentHTML('beforeend', row);
        });

        // Pie de tabla con total
        if (ALBARAN_TOTAL) {
            // CORREGIDO: Colspan 7 (para las 7 primeras columnas) + 1 (Importe) + 2 (Estado/Obs) = 10 columnas
            ALBARAN_TOTAL.innerHTML = `
                <tr class="bg-gray-50 font-bold">
                    <td colspan="7" class="px-4 py-3 text-right text-gray-700">TOTAL PENDIENTE (${currentData.length} registros)</td>
                    <td class="px-4 py-3 text-right text-xl font-black text-emerald-600">€${totalImporte.toFixed(2)}</td>
                    <td colspan="2" class="px-4 py-3"></td>
                </tr>`;
        }
        
        // Ya no hay selectAll
        updateSortIcons();
        if (window.lucide) window.lucide.createIcons();
    }
};

const Events = {
    // ... (El resto de Events se mantiene) ...
    handlePageChange(delta) {
        if ((currentPage + delta) >= 1 && (currentPage + delta) <= totalPages) {
            currentPage += delta;
            DOM.renderResults();
        }
    },

    handleRecordsChange() {
        const select = RECORDS_PER_PAGE_SELECT;
        const value = select.value;

        if (value === 'todos') {
            pageSize = currentData.length || 10;
        } else {
            pageSize = parseInt(value);
        }
        currentPage = 1;
        DOM.renderResults();
    },

    // 🚀 BÚSQUEDA ACOTADA (Simplemente recarga con el filtro de texto si existe)
    handleBusquedaAcotada(e) {
        if (e) e.preventDefault();
        
        let filters = {};
        const form = document.getElementById('searchForm'); 
        if (form) {
             const formData = new FormData(form);
             filters = Object.fromEntries(formData.entries());
        }

        loadAlbaranes(filters);
    },
    
    // 🚀 ENVÍO MASIVO (Lógica principal)
    async handleEnviarSeleccionados() {
        // La funcionalidad de envío masivo YA NO ES NECESARIA en esta vista (Enviados), 
        // pero la dejamos con un placeholder por si se re-usa en la vista Pendientes.
        const checkboxes = document.querySelectorAll('.select-albaran:checked');
        const ids = Array.from(checkboxes).map(cb => parseInt(cb.value));
        // ... (resto de la lógica de envío)
        alertMessage('La función de envío masivo no está activa en esta vista.', 'info');
        // ...
    },
    
    // Inicializar select, paginación y checkboxes
    init() {
        if (RECORDS_PER_PAGE_SELECT) RECORDS_PER_PAGE_SELECT.addEventListener('change', this.handleRecordsChange);
        if (PREV_BTN) PREV_BTN.addEventListener('click', () => this.handlePageChange(-1));
        if (NEXT_BTN) NEXT_BTN.addEventListener('click', () => this.handlePageChange(1));
        
        // No hay checkbox selectAll en el HTML, pero la lógica se mantiene por si se añade.
    }
};


// =================================================================================
// 🚀 INICIALIZACIÓN GLOBAL
// =================================================================================

// Exponer funciones necesarias para el HTML
window.loadAlbaranes = loadAlbaranes; 
window.sortTable = sortTable; 
window.handleEnviarSeleccionados = Events.handleEnviarSeleccionados;
window.handleBusquedaAcotada = Events.handleBusquedaAcotada;


document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Iniciando aplicación de albaranes pendientes...');
    
    // 1. Inicializar eventos (paginación, select)
    Events.init();
    
    // 2. Inicializar sesión del usuario y cargar licencia
    const hasSession = await fetchUserLicense();
    if (!hasSession) {
        DOM.showNoResults();
        alertMessage('No se pudo cargar la sesión del usuario.', 'error');
        return;
    }
    
    // 3. Cargar datos iniciales (Albaranes Pendientes)
    await loadAlbaranes(); 
    
    console.log('✅ Aplicación lista');
});