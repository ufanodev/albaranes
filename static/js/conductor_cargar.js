// Archivo: static/js/conductor_cargar.js
// Lógica de negocio para la carga y guardado de datos de Conductores.

// Función de utilidad para obtener los encabezados de autenticación
function getAuthHeaders() {
    // Nota: Esta función generó un error ❌ ERROR: La función getJWTToken() no está definida.
    // Esto significa que 'security.js' no está cargado o getJWTToken no está globalmente expuesto.
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
 * @param {object} conductorData - Objeto que contiene los datos del conductor.
 */
function fillFormWithConductorData(conductorData) {
    if (!conductorData) return;

    // Campos del formulario. Si 'licencia' es un SELECT, esto selecciona la opción.
    document.getElementById('licencia').value = conductorData.licencia || '';
    document.getElementById('conductor').value = conductorData.conductor || ''; // Nº Conductor
    document.getElementById('nombre').value = conductorData.nombre || ''; 
    document.getElementById('email').value = conductorData.email || '';
    document.getElementById('telefono').value = conductorData.telefono || '';
    
    // Campo de estado Activo/Inactivo (Select)
    document.getElementById('activo').value = String(conductorData.activo || false);
}

/**
 * Carga los datos de un conductor específico desde la API.
 * Busca por Licencia, aunque Licencia ya no es la PK.
 */
async function loadConductorDataFromAPI(licencia) {
    if (!licencia) return null;

    try {
        console.log(`[Cargar] 🌐 Pidiendo datos del Conductor Licencia: ${licencia}`);
        
        const response = await fetch(`/api/v1/conductores/${licencia}`, {
            headers: getAuthHeaders() 
        });
        
        if (response.status === 404) {
            console.error(`[Cargar] Error 404: Conductor Licencia ${licencia} no encontrado.`);
            return null;
        }
        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Error ${response.status}: ${error.error}`);
        }
        
        const data = await response.json();
        return data.data;

    } catch (error) {
        console.error(`[Cargar] ❌ Fallo al cargar datos:`, error);
        return null;
    }
}

/**
 * Construye y envía la solicitud de guardado (Crear/Modificar) a la API.
 */
async function saveConductorToAPI(mode, formData) {
    const licencia = formData.licencia;
    const method = mode === 'create' ? 'POST' : 'PUT';
    const url = mode === 'create' ? '/api/v1/conductores' : `/api/v1/conductores/${licencia}`;
    
    const payload = {};
    for (const key in formData) {
        let value = formData[key];

        // Excluir Licencia y campos vacíos en modo PUT
        if (mode === 'edit' && key === 'licencia') continue;
        if (mode === 'edit' && value === "") continue;

        // Convertir 'activo' a booleano real para el DTO
        if (key === 'activo') {
            payload[key] = value === 'true';
        } else {
            // Asegurarse de que el campo 'licencia' se envíe en modo CREATE
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
    
    // Si la respuesta no es OK, GORM falló o la validación del controlador falló.
    const result = await response.json();
    if (!response.ok) {
        throw new Error(result.error || `Error HTTP ${response.status}`);
    }

    return result;
}

/**
 * Carga una lista simple de conductores (licencias y nombres) para usar en el SELECT.
 */
async function loadLicenciaDropdownData() {
    console.log('[LOG FE] 1. Iniciando loadLicenciaDropdownData...'); 
    try {
        const response = await fetch('/api/v1/conductores', {
            headers: getAuthHeaders() 
        });
        
        console.log(`[LOG FE] 2. Respuesta HTTP Status: ${response.status}`); 

        if (response.status === 401) {
             console.error('[LOG FE] 🛑 Error 401: Sesión expirada o no autorizada.');
             // No lanzamos error para que el select se muestre vacío o con error de carga.
        }
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Respuesta no JSON' }));
            console.error('[LOG FE] ❌ Fallo en la API /conductores:', error); 
            throw new Error(`Error ${response.status} al cargar licencias: ${error.error}`);
        }
        
        const data = await response.json();
        const conductores = data.data || [];
        
        console.log(`[LOG FE] 3. Datos recibidos. Total de conductores: ${conductores.length}`); 

        // Mapeamos a un formato simple {licencia, nombre}
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
window.saveConductorToAPI = saveConductorToAPI;
window.loadLicenciaDropdownData = loadLicenciaDropdownData;