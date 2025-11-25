// Archivo: static/js/login.js
// Lógica de inicio de sesión (fetch a la API) y redirección por rol.
// La sesión (token) se maneja exclusivamente en el backend (Go/Gin) mediante la Cookie HttpOnly.

// Rutas de redirección (ajustadas según routes.go)
const LOGIN_PATH = '/login';
const TITULAR_PATH = '/titulares'; // Para rol 'user' o 'titular'
const ADMIN_PATH = '/admin';       // Para rol 'admin'

// ====================================================================
// 1. CONSTANTES Y UTILIDADES DOM
// ====================================================================

// Obtener elementos DOM
const loginForm = document.getElementById('loginForm');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const statusMessage = document.getElementById('statusMessage');
const submitButton = document.getElementById('submitButton');

/**
 * Muestra un mensaje de estado en el formulario de login.
 */
function showMessage(message, isSuccess) {
    if (!statusMessage) return;
    
    statusMessage.textContent = message;
    statusMessage.classList.remove('hidden', 'bg-status-success-bg', 'text-green-700', 'border-green-400', 'bg-status-error-bg', 'text-red-700', 'border-red-400');
    
    if (isSuccess) {
        statusMessage.classList.add('bg-status-success-bg', 'text-green-700', 'border-green-400');
    } else {
        statusMessage.classList.add('bg-status-error-bg', 'text-red-700', 'border-red-400');
    }
    statusMessage.classList.remove('hidden');
}

/**
 * Deshabilita el formulario durante la petición API.
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
 */
function redirectByRole(role) {
    const userRole = role ? role.toLowerCase() : '';
    let redirectPath = '';
    
    if (userRole === 'admin') {
        redirectPath = ADMIN_PATH; 
    } else if (userRole === 'user' || userRole === 'titular') {
        redirectPath = TITULAR_PATH; 
    } else {
        console.error("Rol de usuario desconocido. Redirigiendo a login.");
        window.location.href = LOGIN_PATH;
        return;
    }
    
    console.log(`LOG: Login exitoso. Redirigiendo a: ${redirectPath}`);
    setTimeout(() => window.location.href = redirectPath, 500);
}

// ====================================================================
// 2. LÓGICA DE MANEJO DE LOGIN (API FETCH)
// ====================================================================

/**
 * Maneja el envío del formulario de login.
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
        // La solicitud POST a /api/v1/login es donde el backend establece la Cookie HttpOnly.
        const response = await fetch('/api/v1/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify(loginData) 
        });

        if (response.ok) {
            const result = await response.json();
            
            // Éxito: La cookie HttpOnly se estableció en el servidor.
            showMessage(`¡Bienvenido, ${result.usuario || 'Usuario'}! Redirigiendo...`, true);

            if (result.role) {
                redirectByRole(result.role);
            } else {
                throw new Error('Rol no definido en la respuesta del servidor.');
            }

        } else {
            const errorData = await response.json();
            const errorMessage = errorData.error || 'Error de credenciales o servidor desconocido.';
            showMessage(`Login fallido: ${errorMessage}`, false);
        }

    } catch (error) {
        console.error('ERROR: Fallo durante el fetch del login:', error);
        showMessage('Error de conexión. Inténtalo de nuevo más tarde.', false);
    } finally {
        // Restaurar el formulario si no hubo una redirección.
        if (window.location.pathname === '/' || window.location.pathname === LOGIN_PATH) {
            toggleFormState(false);
        }
    }
}

// ====================================================================
// 3. INICIALIZACIÓN
// ====================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Asignamos el listener al formulario.
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
});