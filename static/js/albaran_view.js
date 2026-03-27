/**
 * ARCHIVO: static/js/albaran_view.js
 * DESCRIPCIÓN: Lógica de visualización (Solo Lectura) con traducción de datos y motor universal.
 * ACTUALIZADO: 27/03/2026 - FIX: Sincronización total con AlbaranLoader y visualización de 0.35.
 */

document.addEventListener('DOMContentLoaded', async () => {
    console.log("%c🚀 [VIEW] Iniciando motor de renderizado de solo lectura...", "color: #FF8C00; font-weight: bold;");

    // 1. Obtención del ID desde la URL (Soporta /view/93 o /view?id=93)
    let albaranId = new URLSearchParams(window.location.search).get('id');
    if (!albaranId) {
        const pathParts = window.location.pathname.split('/').filter(p => p !== "");
        // El ID suele ser el último segmento de la URL
        albaranId = pathParts[pathParts.length - 1];
    }

    if (!albaranId || isNaN(albaranId)) {
        console.error("❌ [VIEW] ID no válido detectado:", albaranId);
        showError("El identificador del albarán no es válido.");
        return;
    }

    try {
        // 2. Carga paralela: Catálogo de Empresas + Datos del Albarán
        const [resEmpresas, resAlbaran] = await Promise.all([
            fetch('/api/v1/empresas', { 
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } 
            }),
            fetch(`/api/v1/albaranes/id/${albaranId}`, { 
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } 
            })
        ]);

        if (resAlbaran.status === 401) {
            window.location.href = '/login';
            return;
        }

        if (!resAlbaran.ok) throw new Error("No se pudo recuperar la información del servidor.");

        const dEmp = await resEmpresas.json();
        const result = await resAlbaran.json();
        const data = result.data;

        if (!data) throw new Error("No hay datos disponibles para este albarán.");

        // --- PROCESAMIENTO DE DATOS PRE-RENDER ---

        // A. Traducción de Empresa (ID -> Nombre legible)
        const empresasCatalog = {};
        if (dEmp.data) {
            dEmp.data.forEach(e => empresasCatalog[e.id] = e.nombre.toUpperCase());
        }
        
        // Si el backend envía el ID o un nombre vacío, lo rescatamos del catálogo
        if (!data.empresa_nombre || !isNaN(Number(data.empresa_nombre))) {
            data.empresa_nombre = empresasCatalog[data.empresa_ref] || data.empresa_nombre || "EMPRESA NO IDENTIFICADA";
        }

        // B. Verificación de campos críticos en consola para depuración
        console.log(`📡 [VIEW] Datos del Albarán #${data.numero_albaran}:`, {
            id: data.id,
            espera_decimal: data.hora_total,
            pasajero: data.cliente
        });

        // 3. INYECCIÓN MEDIANTE MOTOR UNIVERSAL (AlbaranLoader)
        if (window.AlbaranLoader) {
            /**
             * IMPORTANTE: AlbaranLoader buscará los IDs en el HTML que coincidan con 
             * las llaves del JSON: "fecha", "hora_total", "nombre_pasajero", etc.
             */
            window.AlbaranLoader.populateForm(data);
            console.log("%c✅ [VIEW] AlbaranLoader inyectó los datos correctamente.", "color: #10B981; font-weight: bold;");
        } else {
            console.error("❌ Error: No se encontró el motor AlbaranLoader.js cargado en el HTML.");
            showError("Error interno: Motor de carga no disponible.");
        }

        // 4. LIMPIEZA DE INTERFAZ
        document.getElementById('loadingIndicator')?.classList.add('hidden');
        
        // Refrescar iconos de Lucide tras inyectar el contenido
        if (window.lucide) lucide.createIcons();

    } catch (error) {
        console.error("❌ [VIEW] Error crítico en la carga:", error);
        showError(error.message);
    }
});

/**
 * Muestra un bloque de error visual en la página si algo falla
 */
function showError(msg) {
    const errEl = document.getElementById('errorMessage');
    if (errEl) {
        errEl.textContent = `❌ ERROR: ${msg}`;
        errEl.classList.remove('hidden');
    }
    const loader = document.getElementById('loadingIndicator');
    if (loader) loader.style.display = 'none';
}