// Archivo: static/js/security.js
// Lógica de seguridad para todas las vistas protegidas del frontend.

/**
 * Decodifica un JWT (sin validación de firma, solo extrae el payload)
 * @param {string} token - El token JWT.
 * @returns {object|null} El payload decodificado o null si falla.
 */
function decodeJwt(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) {
            console.error("Token JWT inválido: número incorrecto de partes.");
            return null;
        }
        // El payload es la segunda parte (índice 1)
        const base64Url = parts[1];
        // Reemplaza caracteres no seguros para Base64 URL
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        // Decodifica y parsea el JSON
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error("Error al decodificar JWT:", e);
        return null;
    }
}

/**
 * Comprueba si el token es válido y si el usuario tiene el rol necesario para la página actual.
 */
function checkAuthentication() {
    const token = localStorage.getItem('jwtToken');
    const currentPath = window.location.pathname;
    
    // Si no hay token, redirige al login
    if (!token) {
        // Solo si no estamos ya en /login
        if (currentPath !== '/' && currentPath !== '/login' && currentPath !== '/recuerdame') {
            console.warn("No se encontró token. Redirigiendo a login.");
            window.location.href = '/login';
        }
        return;
    }

    const payload = decodeJwt(token);

    if (!payload || !payload.exp || !payload.role) {
        console.error("Token decodificado es inválido o incompleto.");
        localStorage.removeItem('jwtToken');
        window.location.href = '/login';
        return;
    }

    // 1. Comprobar Expiración (exp es en segundos Unix)
    const currentTime = Date.now() / 1000;
    if (payload.exp < currentTime) {
        console.warn("Token JWT expirado. Redirigiendo a login.");
        localStorage.removeItem('jwtToken');
        window.location.href = '/login';
        return;
    }

    // 2. Comprobar Rol
    const userRole = payload.role;

    // Si la ruta es de administración (/admin/*)
    if (currentPath.startsWith('/admin')) {
        if (userRole !== 'admin') {
            console.warn(`Acceso denegado a ruta de administrador. Rol: ${userRole}. Redirigiendo a /busqueda.`);
            window.location.href = '/busqueda'; // Redirige al usuario a su vista por defecto
        }
    } else if (currentPath === '/busqueda') {
        // En la vista /busqueda, si es admin, redirige a su panel
        if (userRole === 'admin') {
            console.info("Usuario admin en /busqueda. Redirigiendo a /admin/titulares.");
            window.location.href = '/admin/titulares';
        }
    }
    
    // Si la autenticación es exitosa y el rol es correcto, no hacemos nada más.
}

// Ejecutar la comprobación al cargar el script
checkAuthentication();

// Exportar funciones útiles para otros scripts
window.decodeJwt = decodeJwt;
window.checkAuthentication = checkAuthentication;