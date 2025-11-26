// Archivo: static/js/albaran_nuevo.js
// Lógica para la creación, modificación y gestión de formularios de albaranes (Para usuarios Titulares/Admin).

document.addEventListener('DOMContentLoaded', function() {
    
    // Función central para manejar todas las acciones de los botones
    window.handleAction = function(actionType, event = null) {
        const statusMessage = document.getElementById('statusMessage');
        const form = document.getElementById('albaranForm');
        
        // Ocultar y limpiar mensaje de estado anterior
        statusMessage.classList.add('hidden');
        statusMessage.classList.remove('status-success', 'status-error', 'status-info');

        switch (actionType) {
            case 'crear':
                if (event) {
                    event.preventDefault(); // Previene el envío por defecto
                }
                const data = {};

                // Recoger datos del formulario
                new FormData(form).forEach((value, key) => {
                    data[key] = value;
                });
                
                // Mapeo y Conversión de Checkboxes a BOOLEANOS
                data['urbano'] = document.getElementById('urbano').checked;
                data['diurno'] = document.getElementById('diurno').checked;
                data['noct_fest'] = document.getElementById('noct_fest').checked;
                data['festivo'] = document.getElementById('festivo').checked;
                data['finalizado'] = document.getElementById('finalizado').checked;
                data['enganche'] = document.getElementById('enganche').checked;
                data['cobrado'] = document.getElementById('cobrado').checked;
                data['pagado'] = document.getElementById('pagado').checked;

                // Conversión de números (para que el backend Go los reciba correctamente)
                data['km_totales'] = parseFloat(data['km_totales']) || 0.0;
                data['km_nacionales'] = parseFloat(data['km_nacionales']) || 0.0;
                data['km_internacionales'] = parseFloat(data['km_internacionales']) || 0.0;
                data['importe_total'] = parseFloat(data['importe_total']) || 0.0;
                data['importe_suplidos'] = parseFloat(data['importe_suplidos']) || 0.0;
                data['licencia_ref'] = parseInt(data['licencia_ref']) || 0;
                data['empresa_ref'] = parseInt(data['empresa_ref']) || 0;
                data['num_plazas'] = parseInt(data['num_plazas']) || 4; // Asumir 4 si no se selecciona

                // --- VALIDACIÓN DE DATOS MÍNIMOS ---
                if (data.licencia_ref === 0 || data.empresa_ref === 0 || data.importe_total <= 0) {
                    statusMessage.textContent = '❌ Error: LICENCIA, EMPRESA e IMPORTE TOTAL son obligatorios y válidos.';
                    statusMessage.classList.add('status-error');
                    statusMessage.classList.remove('hidden');
                    return;
                }
                
                // Aquí iría la llamada fetch(POST /api/v1/albaranes, JSON.stringify(data))
                
                // Simulación de envío (Reemplazar con la llamada fetch real)
                statusMessage.textContent = '✅ ¡CREACIÓN exitosa simulada! El albarán se guardaría.';
                statusMessage.classList.add('status-success');
                statusMessage.classList.remove('hidden');
                console.log("--- DATOS DEL ALBARÁN A ENVIAR ---");
                console.log(JSON.stringify(data, null, 2));
                break;
            
            case 'modificar':
            case 'borrar':
                // Estas acciones son para la vista de UPDATE. Aquí solo simulamos.
                const confirmMessage = (actionType === 'borrar') ? 
                                       '⚠️ ¿Está seguro que desea borrar este Albarán? Esta acción es irreversible.' :
                                       '✏️ ¿Confirmar modificación?';
                
                if (actionType === 'modificar' || confirm(confirmMessage)) {
                    const msg = (actionType === 'modificar') ? 'Modificación simulada.' : 'Borrado simulado.';
                    const type = (actionType === 'modificar') ? 'status-info' : 'status-error';
                    statusMessage.textContent = msg;
                    statusMessage.classList.add(type);
                    statusMessage.classList.remove('hidden');
                    // Aquí iría la llamada fetch(PUT/DELETE /api/v1/albaranes/{id})
                }
                break;
            
            case 'volver':
                // Redirige al usuario a la página de búsqueda/dashboard de titulares
                window.location.href = '/titulares'; 
                return; 
            default:
                return;
        }
    };
    
    // 3. Lógica de inicialización del DOM
    setupWordCounter();
    setDefaultDateTime();

});

// Contador de palabras para Observaciones
function setupWordCounter() {
    const observaciones = document.getElementById('observaciones');
    if (!observaciones) return;
    
    observaciones.addEventListener('input', function() {
        const text = this.value.trim();
        const wordCount = text ? text.split(/\s+/).filter(word => word.length > 0).length : 0;
        
        const wordCountElement = document.getElementById('wordCount');
        if (wordCountElement) {
            wordCountElement.textContent = `${wordCount} palabras`;
        }
    });
}

// Establecer la fecha y hora actuales por defecto
function setDefaultDateTime() {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const currentTime = `${hours}:${minutes}`;

    const fechaInput = document.getElementById('fecha');
    const horaInput = document.getElementById('hora');
    
    if (fechaInput && !fechaInput.value) fechaInput.value = today;
    // Si la hora aún no tiene valor (para no sobrescribir en edición)
    if (horaInput && !horaInput.value) horaInput.value = currentTime;
}