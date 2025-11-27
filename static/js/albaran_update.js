// Archivo: static/js/albaran_update.js
// Lógica para la actualización de albaranes (Vista Usuario/Titular).

document.addEventListener('DOMContentLoaded', async function() {
    const albaranID = getAlbaranIDFromURL();
    if (!albaranID) {
        showStatus('❌ Error: No se especificó un ID de albarán válido.', 'error');
        return;
    }

    // 1. Cargar datos existentes
    await loadAlbaranData(albaranID);

    // 2. Configurar manejador de envío
    const form = document.getElementById('albaranForm');
    if (form) {
        form.addEventListener('submit', (e) => handleUpdate(e, albaranID));
    }

    // 3. Configurar botón Volver
    const btnVolver = document.getElementById('btn-volver');
    if (btnVolver) {
        btnVolver.addEventListener('click', () => window.location.href = '/titulares');
    }

    setupWordCounter();
});

/**
 * Obtiene el ID del albarán desde la URL (ej: /titulares/update/32 -> 32)
 */
function getAlbaranIDFromURL() {
    const pathParts = window.location.pathname.split('/');
    return pathParts[pathParts.length - 1];
}

/**
 * Carga los datos del albarán desde la API y rellena el formulario.
 */
async function loadAlbaranData(id) {
    try {
        const response = await fetch(`/api/v1/albaranes/${id}`);
        
        if (response.status === 401) {
            window.location.href = '/login';
            return;
        }

        if (!response.ok) throw new Error('Error al cargar el albarán.');

        const json = await response.json();
        const data = json.data;

        populateForm(data);

    } catch (error) {
        console.error(error);
        showStatus('❌ No se pudieron cargar los datos del albarán.', 'error');
        // Deshabilitar formulario si no hay datos
        const inputs = document.querySelectorAll('input, select, textarea, button[type="submit"]');
        inputs.forEach(el => el.disabled = true);
    }
}

/**
 * Rellena el formulario con los datos recibidos.
 */
function populateForm(data) {
    // Helper para asignar valor
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = (val !== null && val !== undefined) ? val : '';
    };
    
    // Helper para checkbox
    const setCheck = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.checked = (val === true || val === 1);
    };

    // Helper para fecha (YYYY-MM-DD)
    const setDate = (id, val) => {
        const el = document.getElementById(id);
        if (el && val) el.value = val.substring(0, 10);
    };

    // Campos principales
    setVal('licencia', data.LicenciaData?.Licencia || data.licencia_ref); // Mostrar código visual si existe
    setVal('n_albaran', data.Numero_albaran || data.numero_albaran);
    setDate('fecha', data.Fecha || data.fecha);
    setVal('empresa', data.EmpresaRef || data.empresa_ref); // Select usa el ID
    setVal('referencia', data.Referencia || data.referencia);
    setVal('asalariado', data.Asalariado || data.asalariado);

    // Detalles
    setVal('hora', data.Hora || data.hora);
    setVal('dni_pasajero', data.Dni_pasajero || data.dni_pasajero);
    setVal('matricula', data.Matricula || data.matricula);
    setVal('num_plazas', data.Num_plazas || data.num_plazas);

    // Viaje
    setVal('cliente', data.Cliente || data.cliente);
    setVal('origen', data.Origen || data.origen);
    setVal('destino', data.Destino || data.destino);
    setVal('parada', data.Parada || data.parada);

    // Importes
    setVal('km_totales', data.Km_totales || data.km_totales);
    setVal('km_nacionales', data.Km_nacionales || data.km_nacionales);
    setVal('km_internacionales', data.Km_internacionales || data.km_internacionales);
    setVal('tiempo_espera', data.Tiempo_espera || data.tiempo_espera);
    setVal('importe_total', data.Importe_total || data.importe_total);
    setVal('importe_suplidos', data.Importe_suplidos || data.importe_suplidos);
    setVal('autorizado_por', data.Autorizado_por || data.autorizado_por);
    setVal('observaciones', data.Observaciones || data.observaciones);

    // Checkboxes
    setCheck('urbano', data.Urbano || data.urbano);
    setCheck('diurno', data.Diurno || data.diurno);
    setCheck('noct_fest', data.Noct_fest || data.noct_fest);
    setCheck('festivo', data.Festivo || data.festivo);
    setCheck('finalizado', data.Finalizado || data.finalizado);
    setCheck('enganche', data.Enganche || data.enganche);
    setCheck('cobrado', data.Cobrado || data.cobrado);
    setCheck('pagado', data.Pagado || data.pagado);
    
    // Disparar evento input para actualizar contador de palabras
    document.getElementById('observaciones')?.dispatchEvent(new Event('input'));
}

/**
 * Maneja el envío del formulario de actualización (PUT).
 */
async function handleUpdate(event, id) {
    event.preventDefault();
    const form = event.target;
    const statusMessage = document.getElementById('statusMessage');
    
    showStatus('Guardando cambios...', 'info');

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

    // Conversión de tipos numéricos
    data['km_totales'] = parseFloat(data['km_totales']) || 0;
    data['importe_total'] = parseFloat(data['importe_total']) || 0;
    data['empresa_ref'] = parseInt(data['empresa_ref']) || 0;
    // ... (convertir otros si necesario)

    try {
        const response = await fetch(`/api/v1/albaranes/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            showStatus('✅ Albarán actualizado correctamente.', 'success');
            // Opcional: Redirigir tras éxito
            // setTimeout(() => window.location.href = '/titulares', 1500);
        } else {
            const err = await response.json();
            throw new Error(err.error || 'Error al actualizar.');
        }
    } catch (error) {
        console.error(error);
        showStatus(`❌ Error: ${error.message}`, 'error');
    }
}

function showStatus(msg, type) {
    const el = document.getElementById('statusMessage');
    if (!el) return;
    el.textContent = msg;
    el.className = `status-message ${type === 'error' ? 'status-error' : (type === 'success' ? 'status-success' : 'status-info')}`;
    el.classList.remove('hidden');
}

function setupWordCounter() {
    const obs = document.getElementById('observaciones');
    if (!obs) return;
    obs.addEventListener('input', function() {
        const text = this.value.trim();
        const count = text ? text.split(/\s+/).length : 0;
        const counter = document.getElementById('wordCount');
        if (counter) counter.textContent = `${count} palabras`;
    });
}