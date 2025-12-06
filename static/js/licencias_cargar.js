// Archivo: static/js/licencias_cargar.js
// Propósito: Contiene las funciones para buscar y cargar datos de una licencia por ID desde la API.

/**
 * Función para cargar los datos de una licencia desde la API.
 * Se asume que el backend responde con {data: {...}} y que el ID es el índice de la ruta.
 * * @param {string} titularId - El ID del titular/licencia (ID de la tabla) a cargar.
 * @returns {Promise<Object|null>} Los datos del titular o null si hay un error.
 */
async function loadLicenciaFromAPI(titularId) {
    if (!titularId) {
        console.error("loadLicenciaFromAPI: ID del titular no proporcionado.");
        return null;
    }

    // Endpoint esperado: /api/v1/licencias/ID
    const url = `/api/v1/licencias/${titularId}`; 
    console.log(`   [Licencia Cargar] 🌐 5. Solicitando datos de licencia al backend: ${url}`);

    try {
        const response = await fetch(url);

        if (response.status === 401) {
            console.error("Sesión expirada. Redirigiendo a login.");
            alert("Sesión expirada. Por favor, inicie sesión de nuevo.");
            window.location.href = '/login';
            return null;
        }

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Error ${response.status} al cargar la licencia.`);
        }

        const data = await response.json();
        
        // El modelo Go usa {data: Licencia}
        const titularData = data.data; 

        if (!titularData) {
            throw new Error("Respuesta de API vacía o inválida.");
        }
        
        // 🔑 LOG DE DATOS CAPTURADOS DESDE EL BACKEND
        console.log("   [Licencia Cargar] 💡 DATOS CAPTURADOS:", titularData);
        console.log("   [Licencia Cargar] ✅ 6. Datos recibidos y verificados con éxito.");
        return titularData;

    } catch (error) {
        console.error('   [Licencia Cargar] ❌ Error al cargar los datos de la Licencia:', error);
        // La función crudAlertMessage se asume global (definida en admin_titular_crud.js)
        if (typeof crudAlertMessage === 'function') {
            crudAlertMessage(`Error: No se pudo cargar el titular #${titularId}. ${error.message}`, 'error');
        }
        return null;
    }
}

/**
 * Mapea los datos recibidos de la API a los campos del formulario y los rellena.
 * @param {Object} data - Objeto con los datos del titular (las claves están en minúsculas/camelCase).
 */
function fillFormWithLicenciaData(data) {
    console.log("   [Licencia Cargar] ✏️ 7. Rellenando formulario con datos del titular.");
    
    // Mapeo entre el nombre de la API (izquierda) y el ID del input HTML (derecha).
    // Usamos los nombres en minúsculas/camelCase que aparecen en los logs del backend.
    const fieldMap = {
        // API Field Name : HTML Input ID
        'licencia': 'licencia',
        'dni': 'nif', // 🔑 CORRECCIÓN CLAVE: Mapea 'dni' del backend al 'nif' del formulario
        'nombre': 'nombre',
        'direccion': 'direccion',
        'cp': 'cp',
        'email': 'email',
        'telefono': 'telefono',
        'movil': 'movil', 
        
        // Campos Adicionales (Ajusta los nombres de la API según el log de tu backend)
        'userlevel': 'userlevel',
        'poblacion': 'poblacion',
        'provincia': 'provincia',
        'serie_factura': 'serie_factura', // snake_case
        'n_proxima_factura': 'n_proxima_factura', // snake_case
        'matricula_taxi': 'matricula_taxi', // snake_case
        'observaciones': 'observaciones',
    };
    
    // Iterar sobre todos los campos mapeados
    Object.keys(fieldMap).forEach(apiField => {
        const inputId = fieldMap[apiField];
        const element = document.getElementById(inputId);
        const value = data[apiField]; // Valor que viene del backend (ej: data.licencia)

        if (element && value !== undefined && value !== null) {
            
            if (element.tagName === 'SELECT') {
                // Selecciona la opción correcta para SELECTs (como userlevel)
                element.value = String(value); 
            } else {
                element.value = value;
            }
        }
    });

    // Disparar evento para actualizar el contador de palabras
    const obsElement = document.getElementById('observaciones');
    if (obsElement) {
        obsElement.dispatchEvent(new Event('input'));
    }
}