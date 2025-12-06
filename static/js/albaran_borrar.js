// Archivo: static/js/albaran_borrar.js
// Lógica para cargar y eliminar un albarán (solo modo Admin).

let albaranID = null;

function getAlbaranIDFromURL() {
    const pathParts = window.location.pathname.split('/');
    const id = pathParts[pathParts.length - 1];
    return (id && !isNaN(id)) ? id : null;
}

// =====================================================================
// 🔑 LÓGICA DE BORRADO
// =====================================================================

/**
 * Maneja la acción de confirmar borrado.
 */
window.handleDeleteAction = async (actionType) => {
    if (actionType !== 'confirmar') return;

    if (!albaranID) {
        showError("ID de albarán no identificado para borrado.");
        return;
    }

    // 1. Confirmación visual extra (aunque el botón ya es una confirmación)
    if (!confirm(`¿Está ABSOLUTAMENTE seguro de ELIMINAR el Albarán con ID ${albaranID}? Esta acción es IRREVERSIBLE.`)) {
        return;
    }

    const loadingIndicator = document.getElementById('loadingIndicator');
    const deleteButton = document.getElementById('btn-confirm-delete');
    
    // Deshabilitar botón y mostrar carga
    deleteButton.disabled = true;
    deleteButton.textContent = "Eliminando...";
    if (loadingIndicator) loadingIndicator.style.display = 'inline';

    try {
        // 2. Llamar a la API con método DELETE
        const response = await fetch(`/api/v1/albaranes/${albaranID}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.status === 401) {
            window.location.href = '/login'; 
            return;
        }

        if (!response.ok) {
            let errorText = await response.text();
            let errorMsg = `Error ${response.status}: No se pudo completar el borrado.`;
            try {
                const err = JSON.parse(errorText);
                errorMsg = err.error || errorMsg;
            } catch {}
            throw new Error(errorMsg);
        }

        // 3. Éxito y redirección
        showError(`✅ Albarán ID ${albaranID} ELIMINADO correctamente. Redirigiendo...`);
        console.log(`✅ DELETE exitoso para Albarán ID ${albaranID}`);

        // Redirigir al listado principal de administrador
        setTimeout(() => window.location.href = '/admin', 1500);

    } catch (error) {
        console.error('Error al eliminar:', error);
        showError(`❌ Fallo en el borrado: ${error.message}`);
        deleteButton.disabled = false;
        deleteButton.textContent = "CONFIRMAR ELIMINACIÓN";
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    }
};


// =====================================================================
// 🚀 INICIALIZACIÓN DE LA VISTA DE BORRADO
// =====================================================================
document.addEventListener('DOMContentLoaded', async () => {
    albaranID = getAlbaranIDFromURL();
    const loadingIndicator = document.getElementById('loadingIndicator');
    
    if (!albaranID) {
        showError("ID de albarán no válido para borrado.");
        return;
    }

    try {
        // Cargar los datos para mostrarlos como confirmación
        const response = await fetch(`/api/v1/albaranes/${albaranID}`);
        
        if (response.status === 401) {
            window.location.href = '/login'; 
            return;
        }
        
        if (!response.ok) {
            throw new Error(`Error ${response.status}: No se pudo cargar el albarán para confirmación.`);
        }

        const json = await response.json();
        const data = json.data;

        if (!data) {
            throw new Error("No se recibieron datos del servidor.");
        }

        // Usamos la función global populateForm de albaran_cargar.js
        if (typeof populateForm === 'function') {
             populateForm(data);
        } else {
             // Fallback si populateForm no está definido globalmente
             console.error("populateForm no está disponible. Datos no cargados.");
        }

        // Ocultar indicador de carga
        if (loadingIndicator) loadingIndicator.style.display = 'none';

    } catch (error) {
        console.error(error);
        showError(error.message);
        if (loadingIndicator) loadingIndicator.textContent = "Error de Carga";
        
        // Deshabilitar el botón de borrado si la carga falla
        const deleteButton = document.getElementById('btn-confirm-delete');
        if (deleteButton) {
             deleteButton.disabled = true;
             deleteButton.textContent = "Error de Carga";
        }
    }
});