/**
 * js/utils.js
 * Funciones de utilidad optimizadas para sesión basada en Cookies HttpOnly.
 */

// Función principal para realizar peticiones protegidas a la API
async function fetchProtected(url, options = {}) {
    
    // Ya no buscamos en localStorage porque la cookie viaja sola
    // Pero nos aseguramos de incluir las credenciales en la petición
    const defaultOptions = {
        credentials: 'include', // Imprescindible para enviar la cookie HttpOnly
        headers: {
            'Accept': 'application/json'
        }
    };

    // Configurar Content-Type automáticamente para envíos de datos
    if (options.method === 'POST' || options.method === 'PUT' || options.method === 'PATCH') {
        defaultOptions.headers['Content-Type'] = 'application/json';
    }

    // Combinar opciones por defecto con las proporcionadas
    const finalOptions = {
        ...defaultOptions,
        ...options,
        headers: {
            ...defaultOptions.headers,
            ...options.headers
        }
    };

    try {
        const response = await fetch(url, finalOptions);

        // Si el servidor responde 401 (No autorizado), la sesión ha muerto
        if (response.status === 401 || response.status === 403) {
            console.warn('🔴 Sesión expirada o inválida. Redirigiendo...');
            // Limpiamos cualquier rastro local por si acaso
            localStorage.clear(); 
            window.location.href = '/login';
            return null;
        }

        return response;
    } catch (error) {
        console.error('❌ Error de red en fetchProtected:', error);
        throw error;
    }
}

// Función para mostrar notificaciones elegante (usando la UI del sistema)
function showNotification(message, type = 'info') {
    const statusEl = document.getElementById('statusMessage');
    if (statusEl) {
        statusEl.textContent = message;
        statusEl.className = `status-message p-3 rounded-md mb-4 text-center font-medium border block`;
        
        // Colores según tipo
        if (type === 'error') statusEl.classList.add('bg-red-100', 'text-red-700', 'border-red-200');
        else if (type === 'success') statusEl.classList.add('bg-green-100', 'text-green-700', 'border-green-200');
        else statusEl.classList.add('bg-blue-100', 'text-blue-700', 'border-blue-200');

        statusEl.classList.remove('hidden');
        setTimeout(() => statusEl.classList.add('hidden'), 5000);
    } else {
        // Fallback si no hay elemento en el HTML
        console.log(`${type.toUpperCase()}: ${message}`);
    }
}

// Formateador de fechas robusto
function formatDate(dateString) {
    if (!dateString || dateString === '0001-01-01T00:00:00Z') return '-';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    } catch (e) {
        return dateString;
    }
}

// Exportar funciones para uso global
window.fetchProtected = fetchProtected;
window.showNotification = showNotification;
window.formatDate = formatDate;