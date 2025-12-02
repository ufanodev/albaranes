// Archivo: static/js/albaran_nuevo.js
// Lógica para la creación de albaranes (Vista Usuario/Titular).

let userLicenciaRef = 0;

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

            const formData = new FormData(form);
            const payload = {};

            // Limpieza y conversión de datos
            for (const [key, value] of formData.entries()) {
                if (typeof value === 'string' && value.trim() === '') continue;

                if (key.startsWith('km_') || key.startsWith('importe_') || key === 'num_plazas' || key.endsWith('_ref')) {
                    const numVal = parseFloat(value);
                    if (!isNaN(numVal)) payload[key] = numVal;
                } else {
                    payload[key] = value;
                }
            }

            // Mapear checkboxes a booleanos
            const checkboxes = ['urbano', 'diurno', 'noct_fest', 'festivo', 'finalizado', 'enganche', 'cobrado', 'pagado'];
            checkboxes.forEach(id => {
                const el = document.getElementById(id);
                payload[id] = el ? el.checked : false;
            });

            payload['licencia_ref'] = userLicenciaRef;
            payload['enviado'] = false;

            if (!payload.numero_albaran || !payload.fecha || !payload.empresa_ref || !payload.importe_total) {
                showStatus('❌ Error: Faltan campos obligatorios (Nº Albarán, Fecha, Empresa o Importe Total).', 'error');
                return;
            }

            try {
                const response = await fetch('/api/v1/albaranes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (response.ok) {
                    showStatus('✅ ¡Albarán creado exitosamente!', 'success');
                    setTimeout(() => window.location.href = '/titulares', 1000);
                } else {
                    const errorText = await response.text();
                    let errorMsg = `Error ${response.status}: `;
                    try {
                        const err = JSON.parse(errorText);
                        errorMsg = err.error || errorMsg;
                    } catch (e) {
                        errorMsg += response.statusText;
                    }
                    throw new Error(errorMsg);
                }
            } catch (error) {
                console.error("-> ❌ FALLO FINAL:", error);
                showStatus(`❌ Error: ${error.message}`, 'error');
            }
            break;

        case 'modificar':
        case 'borrar':
            showStatus('⚠️ Esta acción no está disponible en la pantalla de creación.', 'info');
            break;

        case 'volver':
            window.location.href = '/titulares';
            return;

        default:
            showStatus('⚠️ Acción no implementada.', 'info');
            break;
    }
};

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
        showStatus('❌ Error: No se pudo cargar su licencia. No podrá guardar.', 'error');
        if (licenciaInput) licenciaInput.value = "Error de Carga";
        if (btnGuardar) btnGuardar.disabled = true;
    }
}

async function loadEmpresas() {
    const select = document.getElementById('empresa');
    if (!select) return;

    try {
        select.innerHTML = '<option value="" disabled selected>Cargando empresas...</option>';
        const response = await fetch('/api/v1/empresas');
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
        select.innerHTML = '<option value="" disabled>Error al cargar lista</option>';
        showStatus('❌ Error al cargar la lista de empresas.', 'error');
    }
}

async function loadConductores() {
    const select = document.getElementById('asalariado_select'); 
    if (!select) return;

    try {
        select.innerHTML = '<option value="" selected>Cargando conductores...</option>';
        const response = await fetch('/api/v1/conductores'); 

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
                const conductorName = `${c.Licencia || c.licencia} - ${c.Nombre || c.nombre}`; 
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

document.addEventListener('DOMContentLoaded', async () => {
    await Promise.all([
        loadUserIdentity(), 
        loadEmpresas(),
        loadConductores() 
    ]);
    
    setupWordCounter();
    setDefaultDateTime();
});
