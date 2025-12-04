// Archivo: static/js/albaran_pendiente.js
// Lógica ESPECÍFICA para "Pendientes" (state=creado / No Enviados).

const RESULTS_BODY = document.getElementById('albaranResults');
const ALBARAN_TOTAL = document.getElementById('albaranTotal');
const RECORDS_PER_PAGE_SELECT = document.getElementById('recordsPerPage');
const STATUS_MESSAGE = document.getElementById('statusMessage');
const PAGE_INFO = document.getElementById('pageInfo');
const TOTAL_LABEL = document.getElementById('totalLabel');
const PREV_BTN = document.getElementById('prevPageBtn');
const NEXT_BTN = document.getElementById('nextPageBtn');

// Estado local
let currentData = [];
let currentLicenciaRef = 0; 
let currentPage = 1;
let pageSize = 20; // Valor inicial del select
let totalPages = 1;

let currentSortColumn = 'numero_albaran'; 
let currentSortDirection = 'asc'; 

// =================================================================================
// 📚 UTILIDADES
// =================================================================================

function formatDate(isoString) {
    if (!isoString) return '';
    return isoString.substring(0, 10);
}

function getStateHtml(albaran) {
    // Prioridad: Finalizado > Pagado/Cobrado > Enviado > Creado (Pendiente)
    if (albaran.finalizado) return `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-200 text-purple-800">Finalizado</span>`;
    if (albaran.cobrado || albaran.pagado) return `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-200 text-green-800">Pagado</span>`;
    if (albaran.enviado) return `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-200 text-blue-800">Enviado</span>`;
    
    // Si no ha llegado a Enviado, se considera Creado / Pendiente (amarillo)
    return `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800 border border-yellow-200">Creado</span>`;
}

function alertMessage(message, type) {
    if (!STATUS_MESSAGE) return;
    STATUS_MESSAGE.textContent = message;
    STATUS_MESSAGE.className = 'status-message';
    const alertClasses = { success: 'status-success', error: 'status-error', info: 'status-info' };
    STATUS_MESSAGE.classList.add(alertClasses[type] || alertClasses.info);
    STATUS_MESSAGE.classList.remove('hidden');
    setTimeout(() => STATUS_MESSAGE.classList.add('hidden'), 4000);
}

function updateSortIcons() {
    document.querySelectorAll('th i').forEach(icon => {
        icon.setAttribute('data-lucide', 'chevrons-up-down');
        icon.className = 'h-4 w-4 ml-1 inline-block text-gray-400';
    });
    const icon = document.getElementById(`sort-${currentSortColumn}`);
    if (icon) {
        const newIcon = currentSortDirection === 'asc' ? 'chevron-up' : 'chevron-down';
        icon.setAttribute('data-lucide', newIcon);
        icon.classList.remove('text-gray-400');
        icon.classList.add('text-blue-600');
        if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
    }
}

function updatePaginationUI() {
    pageSize = parseInt(RECORDS_PER_PAGE_SELECT.value);
    if (RECORDS_PER_PAGE_SELECT.value === 'todos') {
         pageSize = currentData.length || 1;
    }
    totalPages = Math.ceil(currentData.length / pageSize);

    if (PAGE_INFO) {
        PAGE_INFO.textContent = `Página ${currentPage} de ${totalPages || 1}`;
    }

    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, currentData.length);
    const showing = endIndex - startIndex;

    if (TOTAL_LABEL) {
        TOTAL_LABEL.textContent = `(${showing} de ${currentData.length} registros)`;
    }

    if (PREV_BTN) PREV_BTN.disabled = currentPage <= 1;
    if (NEXT_BTN) NEXT_BTN.disabled = currentPage >= totalPages;
}


// =================================================================================
// 🧠 LÓGICA DE CARGA Y RENDERIZADO
// =================================================================================

async function loadAlbaranes(filters = {}, pageSize = 20, page = 1) {
    if (currentLicenciaRef === 0) return;

    // Usamos loadPendientes para cargar todos los datos (delegando el filtro de estado al backend)
    // Nota: El backend en Go ya fue corregido para que el estado 'enviado' no incluya 'pagado'
    DOM.showLoading();
    
    // Filtros de estado fijo: Queremos 'creado' y 'enviado'
    const states = ['creado', 'enviado'];

    try {
        // 1. Recoger datos de ambos estados (creado y enviado)
        const allPromises = states.map(state => {
            let apiPath = `/api/v1/albaranes/search?licencia_ref=${currentLicenciaRef}&state=${state}&pageSize=5000`;
            
            // Si el HTML tiene filtros de búsqueda acotada, los añadimos aquí:
            if (filters.referencia) apiPath += `&referencia=${encodeURIComponent(filters.referencia)}`;
            // (Añadir otros filtros si fuera necesario)
            
            return fetch(apiPath).then(res => res.json()).then(resJson => resJson.data || []);
        });
        
        const results = await Promise.all(allPromises);
        
        // 2. Combinar resultados y filtrar duplicados
        let albaranes = results.flatMap(data => data);
        const uniqueAlbaranes = Array.from(new Map(albaranes.map(item => [item.id, item])).values());
        
        currentData = uniqueAlbaranes;
        
        // 3. Aplicar ordenación y paginación
        window.sortTable(currentSortColumn); // Ordena currentData
        
        if (currentData.length > 0) {
            alertMessage(`Se encontraron ${currentData.length} pendientes.`, 'success');
        } else {
            alertMessage(`🎉 No hay albaranes pendientes de envío.`, 'info');
        }
        
        // Renderiza la tabla (que usa currentData, currentPage, pageSize)
        DOM.renderResults(); 
        
    } catch (error) {
        console.error("Error al cargar pendientes:", error);
        alertMessage(`Error cargando: ${error.message}`, 'error');
        DOM.showNoResults();
    }
}


const DOM = {
    showLoading() {
        if (RESULTS_BODY) {
            RESULTS_BODY.innerHTML = `
                <tr>
                    <td colspan="11" class="text-center py-12">
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
                    <td colspan="11" class="text-center py-12 text-orange-500 font-semibold">
                        🎉 No hay albaranes pendientes de envío.
                    </td>
                </tr>`;
        }
        if (ALBARAN_TOTAL) ALBARAN_TOTAL.innerHTML = '';
        updatePaginationUI();
    },

    renderResults() {
        if (!RESULTS_BODY) return;
        
        RESULTS_BODY.innerHTML = '';
        
        // Ajustamos la paginación
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
            
            // Acceso a datos de relación (asumiendo que vienen precargados)
            const licCode = albaran.LicenciaData?.licencia || albaran.licencia_ref || 'N/A';
            const empName = albaran.EmpresaData?.nombre || 'N/A';

            let conductor = albaran.asalariado || 'Titular';
            if (albaran.asalariado || albaran.Asalariado) conductor = albaran.asalariado || albaran.Asalariado;
            else if (albaran.LicenciaData?.nombre) conductor = albaran.LicenciaData.nombre;

            const row = `
                <tr class="hover:bg-yellow-50 transition duration-150">
                    <td class="px-4 py-3 whitespace-nowrap text-center text-sm font-medium">
                        <input type="checkbox" value="${id}" class="select-albaran h-4 w-4 text-primary-link rounded border-gray-300 focus:ring-primary-link">
                    </td>
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
            ALBARAN_TOTAL.innerHTML = `
                <tr class="bg-gray-50 font-bold">
                    <td colspan="7" class="px-4 py-3 text-right text-gray-700">TOTAL PENDIENTE (${currentData.length} registros)</td>
                    <td class="px-4 py-3 text-right text-xl font-black text-emerald-600">€${totalImporte.toFixed(2)}</td>
                    <td colspan="3" class="px-4 py-3"></td>
                </tr>`;
        }
        
        // Resetear selectAll y actualizar iconos
        const selectAll = document.getElementById('selectAll');
        if (selectAll) selectAll.checked = false;
        
        updateSortIcons();
        if (window.lucide) window.lucide.createIcons();
    }
};

const Events = {
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
    
    // 🚀 ENVÍO MASIVO (Lógica principal)
    async handleEnviarSeleccionados() {
        const checkboxes = document.querySelectorAll('.select-albaran:checked');
        const ids = Array.from(checkboxes).map(cb => parseInt(cb.value));

        if (ids.length === 0) {
            alertMessage('⚠️ Seleccione al menos un albarán para enviar.', 'error'); 
            return;
        }

        if (!confirm(`¿Confirmar el envío de ${ids.length} albaranes? Pasarán a estado 'Enviado'.`)) {
            return;
        }

        alertMessage(`⏳ Procesando envío de ${ids.length} registros...`, 'info');

        try {
            const result = await API.bulkSend(ids);
            
            alertMessage(`✅ Envío completado: ${result.updated} registros actualizados a 'Enviado'.`, 'success');
            
            // Recargar datos de pendientes después del envío
            await loadAlbaranes(); 
            
        } catch (error) {
            alertMessage(`❌ Error: ${error.message}`, 'error');
        }
    },
    
    // Inicializar select, paginación y checkboxes
    init() {
        if (RECORDS_PER_PAGE_SELECT) RECORDS_PER_PAGE_SELECT.addEventListener('change', this.handleRecordsChange);
        if (PREV_BTN) PREV_BTN.addEventListener('click', () => this.handlePageChange(-1));
        if (NEXT_BTN) NEXT_BTN.addEventListener('click', () => this.handlePageChange(1));
        
        const selectAll = document.getElementById('selectAll');
        if (selectAll) {
            selectAll.addEventListener('change', (e) => {
                document.querySelectorAll('.select-albaran').forEach(cb => {
                    cb.checked = e.target.checked;
                });
            });
        }
    }
};


// =================================================================================
// 🚀 INICIALIZACIÓN GLOBAL
// =================================================================================

// Exponer loadAlbaranes y sortTable para el HTML (Búsqueda Acotada y Ordenación)
window.loadAlbaranes = loadAlbaranes; 
window.sortTable = sortTable; 
window.handleEnviarSeleccionados = Events.handleEnviarSeleccionados;


document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Iniciando aplicación de albaranes pendientes...');
    
    // 1. Inicializar eventos (paginación, select)
    Events.init();
    
    // 2. Inicializar sesión del usuario y cargar licencia
    const hasSession = await API.initUserSession();
    if (!hasSession) {
        DOM.showNoResults();
        alertMessage('No se pudo cargar la sesión del usuario.', 'error');
        return;
    }
    
    // 3. Cargar datos iniciales (Albaranes Pendientes)
    // Usamos el pageSize inicial del estado (20)
    await loadAlbaranes(); 
    
    console.log('✅ Aplicación lista');
});