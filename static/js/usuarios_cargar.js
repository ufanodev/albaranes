// Archivo: static/js/usuarios_cargar.js
// Lógica de negocio para la carga y guardado de datos de usuario en el formulario CRUD.

// Función de utilidad para obtener los encabezados de autenticación
function getAuthHeaders() {
    // ⚠️ CRÍTICO: Comprueba que getJWTToken() existe en /js/security.js
    if (typeof getJWTToken === 'undefined') {
        console.error("❌ ERROR: La función getJWTToken() no está definida. Revise /js/security.js");
        return { 'Content-Type': 'application/json' }; 
    }
    
    // Si hay token, lo incluimos en el encabezado Authorization
    return {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + getJWTToken()
    };
}


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
    // GORM devuelve `true` o `false` (booleanos), pero HTML usa strings.
    document.getElementById('activo').value = String(userData.activo || false);

    // Campo de referencia opcional
    // Si es null en Go, lo convertimos a string vacío o 0.
    document.getElementById('licencia_ref').value = userData.licencia_ref || '';
    
    // El campo de contraseña SIEMPRE se deja vacío en edición por seguridad
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
        
        const response = await fetch(`/api/v1/users/${userId}`, {
            headers: getAuthHeaders() // Incluir JWT
        });
        
        if (response.status === 404) {
            console.error(`[Cargar] Error 404: Usuario ID ${userId} no encontrado.`);
            return null;
        }
        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Error ${response.status}: ${error.error}`);
        }
        
        const data = await response.json();
        return data.data; // Tu controlador GetUser(c, db) devuelve {data: userObject}

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

        // 1. Excluir ID nulo y password vacío en edición
        if (key === 'id' && !value) continue;
        if (mode === 'edit' && key === 'password' && !value) continue;
        
        // 2. Convertir 'activo' a booleano real para el DTO
        if (key === 'activo') {
            payload[key] = value === 'true';
        } else if (key === 'licencia_ref') {
            // 3. Convertir a número o nulo (si es string vacío) para el modelo Go
            const numValue = parseInt(value);
            payload[key] = isNaN(numValue) || numValue === 0 ? null : numValue;
        } else {
            payload[key] = value;
        }
    }

    // Nota: El controlador Register maneja los campos 'usuario', 'email', 'password' y 'role'.
    // El controlador UpdateUser maneja un DTO que espera 'activo' y otros campos opcionales.

    console.log(`[API] 🌐 ${method} ${url} | Payload:`, payload);

    const response = await fetch(url, {
        method: method,
        headers: getAuthHeaders(), // Incluir JWT
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