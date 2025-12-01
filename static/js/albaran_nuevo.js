// Archivo: static/js/albaran_nuevo.js
// Lógica para la creación de albaranes (Vista Usuario/Titular).

// Variable global para almacenar la licencia validada por el backend
let userLicenciaRef = 0;

// ============================================================================
// 1. FUNCIÓN DE ACCIONES (Global y accesible inmediatamente)
// ============================================================================
window.handleAction = async function(actionType, event = null) {
    const statusMessage = document.getElementById('statusMessage');
    const form = document.getElementById('albaranForm');
    
    if (statusMessage) {
        statusMessage.classList.add('hidden');
        statusMessage.classList.remove('status-success', 'status-error', 'status-info');
    }

    switch (actionType) {
        case 'crear':
            if (event) event.preventDefault();

            if (userLicenciaRef === 0) {
                showStatus('❌ Error Crítico: No se ha identificado su licencia. Recargue la página.', 'error');
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

            // Conversión de Tipos
            data['km_totales'] = parseFloat(data['km_totales']) || 0.0;
            data['km_nacionales'] = parseFloat(data['km_nacionales']) || 0.0;
            data['km_internacionales'] = parseFloat(data['km_internacionales']) || 0.0;
            data['importe_total'] = parseFloat(data['importe_total']) || 0.0;
            data['importe_suplidos'] = parseFloat(data['importe_suplidos']) || 0.0;
            data['empresa_ref'] = parseInt(data['empresa_ref']) || 0;
            data['num_plazas'] = parseInt(data['num_plazas']) || 4;
            
            // 🔒 INYECCIÓN SEGURA DE LA LICENCIA
            data['licencia_ref'] = userLicenciaRef;

            // Validación de Campos
            if (data.empresa_ref === 0 || data.importe_total <= 0) {
                showStatus('❌ Error: Debe seleccionar una EMPRESA e indicar el IMPORTE TOTAL.', 'error');
                return;
            }
            
            // Envío a la API
            try {
                const response = await fetch('/api/v1/albaranes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });

                if (response.ok) {
                    showStatus('✅ ¡Albarán creado exitosamente!', 'success');
                    setTimeout(() => window.location.href = '/titulares', 1000);
                } else {
                    const err = await response.json();
                    throw new Error(err.error || 'Error al guardar.');
                }
            } catch (error) {
                console.error(error);
                showStatus(`❌ Error: ${error.message}`, 'error');
            }
            break;
        
        case 'volver':
            window.location.href = '/titulares'; 
            return; 
        default:
            showStatus('⚠️ Acción no implementada.', 'info');
            break;
    }
};

// ============================================================================
// 2. LÓGICA DE CARGA DE DATOS Y RECURSOS
// ============================================================================

async function loadUserIdentity() {
    const licenciaInput = document.getElementById('licencia');
    const btnGuardar = document.querySelector('.btn-crear');

    if (licenciaInput) {
        licenciaInput.value = ""; 
        licenciaInput.placeholder = "Cargando ID...";
    }

    try {
        const response = await fetch('/api/v1/user/licencia_ref');
        
        if (response.status === 401) { window.location.href = '/login'; return; }
        if (!response.ok) throw new Error('Error al obtener licencia');

        const data = await response.json();
        
        if (data.licencia_ref && data.licencia_ref > 0) {
            userLicenciaRef = data.licencia_ref;
            
            if (licenciaInput) {
                licenciaInput.value = userLicenciaRef;
                licenciaInput.classList.add('bg-gray-200', 'text-gray-600', 'cursor-not-allowed');
                licenciaInput.setAttribute('readonly', true);
            }
            if (btnGuardar) btnGuardar.disabled = false;

        } else {
            throw new Error('Usuario sin licencia asignada');
        }

    } catch (error) {
        console.error('🔴 Error cargando identidad:', error);
        showStatus('❌ Error: No se pudo cargar su licencia. No podrá guardar.', 'error');
        if (licenciaInput) licenciaInput.value = "Error de Carga";
        if (btnGuardar) {
            btnGuardar.disabled = true;
            btnGuardar.classList.add('opacity-50', 'cursor-not-allowed');
        }
    }
}

/**
 * Carga las opciones de empresas desde la API y rellena el select.
 */
async function loadEmpresas() {
    const select = document.getElementById('empresa');
    if (!select) return;

    try {
        select.innerHTML = '<option value="" disabled selected>Cargando empresas...</option>';
        
        const response = await fetch('/api/v1/empresas'); 

        if (response.status === 401) { window.location.href = '/login'; return; }
        if (!response.ok) throw new Error(`Error ${response.status} al cargar la lista.`);

        const json = await response.json();
        const empresas = json.data; 

        select.innerHTML = '<option value="" disabled selected>Seleccione una empresa</option>';

        if (empresas && empresas.length > 0) {
            empresas.forEach(emp => {
                const option = document.createElement('option');
                option.value = emp.id; 
                option.textContent = emp.nombre; 
                select.appendChild(option);
            });
        } else {
            select.innerHTML = '<option value="" disabled>No hay empresas registradas</option>';
        }
        
    } catch (error) {
        console.error("🔴 Error en loadEmpresas:", error);
        select.innerHTML = '<option value="" disabled>Error al cargar lista</option>';
        showStatus('❌ Error al cargar la lista de empresas.', 'error');
    }
}

/**
 * Carga las opciones de conductores (asalariados).
 */
async function loadConductores() {
    const select = document.getElementById('asalariado_select'); // ID del SELECT en el HTML
    if (!select) return;

    try {
        select.innerHTML = '<option value="" selected>Cargando conductores...</option>';
        
        // 🚨 Fetch a la ruta GET /api/v1/conductores
        const response = await fetch('/api/v1/conductores'); 

        if (response.status === 401) { window.location.href = '/login'; return; }
        // Nota: Si el usuario NO es admin, esta ruta devolverá 403 Forbidden.
        if (response.status === 403) {
             select.innerHTML = '<option value="" selected>Sin permisos para ver lista</option>';
             return;
        }

        if (!response.ok) throw new Error(`Error ${response.status} al cargar conductores.`);

        const json = await response.json();
        const conductores = json.data;

        select.innerHTML = '<option value="" selected>Seleccione un conductor (opcional)</option>';

        if (conductores && conductores.length > 0) {
            conductores.forEach(c => {
                const option = document.createElement('option');
                // Formato: LICENCIA + NOMBRE (ej: 001 - Juan Pérez)
                // El valor que se envía al backend es el string completo (licencia y nombre)
                const conductorName = `${c.Licencia || c.licencia} ${c.Nombre || c.nombre}`; 
                option.value = conductorName; 
                option.textContent = conductorName; 
                select.appendChild(option);
            });
        }
        
    } catch (error) {
        console.error("🔴 Error en loadConductores:", error);
        select.innerHTML = '<option value="" selected>Error al cargar lista</option>';
    }
}


// ============================================================================
// 4. INICIALIZACIÓN
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
    // ⚠️ Ejecutar Identity y Recursos en paralelo
    await Promise.all([
        loadUserIdentity(), 
        loadEmpresas(),
        loadConductores() // CARGA CONDUCTORES AÑADIDA AQUÍ
    ]);
    
    setupWordCounter();
    setDefaultDateTime();
});

// ... (Resto de funciones utilitarias se mantienen igual) ...
function showStatus(msg, type) {
    const el = document.getElementById('statusMessage');
    if (!el) return;
    
    el.textContent = msg;
    el.className = 'status-message block mt-4 p-4 text-center text-sm font-medium rounded-lg';
    
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
        document.getElementById('wordCount').textContent = `${count} palabras`;
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