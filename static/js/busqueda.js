// Archivo: static/js/busqueda.js

const RESULTS_BODY = document.getElementById('albaranResults');
const ALBARAN_TOTAL = document.getElementById('albaranTotal');
const RECORDS_PER_PAGE_SELECT = document.getElementById('recordsPerPage');
const STATUS_MESSAGE = document.getElementById('statusMessage');

let currentData = [];
let currentLicenciaRef = 0;
let currentSortColumn = 'numero_albaran';
let currentSortDirection = 'asc';

// ... (Funciones formatDate, getStateHtml, alertMessage se mantienen igual) ...
function formatDate(isoString) {
    if (!isoString) return '-';
    return isoString.substring(0, 10);
}

function getStateHtml(enviado, cobrado, pagado) {
    if (cobrado) return `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-200 text-green-800">Cobrado</span>`;
    if (enviado) return `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-200 text-blue-800">Enviado</span>`;
    return `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-200 text-gray-700">Creado</span>`;
}

function alertMessage(message, type) {
    if (!STATUS_MESSAGE) return;
    STATUS_MESSAGE.textContent = message;
    STATUS_MESSAGE.className = 'status-message';
    const alertClasses = { success: 'status-success', error: 'status-error', info: 'status-info' };
    STATUS_MESSAGE.classList.add(alertClasses[type] || alertClasses.info);
    STATUS_MESSAGE.classList.remove('hidden');
    setTimeout(() => STATUS_MESSAGE.classList.add('hidden'), 3000);
}

// ... (updateSortIcons, sortTable se mantienen igual) ...
function updateSortIcons() { /* ... código existente ... */ }
function sortTable(column) { /* ... código existente ... */ }


// ============================================================================
// 🔍 FUNCIÓN DE RENDERIZADO CON LOGS
// ============================================================================

function renderAlbaranes(data) {
    if (!RESULTS_BODY) return;
    RESULTS_BODY.innerHTML = '';
    let totalImporte = 0;
    const TOTAL_COLUMNS = 10;

    if (!data || data.length === 0) {
        RESULTS_BODY.innerHTML = `<tr><td colspan="${TOTAL_COLUMNS}" class="text-center py-6 text-gray-500 italic">No se encontraron resultados.</td></tr>`;
        if (ALBARAN_TOTAL) ALBARAN_TOTAL.innerHTML = '';
        return;
    }

    // 🛑 DIAGNÓSTICO: Muestra el primer elemento para ver las claves reales
    console.log("🔎 [RENDER] Estructura del primer albarán:", data[0]);

    data.forEach(item => {
        // Intento de lectura robusta (Mayúsculas o Minúsculas)
        const importe = parseFloat(item.importe_total || item.ImporteTotal || 0);
        totalImporte += importe;

        // Extracción de datos
        const numAlbaran = item.numero_albaran || item.NumeroAlbaran || item.ID;
        const fechaRaw = item.fecha || item.Fecha;
        const referencia = item.referencia || item.Referencia || '-';
        const observaciones = item.observaciones || item.Observaciones || '-';
        
        // Relaciones
        const licData = item.LicenciaData || {}; 
        const empData = item.EmpresaData || {};
        const licenciaCode = licData.licencia || licData.Licencia || 'N/A';
        const empresaNombre = empData.nombre || empData.Nombre || 'N/A';

        // Estados
        const enviado = item.enviado || item.Enviado;
        const cobrado = item.cobrado || item.Cobrado;
        const pagado = item.pagado || item.Pagado;

        // Conductor
        let conductor = 'Titular';
        if (item.asalariado && item.asalariado.trim() !== '') conductor = item.asalariado;
        else if (item.Asalariado && item.Asalariado.trim() !== '') conductor = item.Asalariado;
        else if (licData.nombre || licData.Nombre) conductor = licData.nombre || licData.Nombre;

        const row = `
            <tr class="hover:bg-gray-100 transition duration-150">
                <td class="px-4 py-3 text-sm font-medium text-gray-900">${numAlbaran}</td>
                <td class="px-4 py-3 text-sm text-gray-500">${formatDate(fechaRaw)}</td>
                <td class="px-4 py-3 text-sm text-gray-700">${licenciaCode}</td>
                <td class="px-4 py-3 text-sm text-gray-500">${empresaNombre}</td>
                <td class="px-4 py-3 text-sm text-gray-500">${referencia}</td>
                <td class="px-4 py-3 text-sm text-gray-600">${conductor}</td>
                <td class="px-4 py-3 text-sm text-gray-900 font-semibold text-right">€${importe.toFixed(2)}</td>
                <td class="px-4 py-3 text-sm">${getStateHtml(enviado, cobrado, pagado)}</td>
                <td class="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">${observaciones}</td>
                <td class="px-4 py-3 text-center text-sm">
                     <div class="flex justify-center space-x-2">
                        <a href="/titulares/view/${item.ID || item.id}" class="text-blue-500"><i data-lucide="eye" class="h-5 w-5"></i></a>
                        <a href="/titulares/update/${item.ID || item.id}" class="text-orange-500"><i data-lucide="pencil" class="h-5 w-5"></i></a>
                    </div>
                </td>
            </tr>
        `;
        RESULTS_BODY.insertAdjacentHTML('beforeend', row);
    });

    if (ALBARAN_TOTAL) {
        ALBARAN_TOTAL.innerHTML = `
            <tr class="total-row bg-gray-50 font-bold">
                <td colspan="6" class="px-4 py-3 text-right">TOTAL</td>
                <td class="px-4 py-3 text-right">€${totalImporte.toFixed(2)}</td>
                <td colspan="3"></td>
            </tr>`;
    }
    if (window.lucide) lucide.createIcons();
}

// =================================================================================
// 🧠 LÓGICA DE CARGA (MODIFICADA PARA LOGS)
// =================================================================================

async function loadAlbaranes(filters = {}, pageSize = 10, page = 1) {
    if (currentLicenciaRef === 0) {
         console.warn("⚠️ Licencia no asignada.");
         return;
    }

    if (RESULTS_BODY) RESULTS_BODY.innerHTML = '<tr><td colspan="10" class="text-center py-6 text-gray-500 italic">Cargando...</td></tr>';
    
    try {
        let apiPath = `/api/v1/albaranes/search?licencia_ref=${currentLicenciaRef}&pageSize=${pageSize}&page=${page}`;
        
        if (filters.referencia) apiPath += `&referencia=${encodeURIComponent(filters.referencia)}`;
        if (filters.empresa) apiPath += `&empresa_nombre=${encodeURIComponent(filters.empresa)}`;
        if (filters.state) apiPath += `&state=${encodeURIComponent(filters.state)}`;
        if (filters.fecha_desde) apiPath += `&fecha_ini=${filters.fecha_desde}`;
        if (filters.fecha_hasta) apiPath += `&fecha_fin=${filters.fecha_hasta}`;

        console.log("🚀 [API FETCH] URL:", apiPath); // LOG DE URL

        const response = await fetch(apiPath);
        
        if (response.status === 401) {
            window.location.href = '/login';
            return;
        }

        const data = await response.json();
        
        // LOG DE RESPUESTA COMPLETA
        console.log("📦 [API RESPONSE] Datos recibidos:", data);

        currentData = data.data || []; 
        renderAlbaranes(currentData);
        
    } catch (error) {
        console.error('Error loadAlbaranes:', error);
        alertMessage(`Error: ${error.message}`, 'error');
    }
}

// ... (cargarDatosIniciales, handleSearch, listeners e inicialización se mantienen) ...
async function cargarDatosIniciales() {
    try {
        const userResponse = await fetch('/api/v1/user/licencia_ref');
        if (!userResponse.ok) throw new Error("Error sesión");
        const userData = await userResponse.json();
        currentLicenciaRef = userData.licencia_ref; 
        
        if (currentLicenciaRef > 0) {
             const licInput = document.getElementById('licencia');
             if(licInput) licInput.value = currentLicenciaRef;
             const pageSize = document.getElementById('recordsPerPage').value;
             loadAlbaranes({}, pageSize, 1);
        }
    } catch (e) { console.error(e); }
}

function handleSearch(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const filters = Object.fromEntries(formData.entries());
    const pageSize = document.getElementById('recordsPerPage').value;
    loadAlbaranes(filters, pageSize, 1);
}

window.handleSearch = handleSearch;
window.sortTable = sortTable; // Asegúrate de tener sortTable definida
document.addEventListener('DOMContentLoaded', () => {
    cargarDatosIniciales();
    document.getElementById('recordsPerPage').addEventListener('change', handleSearch); // Simplificado
});