/**
 * security.js - Módulo de Seguridad y Gestión de Sesiones
 * SECCIÓN: Configuración y Constantes
 */
const LOGIN_PATH = '/login';

/**
 * SECCIÓN: Gestión de Logout (Cierre de Sesión)
 * Logica: Comunicación con el backend para invalidar Cookie HttpOnly
 */
async function handleLogout() {
    console.log("🚪 [SECURITY] Iniciando proceso de cierre de sesión...");

    // 1. Confirmación de usuario
    if (!confirm("¿Estás seguro que deseas cerrar la sesión?")) {
        console.log("🚫 [SECURITY] Logout cancelado por el usuario.");
        return;
    }

    try {
        console.log("📡 [SECURITY] Llamando a /api/v1/logout...");
        
        // 2. Petición al backend
        const response = await fetch('/api/v1/logout', {
            method: 'POST',
            // No enviamos body ya que el backend identifica al usuario por la Cookie HttpOnly
        });

        if (response.ok) {
            console.log("✅ [SECURITY] Cookie HttpOnly invalidada correctamente por el servidor.");
        } else {
            console.warn(`⚠️ [SECURITY] El servidor respondió con status ${response.status} en el logout.`);
        }

    } catch (error) {
        console.error("❌ [SECURITY] Error de comunicación con el endpoint de logout:", error);
    } finally {
        // SECCIÓN: Redirección Final
        // Independientemente de si la petición falló o no, forzamos limpieza en cliente
        console.log(`🚀 [SECURITY] Redirigiendo a: ${LOGIN_PATH}`);
        window.location.href = LOGIN_PATH;
    }
}

/**
 * SECCIÓN: Verificación de Sesión (Opcional)
 * Útil para chequear si el token sigue vivo antes de operaciones largas
 */
async function checkAuthStatus() {
    console.log("🔍 [SECURITY] Verificando validez de sesión activa...");
    try {
        const response = await fetch('/api/v1/user/licencia_ref');
        if (!response.ok) {
            console.warn("🚫 [SECURITY] Sesión caducada o inválida.");
            if (window.location.pathname !== LOGIN_PATH) {
                window.location.href = LOGIN_PATH;
            }
            return false;
        }
        console.log("✅ [SECURITY] Sesión confirmada.");
        return true;
    } catch (e) {
        console.error("❌ [SECURITY] Error al verificar estado de autenticación.");
        return false;
    }
}

/**
 * SECCIÓN: Exposición Global
 * Registramos las funciones en el objeto 'window' para que sean accesibles
 * desde los atributos onclick del HTML.
 */
window.handleLogout = handleLogout;
window.checkAuthStatus = checkAuthStatus;

console.log("🛡️ [SECURITY] Módulo security.js cargado y listo.");