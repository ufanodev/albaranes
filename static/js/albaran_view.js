/**
 * albaran_view.js
 * Lógica principal para la visualización de un albarán específico (Panel Titular).
 * Extrae el ID de la ruta /titulares/view/:id y sincroniza los datos del servidor.
 */

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Obtener el ID del albarán desde la URL actual
    // Ejemplo de URL: http://localhost:8080/titulares/view/47
    const pathParts = window.location.pathname.split('/');
    const albaranId = pathParts[pathParts.length - 1];

    // Validación de seguridad para el ID
    if (!albaranId || isNaN(albaranId)) {
        console.error("❌ [VIEW] ID de albarán no detectado o inválido en la URL.");
        showError("El identificador del albarán no es válido.");
        return;
    }

    console.log(`🔎 [VIEW] Iniciando sincronización para el Albarán ID: ${albaranId}`);

    try {
        // 2. Solicitar los datos al backend (Garantizando el cumplimiento de roles de seguridad)
        const response = await fetch(`/api/v1/albaranes/id/${albaranId}`);

        // Manejo de expiración de sesión
        if (response.status === 401) {
            console.warn("⚠️ [VIEW] Sesión no válida o caducada. Redirigiendo a login.");
            window.location.href = '/login';
            return;
        }

        // Manejo de errores de servidor o permisos
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Error del servidor (${response.status})`);
        }

        // 3. Procesar la respuesta JSON
        const result = await response.json();
        const data = result.data;

        if (!data) {
            throw new Error("No se han encontrado datos registrados para este albarán.");
        }

        console.log("📦 [VIEW] Datos recibidos con éxito:", data);

        // 4. Poblar el formulario/vista (Utiliza la función global en albaran_cargar.js)
        if (typeof populateForm === 'function') {
            populateForm(data);
        } else {
            console.error("❌ [VIEW] Error crítico: No se encuentra la función global 'populateForm' en albaran_cargar.js");
            showError("Error de carga: El script de mapeo no está disponible.");
        }

        // 5. Actualizar elementos estéticos y visuales fuera del formulario principal
        
        // Actualizar el número del albarán en la cabecera naranja
        const headerTitle = document.getElementById('view_numero_albaran_header');
        if (headerTitle) {
            headerTitle.textContent = data.numero_albaran || `ID: ${data.id}`;
        }

        // Ocultar el spinner de carga una vez finalizado el proceso
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator) {
            loadingIndicator.classList.add('hidden');
        }

        console.log("✅ [VIEW] Proceso de renderizado completado satisfactoriamente.");

    } catch (error) {
        console.error("❌ [VIEW] Fallo en la comunicación con la API:", error);
        showError(error.message);
    }
});

/**
 * Muestra visualmente el error en la interfaz de usuario.
 */
function showError(msg) {
    const errorContainer = document.getElementById('errorMessage');
    const loadingContainer = document.getElementById('loadingIndicator');

    if (errorContainer) {
        errorContainer.textContent = `🛑 ERROR: ${msg}`;
        errorContainer.classList.remove('hidden');
    }

    if (loadingContainer) {
        loadingContainer.classList.add('hidden');
    }
    
    // Si hay un error crítico, notificamos visualmente en la consola
    console.error(`🚨 [VIEW ERROR]: ${msg}`);
}