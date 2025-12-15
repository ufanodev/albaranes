// Archivo: static/js/conductor_cargar.js
// Lógica de negocio para la carga, guardado y eliminación de datos de Conductores.

// Función de utilidad para obtener los encabezados de autenticación
function getAuthHeaders() {
    // Nota: Mantenemos el log del error de dependencia para el debug inicial.
    if (typeof getJWTToken === 'undefined') {
        console.error("❌ ERROR: La función getJWTToken() no está definida.");
        return { 'Content-Type': 'application/json' }; 
    }
    return {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + getJWTToken()
    };
}

/**
 * Rellena el formulario con los datos de un conductor.
 */
function fillFormWithConductorData(conductorData) {
    if (!conductorData) return;

    // Campos del formulario.
    document.getElementById('licencia').value = conductorData.licencia || '';
    document.getElementById('conductor').value = conductorData.conductor || ''; // Nº Conductor
    document.getElementById('nombre').value = conductorData.nombre || ''; 
    document.getElementById('email').value = conductorData.email || '';
    document.getElementById('telefono').value = conductorData.telefono || '';
    
    document.getElementById('activo').value = String(conductorData.activo || false);
}

// =================================================================================
// 🌐 FUNCIONES DE CARGA (GET)
// =================================================================================

/**
 * Carga los datos de un conductor específico desde la API. (LEGACY - Busca solo por Licencia)
 */
async function loadConductorDataFromAPI(licencia) {
    if (!licencia) return null;

    try {
        console.log(`[Cargar LEGACY] 🌐 Pidiendo datos: /api/v1/conductores/${licencia}`);
        
        const response = await fetch(`/api/v1/conductores/${licencia}`, {
            headers: getAuthHeaders() 
        });
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Respuesta no JSON' }));
            console.error(`[Cargar LEGACY] Error ${response.status}:`, error);
            return null;
        }
        
        const data = await response.json();
        console.log(`[Cargar LEGACY] ✅ Datos recibidos para ${licencia}:`, data.data);
        return data.data;

    } catch (error) {
        console.error(`[Cargar LEGACY] ❌ Fallo al cargar datos:`, error);
        return null;
    }
}

/**
 * Carga los datos de un conductor específico desde la API usando Licencia y Nº Conductor. (PRECISO)
 * Ruta API: GET /api/v1/conductores/licencia_conductor/:licencia/:nconductor
 */
async function loadConductorDataFromAPIPrecisa(licencia, nconductor) {
    if (!licencia || !nconductor) return null;

    try {
        const url = `/api/v1/conductores/licencia_conductor/${licencia}/${nconductor}`;
        console.log(`[Cargar PRECISO] 🌐 Pidiendo datos: ${url}`);
        
        const response = await fetch(url, {
            headers: getAuthHeaders() 
        });
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Respuesta no JSON' }));
            console.error(`[Cargar PRECISO] Error ${response.status}:`, error);
            return null;
        }
        
        const data = await response.json();
        console.log(`[Cargar PRECISO] ✅ Datos recibidos para ${licencia}/${nconductor}:`, data.data);
        return data.data;

    } catch (error) {
        console.error(`[Cargar PRECISO] ❌ Fallo al cargar datos:`, error);
        return null;
    }
}


// =================================================================================
// 🌐 FUNCIÓN DE GUARDADO (POST/PUT)
// =================================================================================

/**
 * Construye y envía la solicitud de guardado (Crear/Modificar) a la API.
 * 🎯 NOTA CLAVE: En modo 'edit', utiliza la ruta PUT precisa si se proporciona el nConductorOriginal.
 */
async function saveConductorToAPI(mode, formData, nConductorOriginal = null) {
    const licencia = formData.licencia;
    const method = mode === 'create' ? 'POST' : 'PUT';
    
    let url;

    if (mode === 'edit' && nConductorOriginal) {
        // ✅ RUTA PUT PRECISA: Usamos la clave original para identificar el registro a actualizar.
        url = `/api/v1/conductores/licencia_conductor/${licencia}/${nConductorOriginal}`;
    } else if (mode === 'edit') {
        // Fallback a la ruta legacy PUT /:licencia (Si se pierde el nConductor original)
        url = `/api/v1/conductores/${licencia}`;
    } else {
        // Modo CREATE
        url = '/api/v1/conductores';
    }
    
    const payload = {};
    for (const key in formData) {
        let value = formData[key];

        if (mode === 'edit' && key === 'licencia') continue;
        if (mode === 'edit' && value === "") continue;

        if (key === 'activo') {
            payload[key] = value === 'true';
        } else {
            if (mode === 'create' || value !== "") {
                 payload[key] = value;
            }
        }
    }

    console.log(`[API] 🌐 ${method} ${url} | Payload:`, payload);

    const response = await fetch(url, {
        method: method,
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
    });
    
    const result = await response.json().catch(() => {
        throw new Error(`Error HTTP ${response.status} sin cuerpo JSON.`);
    });
    
    if (!response.ok) {
        throw new Error(result.error || `Error HTTP ${response.status}`);
    }

    return result;
}

// =================================================================================
// 🌐 FUNCIÓN DE BORRADO (DELETE HÍBRIDO)
// =================================================================================

/**
 * Envía la solicitud DELETE al API usando el método de borrado más preciso disponible.
 * @param {object} params - Parámetros para la URL DELETE.
 */
async function deleteConductorFromAPI(params) {
    let url = '/api/v1/conductores';

    if (params.id) {
        // 1. Método recomendado: Borrado por ID único
        url += `/id/${params.id}`;
        console.log(`[API DELETE] Usando ruta ID: ${url}`);
    } else if (params.licencia && params.nconductor) {
        // 2. Método preciso: Borrado por Licencia + Nº Conductor
        url += `/licencia_conductor/${params.licencia}/${params.nconductor}`;
        console.log(`[API DELETE] Usando ruta Licencia+Conductor: ${url}`);
    } else if (params.licencia) {
        // 3. Método Legacy: Borrado por Licencia (borra el primer registro)
        url += `/${params.licencia}`;
        console.log(`[API DELETE] Usando ruta Legacy Licencia: ${url}`);
    } else {
        throw new Error("Parámetros de borrado insuficientes.");
    }

    const response = await fetch(url, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });

    const result = await response.json().catch(() => {
        throw new Error(`Error HTTP ${response.status} sin cuerpo JSON.`);
    });

    if (!response.ok) {
        throw new Error(result.error || `Error HTTP ${response.status}`);
    }

    return result;
}

// =================================================================================
// 🌐 FUNCIÓN DE LISTADO (Dropdown)
// =================================================================================

/**
 * Carga una lista simple de conductores (licencias y nombres) para usar en el SELECT.
 */
async function loadLicenciaDropdownData() {
    try {
        const response = await fetch('/api/v1/conductores', {
            headers: getAuthHeaders() 
        });
        
        if (!response.ok) {
             const error = await response.json().catch(() => ({ error: 'Respuesta no JSON' }));
             throw new Error(`Error ${response.status} al cargar licencias: ${error.error}`);
        }
        
        const data = await response.json();
        const conductores = data.data || [];
        
        return conductores.map(c => ({
            licencia: c.licencia,
            nombre: c.nombre
        })); 

    } catch (error) {
        console.error(`[LOG FE] 🛑 Fallo total al cargar lista:`, error); 
        return [];
    }
}


// 🔑 EXPOSICIÓN GLOBAL
window.fillFormWithConductorData = fillFormWithConductorData;
window.loadConductorDataFromAPI = loadConductorDataFromAPI;
window.loadConductorDataFromAPIPrecisa = loadConductorDataFromAPIPrecisa;
window.saveConductorToAPI = saveConductorToAPI;
window.loadLicenciaDropdownData = loadLicenciaDropdownData;
window.deleteConductorFromAPI = deleteConductorFromAPI;