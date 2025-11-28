// Archivo: static/js/albaran_update.js
// Lógica para la MODIFICACIÓN de albaranes existentes.

document.addEventListener('DOMContentLoaded', async function() {
    
    // 1. Obtener ID de la URL (/titulares/update/32 -> 32)
    const albaranID = getAlbaranIDFromURL();

    if (!albaranID) {
        showStatus('❌ Error: ID de albarán no válido.', 'error');
        disableForm();
        return;
    }

    // 2. Cargar datos existentes
    await loadAlbaranData(albaranID);

    // 3. Inicializar utilidades
    setupWordCounter();

    // 4. Función de Acciones (Global)
    window.handleAction = async function(actionType, event = null) {
        const statusMessage = document.getElementById('statusMessage');
        const form = document.getElementById('albaranForm');
        
        // Limpiar mensajes
        if (statusMessage) {
            statusMessage.classList.add('hidden');
            statusMessage.classList.remove('status-success', 'status-error', 'status-info');
        }

        switch (actionType) {
            case 'modificar': // Guardar Cambios
                if (event) event.preventDefault();
                
                // Recoger datos básicos
                const formData = new FormData(form);
                const data = Object.fromEntries(formData.entries());

                // --- SANITIZACIÓN Y CONVERSIÓN DE TIPOS ---

                // 1. Checkboxes (FormData no los envía si están desmarcados, hay que forzarlos)
                const checkboxes = ['urbano', 'diurno', 'noct_fest', 'festivo', 'finalizado', 'enganche'];
                checkboxes.forEach(id => {
                    const el = document.getElementById(id);
                    data[id] = el ? el.checked : false;
                });

                // 2. Números (Convertir strings a float/int)
                data['km_totales'] = parseFloat(data['km_totales']) || 0.0;
                data['km_nacionales'] = parseFloat(data['km_nacionales']) || 0.0;
                data['km_internacionales'] = parseFloat(data['km_internacionales']) || 0.0;
                data['importe_total'] = parseFloat(data['importe_total']) || 0.0;
                data['importe_suplidos'] = parseFloat(data['importe_suplidos']) || 0.0;
                data['num_plazas'] = parseInt(data['num_plazas']) || 4;
                
                // El select de empresa devuelve el ID como string, lo pasamos a int
                data['empresa_ref'] = parseInt(data['empresa_ref']) || 0;

                // 3. Campos Readonly/Fijos (Asegurar que no se envíen vacíos o incorrectos)
                // Nota: El backend suele ignorar updates en campos que no deberían cambiar, 
                // pero enviamos la referencia de licencia original por consistencia.
                // data['licencia_ref'] = ... (generalmente no se toca en update)

                // --- VALIDACIÓN ---
                if (data.importe_total <= 0) {
                    showStatus('❌ El importe total es obligatorio.', 'error');
                    return;
                }

                showStatus('⏳ Guardando cambios...', 'info');

                try {
                    const response = await fetch(`/api/v1/albaranes/${albaranID}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data)
                    });

                    if (response.ok) {
                        showStatus('✅ Albarán actualizado correctamente.', 'success');
                        setTimeout(() => window.location.href = '/titulares', 1000);
                    } else {
                        const err = await response.json();
                        throw new Error(err.error || 'Error al actualizar.');
                    }
                } catch (error) {
                    console.error(error);
                    showStatus(`❌ Error: ${error.message}`, 'error');
                }
                break;
            
            case 'borrar':
                if (confirm('⚠️ ¿Está seguro que desea borrar este Albarán?')) {
                    try {
                        const response = await fetch(`/api/v1/albaranes/${albaranID}`, {
                            method: 'DELETE'
                        });

                        if (response.ok) {
                            showStatus('✅ Albarán eliminado.', 'success');
                            setTimeout(() => window.location.href = '/titulares', 1000);
                        } else {
                            throw new Error('Error al eliminar.');
                        }
                    } catch (error) {
                        showStatus(`❌ Error: ${error.message}`, 'error');
                    }
                }
                break;

            case 'volver':
                window.location.href = '/titulares';
                break;
        }
    };
});

// ============================================================================
// 🛠️ FUNCIONES AUXILIARES
// ============================================================================

function getAlbaranIDFromURL() {
    const pathParts = window.location.pathname.split('/');
    return pathParts[pathParts.length - 1];
}

async function loadAlbaranData(id) {
    try {
        const response = await fetch(`/api/v1/albaranes/${id}`);
        
        if (response.status === 401) {
            window.location.href = '/login';
            return;
        }
        if (!response.ok) throw new Error('No se pudo cargar el albarán.');

        const json = await response.json();
        populateForm(json.data);

    } catch (error) {
        console.error(error);
        showStatus('❌ Error al cargar los datos.', 'error');
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
        if (el && val && val.length >= 10) el.value = val.substring(0, 10);
    };

    // 1. Datos Principales
    // Mostrar código de licencia si está disponible, sino el ID
    const licCode = data.LicenciaData ? data.LicenciaData.Licencia : (data.licencia_ref || '');
    setVal('licencia_display', licCode); 

    setVal('n_albaran', data.numero_albaran || data.NumeroAlbaran);
    setDate('fecha', data.fecha || data.Fecha);
    setVal('empresa', data.empresa_ref || data.EmpresaRef);
    setVal('referencia', data.referencia || data.Referencia);
    setVal('asalariado', data.asalariado || data.Asalariado);

    // 2. Detalles
    setVal('hora', data.hora || data.Hora);
    setVal('dni_pasajero', data.dni_pasajero || data.DniPasajero);
    setVal('matricula', data.matricula || data.Matricula);
    setVal('num_plazas', data.num_plazas || data.NumPlazas);

    // 3. Estado (Checkboxes)
    setCheck('urbano', data.urbano || data.Urbano);
    setCheck('diurno', data.diurno || data.Diurno);
    setCheck('noct_fest', data.noct_fest || data.NoctFest);
    setCheck('festivo', data.festivo || data.Festivo);
    setCheck('finalizado', data.finalizado || data.Finalizado);
    setCheck('enganche', data.enganche || data.Enganche);

    // 4. Trayecto
    setVal('cliente', data.cliente || data.Cliente);
    setVal('origen', data.origen || data.Origen);
    setVal('destino', data.destino || data.Destino);
    setVal('parada', data.parada || data.Parada);

    // 5. Importes
    setVal('km_totales', data.km_totales || data.KmTotales);
    setVal('km_nacionales', data.km_nacionales || data.KmNacionales);
    setVal('km_internacionales', data.km_internacionales || data.KmInternacionales);
    setVal('tiempo_espera', data.tiempo_espera || data.TiempoEspera);
    setVal('importe_total', data.importe_total || data.ImporteTotal);
    setVal('importe_suplidos', data.importe_suplidos || data.ImporteSuplidos);
    setVal('autorizado_por', data.autorizado_por || data.AutorizadoPor);

    // 6. Observaciones
    setVal('observaciones', data.observaciones || data.Observaciones);
    document.getElementById('observaciones')?.dispatchEvent(new Event('input')); // Actualizar contador
}

function showStatus(msg, type) {
    const el = document.getElementById('statusMessage');
    if (!el) return;
    el.textContent = msg;
    el.className = `status-message block mt-4 p-4 text-center text-sm font-medium rounded-lg ${type === 'error' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`;
    if (type === 'success') el.className = 'status-message block mt-4 p-4 text-center text-sm font-medium rounded-lg bg-green-100 text-green-800';
    el.classList.remove('hidden');
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function disableForm() {
    document.querySelectorAll('input, select, textarea, button:not(.btn-volver)').forEach(el => el.disabled = true);
}

function setupWordCounter() {
    const obs = document.getElementById('observaciones');
    if (!obs) return;
    obs.addEventListener('input', function() {
        const count = this.value.trim() ? this.value.trim().split(/\s+/).length : 0;
        document.getElementById('wordCount').textContent = `${count} palabras`;
    });
}