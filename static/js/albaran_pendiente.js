// Archivo albaran_pendiente.js

/**
 * MOCK DATA: Simula 5 albaranes pendientes de pago o envío (Pagado: 'No').
 */
const mockAlbaranesPendientes = [
    {
        id: '10',
        n_albaran: 'SEP2025-010-P',
        fecha: '2025-09-01',
        licencia: '110 PILAR',
        empresa: 'RACE',
        importe_total: 95.00,
        pagado: 'No', // MUST be 'No'
    },
    {
        id: '11',
        n_albaran: 'SEP2025-011-M',
        fecha: '2025-09-05',
        licencia: '211 PABLO',
        empresa: 'Mapfre',
        importe_total: 180.50,
        pagado: 'No', // MUST be 'No'
    },
    {
        id: '12',
        n_albaran: 'SEP2025-012-O',
        fecha: '2025-09-10',
        licencia: '312 OLGA',
        empresa: 'Mutua Madrileña',
        importe_total: 60.00,
        pagado: 'No', // MUST be 'No'
    },
    {
        id: '13',
        n_albaran: 'OCT2025-013-P',
        fecha: '2025-10-01',
        licencia: '110 PILAR',
        empresa: 'RACE',
        importe_total: 250.99,
        pagado: 'No', // MUST be 'No'
    },
    {
        id: '14',
        n_albaran: 'OCT2025-014-M',
        fecha: '2025-10-15',
        licencia: '414 MARCOS',
        empresa: 'Mapfre',
        importe_total: 112.30,
        pagado: 'No', // MUST be 'No'
    },
];

/**
 * Función para renderizar los albaranes en la tabla.
 * @param {Array<Object>} albaranes - Lista de objetos de albarán.
 */
function renderAlbaranes(albaranes) {
    const resultsBody = document.getElementById('albaranResults');
    if (!resultsBody) {
        console.error('El elemento #albaranResults no fue encontrado.');
        return;
    }
    
    // Limpiar resultados anteriores
    resultsBody.innerHTML = '';

    if (albaranes.length === 0) {
        resultsBody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-gray-500">No se encontraron albaranes pendientes.</td></tr>`;
        return;
    }

    albaranes.forEach((albaran, index) => {
        // Estilo condicional para la columna 'Pagado'
        // Usamos Rojo para No Pagado/Pendiente
        const pagadoClass = albaran.pagado === 'Sí' ? 'bg-green-100 text-green-800 font-bold' : 'bg-red-100 text-red-800 font-medium';
        
        // Estilo de la fila
        const rowClass = index % 2 === 0 ? 'bg-gray-50 hover:bg-gray-100' : 'bg-white hover:bg-gray-100';

        const row = document.createElement('tr');
        row.className = rowClass;

        row.innerHTML = `
            <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">${albaran.n_albaran}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${albaran.fecha}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${albaran.licencia}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${albaran.empresa}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm font-bold text-right text-red-600">${albaran.importe_total.toFixed(2)} €</td>
            <td class="px-4 py-3 whitespace-nowrap text-center">
                <span class="inline-flex items-center px-3 py-0.5 rounded-full text-xs ${pagadoClass}">
                    ${albaran.pagado}
                </span>
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-center text-sm font-medium">
                <div class="flex items-center justify-center space-x-2">
                    <button title="Ver/Editar" onclick="handleViewEdit('${albaran.id}')" 
                            class="text-primary-link hover:text-orange-700">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button title="Enviar por Email" onclick="handleEmail('${albaran.id}')" 
                            class="text-blue-500 hover:text-blue-700">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                    </button>
                    <button title="Eliminar" onclick="handleDelete('${albaran.id}')" 
                            class="text-red-500 hover:text-red-700">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                    </button>
                </div>
            </td>
        `;
        resultsBody.appendChild(row);
    });
}

/**
 * Función que simula la búsqueda y renderiza los albaranes.
 * (En un entorno real, esta función haría una llamada a Firestore)
 */
function handleSearch(event) {
    if (event) {
        event.preventDefault();
    }
    // Simular que la búsqueda devuelve los 5 albaranes de MOCK
    renderAlbaranes(mockAlbaranesPendientes);
    
    const statusMessage = document.getElementById('statusMessage');
    statusMessage.textContent = `Mostrando ${mockAlbaranesPendientes.length} albaranes pendientes.`;
    statusMessage.className = 'status-message status-info'; // Usamos info para neutro/pendiente
    statusMessage.classList.remove('hidden');

    // Ocultar mensaje después de unos segundos
    setTimeout(() => {
        statusMessage.classList.add('hidden');
    }, 5000);
}

// Funciones de acción de la tabla (simuladas)
function handleViewEdit(id) {
    console.log(`Ver/Editar Albarán ID: ${id}`);
    // Aquí iría la lógica para redirigir a la vista de edición/detalle
}
function handleEmail(id) {
    console.log(`Enviar Email Albarán ID: ${id}`);
    // Aquí iría la lógica para abrir el modal de envío de email
}
function handleDelete(id) {
    console.log(`Eliminar Albarán ID: ${id}`);
    // Aquí iría la lógica para el modal de confirmación de eliminación
}

// Iniciar la búsqueda y renderizar los 5 albaranes al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    handleSearch();
});