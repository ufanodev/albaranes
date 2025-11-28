// Archivo: static/js/albaran_pendiente.js
// Lógica ESPECÍFICA para "Pendientes" (state=creado / No Enviados).

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
// 📚 UTILIDADES
// =================================================================================

function formatDate(isoString) {
    if (!isoString) return '';
    return isoString.substring(0, 10);
}

function getStateHtml(enviado, cobrado) {
    return `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800 border border-yellow-200">Pendiente</span>`;
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
    document.querySelectorAll('th i').forEach(icon => {
        icon.setAttribute('data-lucide', 'chevrons-up-down');
        icon.className = 'h-4 w-4 ml-1 inline-block text-gray-400';
    });
    const icon = document.getElementById(`sort-${currentSortColumn}`);
    if (icon) {
        const newIcon = currentSortDirection === 'asc' ? 'chevron-up' : 'chevron-down';
        icon.setAttribute('data-lucide', newIcon);
        icon.className = 'h-4 w-4 ml-1 inline-block text-blue-600';
        if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
    }
}

// =================================================================================
// 📊 RENDERIZADO (10 Columnas)
// =================================================================================

function renderAlbaranes(data) {
    if (!RESULTS_BODY) return;
    RESULTS_BODY.innerHTML = '';
    let totalImporte = 0;
    const TOTAL_COLUMNS = 10; 

    if (!data || data.length === 0) {
        RESULTS_BODY.innerHTML = `<tr><td colspan="${TOTAL_COLUMNS}" class="text-center py-6 text-gray-500 italic">No hay albaranes pendientes.</td></tr>`;
        if (ALBARAN_TOTAL) ALBARAN_TOTAL.innerHTML = '';
    } else {
        data.forEach(albaran => {
            const importe = parseFloat(albaran.importe_total || albaran.ImporteTotal || 0); 
            totalImporte += importe;

            const id = albaran.ID || albaran.id;
            const num = albaran.numero_albaran || albaran.NumeroAlbaran || id;
            const fecha = albaran.fecha || albaran.Fecha;
            const ref = albaran.referencia || albaran.Referencia || '-';
            const obs = albaran.observaciones || albaran.Observaciones || '-';
            
            const licData = albaran.LicenciaData || {};
            const licCode = licData.licencia || licData.Licencia || 'N/A';
            const empData = albaran.EmpresaData || {};
            const empName = empData.nombre || empData.Nombre || 'N/A';

            // Conductor
            let conductor = 'Titular';
            if (albaran.asalariado || albaran.Asalariado) conductor = albaran.asalariado || albaran.Asalariado;
            else if (licData.nombre || licData.Nombre) conductor = licData.nombre || licData.Nombre;

            // Fila
            const row = `
                <tr class="hover:bg-yellow-50 transition duration-150">
                    <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">${num}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${formatDate(fecha)}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">${licCode}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${empName}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${ref}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-600">${conductor}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-semibold text-right">€${importe.toFixed(2)}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm">${getStateHtml()}</td>
                    <td class="px-4 py-3 text-sm text-gray-500 max-w-xs truncate" title="${obs}">${obs}</td>
                    
                    <!-- 🛠️ COLUMNA ACCIONES MODIFICADA -->
                    <td class="px-4 py-3 whitespace-nowrap text-center text-sm font-medium">
                        <div class="flex justify-center items-center space-x-4">
                            <!-- Ver Detalle -->
                            <a href="/titulares/view/${id}" class="text-blue-500 hover:text-blue-700 p-1 transition transform hover:scale-110" title="Ver">
                                <i data-lucide="eye" class="h-5 w-5"></i>
                            </a>
                            
                            <!-- Checkbox de selección para envío -->
                            <input type="checkbox" 
                                   class="select-albaran h-5 w-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer transition transform hover:scale-110" 
                                   value="${id}" 
                                   title="Seleccionar para tramitar">
                        </div>
                    </td>
                </tr>
            `;
            RESULTS_BODY.insertAdjacentHTML('beforeend', row);
        });
        
        if (ALBARAN_TOTAL) {
            ALBARAN_TOTAL.innerHTML = `
                <tr class="total-row bg-gray-50 font-bold">
                    <td colspan="6" class="px-4 py-3 text-right text-gray-700">TOTAL PENDIENTE</td>
                    <td class="px-4 py-3 text-right text-gray-900">€${totalImporte.toFixed(2)}</td>
                    <td colspan="3" class="px-4 py-3"></td>
                </tr>`;
        }
    }
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
}

function sortTable(column) {
    if (!currentData || currentData.length === 0) return;

    if (currentSortColumn === column) {
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortDirection = 'asc';
        currentSortColumn = column;
    }

    currentData.sort((a, b) => {
        // Helper para obtener valor seguro
        const getVal = (item, key) => {
             if (key === 'importe_total') return parseFloat(item.importe_total || item.ImporteTotal || 0);
             if (key === 'fecha') return new Date(item.fecha || item.Fecha).getTime();
             return (item[key] || '').toString().toLowerCase();
        };

        let valA = getVal(a, column);
        let valB = getVal(b, column);

        if (valA > valB) return currentSortDirection === 'asc' ? 1 : -1;
        if (valA < valB) return currentSortDirection === 'asc' ? -1 : 1;
        return 0;
    });

    renderAlbaranes(currentData);
    updateSortIcons();
}

function handleAction(action, itemId) {
    // Función placeholder por si se requiere en el futuro
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
// 🧠 LÓGICA DE CARGA (FILTRO FORZADO)
// =================================================================================

async function loadAlbaranes(filters = {}, pageSize = 10, page = 1) {
    if (currentLicenciaRef === 0) return;

    if (RESULTS_BODY) RESULTS_BODY.innerHTML = '<tr><td colspan="10" class="text-center py-6 text-gray-500 italic">Cargando pendientes...</td></tr>';
    
    try {
        // 🛑 CLAVE: &state=creado
        let apiPath = `/api/v1/albaranes/search?licencia_ref=${currentLicenciaRef}&pageSize=${pageSize}&page=${page}&state=creado`;
        
        if (filters.referencia) apiPath += `&referencia=${encodeURIComponent(filters.referencia)}`;
        if (filters.empresa) apiPath += `&empresa_nombre=${encodeURIComponent(filters.empresa)}`;
        if (filters.fecha_desde) apiPath += `&fecha_ini=${filters.fecha_desde}`;
        if (filters.fecha_hasta) apiPath += `&fecha_fin=${filters.fecha_hasta}`;

        const response = await fetch(apiPath);
        if (response.status === 401) { window.location.href = '/login'; return; }
        
        const resJson = await response.json();
        const rawData = resJson.data || [];

        // --- FILTRADO ROBUSTO EN CLIENTE ---
        // Aseguramos que solo pasen los que NO están enviados NI cobrados
        currentData = rawData.filter(item => {
            const env = item.enviado || item.Enviado; 
            const cob = item.cobrado || item.Cobrado;
            const isEnviado = env === true || env === 1;
            const isCobrado = cob === true || cob === 1;
            
            return !isEnviado && !isCobrado;
        });

        if (currentData.length > 0) {
             alertMessage(`Se encontraron ${currentData.length} pendientes.`, 'success');
        } else {
             if (rawData.length > 0) console.warn("Filtro cliente ocultó registros no pendientes.");
        }
        
        renderAlbaranes(currentData);
        
    } catch (error) {
        console.error(error);
        alertMessage(`Error: ${error.message}`, 'error');
    }
}

async function init() {
    try {
        const userRes = await fetch('/api/v1/user/licencia_ref');
        if (!userRes.ok) throw new Error("Sesión");
        const userData = await userRes.json();
        currentLicenciaRef = userData.licencia_ref; 
        
        if (currentLicenciaRef > 0) {
             const licInput = document.getElementById('licencia');
             if(licInput) licInput.value = currentLicenciaRef;
             const pageSize = document.getElementById('recordsPerPage').value;
             loadAlbaranes({}, pageSize, 1);
        }
    } catch (e) { console.error(e); }
}

// Event Handlers
window.handleSearch = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    loadAlbaranes(Object.fromEntries(formData.entries()), document.getElementById('recordsPerPage').value, 1);
};
window.sortTable = sortTable; 
window.handleEnviarSeleccionados = async function() {
    const checkboxes = document.querySelectorAll('.select-albaran:checked');
    const selectedIds = Array.from(checkboxes).map(cb => cb.value);

    if (selectedIds.length === 0) {
        alertMessage('⚠️ Seleccione al menos un albarán para enviar.', 'info');
        return;
    }

    if (!confirm(`¿Está seguro de enviar ${selectedIds.length} albarán(es)?`)) {
        return;
    }

    alertMessage(`⏳ Enviando ${selectedIds.length} albaranes...`, 'info');
    
    // Simulación de envío exitoso
    setTimeout(() => {
        alertMessage(`✅ ${selectedIds.length} Albaranes enviados correctamente.`, 'success');
        // Aquí recargaríamos la tabla para que desaparezcan los enviados
        // const pageSize = document.getElementById('recordsPerPage').value;
        // loadAlbaranes({}, pageSize, 1);
    }, 1000);
};
window.handleActionModal = handleActionModal;

document.addEventListener('DOMContentLoaded', () => {
    init();
    document.getElementById('recordsPerPage')?.addEventListener('change', window.handleSearch);
});