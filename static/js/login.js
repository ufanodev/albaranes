/**
 * js/login.js
 * Lógica para el manejo del formulario de inicio de sesión con credenciales mockeadas.
 */

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
});

function handleLogin(event) {
    event.preventDefault(); 

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const statusMessage = document.getElementById('statusMessage');

    // 1. Limpiar y resetear clases de estado
    statusMessage.classList.add('hidden');
    // Limpieza de todas las posibles clases de color
    statusMessage.classList.remove('bg-green-100', 'text-green-700', 'border-green-400', 'bg-red-400', 'text-white', 'border-red-600');
    
    // --- CREDENCIALES MOCKEADAS ---
    const ADMIN_USER = "admin";
    const ADMIN_PASS = "1234";
    const TAXI_USER = "taxi";
    const TAXI_PASS = "1234";

    let redirectUrl = null;
    let success = false;

    if (username === ADMIN_USER && password === ADMIN_PASS) {
        // Acceso de Administrador
        redirectUrl = 'admin.html';
        success = true;
    } else if (username === TAXI_USER && password === TAXI_PASS) {
        // Acceso de Taxi (Usuario Titular)
        redirectUrl = 'busqueda.html';
        success = true;
    }

    if (success) {
        // Éxito: Usamos colores verdes estándar de Tailwind para el éxito
        statusMessage.classList.remove('hidden');
        statusMessage.classList.add('bg-green-100', 'text-green-700', 'border-green-400');
        statusMessage.textContent = `✅ ¡Bienvenido ${username}! Redirigiendo...`;
        
        console.log(`Login OK para usuario: ${username}`);
        
        // Redirección después de un breve retraso
        setTimeout(() => {
            window.location.href = redirectUrl; 
        }, 1000); 

    } else {
        // Error: Rojo Pastel (simulado con un tono de rojo más claro, ej. bg-red-400) y Letra Blanca
        statusMessage.classList.remove('hidden');
        // bg-red-400 es un rojo suave, text-white es letra blanca
        statusMessage.classList.add('bg-red-400', 'text-white', 'border-red-600'); 
        statusMessage.textContent = '❌ Usuario o Contraseña invalidos.';
        
        console.log(`Login fallido para usuario: ${username}`);
    }
}