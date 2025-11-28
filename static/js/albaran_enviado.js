// Archivo: static/js/albaran_enviado.js
// Lógica ESPECÍFICA para la vista de "Enviados". Hereda la estructura de 10 columnas.

const RESULTS_BODY = document.getElementById('albaranResults');
const ALBARAN_TOTAL = document.getElementById('albaranTotal');
const RECORDS_PER_PAGE_SELECT = document.getElementById('recordsPerPage');
const STATUS_MESSAGE = document.getElementById('statusMessage');

// Estado local
let currentData = [];
let currentLicenciaRef = 0; 
let currentSortColumn = 'numero_albaran'; 
let currentSortDirection = 'asc'; 

// =================================================================================
// 📚 UTILIDADES (Idénticas a busqueda.js para consistencia)
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
    const alertClasses = { success: 'status-success', error: 'status-error', info: 'status-info' };
    STATUS_MESSAGE.classList.add(alertClasses[type] || alertClasses.info);
    STATUS_MESSAGE.classList.remove('hidden');
    setTimeout(() => STATUS_MESSAGE.classList.add('hidden'), 3000);
}

function updateSortIcons() {
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

// =================================================================================
// 📊 RENDERIZADO Y ORDENACIÓN (10 Columnas)
// =================================================================================

function renderAlbaranes(data) {
    if (!RESULTS_BODY) return;
    RESULTS_BODY.innerHTML = '';
    let totalImporte = 0;
    const TOTAL_COLUMNS = 10; 

    if (data.length === 0) {
        RESULTS_BODY.innerHTML = `<tr><td colspan="${TOTAL_COLUMNS}" class="text-center py-6 text-gray-500 italic">No se encontraron albaranes enviados.</td></tr>`;
        if (ALBARAN_TOTAL) ALBARAN_TOTAL.innerHTML = '';
    } else {
        data.forEach(albaran => {
            const importe = parseFloat(albaran.importe_total) || 0; 
            totalImporte += importe;

            const albaranID = albaran.ID; 
            const numAlbaran = albaran.numero_albaran;
            const licenciaCode = albaran.LicenciaData ? albaran.LicenciaData.licencia : 'N/A';
            const empresaNombre = albaran.EmpresaData ? albaran.EmpresaData.nombre : 'N/A';
            const conductor = albaran.asalariado && albaran.asalariado.trim() !== '' 
                                ? albaran.asalariado 
                                : (albaran.LicenciaData ? albaran.LicenciaData.nombre : 'Titular'); 
            
            const row = `
                <tr class="hover:bg-gray-100 transition duration-150">
                    <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">${numAlbaran}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${formatDate(albaran.fecha)}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">${licenciaCode}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${empresaNombre}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${albaran.referencia || '-'}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-600">${conductor}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-semibold text-right">€${importe.toFixed(2)}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm">${getStateHtml(albaran.enviado, albaran.cobrado, albaran.pagado)}</td>
                    <td class="px-4 py-3 text-sm text-gray-500 max-w-xs truncate" title="${albaran.observaciones || ''}">${albaran.observaciones || '-'}</td>
                    
                    <!-- 🛠️ COLUMNA ACCIONES MODIFICADA (Solo Ver) -->
                    <td class="px-4 py-3 whitespace-nowrap text-center text-sm font-medium">
                        <div class="flex justify-center space-x-2">
                            <a href="/titulares/view/${albaranID}" title="Ver" class="text-blue-500 hover:text-blue-700 p-1 rounded-full hover:bg-blue-100 transition active:scale-90">
                                <i data-lucide="eye" class="h-5 w-5"></i>
                            </a>
                        </div>
                    </td>
                </tr>
            `;
            RESULTS_BODY.insertAdjacentHTML('beforeend', row);
        });
        
        if (ALBARAN_TOTAL) {
            ALBARAN_TOTAL.innerHTML = `
                <tr class="total-row bg-gray-50 font-bold">
                    <td colspan="6" class="px-4 py-3 text-right text-gray-700">TOTAL</td>
                    <td class="px-4 py-3 text-right text-gray-900">€${totalImporte.toFixed(2)}</td>
                    <td colspan="3" class="px-4 py-3"></td>
                </tr>`;
        }
    }
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
}

function sortTable(column) {
    if (currentData.length === 0) return;

    if (currentSortColumn === column) {
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortDirection = 'asc';
        currentSortColumn = column;
    }

    currentData.sort((a, b) => {
        let valA, valB;
        if (column === 'conductor') {
             valA = a.asalariado && a.asalariado.trim() !== '' ? a.asalariado : (a.LicenciaData ? a.LicenciaData.nombre : '');
             valB = b.asalariado && b.asalariado.trim() !== '' ? b.asalariado : (b.LicenciaData ? b.LicenciaData.nombre : '');
        } else if (column === 'licencia') {
            valA = a.LicenciaData ? a.LicenciaData.licencia : '';
            valB = b.LicenciaData ? b.LicenciaData.licencia : '';
        } else {
            valA = a[column]; valB = b[column];
        }

        if (column === 'importe_total') { valA = parseFloat(valA); valB = parseFloat(valB); }
        else if (column === 'fecha') { valA = new Date(valA).getTime(); valB = new Date(valB).getTime(); }
        else if (typeof valA === 'string') { valA = valA.toLowerCase(); valB = valB.toLowerCase(); }

        if (valA > valB) return currentSortDirection === 'asc' ? 1 : -1;
        if (valA < valB) return currentSortDirection === 'asc' ? -1 : 1;
        return 0;
    });

    renderAlbaranes(currentData);
    updateSortIcons();
}

// Esta función ya no se usa en el HTML para acciones individuales, 
// pero se mantiene por si se requiere para el botón de exportar.
function handleAction(action, itemId) {
    let title = action;
    let message = `Acción ${action} sobre ID: ${itemId}`;
    window.handleActionModal && window.handleActionModal(true, title, message); 
}

function handleActionModal(show, title = '', body = '') {
    const modal = document.getElementById('actionModal');
    if (!modal) return;
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').textContent = body;
    modal.classList.toggle('hidden', !show);
}

// =================================================================================
// 🧠 LÓGICA DE CARGA (FILTRO FORZADO: state=enviado)
// =================================================================================

async function loadAlbaranes(filters = {}, pageSize = 10, page = 1) {
    if (currentLicenciaRef === 0) {
         alertMessage("❌ Error: Licencia no asignada.", 'error');
         return;
    }

    if (RESULTS_BODY) RESULTS_BODY.innerHTML = '<tr><td colspan="10" class="text-center py-6 text-gray-500 italic">Cargando enviados...</td></tr>';
    
    try {
        // 🛑 CLAVE: Añadimos &state=enviado
        let apiPath = `/api/v1/albaranes/search?licencia_ref=${currentLicenciaRef}&pageSize=${pageSize}&page=${page}&state=enviado`;
        
        if (filters.referencia) apiPath += `&referencia=${encodeURIComponent(filters.referencia)}`;
        if (filters.empresa) apiPath += `&empresa_nombre=${encodeURIComponent(filters.empresa)}`;
        if (filters.fecha_desde) apiPath += `&fecha_ini=${filters.fecha_desde}`;
        if (filters.fecha_hasta) apiPath += `&fecha_fin=${filters.fecha_hasta}`;

        const response = await fetch(apiPath);
        
        if (response.status === 401) {
            window.location.href = '/login';
            return;
        }
        
        const data = await response.json();
        currentData = data.data || []; 
        
        if (currentData.length > 0) {
            alertMessage(`Se encontraron ${currentData.length} albaranes enviados.`, 'success');
        } else {
            // Mensaje sutil si no hay datos, no alerta roja
        }

        renderAlbaranes(currentData);
        
    } catch (error) {
        console.error(error);
        alertMessage(`Error: ${error.message}`, 'error');
    }
}

async function cargarDatosIniciales() {
    try {
        const userResponse = await fetch('/api/v1/user/licencia_ref');
        if (!userResponse.ok) throw new Error("Error sesión");
        const userData = await userResponse.json();
        currentLicenciaRef = userData.licencia_ref; 
        
        if (currentLicenciaRef > 0) {
             const licInput = document.getElementById('licencia');
             if(licInput) licInput.value = currentLicenciaRef;
             
             const pageSize = RECORDS_PER_PAGE_SELECT ? parseInt(RECORDS_PER_PAGE_SELECT.value) : 10;
             loadAlbaranes({}, pageSize, 1);
        }
    } catch (error) {
        console.error(error);
    }
}

function handleSearch(event) {
    event.preventDefault();
    const form = document.getElementById('searchForm'); 
    const formData = new FormData(form);
    const searchParams = Object.fromEntries(formData.entries());
    
    const pageSize = RECORDS_PER_PAGE_SELECT ? parseInt(RECORDS_PER_PAGE_SELECT.value) : 10;
    loadAlbaranes(searchParams, pageSize, 1);
}

// Exportación
window.handleSearch = handleSearch;
window.handleAction = handleAction;
window.handleActionModal = handleActionModal;
window.sortTable = sortTable; 

document.addEventListener('DOMContentLoaded', () => {
    cargarDatosIniciales();
    if (RECORDS_PER_PAGE_SELECT) {
        RECORDS_PER_PAGE_SELECT.addEventListener('change', handleSearch);
    }
});