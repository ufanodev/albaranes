// Archivo: static/js/albaran_copiar.js
// Lógica para cargar un albarán existente y guardarlo como COPIA (POST).

let albaranID = null; // El ID del albarán original

// Funciones auxiliares
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

/**
 * Deshabilita todos los campos del formulario.
 */
function disableForm() {
    document.querySelectorAll('input, select, textarea, button').forEach(el => {
        // Excluye el botón de volver para que el usuario siempre pueda navegar
        if (el.getAttribute('onclick') !== "handleAction('volver')") el.disabled = true;
    });
}

/**
 * Desbloquea todos los campos, incluyendo la eliminación de 'readonly'.
 * @param {boolean} unlock - Si es true, desbloquea todos los campos.
 */
function toggleAllFields(unlock) {
    document.querySelectorAll('input, select, textarea').forEach(el => {
        // 1. Manipulamos la propiedad 'disabled'
        el.disabled = !unlock;
        
        // 2. Manipulamos el atributo 'readonly' (CRÍTICO para campos como 'licencia')
        if (unlock) {
            el.removeAttribute('readonly'); 
            el.classList.remove('bg-gray-100', 'cursor-not-allowed', 'readonly-field');
        } else {
            // Si no es modo admin, y el elemento tiene id 'licencia' o es un campo fijo,
            // aseguramos que sea readonly si el HTML lo tiene por defecto.
            if (el.id === 'licencia') {
                el.setAttribute('readonly', true);
                el.classList.add('readonly-field');
            }
        }
    });
    
    if (unlock) {
        // Habilita el botón de borrar (aunque se recomienda ocultarlo en la vista de copia)
        const deleteBtn = document.getElementById('btn-borrar');
        if (deleteBtn) deleteBtn.disabled = false;
        
        console.log("🔓 Modo de Administrador: Todos los campos desbloqueados.");
    } else {
        console.log("🔒 Modo de Usuario normal: Solo campos editables por defecto.");
    }
}

function setupWordCounter() {
    const obs = document.getElementById('observaciones');
    if (!obs) return;
    obs.addEventListener('input', function() {
        const text = this.value.trim();
        const count = text ? text.split(/\s+/).filter(w => w.length > 0).length : 0;
        document.getElementById('wordCount').textContent = `${count} palabras`;
    });
}

function getAlbaranIDFromURL() {
    // Detectamos la URL esperada para copiar: /.../copiar/<ID>
    const pathParts = window.location.pathname.split('/');
    const id = pathParts[pathParts.length - 1];
    return (id && !isNaN(id)) ? id : null;
}

/**
 * ✅ NUEVA FUNCIÓN: Restablece los campos que deben ser nuevos para la copia (Nº Albarán, estados, etc.).
 */
function resetNewFields() {
    const today = new Date().toISOString().substring(0, 10);
    
    // 1. Campos que deben ser reiniciados
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
    };

    // Estos campos no deben copiarse o deben tener un valor por defecto
    setVal('n_albaran', ''); // El número de albarán será nuevo
    setVal('num_factura', ''); 
    setVal('fecha_cobro', ''); 
    
    // 2. Reiniciar los estados de control (Se asume que la copia es un albarán 'Creado')
    const setCheck = (id, checked) => {
        const el = document.getElementById(id);
        if (el) el.checked = checked;
    };
    
    setCheck('finalizado', false);
    setCheck('cobrado', false);
    setCheck('pagado', false);
    
    // 3. Establecer la fecha de hoy por defecto para el nuevo albarán
    setVal('fecha', today);

    console.log("🔄 Campos sensibles (Nº Albarán, Factura, Estados) reiniciados para la copia.");
}

// Carga recursos
async function loadEmpresas() {
    const select = document.getElementById('empresa');
    if (!select) return;

    try {
        const response = await fetch('/api/v1/empresas');
        if (!response.ok) throw new Error(`Error ${response.status}`);
        const json = await response.json();
        const empresas = json.data;

        select.innerHTML = '<option value="" disabled selected>Seleccione...</option>';
        empresas.forEach(emp => {
            const option = document.createElement('option');
            option.value = emp.id;
            option.textContent = emp.nombre;
            select.appendChild(option);
        });
    } catch {
        select.innerHTML = '<option value="" disabled>Error de carga de empresas</option>';
    }
}

async function loadConductores() {
    const select = document.getElementById('asalariado_select');
    if (!select) return;

    try {
        select.innerHTML = '<option value="" selected>Seleccione un conductor (opcional)</option>';

        const response = await fetch('/api/v1/conductores');
        if (response.status === 403) {
            select.innerHTML = '<option value="" selected>Sin permisos para ver lista</option>';
            return;
        }
        if (!response.ok) throw new Error(`Error ${response.status} al cargar conductores.`);

        const json = await response.json();
        const conductores = json.data;

        conductores.forEach(c => {
            const option = document.createElement('option');
            const licencia = c.Licencia || c.licencia;
            option.value = licencia;
            option.textContent = `${licencia} - ${c.Nombre || c.nombre}`;
            select.appendChild(option);
        });
    } catch {
        select.innerHTML = '<option value="" selected>Error de carga de conductores</option>';
    }
}

// Carga y pobla formulario
async function loadAlbaranData(id) {
    showStatus('Cargando datos del albarán original...', 'info');

    try {
        const response = await fetch(`/api/v1/albaranes/${id}`);
        if (response.status === 401) { window.location.href = '/login'; return; }
        if (!response.ok) throw new Error('No se pudo cargar el albarán original.');

        const json = await response.json();
        const data = json.data;

        populateForm(data);
        resetNewFields(); // ✅ CAMBIO CLAVE: Reiniciar campos para la COPIA
        showStatus(`Copiando Albarán Nº: ${data.numero_albaran}. Rellene los campos necesarios.`, 'info');
    } catch {
        showStatus('❌ Error al cargar los datos. Intente nuevamente.', 'error');
        disableForm();
    }
}

function populateForm(data) {
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = (val !== null && val !== undefined) ? val : '';
    };
    const setCheck = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.checked = (val === true || val === 1);
    };
    const setDate = (id, val) => {
        const el = document.getElementById(id);
        if (el && val && typeof val === 'string' && val.length >= 10)
            el.value = val.substring(0, 10);
    };
    const setSelect = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
    };

    const licCode = data.LicenciaData ? data.LicenciaData.licencia : data.licencia_ref;
    setVal('licencia', licCode);

    setVal('n_albaran', data.numero_albaran || data.NumeroAlbaran);
    setDate('fecha', data.fecha || data.Fecha);
    setSelect('empresa', data.empresa_ref || data.EmpresaRef);
    setVal('referencia', data.referencia || data.Referencia);

    const conductorSeleccionado = data.licencia_conductor || data.asalariado || data.Asalariado || '';
    setSelect('asalariado_select', conductorSeleccionado);

    setVal('hora', data.hora ? data.hora.substring(11,16) : '');
    setVal('tiempo_espera', data.tiempo_espera ? data.tiempo_espera.substring(11,16) : '');
    setVal('dni_pasajero', data.dni_pasajero || data.DniPasajero);
    setVal('matricula', data.matricula || data.Matricula);
    setSelect('num_plazas', data.num_plazas || data.NumPlazas);

    setVal('cliente', data.cliente || data.Cliente);
    setVal('origen', data.origen || data.Origen);
    setVal('destino', data.destino || data.Destino);
    setVal('parada', data.parada || data.Parada);

    setVal('km_totales', data.km_totales || data.KmTotales);
    setVal('importe_total', data.importe_total || data.ImporteTotal);
    setVal('importe_suplidos', data.importe_suplidos || data.ImporteSuplidos);
    setVal('autorizado_por', data.autorizado_por || data.AutorizadoPor);

    setCheck('urbano', data.urbano || data.Urbano);
    setCheck('diurno', data.diurno || data.Diurno);
    setCheck('noct_fest', data.noct_fest || data.NoctFest);
    setCheck('festivo', data.festivo || data.Festivo);
    setCheck('finalizado', data.finalizado || data.Finalizado);
    setCheck('enganche', data.enganche || data.Enganche);
    setCheck('cobrado', data.cobrado || data.Cobrado);
    setCheck('pagado', data.pagado || data.Pagado);

    setVal('observaciones', data.observaciones || data.Observaciones);
    document.getElementById('observaciones')?.dispatchEvent(new Event('input'));

    setVal('num_factura', data.num_factura || data.NumFactura);
    setDate('fecha_cobro', data.fecha_cobro || data.FechaCobro);
}

// Manejo de acciones
window.handleAction = async function(actionType, event = null) {
    if (!albaranID) {
        showStatus('❌ Error: No se ha identificado el albarán original.', 'error');
        return;
    }

    const form = document.getElementById('albaranForm');

    if (actionType === 'guardar_copia') { // ✅ CAMBIO CLAVE: Nueva acción para la copia
        if (event) event.preventDefault();

        const formData = new FormData(form);
        const data = {};

        // Checkbox a booleanos
        const checkboxes = ['urbano', 'diurno', 'noct_fest', 'festivo', 'finalizado', 'enganche', 'cobrado', 'pagado'];
        checkboxes.forEach(id => {
            const el = document.getElementById(id);
            data[id] = el ? el.checked : false;
        });

        // Resto de campos
        for (const [key, value] of formData.entries()) {
            if (checkboxes.includes(key)) continue;
            if (typeof value === 'string' && value.trim() === '') continue;
            if (key.startsWith('km_') || key.startsWith('importe_') || key === 'num_plazas' || key.endsWith('_ref')) {
                const numVal = parseFloat(value);
                if (!isNaN(numVal)) data[key] = numVal;
            } else {
                data[key] = value;
            }
        }
        
        // Asignar el valor del campo de licencia
        const licenciaInput = document.getElementById('licencia');
        if (licenciaInput) {
            data.licencia_ref = licenciaInput.value;
        }

        // Concatenar hora con fecha para datetime válido
        if (data.hora && data.fecha) {
            data.hora = `${data.fecha} ${data.hora}:00`;
        }
        if (data.tiempo_espera && data.fecha) {
            data.tiempo_espera = `${data.fecha} ${data.tiempo_espera}:00`;
        }
        
        // IMPORTANTE: Asegurar que se usa el endpoint de CREACIÓN (POST)
        showStatus('⏳ Creando copia del albarán...', 'info');

        try {
            const response = await fetch(`/api/v1/albaranes`, {
                method: 'POST', // ✅ CAMBIO CLAVE: Usamos POST para crear
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                showStatus('✅ Copia del albarán creada correctamente.', 'success');
                // Redirigir al listado principal o al listado de administrador según la URL de origen
                const redirectPath = window.location.pathname.startsWith('/admin') ? '/admin' : '/titulares';
                setTimeout(() => window.location.href = redirectPath, 1000);
            } else {
                const errorText = await response.text();
                let errorMsg = `Error ${response.status}: `;
                try {
                    const err = JSON.parse(errorText);
                    errorMsg = err.error || errorMsg;
                } catch {
                    errorMsg += response.statusText;
                }
                throw new Error(errorMsg);
            }
        } catch (error) {
            console.error(error);
            showStatus(`❌ Error: ${error.message}`, 'error');
        }
        return;
    }

    if (actionType === 'borrar') {
        // El botón de borrar está oculto/deshabilitado en la vista de copia,
        // pero mantenemos la lógica por robustez.
        if (confirm('⚠️ ¿Está seguro que desea borrar este Albarán? Esta acción es irreversible.')) {
            showStatus('🗑️ No se puede borrar un albarán en la vista de copia.', 'error');
        }
        return;
    }

    if (actionType === 'volver') {
        window.history.back();
        return;
    }
};

// Inicialización
document.addEventListener('DOMContentLoaded', async function() {
    albaranID = getAlbaranIDFromURL();
    
    // ✅ CAMBIO CLAVE: Detección del modo Admin mediante la URL de COPIA
    let isAdminMode = window.location.pathname.startsWith('/admin/albaranes/copiar/'); 

    if (!albaranID) {
        showStatus('❌ Error: ID de albarán original no válido en la URL.', 'error');
        disableForm();
        return;
    }

    await Promise.all([
        loadEmpresas(),
        loadConductores()
    ]);

    await loadAlbaranData(albaranID);
    
    // Aplicar lógica de permisos
    if (isAdminMode) {
        toggleAllFields(true); 
    }
    
    // Configurar el botón principal del formulario para 'guardar_copia'
    const form = document.getElementById('albaranForm');
    // ✅ CAMBIO: Enlazar el submit a la acción 'guardar_copia'
    if (form) form.addEventListener('submit', (e) => handleAction('guardar_copia', e));

    // Ocultar/deshabilitar botón de borrar en la vista de copia
    const btnBorrar = document.getElementById('btn-borrar');
    if (btnBorrar) btnBorrar.style.display = 'none';

    setupWordCounter();
});