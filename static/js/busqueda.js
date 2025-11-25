// Archivo: static/js/busqueda.js (VERSIÓN FUNCIONAL CON API)
// Lógica de consulta de albaranes por licencia (basado en el token de sesión).

const RESULTS_BODY = document.getElementById('albaranResults');
const ALBARAN_TOTAL = document.getElementById('albaranTotal');
const RECORDS_PER_PAGE_SELECT = document.getElementById('recordsPerPage');
const STATUS_MESSAGE = document.getElementById('statusMessage');

// Estado local de la tabla
let currentData = [];
let sortState = { column: 'id', direction: 'desc' }; 
let currentLicenciaRef = 0; // Almacenará el ID de licencia del usuario

// =================================================================================
// 📚 UTILIDADES DE RENDERIZADO (Reusadas de tu HTML/JS anterior)
// =================================================================================

// NOTA: Debes COPIAR aquí las siguientes funciones desde el <script> de tu HTML:
// 1. function getBooleanHtml(value) { ... }
// 2. function getStateHtml(state) { ... }
// 3. function renderSortIcons() { ... }
// 4. function sortTable(column) { ... }
// 5. function handleActionModal(show, title, body) { ... } (O showModal)
// 6. function handleAction(action, itemId) { ... }

// Por razones de espacio, no las repito aquí, pero DEBEN estar en este archivo.

// Ejemplo de las funciones de renderizado que necesitas (Asegúrate de copiar tu versión):
function getBooleanHtml(value) {
    if (value === 1 || value === true) {
        return `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Sí</span>`;
    } else {
        return `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">No</span>`;
    }
}
// ... (Otras funciones de renderizado deben ir aquí) ...


/**
 * Muestra un mensaje de alerta en la parte inferior de la tabla.
 */
function alertMessage(message, type) {
    // Implementación de alertMessage
    if (!STATUS_MESSAGE) return;
    STATUS_MESSAGE.textContent = message;
    STATUS_MESSAGE.className = 'status-message';
    // ... (Lógica de clases de color) ...
    STATUS_MESSAGE.classList.remove('hidden');
    setTimeout(() => STATUS_MESSAGE.classList.add('hidden'), 3000);
}


// ---------------------------------------------------------------------
// FUNCIÓN DE RENDERIZADO DE TABLA (Actualizada para usar datos de API)
// ---------------------------------------------------------------------

/**
 * Renderiza la tabla de albaranes con los datos obtenidos.
 */
function renderAlbaranes(data) {
    if (!RESULTS_BODY) return;
    RESULTS_BODY.innerHTML = '';
    
    let totalImporte = 0;

    if (data.length === 0) {
        RESULTS_BODY.innerHTML = `<tr><td colspan="9" class="text-center py-6 text-gray-500 italic">No se encontraron resultados para esta licencia.</td></tr>`;
        if (ALBARAN_TOTAL) ALBARAN_TOTAL.innerHTML = '';
    } else {
        data.forEach(albaran => {
            // Suponemos que los datos de la API se mapean a estos nombres (ej: albaran.Fecha)
            const importe = albaran.Importe || 0;
            totalImporte += importe;

            const row = `
                <tr>
                    <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">${albaran.ID}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${albaran.Fecha.substring(0, 10)}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">${albaran.LicenciaData ? albaran.LicenciaData.Referencia : 'N/A'}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${albaran.EmpresaData ? albaran.EmpresaData.Nombre : 'N/A'}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${albaran.Referencia || '-'}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-semibold text-right">€${importe.toFixed(2)}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm">${getBooleanHtml(albaran.Cobrado)}</td>
                    <td class="px-4 py-3 text-sm text-gray-600 max-w-xs overflow-hidden text-ellipsis">${albaran.Observaciones || ''}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-center text-sm font-medium">
                        <div class="flex justify-center space-x-2">
                            <button onclick="handleAction('Ver', '${albaran.ID}')">...</button>
                            <button onclick="handleAction('Editar', '${albaran.ID}')">...</button>
                            </div>
                    </td>
                </tr>
            `;
            RESULTS_BODY.insertAdjacentHTML('beforeend', row);
        });
        
        // Renderizar totales (Asegúrate que albaranTotal está definido en el HTML)
        if (ALBARAN_TOTAL) ALBARAN_TOTAL.innerHTML = `
            <tr class="total-row">
                <td colspan="5" class="px-4 py-3 text-right">TOTAL</td>
                <td class="px-4 py-3 text-right">€${totalImporte.toFixed(2)}</td>
                <td colspan="3" class="px-4 py-3"></td>
            </tr>
        `;
    }
    // Llama a lucide.createIcons() y renderSortIcons()
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
    // if (window.renderSortIcons) window.renderSortIcons();
}


// =================================================================================
// 🧠 LÓGICA DE CARGA Y CONSULTA API
// =================================================================================

/**
 * Carga los albaranes desde la API usando la licencia del usuario.
 * @param {object} filters - Filtros de búsqueda adicionales.
 * @param {number} pageSize - Número de registros por página.
 * @param {number} page - Número de página.
 */
async function loadAlbaranes(filters = {}, pageSize = 10, page = 1) {
    if (!currentLicenciaRef) {
         alertMessage("❌ Error: Licencia de usuario no cargada.", 'error');
         return;
    }

    RESULTS_BODY.innerHTML = '<tr><td colspan="9" class="text-center py-6 text-gray-500 italic">Buscando albaranes...</td></tr>';
    
    try {
        let apiPath = `/api/v1/albaranes/search?licencia_ref=${currentLicenciaRef}&pageSize=${pageSize}&page=${page}`;
        
        // Agregar filtros adicionales (ej: fecha_ini, fecha_fin, referencia, etc.)
        if (filters.referencia) apiPath += `&referencia=${filters.referencia}`;
        if (filters.fecha_desde) apiPath += `&fecha_ini=${filters.fecha_desde}`;
        // ... (otros filtros) ...

        const response = await fetch(apiPath);
        
        if (!response.ok) {
             throw new Error("El servidor rechazó la consulta de albaranes.");
        }
        
        const data = await response.json();

        currentData = data.data; 
        alertMessage(`Se cargaron ${data.data.length} de ${data.total} albaranes.`, 'success');
        
        renderAlbaranes(currentData);
        
    } catch (error) {
        console.error('Error al obtener datos:', error);
        RESULTS_BODY.innerHTML = `<tr><td colspan="9" class="text-center py-6 text-red-500 font-bold">❌ Error de API: ${error.message}</td></tr>`;
    }
}


/**
 * Lógica principal de carga inicial (obtiene la referencia de licencia).
 */
async function cargarDatosIniciales() {
    try {
        // A. Obtener la Licencia Ref del usuario logueado
        const userResponse = await fetch('/api/v1/user/licencia_ref');
        
        if (!userResponse.ok) {
             throw new Error("No se pudo obtener la licencia de sesión.");
        }
        const userData = await userResponse.json();
        
        currentLicenciaRef = userData.licencia_ref; 
        
        // B. Cargar los primeros 10 albaranes
        const initialPageSize = RECORDS_PER_PAGE_SELECT ? parseInt(RECORDS_PER_PAGE_SELECT.value) : 10;
        loadAlbaranes({}, initialPageSize, 1);
        
    } catch (error) {
        console.error('Error de inicialización de sesión:', error);
        alertMessage("No se pudo obtener la licencia de sesión. ¿Sesión válida?", 'error');
    }
}


/**
 * Maneja el submit del formulario de búsqueda y recolecta los datos.
 */
function handleSearch(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const searchParams = Object.fromEntries(formData.entries());
    
    const pageSize = RECORDS_PER_PAGE_SELECT ? parseInt(RECORDS_PER_PAGE_SELECT.value) : 10;

    // Llama a la API con los filtros del formulario
    loadAlbaranes(searchParams, pageSize, 1);

    alertMessage('Iniciando búsqueda filtrada...', 'info');
}

// =================================================================================
// 🚀 INICIALIZACIÓN Y EXPORTACIÓN
// =================================================================================

// Exportar funciones globales necesarias para onclick en el HTML
window.handleSearch = handleSearch;
// ... (Exportar otras funciones de handleAction, sortTable, etc.) ...
// Asegúrate de que todas las funciones usadas en onclick estén exportadas aquí.

document.addEventListener('DOMContentLoaded', () => {
    // Iniciar la carga de datos al iniciar la página
    cargarDatosIniciales();
    
    // Listener para cambiar el número de registros por página
    if (RECORDS_PER_PAGE_SELECT) {
        RECORDS_PER_PAGE_SELECT.addEventListener('change', () => {
            const pageSize = parseInt(RECORDS_PER_PAGE_SELECT.value);
            loadAlbaranes({}, pageSize, 1); // Recargar la primera página con el nuevo tamaño
        });
    }
});