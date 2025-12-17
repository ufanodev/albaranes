/**
 * admin_albaran_view.js
 * Controlador para la vista de detalle del Administrador.
 * Conecta la API con el mapeador admin_albaran_cargar.js
 */

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Extraer ID del albarán desde la URL (ej: /admin/albaranes/view/45)
    const urlParts = window.location.pathname.split('/');
    const albaranId = urlParts[urlParts.length - 1];

    // Validación básica del ID
    if (!albaranId || isNaN(albaranId)) {
        console.error("❌ [ADMIN VIEW] ID de albarán no válido en la URL.");
        if (typeof showError === 'function') {
            showError("El ID del albarán no es válido o no se ha encontrado en la URL.");
        }
        return;
    }

    console.log(`🚀 [ENTRADA JS] Iniciando carga de datos para Albarán ID: ${albaranId}`);

    try {
        // 2. Consultar la API real (GIN)
        // Usamos el endpoint específico que devuelve un solo albarán por su ID único
        const response = await fetch(`/api/v1/albaranes/id/${albaranId}`);
        
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || "Fallo al conectar con el servidor de datos.");
        }

        const result = await response.json();

        // 3. Log de Salida: Verificamos el JSON que nos entrega el Backend
        console.log("📥 [SALIDA GIN -> JS] Datos recibidos con éxito:", result.data);

        // 4. Invocación del Mapeador (admin_albaran_cargar.js)
        // La función populateForm debe existir globalmente gracias a admin_albaran_cargar.js
        if (typeof populateForm === 'function') {
            populateForm(result.data);
            console.log("✅ [ADMIN VIEW] Interfaz rellenada correctamente.");
        } else {
            console.error("❌ [CRÍTICO] No se encontró la función populateForm. Verifica que admin_albaran_cargar.js esté cargado en el HTML.");
            throw new Error("Mapeador de datos no disponible.");
        }

        // 5. Gestión del Indicador de Carga
        const loader = document.getElementById('loadingIndicator');
        if (loader) {
            loader.classList.add('hidden'); // Ocultar usando Tailwind
            loader.style.display = 'none';  // Asegurar por estilo directo
        }

    } catch (error) {
        console.error("❌ [ERROR]:", error.message);
        if (typeof showError === 'function') {
            showError(error.message);
        } else {
            // Fallback si no existe la función showError
            const errDiv = document.getElementById('errorMessage');
            if (errDiv) {
                errDiv.textContent = "Error de sistema: " + error.message;
                errDiv.classList.remove('hidden');
            }
            alert("Error al cargar el albarán: " + error.message);
        }
    }

    // 6. Inicializar/Refrescar iconos de Lucide (por si el cargador inyectó contenido)
    if (window.lucide) {
        lucide.createIcons();
    }
});