// Archivo: static/js/usuarios_cargar.js
// Lógica de negocio para la carga de datos de usuario en el formulario CRUD.

/**
 * Rellena el formulario con los datos de un usuario.
 * @param {object} userData - Objeto que contiene los datos del usuario (API response).
 */
function fillFormWithUserData(userData) {
    if (!userData) return;

    // Campos de usuario básicos
    document.getElementById('id').value = userData.id || '';
    document.getElementById('usuario').value = userData.usuario || '';
    document.getElementById('email').value = userData.email || '';
    
    // Campos de selección
    document.getElementById('role').value = userData.role || 'user';
    document.getElementById('activo').value = String(userData.activo || false);

    // Campo de referencia opcional
    document.getElementById('licencia_ref').value = userData.licencia_ref || '';
    
    // El campo de contraseña SIEMPRE se deja vacío por seguridad
    document.getElementById('password').value = '';
}


/**
 * Carga los datos de un usuario específico desde la API.
 * @param {number} userId - ID del usuario a cargar.
 * @returns {Promise<object|null>} Los datos del usuario o null si falla.
 */
async function loadUserDataFromAPI(userId) {
    if (!userId) return null;

    try {
        console.log(`[Cargar] 🌐 Pidiendo datos del usuario ID: ${userId} a /api/v1/users/${userId}`);
        
        const response = await fetch(`/api/v1/users/${userId}`);
        
        if (response.status === 404) {
            console.error(`[Cargar] Error 404: Usuario ID ${userId} no encontrado.`);
            return null;
        }
        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Error ${response.status}: ${error.error}`);
        }
        
        const data = await response.json();
        return data.data; // Asumiendo que la respuesta es {data: userObject}

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
async function saveUserToAPI(mode, formData) {
    const userId = formData.id;
    const method = mode === 'create' ? 'POST' : 'PUT';
    const url = mode === 'create' ? '/api/v1/users' : `/api/v1/users/${userId}`;
    
    const payload = {};
    for (const key in formData) {
        let value = formData[key];

        // Excluir ID nulo y password vacío en edición
        if (key === 'id' && !value) continue;
        if (key === 'password' && !value) continue;
        
        // Convertir strings 'true'/'false' a booleanos para el DTO
        if (key === 'activo') {
            payload[key] = value === 'true';
        } else if (key === 'licencia_ref') {
            // Convertir a número o nulo para Go
            const numValue = parseInt(value);
            payload[key] = isNaN(numValue) || numValue === 0 ? null : numValue;
        } else {
            payload[key] = value;
        }
    }

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

// 🔑 EXPOSICIÓN GLOBAL: Hacemos las funciones accesibles para admin_usuarios_crud.js
window.fillFormWithUserData = fillFormWithUserData;
window.loadUserDataFromAPI = loadUserDataFromAPI;
window.saveUserToAPI = saveUserToAPI;