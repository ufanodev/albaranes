/**
 * Archivo: static/js/licencias_cargar.js
 * Propósito: Funciones para buscar, cargar y mapear datos de una licencia por ID.
 * Incluye logs de depuración para rastrear errores de carga.
 */

/**
 * Función principal para obtener datos de la licencia desde la API.
 */
async function loadLicenciaFromAPI(titularId) {
    console.log(`%c🔍 [FETCH] Iniciando carga del titular ID: ${titularId}`, "color: #3b82f6; font-weight: bold;");
    
    if (!titularId) {
        console.error("%c❌ [FETCH] Error: ID no proporcionado.", "color: red;");
        return null;
    }

    const url = `/api/v1/licencias/${titularId}`; 

    try {
        const response = await fetch(url);
        console.log(`%c📡 [API] Endpoint: ${url} | Status: ${response.status}`, "color: #6366f1;");

        if (response.status === 401) {
            alert("Sesión expirada. Por favor, inicie sesión de nuevo.");
            window.location.href = '/login';
            return null;
        }

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Error ${response.status} al cargar.`);
        }

        const data = await response.json();
        const titularData = data.data; 

        if (!titularData) {
            throw new Error("La API respondió con éxito pero el objeto 'data' está vacío.");
        }
        
        console.log("%c📦 [DATA] Datos recibidos correctamente:", "color: #10b981;", titularData);
        return titularData;

    } catch (error) {
        console.error('%c❌ [FETCH-ERROR]', "color: red; font-weight: bold;", error);
        if (typeof window.crudAlertMessage === 'function') {
            window.crudAlertMessage(`Error: No se pudo cargar el titular #${titularId}. ${error.message}`, 'error');
        }
        return null;
    }
}

/**
 * Mapea los datos del JSON a los inputs del HTML.
 */
function fillFormWithLicenciaData(data) {
    console.log("%c✏️ [MAPPER] Rellenando campos del formulario...", "color: #f59e0b; font-weight: bold;");
    
    // Función auxiliar para asignar valores de forma segura
    const safeSet = (id, value) => {
        const el = document.getElementById(id);
        if (el) {
            // Manejo especial para SELECTS
            if (el.tagName === 'SELECT') {
                el.value = (value !== null && value !== undefined) ? String(value) : "";
            } else {
                el.value = (value !== null && value !== undefined) ? value : "";
            }
            console.log(`   ✅ Campo [#${id}] rellenado con:`, value);
        } else {
            console.warn(`   ⚠️ Advertencia: No existe el elemento con ID [#${id}] en el HTML.`);
        }
    };

    // Mapeo exhaustivo basado en tu admin_titular_crud.html
    safeSet('titularId', data.id);
    safeSet('licencia', data.licencia);
    safeSet('dni', data.dni); // Mapeado a id="dni"
    safeSet('nombre', data.nombre);
    safeSet('email', data.email);
    safeSet('telefono', data.telefono);
    safeSet('movil', data.movil);
    safeSet('userlevel', data.userlevel);
    safeSet('direccion', data.direccion);
    safeSet('cp', data.cp);
    safeSet('poblacion', data.poblacion);
    safeSet('provincia', data.provincia);
    safeSet('serie_factura', data.serie_factura);
    safeSet('n_proxima_factura', data.n_proxima_factura);
    safeSet('matricula_taxi', data.matricula_taxi);
    safeSet('observaciones', data.observaciones);

    // Actualizar el contador de palabras tras rellenar las observaciones
    const obsElement = document.getElementById('observaciones');
    if (obsElement) {
        obsElement.dispatchEvent(new Event('input'));
    }
    
    console.log("%c✅ [MAPPER] Proceso completado.", "color: #10b981; font-weight: bold;");
}