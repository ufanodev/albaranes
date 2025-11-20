// =================================================================================
// 📚 FUNCIONES PRINCIPALES
// =================================================================================

// Mocks de datos ACTUALIZADOS con campos de la base de datos
let mockAlbaranes = [
    { 
        id: '2023-0001', 
        numero_albaran: 'ENERO2025-804-1',
        fecha: '2023-11-15', 
        licencia_ref: 1,
        empresa_ref: 1,
        licencia: '001A', 
        empresa_nombre: 'Mapfre', 
        referencia: 'R45678', 
        importe: 45.00, 
        state: 'pagado', 
        num_factura: 'FAC-2023-001',
        enviado: 1,
        cobrado: 1,
        fecha_cobro: '2023-11-20',
        pagado: 1,
        fecha_pago: '2023-11-20',
        observaciones_admin: 'Cobrado por transferencia',
        created_at: '2023-11-15 10:30:00',
        updated_at: '2023-11-20 14:45:00'
    },
    { 
        id: '2023-0002', 
        numero_albaran: 'ENERO2025-804-2',
        fecha: '2023-11-16', 
        licencia_ref: 2,
        empresa_ref: 2,
        licencia: '002', 
        empresa_nombre: 'RACE', 
        referencia: 'E90123', 
        importe: 80.50, 
        state: 'enviado', 
        num_factura: null,
        enviado: 1,
        cobrado: 0,
        fecha_cobro: null,
        pagado: 0,
        fecha_pago: null,
        observaciones_admin: 'Pendiente de pago',
        created_at: '2023-11-16 09:15:00',
        updated_at: '2023-11-16 09:15:00'
    },
    { 
        id: '2023-0003', 
        numero_albaran: 'ENERO2025-804-3',
        fecha: '2023-11-17', 
        licencia_ref: 3,
        empresa_ref: 3,
        licencia: '003B', 
        empresa_nombre: 'Mutua Madrileña', 
        referencia: 'M54321', 
        importe: 120.90, 
        state: 'finalizado', 
        num_factura: 'FAC-2023-003',
        enviado: 1,
        cobrado: 1,
        fecha_cobro: '2023-11-25',
        pagado: 1,
        fecha_pago: '2023-11-25',
        observaciones_admin: 'Servicio completado',
        created_at: '2023-11-17 11:20:00',
        updated_at: '2023-11-25 16:30:00'
    },
    { 
        id: '2023-0004', 
        numero_albaran: 'ENERO2025-804-4',
        fecha: '2023-11-18', 
        licencia_ref: 4,
        empresa_ref: 1,
        licencia: '004', 
        empresa_nombre: 'Mapfre', 
        referencia: 'R99887', 
        importe: 55.00, 
        state: 'creado', 
        num_factura: null,
        enviado: 0,
        cobrado: 0,
        fecha_cobro: null,
        pagado: 0,
        fecha_pago: null,
        observaciones_admin: 'Borrador inicial',
        created_at: '2023-11-18 14:10:00',
        updated_at: '2023-11-18 14:10:00'
    },
    { 
        id: '2023-0005', 
        numero_albaran: 'ENERO2025-804-5',
        fecha: '2023-11-19', 
        licencia_ref: 5,
        empresa_ref: 2,
        licencia: '005C', 
        empresa_nombre: 'RACE', 
        referencia: 'E11223', 
        importe: 99.95, 
        state: 'pagado', 
        num_factura: 'FAC-2023-005',
        enviado: 1,
        cobrado: 1,
        fecha_cobro: '2023-11-22',
        pagado: 1,
        fecha_pago: '2023-11-22',
        observaciones_admin: 'Cobrado en efectivo',
        created_at: '2023-11-19 08:45:00',
        updated_at: '2023-11-22 12:15:00'
    },
    { 
        id: '2023-0006', 
        numero_albaran: 'ENERO2025-804-6',
        fecha: '2023-11-14', 
        licencia_ref: 6,
        empresa_ref: 3,
        licencia: '006D', 
        empresa_nombre: 'Mutua Madrileña', 
        referencia: 'A00001', 
        importe: 15.00, 
        state: 'creado', 
        num_factura: null,
        enviado: 0,
        cobrado: 0,
        fecha_cobro: null,
        pagado: 0,
        fecha_pago: null,
        observaciones_admin: 'Borrador',
        created_at: '2023-11-14 16:30:00',
        updated_at: '2023-11-14 16:30:00'
    },
    { 
        id: '2023-0007', 
        numero_albaran: 'ENERO2025-804-7',
        fecha: '2023-11-20', 
        licencia_ref: 7,
        empresa_ref: 1,
        licencia: '007', 
        empresa_nombre: 'Mapfre', 
        referencia: 'Z99999', 
        importe: 115.00, 
        state: 'enviado', 
        num_factura: null,
        enviado: 1,
        cobrado: 0,
        fecha_cobro: null,
        pagado: 0,
        fecha_pago: null,
        observaciones_admin: 'Pendiente de pago',
        created_at: '2023-11-20 13:25:00',
        updated_at: '2023-11-20 13:25:00'
    },
];

// Objeto para mantener el estado de la ordenación
let sortState = {
    column: 'numero_albaran',
    direction: 'asc' // 'asc' o 'desc'
};

/**
 * Muestra/oculta el modal de mensajes
 * @param {boolean} show Si es true, muestra. Si es false, oculta.
 * @param {string} title Título del modal.
 * @param {string} body Contenido del modal.
 */
function showModal(show, title = '', body = '') {
    const modal = document.getElementById('actionModal');
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').textContent = body;
    modal.classList.toggle('hidden', !show);
    if (show) {
        // Pequeña animación para mostrar
        setTimeout(() => {
            modal.querySelector('div').classList.remove('scale-90');
        }, 10);
    } else {
        // Animación para ocultar
        modal.querySelector('div').classList.add('scale-90');
    }
}

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
    
    showModal(true, title, message);
}

/**
 * Devuelve la representación HTML del estado del albarán.
 */
function getStateHtml(state) {
    switch (state) {
        case 'pagado':
            return `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Pagado</span>`;
        case 'enviado':
            return `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">Enviado</span>`;
        case 'finalizado':
            return `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-primary-link/20 text-primary-link">Finalizado</span>`;
        case 'creado':
        default:
            return `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-200 text-gray-700">Creado</span>`;
    }
}

/**
 * Función principal de ordenación.
 * @param {string} column La clave de la columna por la que ordenar ('numero_albaran', 'fecha', 'referencia', 'state').
 */
function sortTable(column) {
    // Determinar la dirección de la ordenación
    if (sortState.column === column) {
        sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
    } else {
        sortState.column = column;
        sortState.direction = 'asc';
    }

    // Lógica de ordenación
    const sortedData = [...mockAlbaranes].sort((a, b) => {
        let comparison = 0;
        let aValue = a[column];
        let bValue = b[column];

        if (column === 'numero_albaran' || column === 'referencia' || column === 'state') {
            // Ordenación alfabética/string
            if (aValue < bValue) {
                comparison = -1;
            } else if (aValue > bValue) {
                comparison = 1;
            }
        } else if (column === 'fecha') {
            // Ordenación por fecha (comparando strings de fecha ISO)
            if (aValue < bValue) {
                comparison = -1;
            } else if (aValue > bValue) {
                comparison = 1;
            }
        }

        // Aplicar la dirección
        return sortState.direction === 'asc' ? comparison : comparison * -1;
    });

    // Actualizar los datos originales (simulados) con los ordenados
    mockAlbaranes = sortedData;
    
    // Re-renderizar la tabla con los datos ordenados
    renderAlbaranes(mockAlbaranes);
}

/**
 * Renderiza los iconos de ordenación en la tabla.
 */
function renderSortIcons() {
    // Limpiar todos los iconos
    document.querySelectorAll('.sort-icon').forEach(icon => {
        icon.innerHTML = '';
    });

    // Añadir el icono a la columna activa
    const activeIconElement = document.getElementById(`sort-${sortState.column}`);
    if (activeIconElement) {
        if (sortState.direction === 'asc') {
            // Flecha hacia arriba
            activeIconElement.innerHTML = `<svg data-lucide="chevron-up" class="h-4 w-4"></svg>`;
        } else {
            // Flecha hacia abajo
            activeIconElement.innerHTML = `<svg data-lucide="chevron-down" class="h-4 w-4"></svg>`;
        }
         // Ejecutar Lucide para convertir el tag <i> en icono SVG
        lucide.createIcons();
    }
}

/**
 * Renderiza la tabla de albaranes y el total.
 */
function renderAlbaranes(data = mockAlbaranes) {
    const resultsBody = document.getElementById('albaranResults');
    const totalFooter = document.getElementById('albaranTotal');
    resultsBody.innerHTML = '';
    
    let totalImporte = 0;

    if (data.length === 0) {
        resultsBody.innerHTML = `<tr><td colspan="10" class="text-center py-6 text-gray-500 italic">No se encontraron resultados que coincidan con los filtros.</td></tr>`;
        totalFooter.innerHTML = '';
    } else {
        data.forEach(albaran => {
            totalImporte += albaran.importe;

            const row = `
                <tr class="hover:bg-primary-pastel/30 ${albaran.id % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
                    <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">${albaran.numero_albaran}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${albaran.fecha}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">${albaran.licencia}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${albaran.empresa_nombre}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${albaran.referencia}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-semibold text-right">€${albaran.importe.toFixed(2)}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm">${getStateHtml(albaran.state)}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${albaran.num_factura || '-'}</td>
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
    }

    // Renderizar el pie de tabla con el total
    totalFooter.innerHTML = `
        <tr class="total-row">
            <td colspan="5" class="px-4 py-3 text-right">TOTAL</td>
            <td class="px-4 py-3 text-right">€${totalImporte.toFixed(2)}</td>
            <td colspan="4" class="px-4 py-3"></td>
        </tr>
    `;

    // Ejecutar Lucide para convertir los tags <i> en iconos SVG
    lucide.createIcons();

    // Renderizar el icono de ordenación
    renderSortIcons();
}

/**
 * Maneja el envío del formulario de búsqueda (simulado).
 */
function handleSearch(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const searchParams = Object.fromEntries(formData.entries());

    const statusMessage = document.getElementById('statusMessage');
    
    console.log("Parámetros de búsqueda:", searchParams);

    // Simulación de filtro: Filtramos una copia de los datos
    const filteredResults = mockAlbaranes.filter(albaran => {
        const matchCompany = !searchParams.empresa || albaran.empresa_nombre.toLowerCase() === searchParams.empresa;
        const matchState = !searchParams.state || albaran.state.toLowerCase() === searchParams.state;
        const matchLicencia = !searchParams.licencia || albaran.licencia.toLowerCase().includes(searchParams.licencia.toLowerCase());
        const matchReferencia = !searchParams.referencia || albaran.referencia.toLowerCase().includes(searchParams.referencia.toLowerCase());
        
        return matchCompany && matchState && matchLicencia && matchReferencia;
    });
    
    // Reemplazar el mock actual con los resultados filtrados para que la ordenación actúe sobre ellos
    // NOTA: En una aplicación real, se cargaría la data del servidor.
    mockAlbaranes = filteredResults; 

    renderAlbaranes(mockAlbaranes); // Renderizar los resultados filtrados

    // Mostrar un mensaje de éxito simulado
    statusMessage.textContent = `Búsqueda realizada con éxito. Mostrando ${filteredResults.length} resultados.`;
    statusMessage.className = 'status-message status-success';
    statusMessage.classList.remove('hidden');

    setTimeout(() => {
        statusMessage.classList.add('hidden');
    }, 3000);
}

/**
 * Muestra un mensaje de alerta en la parte inferior de la tabla.
 * @param {string} message - El texto a mostrar.
 * @param {'success'|'error'|'info'|'neutral'} type - Tipo de mensaje para aplicar la clase CSS semántica.
 */
function alertMessage(message, type) {
    const statusMessage = document.getElementById('statusMessage');
    
    // Resetear las clases para ocultar y limpiar el estado
    statusMessage.className = 'hidden status-message'; 

    const alertClasses = {
        // Usamos las clases semánticas definidas en el <style> incrustado
        success: 'status-success',
        error: 'status-error',
        info: 'status-info',
        neutral: 'status-neutral',
    };

    const chosenClass = alertClasses[type] || alertClasses.info;

    // Aplicar la clase de estado y hacerlo visible
    statusMessage.classList.add(chosenClass);
    statusMessage.classList.remove('hidden');

    let icon = '';
    if (type === 'success') icon = '✅ ';
    else if (type === 'error') icon = '❌ ';
    else if (type === 'info') icon = 'ℹ️ ';
    
    statusMessage.textContent = icon + message;
}

// =================================================================================
// 🚀 INICIALIZACIÓN
// =================================================================================

// Ejecutar carga inicial de tabla cuando el DOM esté completamente cargado.
document.addEventListener('DOMContentLoaded', () => {
    // Aplicar la ordenación inicial (por numero_albaran ascendente) y renderizar
    sortTable('numero_albaran'); 
});