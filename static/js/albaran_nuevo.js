// Archivo: static/js/albaran_nuevo.js

// Variable global para la licencia
let userLicenciaRef = 0;

// ============================================================================
// 1. FUNCIÓN DE ACCIONES (Global y accesible inmediatamente)
// ============================================================================
window.handleAction = async function(actionType, event = null) {
    const statusMessage = document.getElementById('statusMessage');
    const form = document.getElementById('albaranForm');
    
    // Limpiar mensajes previos
    if (statusMessage) {
        statusMessage.classList.add('hidden');
        statusMessage.className = 'hidden mt-4 p-4 text-center text-sm font-medium rounded-lg';
    }

    switch (actionType) {
        case 'crear':
            if (event) event.preventDefault();

            // Validación de seguridad: ¿Tenemos licencia?
            if (userLicenciaRef === 0) {
                showStatus('❌ Error: No se ha cargado la licencia del usuario. Recargue la página.', 'error');
                return;
            }

            const data = {};
            new FormData(form).forEach((value, key) => {
                data[key] = value;
            });
            
            // Mapeo de Checkboxes
            const checkboxes = ['urbano', 'diurno', 'noct_fest', 'festivo', 'finalizado', 'enganche', 'cobrado', 'pagado'];
            checkboxes.forEach(id => {
                const el = document.getElementById(id);
                data[id] = el ? el.checked : false;
            });

            // Conversión de Tipos Numéricos
            data['km_totales'] = parseFloat(data['km_totales']) || 0.0;
            data['km_nacionales'] = parseFloat(data['km_nacionales']) || 0.0;
            data['km_internacionales'] = parseFloat(data['km_internacionales']) || 0.0;
            data['importe_total'] = parseFloat(data['importe_total']) || 0.0;
            data['importe_suplidos'] = parseFloat(data['importe_suplidos']) || 0.0;
            data['empresa_ref'] = parseInt(data['empresa_ref']) || 0;
            data['num_plazas'] = parseInt(data['num_plazas']) || 4;
            
            // 🛑 FORZAR LA LICENCIA DEL USUARIO (Seguridad)
            data['licencia_ref'] = userLicenciaRef;

            // Validación Básica
            if (data.empresa_ref === 0 || data.importe_total <= 0) {
                showStatus('❌ Error: EMPRESA e IMPORTE TOTAL son obligatorios.', 'error');
                return;
            }
            
            // ENVÍO A LA API
            try {
                const response = await fetch('/api/v1/albaranes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });

                if (response.ok) {
                    showStatus('✅ ¡Albarán creado exitosamente!', 'success');
                    // Redirigir tras 1.5 segundos a la lista (/titulares -> busqueda.html)
                    setTimeout(() => window.location.href = '/titulares', 1500);
                } else {
                    const err = await response.json();
                    throw new Error(err.error || 'Error al guardar.');
                }
            } catch (error) {
                console.error(error);
                showStatus(`❌ Error: ${error.message}`, 'error');
            }
            break;
        
        case 'modificar':
        case 'borrar':
            showStatus('⚠️ Esta acción no está disponible en la pantalla de creación.', 'info');
            break;
        
        case 'volver':
            console.log("Navegando a /titulares");
            // REDIRECCIÓN CORRECTA A BUSQUEDA.HTML (Mapeada en routes.go)
            window.location.href = '/titulares'; 
            return; 
    }
};

// ============================================================================
// 2. LÓGICA DE CARGA DE DATOS
// ============================================================================

async function loadUserIdentity() {
    const licenciaInput = document.getElementById('licencia');
    if (licenciaInput) licenciaInput.placeholder = "Cargando...";

    try {
        console.log("🔍 Solicitando licencia del usuario...");
        const response = await fetch('/api/v1/user/licencia_ref');
        
        if (response.status === 401) {
            console.warn("Sesión expirada, redirigiendo a login.");
            window.location.href = '/login';
            return;
        }

        if (!response.ok) throw new Error('Error en la respuesta del servidor');

        const data = await response.json();
        console.log("✅ Datos recibidos:", data);
        
        if (data.licencia_ref && data.licencia_ref > 0) {
            userLicenciaRef = data.licencia_ref;
            
            // Rellenar el input
            if (licenciaInput) {
                licenciaInput.value = userLicenciaRef;
                licenciaInput.classList.add('bg-gray-200', 'text-gray-600', 'cursor-not-allowed'); // Estilo visual de bloqueado
                licenciaInput.readOnly = true;
            }
        } else {
            showStatus('❌ Error: Su usuario no tiene una licencia válida asignada.', 'error');
            if (licenciaInput) licenciaInput.value = "Sin Asignar";
        }

    } catch (error) {
        console.error('Error cargando identidad:', error);
        showStatus('Error de conexión al cargar licencia.', 'error');
    }
}

// ============================================================================
// 3. UTILIDADES DE UI
// ============================================================================

function showStatus(msg, type) {
    const el = document.getElementById('statusMessage');
    if (!el) return;
    
    el.textContent = msg;
    el.className = 'status-message block mt-4 p-4 text-center text-sm font-medium rounded-lg'; // Reset base classes
    
    if (type === 'success') el.classList.add('bg-green-100', 'text-green-800', 'border', 'border-green-300');
    else if (type === 'error') el.classList.add('bg-red-100', 'text-red-800', 'border', 'border-red-300');
    else el.classList.add('bg-blue-100', 'text-blue-800', 'border', 'border-blue-300');
    
    el.classList.remove('hidden');
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function setupWordCounter() {
    const observaciones = document.getElementById('observaciones');
    if (!observaciones) return;
    observaciones.addEventListener('input', function() {
        const text = this.value.trim();
        const count = text ? text.split(/\s+/).filter(w => w.length > 0).length : 0;
        const counter = document.getElementById('wordCount');
        if (counter) counter.textContent = `${count} palabras`;
    });
}

function setDefaultDateTime() {
    const now = new Date();
    const fechaInput = document.getElementById('fecha');
    const horaInput = document.getElementById('hora');

    if (fechaInput && !fechaInput.value) fechaInput.value = now.toISOString().split('T')[0];
    
    if (horaInput && !horaInput.value) {
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        horaInput.value = `${hours}:${minutes}`;
    }
}

// ============================================================================
// 4. INICIALIZACIÓN
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    loadUserIdentity();
    setupWordCounter();
    setDefaultDateTime();
});