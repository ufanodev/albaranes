/**
 * albaran_view.js
 * Lógica para la visualización detallada de un albarán (Panel Titular).
 * Conecta con el endpoint GET /api/v1/albaranes/id/:id
 */

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Extracción del ID desde la URL
    // Soporta rutas tipo: /titulares/view/123
    const pathParts = window.location.pathname.split('/');
    const albaranId = pathParts[pathParts.length - 1];

    if (!albaranId || isNaN(albaranId)) {
        console.error("❌ [VIEW] ID no válido en la URL.");
        showError("El identificador del albarán es inválido o no existe.");
        return;
    }

    console.log(`🔎 [VIEW] Sincronizando datos del Albarán ID: ${albaranId}`);

    try {
        // 2. Consulta a la API
        const response = await fetch(`/api/v1/albaranes/id/${albaranId}`);

        // Control de Sesión Expirada
        if (response.status === 401) {
            console.warn("⚠️ [VIEW] Sesión caducada.");
            window.location.href = '/login';
            return;
        }

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Error ${response.status}: No se pudo acceder al albarán.`);
        }

        // 3. Procesamiento de datos
        const result = await response.json();
        const data = result.data;

        if (!data) {
            throw new Error("El albarán solicitado no contiene información válida.");
        }

        console.log("📦 [VIEW] Datos cargados:", data);

        // 4. Mapeo al HTML (Usa la función unificada en albaran_cargar.js)
        if (typeof populateForm === 'function') {
            populateForm(data);
        } else {
            throw new Error("Error interno: No se pudo cargar el motor de mapeo de datos.");
        }

        // 5. Ajustes estéticos finales
        // Actualizamos el número en la cabecera con el formato oficial
        const headerNum = document.getElementById('view_numero_albaran_header');
        if (headerNum) {
            headerNum.textContent = data.numero_albaran || `#${data.id}`;
        }

        // Finalizar estado de carga
        const loader = document.getElementById('loadingIndicator');
        if (loader) {
            loader.classList.add('hidden');
        }

        console.log("✅ [VIEW] Renderizado completado satisfactoriamente.");

    } catch (error) {
        console.error("❌ [VIEW] Error en proceso:", error);
        showError(error.message);
    }
});

/**
 * Gestión visual de errores en la interfaz
 */
function showError(msg) {
    const errorContainer = document.getElementById('errorMessage');
    const loadingContainer = document.getElementById('loadingIndicator');

    if (errorContainer) {
        errorContainer.innerHTML = `
            <div class="flex items-center justify-center gap-3">
                <i data-lucide="alert-triangle" class="w-8 h-8"></i>
                <span>${msg}</span>
            </div>
        `;
        errorContainer.classList.remove('hidden');
        // Re-inicializar iconos de Lucide para el nuevo HTML inyectado
        if (window.lucide) lucide.createIcons();
    }

    if (loadingContainer) {
        loadingContainer.classList.add('hidden');
    }
}