document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('recuperarForm');
    const statusMessage = document.getElementById('statusMessage');
    const btn = document.getElementById('btnEnviar');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value.trim().toLowerCase();

        statusMessage.classList.add('hidden');
        statusMessage.className = "hidden text-center mt-6 p-3 rounded-md border border-opacity-50 font-medium";

        btn.disabled = true;
        btn.textContent = "Procesando...";

        try {
            const response = await fetch('/api/v1/auth/request-reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            const result = await response.json();
            statusMessage.classList.remove('hidden');

            if (response.ok) {
                statusMessage.classList.add('bg-green-100', 'text-green-700', 'border-green-400');
                statusMessage.textContent = '📧 Enlace generado. Revisa la consola del servidor.';
                form.reset();
            } else {
                statusMessage.classList.add('bg-red-400', 'text-white', 'border-red-600');
                statusMessage.textContent = '❌ ' + (result.error || 'Error al procesar');
            }
        } catch (error) {
            statusMessage.classList.remove('hidden');
            statusMessage.classList.add('bg-red-400', 'text-white', 'border-red-600');
            statusMessage.textContent = '❌ Error de conexión.';
        } finally {
            btn.disabled = false;
            btn.textContent = "Enviar Enlace";
        }
    });
});