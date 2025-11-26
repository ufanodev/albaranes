// Archivo: static/js/busqueda.js
// Lógica de consulta de albaranes por licencia (basado en el token de sesión) y manejo de la tabla.

const RESULTS_BODY = document.getElementById('albaranResults');
const ALBARAN_TOTAL = document.getElementById('albaranTotal');
const RECORDS_PER_PAGE_SELECT = document.getElementById('recordsPerPage');
const STATUS_MESSAGE = document.getElementById('statusMessage');

// Estado local
let currentData = [];
let currentLicenciaRef = 0; // Almacenará el ID de licencia del usuario logueado
let currentSortColumn = 'numero_albaran'; // Columna inicial para ordenar
let currentSortDirection = 'asc'; // Dirección inicial: 'asc'

// =================================================================================
// 📚 UTILIDADES DE RENDERIZADO Y ESTADO
// =================================================================================

function formatDate(isoString) {
    if (!isoString) return '';
    return isoString.substring(0, 10);
}

function getStateHtml(enviado, cobrado, pagado) {
    if (cobrado === 1 || cobrado === true) {
        return `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-200 text-green-800">Cobrado</span>`;
    }
    if (enviado === 1 || enviado === true) {
        return `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-200 text-blue-800">Enviado</span>`;
    }
    return `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-200 text-gray-700">Creado</span>`;
}

function alertMessage(message, type) {
    if (!STATUS_MESSAGE) return;
    STATUS_MESSAGE.textContent = message;
    STATUS_MESSAGE.className = 'status-message';
    
    const alertClasses = {
        success: 'status-success',
        error: 'status-error',
        info: 'status-info',
    };
    STATUS_MESSAGE.classList.add(alertClasses[type] || alertClasses.info);
    STATUS_MESSAGE.classList.remove('hidden');
    setTimeout(() => STATUS_MESSAGE.classList.add('hidden'), 3000);
}

/**
 * Actualiza los iconos de flecha para reflejar la columna y dirección de ordenación.
 */
function updateSortIcons() {
    // Restablecer todos los iconos
    document.querySelectorAll('.sortable i').forEach(icon => {
        icon.setAttribute('data-lucide', 'chevrons-up-down');
        icon.classList.remove('text-blue-300'); 
    });

    if (currentSortColumn) {
        const currentIcon = document.getElementById(`sort-${currentSortColumn}`);
        if (currentIcon) {
            const newIcon = currentSortDirection === 'asc' ? 'chevron-up' : 'chevron-down';
            currentIcon.setAttribute('data-lucide', newIcon);
            currentIcon.classList.add('text-blue-300');
            
            if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
        }
    }
}

/**
 * Ordena la tabla por una columna específica (cliente).
 */
function sortTable(column) {
    if (currentData.length === 0) return;

    // 1. Determinar la dirección de ordenación
    if (currentSortColumn === column) {
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortDirection = 'asc';
        currentSortColumn = column;
    }

    // 2. Lógica de ordenación
    currentData.sort((a, b) => {
        let valA, valB;

        // Mapeo de campos anidados/especiales a ordenar
        if (column === 'licencia') {
            valA = a.LicenciaData ? a.LicenciaData.licencia : '';
            valB = b.LicenciaData ? b.LicenciaData.licencia : '';
        } else {
            // Campos directos (ej: 'importe_total', 'fecha')
            valA = a[column];
            valB = b[column];
        }

        // 2.1. Conversión de tipos
        if (column === 'importe_total') {
            valA = parseFloat(valA);
            valB = parseFloat(valB);
        } else if (column === 'fecha') {
            // Comparación de fechas ISO
            valA = new Date(valA).getTime();
            valB = new Date(valB).getTime();
        } else if (column === 'enviado') {
             // Tratamiento de booleanos (true = 1, false = 0)
            valA = valA ? 1 : 0;
            valB = valB ? 1 : 0;
        } else if (typeof valA === 'string') {
             // Comparación de cadenas de texto
            valA = valA.toLowerCase();
            valB = valB.toLowerCase();
        }

        let comparison = 0;
        if (valA > valB) {
            comparison = 1;
        } else if (valA < valB) {
            comparison = -1;
        }
        
        // 2.2. Aplicar la dirección
        return currentSortDirection === 'desc' ? comparison * -1 : comparison;
    });

    // 3. Re-renderizar y actualizar iconos
    renderAlbaranes(currentData);
    updateSortIcons();
}

/**
 * Renderiza la tabla de albaranes con los datos obtenidos de la API.
 */
function renderAlbaranes(data) {
    if (!RESULTS_BODY) return;
    RESULTS_BODY.innerHTML = '';
    
    let totalImporte = 0;

    if (data.length === 0) {
        RESULTS_BODY.innerHTML = `<tr><td colspan="9" class="text-center py-6 text-gray-500 italic">No se encontraron albaranes asociados a esta licencia.</td></tr>`;
        if (ALBARAN_TOTAL) ALBARAN_TOTAL.innerHTML = '';
    } else {
        data.forEach(albaran => {
            
            // 🛑 CLAVES JSON EXACTAS (snake_case y PascalCase anidado)
            const importe = albaran.importe_total || 0; 
            totalImporte += importe;

            // Mapeo de datos para la tabla:
            const albaranID = albaran.ID; 
            const numAlbaran = albaran.numero_albaran;
            const licenciaCode = albaran.LicenciaData ? albaran.LicenciaData.licencia : 'N/A';
            const empresaNombre = albaran.EmpresaData ? albaran.EmpresaData.nombre : 'N/A';

            const row = `
                <tr class="hover:bg-gray-100">
                    <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">${numAlbaran}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${formatDate(albaran.fecha)}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">${licenciaCode}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${empresaNombre}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${albaran.referencia || '-'}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-semibold text-right">€${importe.toFixed(2)}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm">${getStateHtml(albaran.enviado, albaran.cobrado, albaran.pagado)}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${albaran.observaciones || '-'}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-center text-sm font-medium">
                        <div class="flex justify-center space-x-2">
                            <a href="/titulares/view/${albaranID}" title="Ver" class="text-blue-500 hover:text-blue-700 p-1 rounded-full hover:bg-blue-100 transition active:scale-90"><i data-lucide="eye" class="h-5 w-5"></i></a>
                            <a href="/titulares/update/${albaranID}" title="Editar" class="text-primary-link hover:text-orange-700 p-1 rounded-full hover:bg-orange-100 transition active:scale-90"><i data-lucide="pencil" class="h-5 w-5"></i></a>
                            <button onclick="handleAction('Copiar', '${albaranID}')" title="Duplicar albarán" class="text-purple-500 hover:text-purple-700 p-1 rounded-full hover:bg-purple-100 transition active:scale-90"><i data-lucide="copy" class="h-5 w-5"></i></button>
                            <button onclick="handleAction('Eliminar', '${albaranID}')" title="Eliminar albarán" class="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-100 transition active:scale-90"><i data-lucide="trash-2" class="h-5 w-5"></i></button>
                        </div>
                    </td>
                </tr>
            `;
            RESULTS_BODY.insertAdjacentHTML('beforeend', row);
        });
        
        if (ALBARAN_TOTAL) ALBARAN_TOTAL.innerHTML = `
            <tr class="total-row">
                <td colspan="6" class="px-4 py-3 text-right">TOTAL</td>
                <td class="px-4 py-3 text-right">€${totalImporte.toFixed(2)}</td>
                <td colspan="2" class="px-4 py-3"></td>
            </tr>
        `;
    }
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
}


// =================================================================================
// 🧠 LÓGICA DE CARGA Y CONSULTA API
// =================================================================================

/**
 * Carga los albaranes desde la API usando la licencia del usuario.
 */
async function loadAlbaranes(filters = {}, pageSize = 10, page = 1) {
    if (currentLicenciaRef === 0) {
         alertMessage("❌ Error: Licencia de usuario no asignada. No se puede buscar.", 'error');
         if (RESULTS_BODY) RESULTS_BODY.innerHTML = '<tr><td colspan="9" class="text-center py-6 text-red-500 font-bold">Licencia no asignada.</td></tr>';
         return;
    }

    if (RESULTS_BODY) RESULTS_BODY.innerHTML = '<tr><td colspan="9" class="text-center py-6 text-gray-500 italic">Buscando albaranes...</td></tr>';
    
    try {
        let apiPath = `/api/v1/albaranes/search?licencia_ref=${currentLicenciaRef}&pageSize=${pageSize}&page=${page}`;
        
        // Agregar filtros adicionales
        if (filters.referencia) apiPath += `&referencia=${filters.referencia}`;
        if (filters.fecha_desde) apiPath += `&fecha_ini=${filters.fecha_desde}`;
        if (filters.fecha_hasta) apiPath += `&fecha_fin=${filters.fecha_hasta}`;

        const response = await fetch(apiPath);
        
        if (response.status === 401) {
            window.location.href = '/login';
            return;
        }

        if (!response.ok) {
             throw new Error("El servidor rechazó la consulta de albaranes.");
        }
        
        const data = await response.json();

        currentData = data.data || []; 
        alertMessage(`Se cargaron ${currentData.length} de ${data.total} albaranes.`, 'success');
        
        renderAlbaranes(currentData);
        
    } catch (error) {
        console.error('Error al obtener datos:', error);
        alertMessage(`Error de red o procesamiento: ${error.message}`, 'error');
    }
}


/**
 * Lógica principal de carga inicial: Obtiene la LicenciaRef y activa la carga.
 */
async function cargarDatosIniciales() {
    if (RESULTS_BODY) RESULTS_BODY.innerHTML = '<tr><td colspan="9" class="text-center py-6 text-gray-500 italic">Inicializando sesión...</td></tr>';
    
    try {
        // 1. Obtener la Licencia Ref (llama a /api/v1/user/licencia_ref)
        const userResponse = await fetch('/api/v1/user/licencia_ref');
        
        if (!userResponse.ok) {
             throw new Error("No se pudo obtener la licencia de sesión.");
        }
        const userData = await userResponse.json();
        
        currentLicenciaRef = userData.licencia_ref; 
        
        // 2. Cargar los primeros 10 albaranes
        const initialPageSize = RECORDS_PER_PAGE_SELECT ? parseInt(RECORDS_PER_PAGE_SELECT.value) : 10;
        
        if (currentLicenciaRef > 0) {
             const licenciaInput = document.getElementById('licencia');
             if (licenciaInput) licenciaInput.value = currentLicenciaRef;
             
             // Cargar y ordenar por la columna inicial
             loadAlbaranes({}, initialPageSize, 1);
        } else {
             if (RESULTS_BODY) RESULTS_BODY.innerHTML = `<tr><td colspan="9" class="text-center py-6 text-red-500 font-bold">❌ Su usuario no tiene una Licencia de Referencia válida asignada (ID: 0).</td></tr>`;
        }
        
    } catch (error) {
        console.error('Error de inicialización de sesión:', error);
        alertMessage("Fallo al iniciar sesión: Intente reloguear.", 'error');
    }
}


/**
 * Maneja el submit del formulario de búsqueda y recolecta los datos.
 */
function handleSearch(event) {
    event.preventDefault();
    const form = document.getElementById('searchForm'); 
    const formData = new FormData(form);
    const searchParams = Object.fromEntries(formData.entries());
    
    const pageSize = RECORDS_PER_PAGE_SELECT ? parseInt(RECORDS_PER_PAGE_SELECT.value) : 10;

    loadAlbaranes(searchParams, pageSize, 1);

    alertMessage('Iniciando búsqueda filtrada...', 'info');
}

// =================================================================================
// 🚀 INICIALIZACIÓN Y EXPORTACIÓN
// =================================================================================

// Exportar funciones globales necesarias para onclick en el HTML
window.handleSearch = handleSearch;
window.sortTable = sortTable; // Exportamos la función de ordenamiento

document.addEventListener('DOMContentLoaded', () => {
    cargarDatosIniciales();
    
    // Listener para cambiar el número de registros por página
    if (RECORDS_PER_PAGE_SELECT) {
        RECORDS_PER_PAGE_SELECT.addEventListener('change', () => {
            const pageSize = parseInt(RECORDS_PER_PAGE_SELECT.value);
            const form = document.getElementById('searchForm');
            const searchParams = form ? Object.fromEntries(new FormData(form).entries()) : {};
            loadAlbaranes(searchParams, pageSize, 1); 
        });
    }
    
    // Asignación de listener al formulario de búsqueda
    if (document.getElementById('searchForm')) {
         document.getElementById('searchForm').addEventListener('submit', handleSearch);
    }
});