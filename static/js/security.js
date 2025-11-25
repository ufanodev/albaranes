// Archivo: static/js/security.js
// Contiene funciones de seguridad reutilizables que interactúan con el backend
// (principalmente para sesiones basadas en Cookie HttpOnly).

const LOGIN_PATH = '/login';

/**
 * Cierra la sesión de forma segura llamando al endpoint del backend
 * para que borre la Cookie HttpOnly.
 */
async function handleLogout() {
    if (!confirm("¿Estás seguro que deseas cerrar la sesión?")) {
        return;
    }

    try {
        // Llama al endpoint de logout (POST /api/v1/logout), que borra la Cookie HttpOnly en el backend.
        const response = await fetch('/api/v1/logout', {
            method: 'POST',
        });

        // El backend responde con 200 OK y la instrucción de borrar la cookie.

    } catch (error) {
        console.error("Error al comunicarse con el endpoint de logout:", error);
    } finally {
        // 1. Forzar la redirección al login.
        // 2. El AuthRedirectMiddleware de Go se encargará de confirmar que la sesión
        //    esté limpia y servirá la página de login.
        window.location.href = LOGIN_PATH;
    }
}

// Exportar la función para que sea accesible desde los onclick en el HTML
window.handleLogout = handleLogout;