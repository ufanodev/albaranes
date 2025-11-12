// =================================================================================
// 📚 FUNCIONES PRINCIPALES
// =================================================================================

/**
 * Simula la carga de datos en la tabla de albaranes.
 */
function cargarDatosTabla() {
    // 1. Datos simulados
    const dummyData = Array.from({length: 20}, (_, i) => ({
        id: i + 1,
        num: `ENERO2025-804-${i + 1}`,
        fecha: `01/01/2025`,
        licencia: `77`,
        empresa: (i % 3 === 0) ? 'RACE' : ((i % 3 === 1) ? 'Mapfre' : 'Mutua'),
        importe: (120.50 + i * 5).toFixed(2),
        // Usamos 'Sí'/'No' para que la clase de estilo se aplique en el HTML
        pagado: (i % 4 === 0) ? 'Sí' : 'No', 
    }));

    const tableBody = document.getElementById('albaranResults');
    tableBody.innerHTML = ''; // Limpiar tabla antes de rellenar

    // 2. Rellenar tabla
    dummyData.forEach(item => {
        const row = document.createElement('tr');
        // Aplicar clases de hover y alternar color de fondo
        row.classList.add('hover:bg-primary-pastel/30', (item.id % 2 === 0 ? 'bg-white' : 'bg-gray-50'));

        // Clase de Tailwind para el estado Pagado/No Pagado
        const pagoClase = item.pagado === 'Sí' ? 'bg-green-100 text-green-800' : 'bg-red-400 text-white'; 

        row.innerHTML = `
            <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">${item.num}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${item.fecha}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${item.licencia}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${item.empresa}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm font-bold text-primary-link">€${item.importe}</td>
            <td class="px-4 py-3 whitespace-nowrap text-xs">
                <span class="px-2 inline-flex leading-5 font-semibold rounded-full ${pagoClase}">
                    ${item.pagado}
                </span>
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-center">
                <a href="albaran_view.html?num=${item.num}" 
                    title="Ver Detalle" 
                    class="text-primary-link hover:text-orange-600 p-1 rounded-full hover:bg-primary-pastel/50 transition duration-150">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                </a>
                
                <a href="albaran_update.html?num=${item.num}" 
                    title="Editar Albarán" 
                    class="text-gray-600 hover:text-gray-900 p-1 rounded-full hover:bg-gray-200 transition duration-150 ml-2">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5l-2.5 2.5m-7 7l7-7l2.5 2.5l-7 7z"/><path d="M15 5l2 2"/></svg>
                </a>
            </td>
        `;
        tableBody.appendChild(row);
    });
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

/**
 * Maneja el submit del formulario de búsqueda y recolecta los datos.
 * @param {Event} event - El evento de submit del formulario.
 */
function handleSearch(event) {
    event.preventDefault();
    const form = event.target;
    
    // 💡 MEJORA: Obtener todos los datos del formulario de forma concisa (ES6+)
    const data = Object.fromEntries(new FormData(form).entries());
    
    console.log("--- FILTROS DE BÚSQUEDA APLICADOS ---");
    console.log(JSON.stringify(data, null, 2));
    
    // Simular actualización de tabla filtrada
    cargarDatosTabla();

    alertMessage('Filtros aplicados. Resultados de la tabla actualizados (simulación).', 'success');
}

// =================================================================================
// 🚀 INICIALIZACIÓN
// =================================================================================

// Ejecutar carga inicial de tabla cuando el DOM esté completamente cargado.
document.addEventListener('DOMContentLoaded', () => {
    cargarDatosTabla();
});