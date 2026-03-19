/**
 * ARCHIVO: static/js/albaran_update.js
 * DESCRIPCIÓN: Lógica de actualización para usuarios (Titulares).
 * FUNCIONALIDAD: Normalización de tiempos HH:mm:ss y mapeo compatible con Go cleanAlbaranMap.
 * ACTUALIZADO: 19/03/2026
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
        const response = await fetch(`/api/v1/albaranes/id/${albaranId}`, { credentials: 'include' });
        const result = await response.json();

        if (response.ok && result.data) {
            document.getElementById('albaran_id').value = result.data.id;
            
            // 3. Usar el motor universal para rellenar el formulario
            // Mapea 'cliente' de la BD al ID 'nombre_pasajero' del HTML
            if (window.AlbaranLoader) {
                window.AlbaranLoader.populateForm(result.data);
            }
            
            console.log("%c✅ [UPDATE] Datos cargados con éxito.", "color: #10B981; font-weight: bold;");
        } else {
            throw new Error(result.error || "No se encontró el albarán.");
        }
    } catch (error) {
        showStatus(error.message, "error");
    }

    // 4. Listener para el envío
    document.getElementById('albaranForm')?.addEventListener('submit', handleFormSubmit);
    if (window.lucide) lucide.createIcons();
});

async function cargarCatalogoEmpresas() {
    const select = document.getElementById('empresa');
    if (!select) return;
    try {
        const res = await fetch('/api/v1/empresas', { credentials: 'include' });
        const result = await res.json();
        const empresas = result.data || [];
        select.innerHTML = '<option value="">-- Seleccionar Empresa --</option>';
        empresas.sort((a,b) => a.nombre.localeCompare(b.nombre)).forEach(emp => {
            select.innerHTML += `<option value="${emp.id}">${emp.nombre.toUpperCase()}</option>`;
        });
    } catch (e) { console.error("Error catálogo:", e); }
}

/**
 * ENVÍO CRÍTICO: Sincronización con cleanAlbaranMap de Go
 */
async function handleFormSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('albaran_id').value;

    // ✅ Normaliza HH:mm → HH:mm:ss (Evita el fallo de parseTimePtr en Go)
    const normalizeTime = (val) => {
        if (!val || val.trim() === "") return "";
        return val.length === 5 ? `${val}:00` : val;
    };

    // Construimos el payload con los nombres de clave que el backend Go reconoce
    const payload = {
        // TIEMPOS (Con segundos para el parser de Go)
        "fecha":       document.getElementById('fecha').value,
        "hora_ini":    normalizeTime(document.getElementById('hora_ini').value),
        "hora_fin":    normalizeTime(document.getElementById('hora_fin').value),
        "espera_ini":  normalizeTime(document.getElementById('espera_ini').value),
        "espera_fin":  normalizeTime(document.getElementById('espera_fin').value),
        
        // PASAJERO (HTML 'nombre_pasajero' -> Go mapea a columna 'cliente')
        "nombre_pasajero": document.getElementById('nombre_pasajero').value,

        // TEXTO
        "referencia":    document.getElementById('referencia').value,
        "origen":        document.getElementById('origen').value,
        "parada":        document.getElementById('parada').value,
        "destino":       document.getElementById('destino').value,
        "tlf_pasajero":  document.getElementById('tlf_pasajero').value,
        "dni_pasajero":  document.getElementById('dni_pasajero').value,
        "matricula":     document.getElementById('matricula').value,
        "observaciones": document.getElementById('observaciones').value,
        "autorizado_por":document.getElementById('autorizado_por').value,
        "asalariado":    document.getElementById('asalariado').value,
        "adjuntos":      document.getElementById('adjuntos_ref').value,

        // NÚMEROS (Tipado estricto para GORM/MySQL)
        "empresa_ref":        parseInt(document.getElementById('empresa').value) || 0,
        "km_totales":         parseFloat(document.getElementById('km_totales').value) || 0,
        "km_nacionales":      parseFloat(document.getElementById('km_nacionales').value) || 0,
        "km_internacionales": parseFloat(document.getElementById('km_internacionales').value) || 0,
        "importe_total":      parseFloat(document.getElementById('importe_total').value) || 0,
        "importe_suplidos":   parseFloat(document.getElementById('importe_suplidos').value) || 0,
        "hora_total":         parseFloat(document.getElementById('hora_total').value) || 0,
        "num_plazas":         parseInt(document.getElementById('num_plazas').value) || 4,

        // BOOLEANOS
        "urbano":       document.getElementById('urbano').checked,
        "diurno":       document.getElementById('diurno').checked,
        "noct_fest":    document.getElementById('noct_fest').checked,
        "remolque":     document.getElementById('remolque').checked,
        "adjuntos_bool":document.getElementById('adjuntos_bool').checked
    };

    console.log("📤 [DEBUG] Enviando Payload Final:", payload);

    try {
        const res = await fetch(`/api/v1/albaranes/user/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            credentials: 'include'
        });

        const resData = await res.json();

        if (res.ok) {
            showStatus("✅ Albarán actualizado correctamente.", "success");
            setTimeout(() => window.location.href = '/busqueda', 1500);
        } else {
            throw new Error(resData.error || "Error al actualizar");
        }
    } catch (error) {
        console.error("❌ [UPDATE] Fallo:", error);
        showStatus(error.message, "error");
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