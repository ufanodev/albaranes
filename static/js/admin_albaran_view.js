/**
 * ARCHIVO: static/js/admin_albaran_view.js
 * DESCRIPCIÓN: Controlador para la vista de detalle del Administrador.
 * FUNCIONALIDAD: Conecta la API con el motor de carga y gestiona la navegación.
 * ACTUALIZADO: 21/03/2026
 */

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Extraer ID del albarán desde la URL (ej: /admin/albaranes/view/92)
    const urlParts = window.location.pathname.split('/').filter(p => p !== "");
    const albaranId = urlParts[urlParts.length - 1];

    console.log(`🚀 [ADMIN VIEW] Iniciando vista para Albarán ID: ${albaranId}`);

    // Validación básica del ID antes de llamar a la API
    if (!albaranId || isNaN(albaranId)) {
        console.error("❌ ID de albarán no válido en la URL.");
        mostrarNotificacion("ID de albarán no válido.", "error");
        return;
    }

    try {
        // 2. Consultar la API de GIN (Backend)
        const response = await fetch(`/api/v1/albaranes/id/${albaranId}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            // Importante para mantener la sesión de admin
            credentials: 'include' 
        });

        // Manejo de errores de autorización (401/403)
        if (response.status === 401 || response.status === 403) {
            window.location.href = '/login';
            return;
        }

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || "Fallo al conectar con el servidor.");
        }

        const result = await response.json();

        // 3. Verificar si existen datos
        if (!result.data) {
            throw new Error("El servidor no devolvió información para este registro.");
        }

        console.log("📥 [API DATA] Datos cargados con éxito:", result.data);

        // 4. Invocación del Mapeador (admin_albaran_cargar.js)
        if (typeof populateForm === 'function') {
            populateForm(result.data);
            console.log("✅ [ADMIN VIEW] Interfaz rellenada satisfactoriamente.");
        } else {
            console.error("❌ Error: No se encontró la función populateForm.");
            throw new Error("El motor de carga (admin_albaran_cargar.js) no está disponible.");
        }

        // 5. Configurar lógica de botones de navegación
        configurarBotones(albaranId);

    } catch (error) {
        console.error("❌ [CRÍTICO]:", error.message);
        mostrarNotificacion(error.message, "error");
    } finally {
        // Ocultar indicador de carga si existiera en el HTML
        const loader = document.getElementById('loadingIndicator');
        if (loader) loader.classList.add('hidden');
    }
});

/**
 * Configura los eventos de los botones de la cabecera
 */
function configurarBotones(id) {
    // Botón de Edición Directa
    const btnEdit = document.getElementById('btn_edit_direct');
    if (btnEdit) {
        btnEdit.addEventListener('click', () => {
            // Redirige a la ruta de edición de administración
            window.location.href = `/admin/albaranes/update/${id}`;
        });
    }
}

/**
 * Función auxiliar para mostrar errores visuales en la interfaz
 */
function mostrarNotificacion(mensaje, tipo) {
    // Si tienes un contenedor de errores específico en el HTML
    const errDiv = document.getElementById('errorMessage');
    if (errDiv) {
        errDiv.textContent = mensaje;
        errDiv.classList.remove('hidden');
        errDiv.className = tipo === 'error' ? 'bg-red-100 text-red-700 p-4 rounded-xl' : 'bg-green-100 text-green-700 p-4 rounded-xl';
    } else {
        // Fallback simple
        console.warn("Aviso al usuario:", mensaje);
    }
}