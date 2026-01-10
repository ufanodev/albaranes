document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('resetForm');
    const statusMessage = document.getElementById('statusMessage');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        // Obtener el token de la URL (?token=XXXX)
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');

        if (!token) {
            alert("Token no encontrado en la URL");
            return;
        }

        if (password !== confirmPassword) {
            alert("Las contraseñas no coinciden");
            return;
        }

        try {
            const response = await fetch('/api/v1/auth/confirm-reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password })
            });

            const result = await response.json();
            statusMessage.classList.remove('hidden');

            if (response.ok) {
                statusMessage.className = "mt-4 p-3 bg-green-100 text-green-700 rounded-md";
                statusMessage.textContent = "✅ Contraseña actualizada. Redirigiendo...";
                setTimeout(() => window.location.href = "/login", 2000);
            } else {
                statusMessage.className = "mt-4 p-3 bg-red-100 text-red-700 rounded-md";
                statusMessage.textContent = "❌ " + result.error;
            }
        } catch (error) {
            console.error(error);
        }
    });
});