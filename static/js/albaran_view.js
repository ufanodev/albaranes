/**
 * ARCHIVO: static/js/albaran_view.js
 * DESCRIPCIÓN: Lógica de vista (Solo Lectura) que utiliza el motor universal AlbaranLoader.
 * ACTUALIZADO: 19/03/2026 - Integración con sistema de mapeo automático.
 */

document.addEventListener('DOMContentLoaded', async () => {
    console.log("%c🚀 [VIEW] Iniciando motor de renderizado de solo lectura...", "color: #FF8C00; font-weight: bold;");

    // 1. Obtención del ID desde la URL
    // Soporta formatos: /titulares/view/92 o /titulares/view?id=92
    let albaranId = new URLSearchParams(window.location.search).get('id');
    if (!albaranId) {
        const pathParts = window.location.pathname.split('/').filter(p => p !== "");
        albaranId = pathParts[pathParts.length - 1];
    }

    if (!albaranId || isNaN(albaranId)) {
        console.error("❌ [VIEW] ID no válido detectado en la URL.");
        showError("El identificador del albarán no es válido.");
        return;
    }

    try {
        console.log(`📡 [VIEW] Solicitando datos al servidor para ID: ${albaranId}`);
        
        // 2. Petición a la API con credenciales (Cookie HttpOnly)
        const response = await fetch(`/api/v1/albaranes/id/${albaranId}`, {
            credentials: 'include'
        });

        if (response.status === 401) {
            console.warn("⚠️ [VIEW] Sesión expirada o no válida.");
            window.location.href = '/login';
            return;
        }

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || "No se pudo recuperar la información del albarán.");
        }

        const result = await response.json();
        const data = result.data;

        if (!data) {
            throw new Error("El servidor respondió con éxito pero sin datos del albarán.");
        }

        // --- BLOQUE DE AUDITORÍA (Verifica esto en la consola F12) ---
        console.log("%c📦 [DATA SQL] Valores maestros recibidos:", "color: #3B82F6; font-weight: bold;");
        console.log("- ID Albarán:", data.id);
        console.log("- Cliente (SQL: cliente):", data.cliente);
        console.log("- Empresa (SQL: empresa_nombre):", data.empresa_nombre);
        console.log("- Referencia (SQL: referencia):", data.referencia);
        console.log("- Importe Total:", data.importe_total);
        // -----------------------------------------------------------

        // 3. POBLAR LA VISTA USANDO EL MOTOR UNIVERSAL
        // AlbaranLoader.populateForm detectará los DIVs en albaran_view.html
        // y aplicará el mapeo de 'cliente' -> '#nombre_pasajero'
        if (window.AlbaranLoader) {
            window.AlbaranLoader.populateForm(data);
            console.log("%c✅ [VIEW] AlbaranLoader ejecutado correctamente.", "color: #10B981; font-weight: bold;");
        } else {
            throw new Error("El motor AlbaranLoader no está cargado. Revisa el orden de los scripts en el HTML.");
        }

        // 4. FINALIZAR INTERFAZ
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator) loadingIndicator.classList.add('hidden');

        // Refrescar iconos de Lucide
        if (window.lucide) {
            lucide.createIcons();
        }

    } catch (error) {
        console.error("❌ [VIEW] Error crítico en el renderizado:", error);
        showError(error.message);
    }
});

/**
 * Muestra un bloque de error visual en la página
 */
function showError(msg) {
    const errEl = document.getElementById('errorMessage');
    if (errEl) {
        errEl.textContent = `❌ Error de Carga: ${msg}`;
        errEl.classList.remove('hidden');
    }
    const loading = document.getElementById('loadingIndicator');
    if (loading) loading.classList.add('hidden');
}