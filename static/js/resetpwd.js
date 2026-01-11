document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('resetForm');
    const statusMessage = document.getElementById('statusMessage');
    const btn = document.getElementById('btnCambiar');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Captura de datos
        const email = document.getElementById('email').value.trim().toLowerCase();
        const code = document.getElementById('code').value.trim();
        const password = document.getElementById('password').value;

        // Validación visual previa
        if (code.length !== 6) {
            mostrarMensaje("❌ El código debe tener 6 dígitos", "error");
            return;
        }

        // Preparar UI para la carga
        statusMessage.classList.add('hidden');
        btn.disabled = true;
        btn.textContent = "Validando código...";

        try {
            const response = await fetch('/api/v1/auth/confirm-reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code, password })
            });

            const result = await response.json();

            if (response.ok) {
                // ÉXITO: Contraseña cambiada
                mostrarMensaje("✅ Contraseña actualizada. Redirigiendo al inicio...", "success");
                
                // Redirección al login tras 2 segundos
                setTimeout(() => {
                    window.location.href = "/login";
                }, 2000);
            } else {
                // ERROR: Código inválido, expirado o error de servidor
                mostrarMensaje("❌ " + (result.error || "Error al validar"), "error");
                btn.disabled = false;
                btn.textContent = "Actualizar Contraseña";
            }
        } catch (error) {
            // ERROR DE RED
            mostrarMensaje("❌ Error de comunicación con el servidor", "error");
            btn.disabled = false;
            btn.textContent = "Actualizar Contraseña";
        }
    });

    // Función auxiliar para mostrar mensajes con estilos Tailwind
    function mostrarMensaje(texto, tipo) {
        statusMessage.classList.remove('hidden');
        statusMessage.textContent = texto;
        
        if (tipo === "success") {
            statusMessage.className = "text-center mt-4 p-3 rounded-md bg-green-100 text-green-700 border border-green-400 font-medium text-sm";
        } else {
            statusMessage.className = "text-center mt-4 p-3 rounded-md bg-red-100 text-red-700 border border-red-400 font-medium text-sm";
        }
    }
});