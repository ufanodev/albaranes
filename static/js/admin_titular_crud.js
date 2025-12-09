// Archivo: static/js/admin_titular_crud.js
// Lógica para la vista de CRUD de Titulares, incluyendo los modos 'view', 'edit' y 'delete'.

(function() {
    
    // Objeto de estado y elementos encapsulado dentro del IIFE
    const CRUD_APP = {
        elements: {
            form: document.getElementById('titularForm'),
            mainTitle: document.getElementById('mainTitle'),
            statusMessage: document.getElementById('statusMessage'),
            btnCrear: document.getElementById('btn-crear'),
            btnModificar: document.getElementById('btn-modificar'),
            btnBorrar: document.getElementById('btn-borrar'), // Usaremos este botón para la confirmación
            allInputs: null,
        },
        state: {
            mode: 'create', // 'create', 'edit', 'view', 'delete'
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
    function updateUIForMode(mode, titularData = null) {
        const { mainTitle, btnCrear, btnModificar, btnBorrar } = CRUD_APP.elements;
        const titularID = CRUD_APP.state.titularId;
        const titularLicencia = titularData ? titularData.licencia : '';

        // Ocultar botones de acción por defecto
        if (btnCrear) btnCrear.style.display = 'none';
        if (btnModificar) btnModificar.style.display = 'none';
        if (btnBorrar) btnBorrar.style.display = 'none';
        
        // Resetear deshabilitación
        if (btnModificar) btnModificar.disabled = false;
        if (btnBorrar) btnBorrar.disabled = false;
        
        toggleFormFields(false); // Por defecto, deshabilitado

        switch (mode) {
            case 'view':
                mainTitle.textContent = `👁️ Detalle Titular #${titularID}`;
                crudAlertMessage("Modo Solo Lectura: Campos deshabilitados.", 'info');
                break;

            case 'edit':
                mainTitle.textContent = `✏️ Modificar Titular #${titularID}`;
                if (btnModificar) {
                    btnModificar.textContent = 'Guardar Cambios';
                    btnModificar.style.display = '';
                }
                toggleFormFields(true); // Habilitar campos
                crudAlertMessage("Modo Edición: Modifique los campos y pulse 'Guardar Cambios'.", 'neutral');
                break;
                
            case 'delete':
                // ⚠️ MODO CONFIRMACIÓN DE BAJA
                mainTitle.textContent = `🗑️ Confirmar Baja Titular #${titularID} (${titularLicencia})`;
                if (btnBorrar) {
                    btnBorrar.textContent = '🗑️ CONFIRMAR BAJA'; // Cambiar texto para confirmación
                    btnBorrar.style.display = ''; // Mostrar solo Borrar
                }
                
                // Deshabilitar campos y mostrar mensaje de confirmación
                toggleFormFields(false);
                crudAlertMessage(`ATENCIÓN: Se requiere confirmación para dar de BAJA al titular #${titularID}.`, 'error');
                break;

            case 'create':
            default:
                mainTitle.textContent = '➕ Crear Nuevo Titular';
                if (btnCrear) btnCrear.style.display = '';
                toggleFormFields(true); // Habilitar campos
                break;
        }
    }

    /** Carga los datos del titular y actualiza la UI. */
    async function loadAndFillTitularData(id, mode) {
        if (id && mode !== 'create' && typeof loadLicenciaFromAPI === 'function') {
            
            console.log(`   [CRUD] ⚙️ 8. Iniciando carga asíncrona de datos (ID: ${id}).`);
            
            const titularData = await loadLicenciaFromAPI(id); 

            if (titularData) {
                // 2. Rellenar formulario
                if (typeof fillFormWithLicenciaData === 'function') {
                    fillFormWithLicenciaData(titularData); 
                } else {
                    console.error("Error: fillFormWithLicenciaData no está definido.");
                }
                
                // 3. Actualizar la UI con los datos cargados
                updateUIForMode(mode, titularData);
                console.log(`   [CRUD] ✅ 9. Formulario rellenado. Modo: ${mode.toUpperCase()}`);

            } else {
                console.error(`   [CRUD] ⚠️ 9. Carga fallida. Redefiniendo modo a 'create'.`);
                CRUD_APP.state.mode = 'create';
                updateUIForMode('create');
                crudAlertMessage(`No se pudo encontrar el titular #${id}. Listo para Crear.`, 'error');
            }
        } else {
             // Si el ID es nulo (modo create), simplemente actualiza la UI al modo 'create'
             updateUIForMode('create');
        }
    }

    // =================================================================================
    // 🎯 EVENT HANDLERS (Expuestos al scope global como window.handleAction)
    // =================================================================================

    /** Maneja el envío del formulario (Crear/Modificar) */
    window.handleFormSubmit = function(event) {
        event.preventDefault();
        
        if (!document.getElementById('licencia').value) {
            crudAlertMessage('❌ Error: El campo LICENCIA es obligatorio.', 'error');
            return;
        }

        const form = event.target;
        const data = {};
        new FormData(form).forEach((value, key) => { data[key] = value; });
        
        if (CRUD_APP.state.mode === 'edit') {
            // Lógica para Modificar (fetch PUT /api/v1/licencias/ID)
            crudAlertMessage(`✅ MODIFICACIÓN exitosa simulada para ID ${data.titularId}.`, 'success');
            console.log("--- DATOS A MODIFICAR (SIMULADO) ---", JSON.stringify(data, null, 2));
        } else if (CRUD_APP.state.mode === 'create') {
            // Lógica para Crear (fetch POST /api/v1/licencias)
            crudAlertMessage('✅ CREACIÓN exitosa simulada.', 'success');
            console.log("--- DATOS A CREAR (SIMULADO) ---", JSON.stringify(data, null, 2));
        }
    }

    /** Maneja las acciones de botones (Modificar, Borrar, Volver). */
    window.handleAction = function(actionType) {
        switch (actionType) {
            case 'modificar':
                if (CRUD_APP.state.mode === 'edit') {
                    CRUD_APP.elements.form.dispatchEvent(new Event('submit', { cancelable: true }));
                }
                break;
                
            case 'borrar':
                // Solo se ejecuta en modo 'delete'
                if (CRUD_APP.state.mode === 'delete' && CRUD_APP.state.titularId) {
                    
                    const id = CRUD_APP.state.titularId;
                    
                    // Lógica de Soft Delete contra el endpoint PUT
                    const deleteUrl = `/api/v1/licencias/softdelete/${id}`; 
                    
                    fetch(deleteUrl, { method: 'PUT' })
                        .then(response => {
                            if (!response.ok) throw new Error(`Error ${response.status} al desactivar.`);
                            return response.json();
                        })
                        .then(() => {
                            crudAlertMessage(`✅ Titular #${id} desactivado (Estado=Inactivo).`, 'success');
                            console.log(`🗑️ Soft Delete exitoso: ${id}`);
                            setTimeout(() => window.location.href = '/admin/titulares', 1500);
                        })
                        .catch(error => {
                            crudAlertMessage(`❌ Falló la BAJA: ${error.message}`, 'error');
                            console.error("Error Soft Delete:", error);
                        });
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
        
        // 2. Determinar ID y Modo a partir del path (ej: /admin/titulares/delete/19)
        const url = window.location.pathname;
        
        // 🔑 FIX: Usando String.split para la detección de modo y ID (más robusto que regex aquí)
        const parts = url.split('/').filter(p => p.length > 0);
        
        let mode = 'create';
        let id = null;

        // Regla: Buscamos la acción después de 'titulares'
        if (parts.length >= 3 && parts[0] === 'admin' && parts[1] === 'titulares') {
            const action = parts[2];
            id = parts.length > 3 ? parts[3] : null;

            if (action === 'view') {
                mode = 'view';
            } else if (action === 'update') {
                mode = 'edit';
            } else if (action === 'delete') {
                mode = 'delete'; // 🟢 ESTO DEBE SER DETECTADO
            } else if (action === 'crear') {
                mode = 'create';
            }
        }
        // ----------------------------------------------------------------------------------

        // 3. Establecer modo y ID en el estado global
        CRUD_APP.state.titularId = id;
        CRUD_APP.state.mode = mode;
        
        // Solo asignar el ID al input si fue detectado
        if (id) document.getElementById('titularId').value = id;

        // 🟢 Log con el modo detectado:
        console.log(`➡️ 4. URL analizada. Modo detectado: ${mode.toUpperCase()} (ID: ${id || 'Nuevo'}).`);
        
        // 4. Cargar datos y actualizar la interfaz (asíncrono)
        loadAndFillTitularData(id, mode);
        
        // La actualización final de la UI se realiza dentro de loadAndFillTitularData
        // para asegurar que los datos estén cargados antes de establecer los títulos.
        
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