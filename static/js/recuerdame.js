document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('recuperarForm');
    const statusMessage = document.getElementById('statusMessage');
    const btn = document.getElementById('btnEnviar');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Limpiamos espacios y normalizamos el email
        const email = document.getElementById('email').value.trim().toLowerCase();

        // Preparar la UI para la carga
        statusMessage.classList.add('hidden');
        statusMessage.className = "hidden text-center mt-6 p-3 rounded-md border border-opacity-50 font-medium text-sm";
        
        btn.disabled = true;
        btn.textContent = "Enviando código...";

        try {
            const response = await fetch('/api/v1/auth/request-reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            const result = await response.json();
            statusMessage.classList.remove('hidden');

            if (response.ok) {
                // ÉXITO
                statusMessage.classList.add('bg-green-100', 'text-green-700', 'border-green-400', 'border');
                statusMessage.textContent = '📧 Código enviado con éxito. Redirigiendo...';
                
                // Redirección automática tras 2 segundos para que el usuario lea el mensaje
                setTimeout(() => {
                    window.location.href = "/resetpwd";
                }, 2000);

            } else {
                // ERROR DEL SERVIDOR (ej. formato inválido)
                statusMessage.classList.add('bg-red-100', 'text-red-700', 'border-red-400', 'border');
                statusMessage.textContent = '❌ ' + (result.error || 'No se pudo enviar el código');
                
                // Rehabilitar botón si hay error para permitir reintento
                btn.disabled = false;
                btn.textContent = "Enviar Código";
            }
        } catch (error) {
            // ERROR DE RED
            statusMessage.classList.remove('hidden');
            statusMessage.classList.add('bg-red-100', 'text-red-700', 'border-red-400', 'border');
            statusMessage.textContent = '❌ Error de conexión. Revisa tu internet.';
            
            btn.disabled = false;
            btn.textContent = "Enviar Código";
        }
    });
});