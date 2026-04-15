/**
 * ARCHIVO: static/js/albaran_update.js
 * DESCRIPCIÓN: Lógica de actualización para usuarios (Titulares).
 * ACTUALIZADO: 15/04/2026 - FIX: Compatibilidad con corrección horaria dinámica del Backend.
 */

document.addEventListener('DOMContentLoaded', async () => {
    console.log("%c🚀 [UPDATE] Iniciando motor de edición...", "color: #3B82F6; font-weight: bold;");

    const segments = window.location.pathname.split('/').filter(p => p !== "");
    const albaranId = segments[segments.length - 1];

    if (!albaranId || isNaN(albaranId)) {
        showStatus("ID de albarán no válido", "error");
        return;
    }

    try {
        // 1. Cargar catálogo de empresas primero
        await cargarCatalogoEmpresas();

        // 2. Obtener datos del albarán
        const response = await fetch(`/api/v1/albaranes/id/${albaranId}`, { 
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const result = await response.json();

        if (response.ok && result.data) {
            const data = result.data;
            const albaranIdInput = document.getElementById('albaran_id');
            if (albaranIdInput) albaranIdInput.value = data.id;

            // 3. Usar el motor universal para rellenar el formulario (Fix de zona horaria incluido en Loader)
            if (window.AlbaranLoader) {
                window.AlbaranLoader.populateForm(data);
            }

            // 4. Inicializar formateadores para lógica sexagesimal (.59 máx)
            initUpdateFormatters();
            
            console.log("%c✅ [UPDATE] Datos cargados con ajuste local.", "color: #10B981; font-weight: bold;");
        } else {
            throw new Error(result.error || "No se encontró el albarán.");
        }
    } catch (error) {
        showStatus(error.message, "error");
    }

    // 5. Listener para el envío
    document.getElementById('albaranForm')?.addEventListener('submit', handleFormSubmit);
    if (window.lucide) lucide.createIcons();
});

/**
 * Mantiene el formato numérico y sexagesimal en los inputs al perder el foco
 */
function initUpdateFormatters() {
    const fields = ['importe_suplidos', 'importe_total', 'km_totales', 'hora_total'];
    fields.forEach(name => {
        const input = document.querySelector(`[name="${name}"]`);
        if (input) {
            input.addEventListener('blur', () => {
                let rawVal = input.value.replace(',', '.');
                let val = parseFloat(rawVal);
                if (isNaN(val)) { input.value = "0.00"; return; }
                
                if (name === 'hora_total') {
                    let horas = Math.floor(val);
                    let minutos = Math.round((val - horas) * 100);
                    if (minutos > 59) minutos = 59;
                    input.value = `${horas}.${minutos < 10 ? '0' + minutos : minutos}`;
                } else {
                    input.value = val.toFixed(2);
                }
            });
        }
    });
}

async function cargarCatalogoEmpresas() {
    const select = document.getElementById('empresa');
    if (!select) return;
    try {
        const res = await fetch('/api/v1/empresas', { 
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const result = await res.json();
        const empresas = result.data || [];
        select.innerHTML = '<option value="">-- Seleccionar Empresa --</option>';
        empresas.sort((a,b) => a.nombre.localeCompare(b.nombre)).forEach(emp => {
            select.innerHTML += `<option value="${emp.id}">${emp.nombre.toUpperCase()}</option>`;
        });
    } catch (e) { console.error("Error catálogo:", e); }
}

/**
 * ENVÍO: Sincronización con el Backend Go (Normalización a string plano)
 */
async function handleFormSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('albaran_id').value;
    const btn = e.target.querySelector('button[type="submit"]');

    // Captura literal del valor (HH:mm). El Backend compensará el desfase.
    const getTimeValue = (id) => {
        const el = document.getElementById(id);
        return (el && el.value) ? el.value : "";
    };

    const payload = {
        "fecha":            document.getElementById('fecha').value,
        "hora_ini":         getTimeValue('hora_ini'),
        "hora_fin":         getTimeValue('hora_fin'),
        "espera_ini":       getTimeValue('espera_ini'),
        "espera_fin":       getTimeValue('espera_fin'),
        "nombre_pasajero":  document.getElementById('nombre_pasajero').value,
        "referencia":       document.getElementById('referencia').value,
        "origen":           document.getElementById('origen').value,
        "parada":           document.getElementById('parada').value,
        "destino":          document.getElementById('destino').value,
        "tlf_pasajero":     document.getElementById('tlf_pasajero').value,
        "dni_pasajero":     document.getElementById('dni_pasajero').value,
        "matricula":        document.getElementById('matricula').value,
        "observaciones":    document.getElementById('observaciones').value,
        "autorizado_por":   document.getElementById('autorizado_por').value,
        "asalariado":       document.getElementById('asalariado').value,
        "adjuntos":         document.getElementById('adjuntos_ref').value,

        // Números
        "empresa_ref":      parseInt(document.getElementById('empresa').value) || 0,
        "km_totales":       parseFloat(document.getElementById('km_totales').value.replace(',','.')) || 0,
        "importe_total":    parseFloat(document.getElementById('importe_total').value.replace(',','.')) || 0,
        "importe_suplidos": parseFloat(document.getElementById('importe_suplidos').value.replace(',','.')) || 0,
        "hora_total":       parseFloat(document.getElementById('hora_total').value.replace(',','.')) || 0,
        "num_plazas":       parseInt(document.getElementById('num_plazas').value) || 4,

        // Booleanos
        "urbano":           document.getElementById('urbano').checked,
        "diurno":           document.getElementById('diurno').checked,
        "noct_fest":        document.getElementById('noct_fest').checked,
        "remolque":         document.getElementById('remolque').checked,
        "adjuntos_bool":    document.getElementById('adjuntos_bool').checked
    };

    btn.disabled = true;
    try {
        const res = await fetch(`/api/v1/albaranes/user/${id}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(payload)
        });

        const resData = await res.json();

        if (res.ok) {
            showStatus("✅ Albarán actualizado correctamente.", "success");
            setTimeout(() => window.location.href = '/titulares/pendientes', 1500);
        } else {
            throw new Error(resData.error || "Error al procesar la actualización.");
        }
    } catch (error) {
        showStatus(error.message, "error");
    } finally {
        btn.disabled = false;
    }
}

function showStatus(msg, type) {
    const el = document.getElementById('statusMessage');
    if (!el) return;
    el.className = `mt-6 p-4 rounded-xl text-center font-bold w-full max-w-md border-2 ${
        type === 'success' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'
    }`;
    el.textContent = msg;
    el.classList.remove('hidden');
}