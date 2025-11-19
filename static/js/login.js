// Archivo: static/js/login.js

// ====================================================================
// 1. CONSTANTES Y UTILIDADES DOM
// ====================================================================

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
    statusMessage.classList.remove('hidden', 'bg-status-success-bg', 'text-green-800', 'bg-status-error-bg', 'text-red-800');
    
    if (isSuccess) {
        statusMessage.classList.add('bg-status-success-bg', 'text-green-800', 'border-green-400');
    } else {
        statusMessage.classList.add('bg-status-error-bg', 'text-red-800', 'border-red-400');
    }
}

/**
 * Deshabilita el formulario durante la petición API.
 * @param {boolean} disabled - Estado de deshabilitación.
 */
function toggleFormState(disabled) {
    submitButton.disabled = disabled;
    usernameInput.disabled = disabled;
    passwordInput.disabled = disabled;
    submitButton.textContent = disabled ? 'Accediendo...' : 'Acceder';
    submitButton.classList.toggle('opacity-50', disabled);
}

// ====================================================================
// 2. LÓGICA DE MANEJO DE LOGIN
// ====================================================================

/**
 * Maneja el envío del formulario de login.
 * @param {Event} event - El evento de envío del formulario.
 */
async function handleLogin(event) {
    event.preventDefault();
    statusMessage.classList.add('hidden');
    toggleFormState(true);

    const email = usernameInput.value.trim();
    const password = passwordInput.value;

    const loginData = {
        email: email, 
        password: password
    };

    try {
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
            localStorage.setItem('jwtToken', result.token);
            
            showMessage(`¡Bienvenido, ${result.usuario}! Redirigiendo...`, true);

            // 2. Redirigir basado en el rol recibido del backend
            const userRole = result.role ? result.role.toLowerCase() : '';

            if (userRole === 'admin') {
                // REDIRECCIÓN CORREGIDA a la ruta base /admin
                const redirectPath = '/admin'; 
                console.log(`Login exitoso (Admin). Redirigiendo a: ${redirectPath}`);
                window.location.href = redirectPath; 
            } else {
                // RUTA DE USUARIO NORMAL
                const redirectPath = '/busqueda';
                console.log(`Login exitoso (User). Redirigiendo a: ${redirectPath}`);
                window.location.href = redirectPath; 
            }

        } else {
            const errorData = await response.json();
            const errorMessage = errorData.message || 'Error de servidor desconocido.';
            showMessage(`Login fallido: ${errorMessage}`, false);
        }

    } catch (error) {
        console.error('Error de red durante el login:', error);
        showMessage('Error de conexión. Inténtalo de nuevo más tarde.', false);
    } finally {
        toggleFormState(false);
    }
}

// ====================================================================
// 3. INICIALIZACIÓN
// ====================================================================

if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
} else {
    console.error('Elemento #loginForm no encontrado en el DOM.');
}