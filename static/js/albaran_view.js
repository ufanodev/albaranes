/**
 * ARCHIVO: static/js/albaran_view.js
 * DESCRIPCIÓN: Lógica de vista (Solo Lectura) con traducción de IDs de empresa.
 * ACTUALIZADO: 24/03/2026 - Compatibilidad total con AlbaranLoader Universal.
 */

document.addEventListener('DOMContentLoaded', async () => {
    console.log("%c🚀 [VIEW] Iniciando motor de renderizado de solo lectura...", "color: #FF8C00; font-weight: bold;");

    // 1. Obtención del ID desde la URL (Soporta /view/93 o /view?id=93)
    let albaranId = new URLSearchParams(window.location.search).get('id');
    if (!albaranId) {
        const pathParts = window.location.pathname.split('/').filter(p => p !== "");
        albaranId = pathParts[pathParts.length - 1];
    }

    if (!albaranId || isNaN(albaranId)) {
        console.error("❌ [VIEW] ID no válido detectado.");
        showError("El identificador del albarán no es válido.");
        return;
    }

    try {
        // 2. Cargar Catálogo de Empresas (Para traducir IDs a Nombres reales)
        // Esto es necesario porque a veces la DB devuelve el ID en el campo de texto.
        const rEmp = await fetch('/api/v1/empresas', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const dEmp = await rEmp.json();
        const empresasCatalog = {};
        if (dEmp.data) {
            dEmp.data.forEach(e => empresasCatalog[e.id] = e.nombre.toUpperCase());
        }

        console.log(`📡 [VIEW] Solicitando datos para ID: ${albaranId}`);
        
        // 3. Petición a la API del Albarán
        const response = await fetch(`/api/v1/albaranes/id/${albaranId}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });

        if (response.status === 401) {
            window.location.href = '/login';
            return;
        }

        if (!response.ok) {
            throw new Error("No se pudo recuperar la información del albarán.");
        }

        const result = await response.json();
        const data = result.data;

        if (!data) {
            throw new Error("No hay datos disponibles.");
        }

        // --- BLOQUE DE TRADUCCIÓN DE EMPRESA ---
        // Si empresa_nombre es un número (ID) o está vacío, usamos el catálogo.
        if (!data.empresa_nombre || !isNaN(Number(data.empresa_nombre))) {
            data.empresa_nombre = empresasCatalog[data.empresa_ref] || data.empresa_nombre || "---";
        }

        // 4. INYECCIÓN MEDIANTE MOTOR UNIVERSAL
        // Buscará los IDs en el HTML que coincidan con las llaves del JSON
        if (window.AlbaranLoader) {
            window.AlbaranLoader.populateForm(data);
            console.log("%c✅ [VIEW] AlbaranLoader inyectó los datos correctamente.", "color: #10B981; font-weight: bold;");
        } else {
            console.error("❌ Motor AlbaranLoader no encontrado.");
        }

        // 5. LIMPIEZA DE INTERFAZ
        document.getElementById('loadingIndicator')?.classList.add('hidden');
        if (window.lucide) lucide.createIcons();

    } catch (error) {
        console.error("❌ [VIEW] Error crítico:", error);
        showError(error.message);
    }
});

/**
 * Muestra un bloque de error visual en la página
 */
function showError(msg) {
    const errEl = document.getElementById('errorMessage');
    if (errEl) {
        errEl.textContent = `❌ Error: ${msg}`;
        errEl.classList.remove('hidden');
    }
    document.getElementById('loadingIndicator')?.classList.add('hidden');
}