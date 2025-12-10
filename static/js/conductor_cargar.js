// Archivo: static/js/conductores_cargar.js
// Lógica de negocio API para el CRUD de Conductores (Identificador: Licencia)

/**
 * Rellena el formulario con los datos de un conductor.
 * @param {object} conductorData - Objeto que contiene los datos del conductor (API response).
 */
function fillFormWithConductorData(conductorData) {
    if (!conductorData) return;

    // La licencia se usa como ID de la URL
    document.getElementById('licencia').value = conductorData.licencia || '';
    
    // Campos de conductor
    document.getElementById('conductor').value = conductorData.conductor || '';
    document.getElementById('nombre').value = conductorData.nombre || '';
    document.getElementById('email').value = conductorData.email || '';
    document.getElementById('telefono').value = conductorData.telefono || '';
    
    // Nota: El campo de contraseña no aplica aquí, pero si hubiera, se dejaría vacío.
}


/**
 * Carga los datos de un conductor específico desde la API.
 * @param {string} licencia - Número de Licencia del conductor a cargar.
 * @returns {Promise<object|null>} Los datos del conductor o null si falla.
 */
async function loadConductorDataFromAPI(licencia) {
    if (!licencia) return null;

    try {
        console.log(`[Cargar] 🌐 Pidiendo datos del conductor [${licencia}] a /api/v1/conductores/${licencia}`);
        
        const response = await fetch(`/api/v1/conductores/${licencia}`);
        
        if (response.status === 404) {
            console.error(`[Cargar] Error 404: Conductor ${licencia} no encontrado.`);
            return null;
        }
        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Error ${response.status}: ${error.error}`);
        }
        
        const data = await response.json();
        // Asumimos que la respuesta del backend es {data: conductorObject}
        return data.data; 

    } catch (error) {
        console.error(`[Cargar] ❌ Fallo al cargar datos:`, error);
        return null;
    }
}


/**
 * Construye y envía la solicitud de guardado (Crear/Modificar) a la API.
 * @param {string} mode - 'create' o 'edit'.
 * @param {object} formData - Datos del formulario.
 * @returns {Promise<object>} Respuesta de la API.
 */
async function saveConductorToAPI(mode, formData) {
    const licencia = formData.licencia;
    const method = mode === 'create' ? 'POST' : 'PUT';
    const url = mode === 'create' ? '/api/v1/conductores' : `/api/v1/conductores/${licencia}`;
    
    // Construir Payload: Asegurarse de enviar solo los campos requeridos y mapeados en Go
    const payload = {
        licencia: formData.licencia,
        conductor: formData.conductor,
        nombre: formData.nombre,
        email: formData.email,
        telefono: formData.telefono,
        // Nota: Los campos socio, chofer, y dni, si existen en el modelo Go, 
        // deberían mapearse aquí desde el formulario si fueran necesarios.
    };

    console.log(`[API] 🌐 ${method} ${url} | Payload:`, payload);

    const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    
    const result = await response.json();
    if (!response.ok) {
        throw new Error(result.error || `Error HTTP ${response.status}`);
    }

    return result;
}

// 🔑 EXPOSICIÓN GLOBAL
window.fillFormWithConductorData = fillFormWithConductorData;
window.loadConductorDataFromAPI = loadConductorDataFromAPI;
window.saveConductorToAPI = saveConductorToAPI;