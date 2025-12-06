// Archivo: static/js/admin_titular_crud.js
// Lógica para la vista de CRUD de Titulares, incluyendo los modos 'view', 'edit' y 'create'.

(function() {
    
    // Objeto de estado y elementos encapsulado dentro del IIFE
    const CRUD_APP = {
        elements: {
            form: document.getElementById('titularForm'),
            mainTitle: document.getElementById('mainTitle'),
            statusMessage: document.getElementById('statusMessage'),
            btnCrear: document.getElementById('btn-crear'),
            btnModificar: document.getElementById('btn-modificar'),
            btnBorrar: document.getElementById('btn-borrar'),
            allInputs: null,
        },
        state: {
            mode: 'create', // 'create', 'edit', 'view'
            titularId: null,
        }
    };

    // =================================================================================
    // ⚙️ UTILITIES
    // =================================================================================

    /** Muestra un mensaje de estado en la interfaz. */
    function crudAlertMessage(message, type = 'info') {
        const { statusMessage } = CRUD_APP.elements;
        if (!statusMessage) return;

        statusMessage.textContent = message;
        statusMessage.className = `status-message ${type === 'success' ? 'status-success' : type === 'error' ? 'status-error' : type === 'info' ? 'status-info' : 'status-neutral'}`;
        statusMessage.classList.remove('hidden');
        setTimeout(() => statusMessage.classList.add('hidden'), 5000);
    }

    /** Habilita/Deshabilita todos los campos de entrada del formulario. */
    function toggleFormFields(enable) {
        if (!CRUD_APP.elements.allInputs) return;

        CRUD_APP.elements.allInputs.forEach(input => {
            input.disabled = !enable;
            input.readOnly = !enable;
            input.classList.toggle('bg-gray-50', !enable);
            input.classList.toggle('cursor-default', !enable);
        });
    }

    /** Actualiza el título de la página y los estados de los botones según el modo. */
    function updateUIForMode(mode) {
        const { mainTitle, btnCrear, btnModificar, btnBorrar } = CRUD_APP.elements;

        if (mode === 'view') {
            mainTitle.textContent = `👁️ Detalle Titular #${CRUD_APP.state.titularId}`;
            
            // Ocultar Crear y Deshabilitar Modificar/Borrar
            if (btnCrear) btnCrear.style.display = 'none'; 
            if (btnModificar) btnModificar.disabled = true;
            if (btnBorrar) btnBorrar.disabled = true;
            
            toggleFormFields(false);
            
            crudAlertMessage("Modo Solo Lectura: Los campos y botones de acción están deshabilitados.", 'info');

        } else if (mode === 'edit') {
            mainTitle.textContent = `✏️ Modificar Titular #${CRUD_APP.state.titularId}`;
            
            // Ocultar Crear y Borrar (solo Modificar y Volver deben estar activos)
            if (btnCrear) btnCrear.style.display = 'none';
            if (btnBorrar) btnBorrar.style.display = 'none'; 
            
            if (btnModificar) {
                btnModificar.textContent = 'Guardar Cambios'; // Cambiar texto
                btnModificar.disabled = false;
                btnModificar.style.display = ''; // Asegurar visibilidad
            }
            
            toggleFormFields(true);
            crudAlertMessage("Modo Edición: Modifique los campos y pulse 'Guardar Cambios'.", 'neutral');
            
        } else { // 'create'
            mainTitle.textContent = '➕ Crear Nuevo Titular';
            
            if (btnModificar) btnModificar.style.display = 'none';
            if (btnBorrar) btnBorrar.style.display = 'none';
            
            if (btnCrear) btnCrear.disabled = false;
            
            toggleFormFields(true);
        }
    }

    /** Carga los datos del titular y actualiza la UI, usando licencias_cargar.js. */
    async function loadAndFillTitularData(id, mode) {
        if (id && mode !== 'create' && typeof loadLicenciaFromAPI === 'function') {
            
            console.log(`   [CRUD] ⚙️ 8. Iniciando carga asíncrona de datos (ID: ${id}).`);
            
            const titularData = await loadLicenciaFromAPI(id); 

            if (titularData) {
                if (typeof fillFormWithLicenciaData === 'function') {
                    fillFormWithLicenciaData(titularData); 
                } else {
                    console.error("Error: fillFormWithLicenciaData no está definido. ¿licencias_cargar.js cargado?");
                }
                
                console.log(`   [CRUD] ✅ 9. Formulario rellenado. Modo: ${mode.toUpperCase()}`);
            } else {
                console.error(`   [CRUD] ⚠️ 9. Carga fallida. Redefiniendo modo a 'create'.`);
                CRUD_APP.state.mode = 'create';
                updateUIForMode('create');
                crudAlertMessage(`No se pudo encontrar el titular #${id}. Listo para Crear.`, 'error');
            }
        }
    }

    // =================================================================================
    // 🎯 EVENT HANDLERS (Expuestos al scope global como window.handleAction)
    // =================================================================================

    /** Maneja el envío del formulario (Crear/Modificar) */
    window.handleFormSubmit = function(event) {
        event.preventDefault();
        const form = event.target;
        
        if (!document.getElementById('licencia').value) {
            crudAlertMessage('❌ Error: El campo LICENCIA es obligatorio.', 'error');
            return;
        }

        const data = {};
        new FormData(form).forEach((value, key) => { data[key] = value; });
        
        if (CRUD_APP.state.mode === 'edit') {
            // Lógica para Modificar (fetch PUT)
            crudAlertMessage(`✅ MODIFICACIÓN exitosa simulada para ID ${data.titularId}.`, 'success');
            console.log("--- DATOS A MODIFICAR (SIMULADO) ---", JSON.stringify(data, null, 2));
        } else if (CRUD_APP.state.mode === 'create') {
            // Lógica para Crear (fetch POST)
            crudAlertMessage('✅ CREACIÓN exitosa simulada.', 'success');
            console.log("--- DATOS A CREAR (SIMULADO) ---", JSON.stringify(data, null, 2));
        }
    }

    /** Maneja las acciones de botones (Modificar, Borrar, Volver). */
    window.handleAction = function(actionType) {
        switch (actionType) {
            case 'modificar':
                // Si el botón está visible (modo 'edit'), se comporta como "Guardar Cambios"
                if (CRUD_APP.state.mode === 'edit') {
                    CRUD_APP.elements.form.dispatchEvent(new Event('submit', { cancelable: true }));
                }
                break;
                
            case 'borrar':
                if (CRUD_APP.state.titularId && confirm(`¿Está seguro que desea borrar el Titular #${CRUD_APP.state.titularId}? Esta acción es irreversible.`)) {
                    crudAlertMessage(`🗑️ Simulación: Eliminación solicitada para Titular #${CRUD_APP.state.titularId}.`, 'error');
                    // Redirigir después de simular la acción de la API
                    setTimeout(() => window.location.href = '/admin/titulares', 1500);
                }
                break;
                
            case 'volver':
                window.location.href = '/admin/titulares'; 
                break;

            default:
                break;
        }
    }

    // =================================================================================
    // 🚀 INICIALIZACIÓN AL CARGAR EL DOM
    // =================================================================================

    document.addEventListener('DOMContentLoaded', () => {
        console.log('---[ admin_titular_crud.js ]------------------------------');
        
        // 1. Obtener todos los campos del formulario
        if (CRUD_APP.elements.form) {
            CRUD_APP.elements.allInputs = CRUD_APP.elements.form.querySelectorAll('input, select, textarea');
        } else {
             console.error("Error FATAL: No se encontró el formulario #titularForm.");
             return; 
        }
        
        // 2. Determinar ID y Modo a partir del path (ej: /admin/titulares/view/20)
        const url = window.location.pathname;
        
        // Regex para capturar el modo y el ID: /.../(view|update|crear)/(\d+)?
        const match = url.match(/\/admin\/titulares\/(view|update|crear)\/(\d+)?/);
        
        let mode = 'create';
        let id = null;

        if (match) {
            if (match[1] === 'crear') {
                mode = 'create';
            } else {
                mode = match[1] === 'update' ? 'edit' : 'view'; // Mapear 'update' a 'edit'
                id = match[2];
            }
        }

        // 3. Establecer modo y ID en el estado global
        CRUD_APP.state.titularId = id;
        CRUD_APP.state.mode = mode;
        if (id) document.getElementById('titularId').value = id;

        console.log(`➡️ 4. URL analizada. Modo detectado: ${mode.toUpperCase()} (ID: ${id || 'Nuevo'}).`);
        
        // 4. Cargar datos y actualizar la interfaz (asíncrono)
        loadAndFillTitularData(id, mode);
        updateUIForMode(mode);
        
        console.log('✅ 10. Inicialización de CRUD completada.');

        // 5. Contador de palabras para Observaciones
        const obsElement = document.getElementById('observaciones');
        if (obsElement) {
            obsElement.addEventListener('input', function() {
                const text = this.value.trim();
                const wordCount = text ? text.split(/\s+/).filter(word => word.length > 0).length : 0;
                document.getElementById('wordCount').textContent = `${wordCount} palabras`;
            });
        }
    });

})(); // Fin del IIFE