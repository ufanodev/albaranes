/**
 * albaran_update.js - Panel Titular
 * Gestión de edición con blindaje contra errores de API y seguridad JWT.
 */

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Obtener ID del albarán desde la URL
    const urlParts = window.location.pathname.split('/');
    const albaranId = urlParts[urlParts.length - 1];

    if (!albaranId || isNaN(albaranId)) {
        showError("ID de albarán no detectado.");
        return;
    }

    console.log(`🚀 [UPDATE] Iniciando edición para ID: ${albaranId}`);

    try {
        // 2. CARGA DE DICCIONARIOS (Con blindaje individual)
        // Usamos Promise.allSettled para que si conductores da 404, empresas sí cargue.
        await Promise.allSettled([
            loadSelectData('/api/v1/empresas', 'empresa', 'nombre'),
            loadSelectData('/api/v1/conductores/mis-conductores', 'asalariado_select', 'nombre', true)
        ]);

        // 3. RECUPERAR DATOS DEL ALBARÁN
        const response = await fetch(`/api/v1/albaranes/id/${albaranId}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        
        // Validar si la respuesta es JSON antes de procesar (Evita SyntaxError)
        const contentType = response.headers.get("content-type");
        if (!response.ok || !contentType || !contentType.includes("application/json")) {
            throw new Error("El servidor no devolvió un JSON válido para el albarán.");
        }

        const result = await response.json();

        // 4. POBLAR FORMULARIO (Usa albaran_cargar.js)
        if (typeof populateForm === 'function') {
            populateForm(result.data);
            
            // Sincronización de campos específicos de la vista Update
            if(document.getElementById('albaran_id')) document.getElementById('albaran_id').value = result.data.id;
            if(document.getElementById('header_num')) document.getElementById('header_num').textContent = `#${result.data.numero_albaran}`;
        } else {
            throw new Error("Motor de carga (albaran_cargar.js) no encontrado.");
        }

    } catch (err) {
        console.error("❌ [ERROR FLUJO]:", err.message);
        showError("No se pudieron cargar todos los datos: " + err.message);
    }
});

/**
 * Carga datos para selectores con manejo de errores y Token
 */
async function loadSelectData(url, elementId, textField, useTextAsValue = false) {
    const select = document.getElementById(elementId);
    if (!select) return;

    try {
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });

        if (!response.ok) throw new Error(`Status ${response.status}`);

        const json = await response.json();
        const list = json.data || json;

        if (Array.isArray(list)) {
            // Preservar la opción por defecto si existe
            const defaultOpt = select.options[0] ? select.options[0].outerHTML : '<option value="">Seleccione...</option>';
            
            select.innerHTML = defaultOpt + list.map(item => {
                const val = useTextAsValue ? item[textField] : item.id;
                return `<option value="${val}">${item[textField]}</option>`;
            }).join('');
        }
    } catch (e) {
        console.warn(`⚠️ No se pudo cargar el selector ${elementId} (Ruta: ${url}). Continuando...`);
        // No bloqueamos la ejecución, solo dejamos el select con su opción por defecto
    }
}

// 5. MANEJO DEL ENVÍO (Mantiene las reglas de integridad de IDs)
const albaranForm = document.getElementById('albaranForm');
if (albaranForm) {
    albaranForm.onsubmit = async (e) => {
        e.preventDefault();
        const albaranId = window.location.pathname.split('/').pop();
        
        const formData = new FormData(albaranForm);
        const payload = Object.fromEntries(formData.entries());

        // Checkboxes
        ['urbano', 'diurno', 'noct_fest', 'remolque', 'adjuntos'].forEach(id => {
            const el = document.getElementById(id);
            if (el) payload[id] = el.checked;
        });

        // Conversión numérica para Go
        payload.empresa_ref = parseInt(payload.empresa_ref) || 0;
        payload.num_plazas = parseInt(payload.num_plazas) || 0;
        ['km_totales', 'importe_suplidos', 'importe_total'].forEach(f => {
            payload[f] = parseFloat(payload[f]) || 0;
        });

        // REGLA 2025-12-17: El ID se envía en la URL, se quita del body
        delete payload.id;

        try {
            const res = await fetch(`/api/v1/albaranes/${albaranId}`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || "Error al actualizar");
            }

            showStatus("✅ Albarán actualizado correctamente", "success");
            setTimeout(() => window.location.href = '/titulares', 1500);

        } catch (err) {
            showError(err.message);
        }
    };
}

function showError(msg) {
    const el = document.getElementById('statusMessage');
    if (el) {
        el.textContent = msg;
        el.className = "mt-6 p-4 bg-red-100 text-red-700 border-2 border-red-200 rounded-xl text-center font-bold block";
        el.classList.remove('hidden');
    }
}

function showStatus(msg, type) {
    const el = document.getElementById('statusMessage');
    if (el) {
        el.textContent = msg;
        el.className = `mt-6 p-4 rounded-xl text-center font-bold block border-2 ${
            type === 'success' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-blue-100 text-blue-700 border-blue-200'
        }`;
        el.classList.remove('hidden');
    }
}