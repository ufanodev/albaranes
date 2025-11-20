// Archivo: static/js/login.js
// Lógica de inicio de sesión, manejo de estado del formulario y redirección por rol,
// incluyendo verificación de token al cargar la página.

// Rutas de redirección protegidas
const LOGIN_PATH = '/login';
const TITULAR_PATH = '/titular';
const ADMIN_PATH = '/admin';

// ====================================================================
// 1. UTILIDADES JWT
// ====================================================================

/**
 * Decodifica un JWT (sin validación de firma, solo extrae el payload)
 * @param {string} token - El token JWT.
 * @returns {object|null} El payload decodificado o null si falla.
 */
function decodeJwt(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        
        const base64Url = parts[1];
        // Reemplaza caracteres URL-safe por sus equivalentes Base64 estándar
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        
        // Decodificación Base64 y mapeo de caracteres UTF-8
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error("Error al decodificar JWT:", e);
        return null;
    }
}

// ====================================================================
// 2. CONSTANTES Y UTILIDADES DOM
// ====================================================================

// Obtener elementos DOM, asumiendo que ya existen en login.html
const loginForm = document.getElementById('loginForm');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const statusMessage = document.getElementById('statusMessage');
const submitButton = document.getElementById('submitButton');

/**
 * Muestra un mensaje de estado en el formulario de login.
 * @param {string} message - El mensaje a mostrar.
 * @param {boolean} isSuccess - Si el mensaje es de éxito (true) o error (false).
 */
function showMessage(message, isSuccess) {
    statusMessage.textContent = message;
    // Limpia clases anteriores
    statusMessage.classList.remove('hidden', 'bg-status-success-bg', 'text-green-700', 'border-green-400', 'bg-status-error-bg', 'text-red-700', 'border-red-400');
    
    // Asignación de nuevas clases (asumiendo que los nombres de clase Tailwind son correctos)
    if (isSuccess) {
        statusMessage.classList.add('bg-status-success-bg', 'text-green-700', 'border-green-400');
    } else {
        statusMessage.classList.add('bg-status-error-bg', 'text-red-700', 'border-red-400');
    }
    statusMessage.classList.remove('hidden');
}

/**
 * Deshabilita el formulario durante la petición API.
 * @param {boolean} disabled - Estado de deshabilitación.
 */
function toggleFormState(disabled) {
    if (submitButton) submitButton.disabled = disabled;
    if (usernameInput) usernameInput.disabled = disabled;
    if (passwordInput) passwordInput.disabled = disabled;
    if (submitButton) {
        submitButton.textContent = disabled ? 'Accediendo...' : 'Acceder';
        submitButton.classList.toggle('opacity-50', disabled);
    }
}

/**
 * Lógica central de redirección basada en el rol.
 * @param {string} role - El rol del usuario ('admin' o 'titular').
 */
function redirectByRole(role) {
    const userRole = role ? role.toLowerCase() : '';
    let redirectPath = '';
    
    if (userRole === 'admin') {
        redirectPath = ADMIN_PATH; 
    } else if (userRole === 'titular') {
        redirectPath = TITULAR_PATH; 
    } else {
        // Rol no reconocido, forzamos logout por seguridad
        localStorage.removeItem('jwtToken');
        console.error("Rol de usuario desconocido. Redirigiendo a login.");
        window.location.href = LOGIN_PATH;
        return;
    }
    
    console.log(`Login exitoso. Redirigiendo a: ${redirectPath}`);
    // Ejecutar la redirección después de un breve delay visual si el formulario está visible
    setTimeout(() => window.location.href = redirectPath, 500);
}

// ====================================================================
// 3. LÓGICA DE MANEJO DE LOGIN
// ====================================================================

/**
 * Maneja el envío del formulario de login.
 * @param {Event} event - El evento de envío del formulario.
 */
async function handleLogin(event) {
    event.preventDefault();
    if (statusMessage) statusMessage.classList.add('hidden');
    toggleFormState(true);

    const email = usernameInput.value.trim();
    const password = passwordInput.value;

    const loginData = {
        email: email, 
        password: password
    };

    try {
        // Endpoint de la API
        const response = await fetch('/api/v1/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify(loginData) 
        });

        if (response.ok) {
            const result = await response.json();
            
            // 1. Guardar el token JWT en el LocalStorage
            if (result.token) {
                localStorage.setItem('jwtToken', result.token);
            } else {
                throw new Error('Token JWT no recibido en la respuesta.');
            }
            
            showMessage(`¡Bienvenido, ${result.usuario || 'Usuario'}! Redirigiendo...`, true);

            // 2. Redirigir basado en el rol recibido del backend
            if (result.role) {
                redirectByRole(result.role);
            } else {
                throw new Error('Rol no definido en la respuesta del servidor.');
            }

        } else {
            const errorData = await response.json();
            const errorMessage = errorData.message || 'Error de servidor desconocido.';
            showMessage(`Login fallido: ${errorMessage}`, false);
            localStorage.removeItem('jwtToken');
        }

    } catch (error) {
        console.error('Error durante el login:', error);
        showMessage('Error de conexión o datos. Inténtalo de nuevo más tarde.', false);
        localStorage.removeItem('jwtToken');
    } finally {
        // Solo restaurar el formulario si no hubo una redirección inmediata
        if (window.location.pathname === '/' || window.location.pathname === LOGIN_PATH) {
            toggleFormState(false);
        }
    }
}

// ====================================================================
// 4. INICIALIZACIÓN Y VERIFICACIÓN DE TOKEN
// ====================================================================

document.addEventListener('DOMContentLoaded', () => {
    // 1. Verificar si el usuario ya está logueado
    const existingToken = localStorage.getItem('jwtToken');
    
    // Si estamos en la página de login (o la raíz) Y hay un token, debemos redirigir.
    if (existingToken && (window.location.pathname === '/' || window.location.pathname === LOGIN_PATH)) {
        const payload = decodeJwt(existingToken);
        
        // Si el token es válido y tiene rol, redirigir inmediatamente.
        if (payload && payload.role) {
            console.log("Token existente encontrado. Redirigiendo a página principal.");
            // Usamos una redirección directa sin delay para la precarga
            redirectByRole(payload.role); 
            return; // Detiene la asignación de listeners del formulario
        } else {
            // Token inválido/incompleto, lo borramos
            localStorage.removeItem('jwtToken');
        }
    }

    // 2. Asignar el listener al formulario de login solo si está presente
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
});