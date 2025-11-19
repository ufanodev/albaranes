/**
 * js/utils.js
 * Funciones de utilidad para el frontend.
 */

// Función principal para realizar peticiones autenticadas a la API
async function fetchProtected(url, options = {}) {
    const token = localStorage.getItem('jwtToken');
    
    // El script security.js debería manejar la redirección si no hay token, 
    // pero incluimos esta verificación como guardián.
    if (!token) {
        console.error('Token no encontrado. Redirigiendo a login.');
        window.location.href = '/login';
        throw new Error('No Auth Token');
    }

    // Configurar encabezados por defecto
    const defaultHeaders = {
        'Authorization': `Bearer ${token}`,
    };

    // Añadir Content-Type para métodos POST/PUT/DELETE si no está presente
    if (options.method === 'POST' || options.method === 'PUT') {
        defaultHeaders['Content-Type'] = 'application/json';
    }

    options.headers = {
        ...defaultHeaders,
        ...options.headers // Permitir sobrescribir headers
    };

    const response = await fetch(url, options);
    
    // Manejo básico de expiración del token (además del control de security.js)
    if (response.status === 401 || response.status === 403) {
        console.warn('Sesión expirada o no autorizada por el servidor.');
        localStorage.removeItem('jwtToken');
        window.location.href = '/login';
        throw new Error('Unauthorized or Expired Session');
    }
    
    return response;
}

// Función para mostrar notificaciones (puedes personalizar según tu UI)
function showNotification(message, type = 'info') {
    // Implementación básica - puedes integrar con tu sistema de notificaciones
    console.log(`${type.toUpperCase()}: ${message}`);
    alert(`${type.toUpperCase()}: ${message}`); // Reemplaza con tu sistema de UI
}

// Función para formatear fechas
function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES');
}

// Exportar funciones para uso global
window.fetchProtected = fetchProtected;
window.showNotification = showNotification;
window.formatDate = formatDate;