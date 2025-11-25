// Archivo: static/js/admin_busqueda.js
// Lógica principal de la vista de Búsqueda de Albaranes para ADMINISTRADOR (Tablas, Filtros, Acciones).
// NOTA: La función handleLogout está centralizada en /js/security.js.

// Mocks de datos - Data simulada con campos de administración
let mockAlbaranes = [
    { 
        id: 1,
        numero_albaran: 'ENERO2025-804-1',
        fecha: '2024-01-15', 
        licencia_ref: 1,
        empresa_ref: 1,
        licencia: '001A', 
        empresa_nombre: 'Mapfre', 
        referencia: 'R45678', 
        importe: 45.00, 
        state: 'pagado', 
        num_factura: 'FAC-2024-001',
        enviado: 1,
        cobrado: 1,
        pagado: 1,
        observaciones_admin: 'Cobrado por transferencia',
    },
    { 
        id: 2,
        numero_albaran: 'ENERO2025-804-2',
        fecha: '2024-01-16', 
        licencia_ref: 2,
        empresa_ref: 2,
        licencia: '002B', 
        empresa_nombre: 'RACE', 
        referencia: 'E90123', 
        importe: 80.50, 
        state: 'enviado', 
        num_factura: null,
        enviado: 1,
        cobrado: 0,
        pagado: 0,
        observaciones_admin: 'Pendiente de pago',
    },
    { 
        id: 3,
        numero_albaran: 'ENERO2025-804-3',
        fecha: '2024-01-17', 
        licencia_ref: 3,
        empresa_ref: 3,
        licencia: '003C', 
        empresa_nombre: 'Mutua Madrileña', 
        referencia: 'M54321', 
        importe: 120.90, 
        state: 'finalizado', 
        num_factura: 'FAC-2024-003',
        enviado: 1,
        cobrado: 1,
        pagado: 1,
        observaciones_admin: 'Servicio completado',
    },
    { 
        id: 4,
        numero_albaran: 'ENERO2025-804-4',
        fecha: '2024-01-18', 
        licencia_ref: 4,
        empresa_ref: 1,
        licencia: '004D', 
        empresa_nombre: 'Mapfre', 
        referencia: 'R99887', 
        importe: 55.00, 
        state: 'creado', 
        num_factura: null,
        enviado: 0,
        cobrado: 0,
        pagado: 0,
        observaciones_admin: 'Borrador inicial',
    },
    { 
        id: 5,
        numero_albaran: 'ENERO2025-804-5',
        fecha: '2024-01-19', 
        licencia_ref: 5,
        empresa_ref: 2,
        licencia: '005E', 
        empresa_nombre: 'RACE', 
        referencia: 'E11223', 
        importe: 99.95, 
        state: 'pagado', 
        num_factura: 'FAC-2024-005',
        enviado: 1,
        cobrado: 1,
        pagado: 1,
        observaciones_admin: 'Cobrado en efectivo',
    },
    { 
        id: 6,
        numero_albaran: 'ENERO2025-804-6',
        fecha: '2024-01-14', 
        licencia_ref: 6,
        empresa_ref: 3,
        licencia: '006F', 
        empresa_nombre: 'Mutua Madrileña', 
        referencia: 'A00001', 
        importe: 15.00, 
        state: 'creado', 
        num_factura: null,
        enviado: 0,
        cobrado: 0,
        pagado: 0,
        observaciones_admin: 'Borrador pendiente de revisión',
    },
    { 
        id: 7,
        numero_albaran: 'ENERO2025-804-7',
        fecha: '2024-01-20', 
        licencia_ref: 7,
        empresa_ref: 1,
        licencia: '007G', 
        empresa_nombre: 'Mapfre', 
        referencia: 'Z99999', 
        importe: 115.00, 
        state: 'enviado', 
        num_factura: null,
        enviado: 1,
        cobrado: 0,
        pagado: 0,
        observaciones_admin: 'Pendiente de pago',
    },
];

// Objeto para mantener el estado de la ordenación
let sortState = {
    column: 'numero_albaran',
    direction: 'asc' // 'asc' o 'desc'
};

// =================================================================================
// 📚 UTILIDADES DE ESTADO Y MENSAJES (Mismas que en el HTML)
// =================================================================================

/**
 * Muestra/oculta el modal de mensajes de acción.
 */
function handleActionModal(show, title = '', body = '') {
    const modal = document.getElementById('actionModal');
    if (!modal) return;
    
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').textContent = body;
    modal.classList.toggle('hidden', !show);
    
    const modalContent = modal.querySelector('div');
    if (show) {
        setTimeout(() => modalContent.classList.remove('scale-90'), 10);
    } else {
        modalContent.classList.add('scale-90');
    }
}

/**
 * Muestra un mensaje de alerta en la parte inferior de la tabla.
 */
function alertMessage(message, type) {
    const statusMessage = document.getElementById('statusMessage');
    if (!statusMessage) return;
    
    statusMessage.className = 'hidden status-message'; 
    
    const alertClasses = {
        success: 'status-success',
        error: 'status-error',
        info: 'status-info',
        neutral: 'status-neutral',
    };

    const chosenClass = alertClasses[type] || alertClasses.info;

    statusMessage.classList.add(chosenClass);
    statusMessage.classList.remove('hidden');

    let icon = '';
    if (type === 'success') icon = '✅ ';
    else if (type === 'error') icon = '❌ ';
    else if (type === 'info') icon = 'ℹ️ ';
    
    statusMessage.textContent = icon + message;

    setTimeout(() => {
        statusMessage.classList.add('hidden');
    }, 3000);
}

// =================================================================================
// 📊 LÓGICA DE TABLA Y RENDERIZADO
// =================================================================================

/**
 * Simula una acción y muestra el resultado en un modal.
 */
function handleAction(action, itemId) {
    let title = `${action} de Albarán`;
    let message = `Se ha solicitado la acción "${action}" para el albarán/listado: ${itemId}.`;

    if (action === 'Eliminar') {
         title = 'Confirmación de Eliminación';
         message = `ATENCIÓN: Se ha simulado la eliminación del albarán ${itemId}. En un entorno real, se requeriría una confirmación adicional.`;
    } else if (action.includes('Exportar') || action.includes('Imprimir')) {
         title = 'Exportación Simulada';
         message = `El documento para "${itemId}" ha sido generado para ${action}.`;
    }
    
    handleActionModal(true, title, message);
}

/**
 * Devuelve la representación HTML del estado booleano (Sí/No).
 */
function getBooleanHtml(value) {
    if (value === 1 || value === true) {
        return `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Sí</span>`;
    } else {
        return `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">No</span>`;
    }
}

/**
 * Devuelve la representación HTML del estado del albarán (Campo `state`).
 */
function getStateHtml(state) {
    switch (state) {
        case 'pagado':
            return `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-200 text-green-800">Pagado</span>`;
        case 'enviado':
            return `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-200 text-blue-800">Enviado</span>`;
        case 'finalizado':
            return `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-200 text-yellow-800">Finalizado</span>`;
        case 'creado':
        default:
            return `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-200 text-gray-700">Creado</span>`;
    }
}

/**
 * Función principal de ordenación.
 */
function sortTable(column) {
    if (sortState.column === column) {
        sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
    } else {
        sortState.column = column;
        sortState.direction = 'asc';
    }

    const sortedData = [...mockAlbaranes].sort((a, b) => {
        let comparison = 0;
        let aValue = a[column];
        let bValue = b[column];

        if (aValue === null || aValue === undefined) aValue = '';
        if (bValue === null || bValue === undefined) bValue = '';

        // Ordenación por valores booleanos/numéricos (1/0)
        if (column === 'enviado' || column === 'cobrado' || column === 'pagado' || typeof aValue === 'number') {
             comparison = (aValue > bValue) ? 1 : (aValue < bValue) ? -1 : 0;
        } else {
            // Ordenación alfabética/string (incluyendo fechas ISO)
            if (aValue < bValue) comparison = -1;
            if (aValue > bValue) comparison = 1;
        }

        return sortState.direction === 'asc' ? comparison : comparison * -1;
    });

    mockAlbaranes = sortedData;
    renderAlbaranes(mockAlbaranes);
}

/**
 * Renderiza los iconos de ordenación en la tabla.
 */
function renderSortIcons() {
    document.querySelectorAll('.sort-icon').forEach(icon => {
        icon.innerHTML = '';
    });

    const activeIconElement = document.getElementById(`sort-${sortState.column}`);
    if (activeIconElement) {
        activeIconElement.innerHTML = sortState.direction === 'asc' 
            ? `<svg data-lucide="chevron-up" class="h-4 w-4"></svg>`
            : `<svg data-lucide="chevron-down" class="h-4 w-4"></svg>`;
        lucide.createIcons();
    }
}

/**
 * Renderiza la tabla de albaranes.
 */
function renderAlbaranes(data) {
    const resultsBody = document.getElementById('albaranResults');
    const totalFooter = document.getElementById('albaranTotal');
    resultsBody.innerHTML = '';
    
    let totalImporte = 0;

    if (data.length === 0) {
        resultsBody.innerHTML = `<tr><td colspan="11" class="text-center py-6 text-gray-500 italic">No se encontraron resultados que coincidan con los filtros.</td></tr>`;
        if (totalFooter) totalFooter.innerHTML = '';
    } else {
        data.forEach(albaran => {
            totalImporte += albaran.importe;

            const row = `
                <tr class="hover:bg-primary-pastel/30 ${albaran.id % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
                    <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">${albaran.numero_albaran}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${albaran.fecha}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">${albaran.licencia}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${albaran.empresa_nombre}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${albaran.referencia || '-'}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${albaran.num_factura || '-'}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm">${getBooleanHtml(albaran.enviado)}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm">${getBooleanHtml(albaran.cobrado)}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm">${getBooleanHtml(albaran.pagado)}</td>
                    <td class="px-4 py-3 text-sm text-gray-600 max-w-xs overflow-hidden text-ellipsis">${albaran.observaciones_admin || ''}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-center text-sm font-medium">
                        <div class="flex justify-center space-x-2">
                            <button onclick="handleAction('Ver', '${albaran.numero_albaran}')" title="Ver detalle" class="text-blue-500 hover:text-blue-700 p-1 rounded-full hover:bg-blue-100 transition active:scale-90">
                                <i data-lucide="eye" class="h-5 w-5"></i>
                            </button>
                            <button onclick="handleAction('Editar', '${albaran.numero_albaran}')" title="Editar albarán" class="text-primary-link hover:text-orange-700 p-1 rounded-full hover:bg-orange-100 transition active:scale-90">
                                <i data-lucide="pencil" class="h-5 w-5"></i>
                            </button>
                            <button onclick="handleAction('Copiar', '${albaran.numero_albaran}')" title="Duplicar albarán" class="text-purple-500 hover:text-purple-700 p-1 rounded-full hover:bg-purple-100 transition active:scale-90">
                                <i data-lucide="copy" class="h-5 w-5"></i>
                            </button>
                            <button onclick="handleAction('Eliminar', '${albaran.numero_albaran}')" title="Eliminar albarán" class="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-100 transition active:scale-90">
                                <i data-lucide="trash-2" class="h-5 w-5"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
            resultsBody.insertAdjacentHTML('beforeend', row);
        });

         // Renderizar el pie de tabla con el total
        if (totalFooter) {
            totalFooter.innerHTML = `
                <tr class="total-row">
                    <td colspan="5" class="px-4 py-3 text-right">TOTAL IMPORTE (SIMULADO)</td>
                    <td class="px-4 py-3 text-right">€${totalImporte.toFixed(2)}</td>
                    <td colspan="5" class="px-4 py-3"></td>
                </tr>
            `;
        }
    }

    // Ejecutar Lucide para convertir los tags <i> en iconos SVG
    lucide.createIcons();
    renderSortIcons();
}

/**
 * Maneja el submit del formulario de búsqueda (simulado).
 */
function handleSearch(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const searchParams = Object.fromEntries(formData.entries());

    console.log("Parámetros de búsqueda:", searchParams);

    // Simulación de filtro:
    const filteredResults = mockAlbaranes.filter(albaran => {
        const matchCompany = !searchParams.empresa || albaran.empresa_nombre.toLowerCase() === searchParams.empresa;
        
        // Lógica de mapeo de estado:
        let matchState = true;
        if (searchParams.state) {
            switch (searchParams.state) {
                case 'creado':
                    matchState = albaran.enviado === 0;
                    break;
                case 'enviado':
                    matchState = albaran.enviado === 1 && albaran.cobrado === 0;
                    break;
                case 'pagado':
                    matchState = albaran.pagado === 1;
                    break;
                case 'finalizado':
                    matchState = albaran.enviado === 1 && albaran.cobrado === 1 && albaran.pagado === 1;
                    break;
                default:
                    matchState = true;
            }
        }

        const matchLicencia = !searchParams.licencia || albaran.licencia.toLowerCase().includes(searchParams.licencia.toLowerCase());
        const matchReferencia = !searchParams.referencia || (albaran.referencia && albaran.referencia.toLowerCase().includes(searchParams.referencia.toLowerCase()));
        
        return matchCompany && matchState && matchLicencia && matchReferencia;
    });
    
    mockAlbaranes = filteredResults; 
    renderAlbaranes(mockAlbaranes);

    alertMessage(`Búsqueda realizada con éxito. Mostrando ${filteredResults.length} resultados.`, 'success');
}

// =================================================================================
// 🚀 INICIALIZACIÓN
// =================================================================================

// Exportar funciones globales necesarias para onclick en el HTML
window.handleSearch = handleSearch;
window.handleAction = handleAction;
window.handleActionModal = handleActionModal;
window.sortTable = sortTable;
window.showModal = handleActionModal; 
// NOTA: handleLogout se hace global a través de security.js, no de aquí.

document.addEventListener('DOMContentLoaded', () => {
    // Aplicar la ordenación inicial (por numero_albaran ascendente) y renderizar
    sortTable('numero_albaran'); 
});