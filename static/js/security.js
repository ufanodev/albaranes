// Archivo: static/js/security.js
// Implementa la verificación de autenticación basada en JWT y el acceso por rol para rutas específicas.

const LOGIN_PATH = '/login';
const TITULAR_PATH = '/titular';
const ADMIN_PATH = '/admin';

/**
 * Decodifica un JWT para extraer el payload (sin validar la firma).
 * @param {string} token - El token JWT.
 * @returns {object|null} El payload decodificado o null si falla.
 */
function decodeJwt(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        
        const base64Url = parts[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error("Error al decodificar JWT en security.js:", e);
        return null;
    }
}

/**
 * Elimina el token de localStorage y redirige al login.
 */
function clearTokenAndRedirect() {
    localStorage.removeItem('jwtToken');
    window.location.href = LOGIN_PATH;
}


/**
 * Función que verifica la validez del token y el rol de acceso a la página actual.
 * Si falla, redirige al usuario al path correspondiente.
 */
function checkAuthAndRedirect() {
    const token = localStorage.getItem('jwtToken');
    const currentPath = window.location.pathname;

    // Rutas públicas que no deben cargar este script
    if (currentPath === '/' || currentPath === LOGIN_PATH || currentPath === '/recuerdame') {
        return; // No hacer nada en páginas públicas
    }

    if (!token) {
        console.log("Token no encontrado. Redirigiendo a login.");
        window.location.href = LOGIN_PATH;
        return;
    }

    const payload = decodeJwt(token);

    if (!payload || !payload.exp || !payload.role) {
        console.warn("Token inválido o incompleto. Limpiando y redirigiendo.");
        clearTokenAndRedirect();
        return;
    }

    // 1. Verificar Expiración
    const currentTimeSeconds = Math.floor(Date.now() / 1000);
    if (payload.exp < currentTimeSeconds) {
        console.warn("Token expirado. Limpiando y redirigiendo.");
        clearTokenAndRedirect();
        return;
    }

    // 2. Determinar el rol requerido según la ruta
    // Si la ruta comienza con '/admin', se requiere 'admin'. Cualquier otra ruta protegida requiere 'titular'.
    const requiredRole = currentPath.startsWith(ADMIN_PATH) ? 'admin' : 'titular';
    
    // 3. Verificar Rol
    if (payload.role !== requiredRole) {
        console.warn(`Acceso denegado. Rol requerido: ${requiredRole}, Rol del token: ${payload.role}. Redirigiendo.`);
        
        // Redirigir al usuario a su página principal correcta
        const targetPath = payload.role === 'admin' ? ADMIN_PATH : TITULAR_PATH;
        
        // Solo redirigir si la ruta actual no pertenece a su rol
        if (!currentPath.startsWith(targetPath)) {
             window.location.href = targetPath;
        }
        return;
    }

    console.log(`Autenticación exitosa. Rol: ${payload.role}.`);
}


// Ejecutar la verificación de autenticación inmediatamente al cargar el script
checkAuthAndRedirect();

// =========================================================================
// Función wrapper para llamadas a la API (uso del token)
// =========================================================================

/**
 * Función wrapper para fetch que inyecta automáticamente el header de Autorización.
 * @param {string} url - La URL del endpoint de la API.
 * @param {object} options - Opciones estándar de Fetch.
 * @returns {Promise<Response>}
 */
window.fetchProtected = async function(url, options = {}) {
    const token = localStorage.getItem('jwtToken');

    if (!token) {
        console.error("Intento de llamada protegida sin token. Forzando re-login.");
        clearTokenAndRedirect();
        throw new Error("Token de autorización no encontrado.");
    }

    options.headers = options.headers || {};
    options.headers['Authorization'] = `Bearer ${token}`;

    return fetch(url, options);
};

// Exportar función de logout para ser usada en el menú de navegación
window.clearTokenAndRedirect = clearTokenAndRedirect;