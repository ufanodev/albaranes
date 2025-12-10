// Archivo: static/js/admin_usuarios_crud.js
// Lógica para la vista de CRUD de Usuarios: modos 'create', 'edit', 'view', 'delete'.

// NOTA: Este script asume que 'usuarios_cargar.js' ha expuesto globalmente:
// window.fillFormWithUserData, window.loadUserDataFromAPI, window.saveUserToAPI.

(function() {
    
    // Objeto de estado y elementos encapsulado
    const CRUD_APP = {
        elements: {
            form: document.getElementById('usuarioForm'),
            mainTitle: document.getElementById('mainTitle'),
            statusMessage: document.getElementById('statusMessage'),
            btnCrear: document.getElementById('btn-crear'),
            btnModificar: document.getElementById('btn-modificar'),
            btnBorrar: document.getElementById('btn-borrar'),
            passwordInput: document.getElementById('password'),
            passwordHelp: document.getElementById('password-help'),
            allInputs: null,
        },
        state: {
            mode: 'create', // 'create', 'edit', 'view', 'delete'
            userId: null,
        }
    };

    // =================================================================================
    // ⚙️ UTILITIES (Asumen funciones de usuarios_cargar.js están disponibles)
    // =================================================================================

    /** Muestra un mensaje de estado en la interfaz. */
    function crudAlertMessage(message, type = 'info') {
        const { statusMessage } = CRUD_APP.elements;
        if (!statusMessage) return;

        statusMessage.textContent = message;
        statusMessage.className = `status-message status-${type}`;
        statusMessage.classList.remove('hidden');
        setTimeout(() => statusMessage.classList.add('hidden'), 5000);
    }

    /** Habilita/Deshabilita todos los campos de entrada del formulario. */
    function toggleFormFields(enable) {
        if (!CRUD_APP.elements.allInputs) return;

        CRUD_APP.elements.allInputs.forEach(input => {
            if (input.id === 'id') {
                input.readOnly = true;
                return;
            }
            
            input.disabled = !enable;
            input.readOnly = !enable;
            
            if (input.id === 'password') {
                input.disabled = !enable;
                input.readOnly = !enable;
                
                if (CRUD_APP.state.mode === 'create') {
                    input.required = enable;
                    input.placeholder = 'Mínimo 6 caracteres';
                } else {
                    input.required = false;
                    input.placeholder = 'Dejar vacío para no modificar';
                }
            }
        });
    }

    /** Actualiza la UI y la visibilidad de botones según el modo. */
    function updateUIForMode(mode, userData = null) {
        const { mainTitle, btnCrear, btnModificar, btnBorrar, passwordInput, passwordHelp } = CRUD_APP.elements;
        const userID = CRUD_APP.state.userId;
        
        // Ocultar botones
        if (btnCrear) btnCrear.style.display = 'none';
        if (btnModificar) btnModificar.style.display = 'none';
        if (btnBorrar) btnBorrar.style.display = 'none';
        
        // Deshabilitar
        if (btnModificar) btnModificar.disabled = true;
        if (btnBorrar) btnBorrar.disabled = true;

        toggleFormFields(false); // Por defecto, deshabilitado

        switch (mode) {
            case 'create':
                mainTitle.textContent = '➕ Crear Nuevo Usuario';
                if (btnCrear) btnCrear.style.display = ''; 
                toggleFormFields(true); 
                passwordInput.required = true;
                passwordHelp.textContent = 'El password es obligatorio al crear un nuevo usuario.';
                crudAlertMessage("Modo Creación. Complete los campos y guarde.", 'info');
                break;

            case 'edit':
                mainTitle.textContent = `✏️ Modificar Usuario #${userID}`;
                if (btnModificar) btnModificar.style.display = ''; 
                if (btnBorrar) btnBorrar.style.display = '';
                if (btnModificar) btnModificar.disabled = false;
                if (btnBorrar) btnBorrar.disabled = false;
                toggleFormFields(true); 
                passwordInput.required = false;
                passwordHelp.textContent = 'Dejar vacío para mantener la contraseña actual.';
                crudAlertMessage("Modo Edición.", 'neutral');
                break;
                
            case 'view':
            case 'delete':
                mainTitle.textContent = (mode === 'view' ? '👁️ Detalle ' : '🗑️ Confirmar Baja ') + `Usuario #${userID}`;
                if (mode === 'delete' && btnBorrar) {
                    btnBorrar.textContent = '🗑️ CONFIRMAR BAJA'; 
                    btnBorrar.style.display = ''; 
                    btnBorrar.disabled = false;
                    crudAlertMessage(`ATENCIÓN: Confirme la BAJA del usuario #${userID}. El usuario será desactivado.`, 'error');
                } else if (mode === 'view' && btnModificar) {
                    btnModificar.textContent = 'Ir a Edición';
                    btnModificar.style.display = '';
                    btnModificar.disabled = false;
                    crudAlertMessage("Modo Solo Lectura: Campos deshabilitados.", 'info');
                }
                break;
        }
        
        // Mostrar el botón de Volver en todos los modos
        document.querySelector('.btn-volver').style.display = ''; 
    }

    /** Carga los datos del usuario (si hay ID) y actualiza la UI. */
    async function loadAndFillUserData(id, mode) {
        if (id && mode !== 'create') {
            crudAlertMessage("⏳ Cargando datos del usuario...", 'neutral');
            
            // 🔑 Usamos la función global del script usuarios_cargar.js
            const userData = await loadUserDataFromAPI(id); 

            if (userData) {
                // 🔑 Usamos la función global del script usuarios_cargar.js
                fillFormWithUserData(userData);
                updateUIForMode(mode, userData);
            } else {
                updateUIForMode('create');
                crudAlertMessage(`No se pudo encontrar el usuario #${id}.`, 'error');
            }
        } else {
            updateUIForMode('create');
        }
    }

    // =================================================================================
    // 🎯 EVENT HANDLERS
    // =================================================================================

    /** Maneja el envío del formulario (Crear/Modificar) - Llama a la API real */
    window.handleFormSubmit = async function(event) {
        event.preventDefault();
        
        if (CRUD_APP.state.isBulkProcessing) return; // Evitar doble submit
        CRUD_APP.state.isBulkProcessing = true;

        const mode = CRUD_APP.state.mode;
        const form = event.target;
        const formData = {};
        new FormData(form).forEach((value, key) => { formData[key] = value; });

        // Validación de contraseña para CREATE
        if (mode === 'create' && (!formData.password || formData.password.length < 6)) {
             CRUD_APP.state.isBulkProcessing = false;
             return crudAlertMessage('❌ Error: La contraseña debe tener al menos 6 caracteres.', 'error');
        }
        
        try {
            crudAlertMessage(`⏳ Enviando solicitud de ${mode}...`, 'neutral');
            
            // 🔑 LLAMADA REAL A LA API (usa la función de usuarios_cargar.js)
            const result = await saveUserToAPI(mode, formData);
            
            crudAlertMessage(`✅ Operación de ${mode} exitosa! ${result.message}`, 'success');
            
            // Redirección tras éxito
            if (mode === 'create' || mode === 'edit') {
                setTimeout(() => window.location.href = '/admin/usuarios', 1500);
            }
            
        } catch (error) {
            crudAlertMessage(`❌ Falló ${mode}: ${error.message}`, 'error');
            console.error(`Error en la operación ${mode}:`, error);
        } finally {
            CRUD_APP.state.isBulkProcessing = false;
        }
    }

    /** Maneja las acciones de botones (Modificar, Borrar, Volver). */
    window.handleAction = function(actionType) {
        switch (actionType) {
            case 'modificar':
                if (CRUD_APP.state.mode === 'edit') {
                    // En modo EDIT, el botón Modificar actúa como GUARDAR
                    CRUD_APP.elements.form.dispatchEvent(new Event('submit', { cancelable: true }));
                } else if (CRUD_APP.state.mode === 'view') {
                    // En modo VIEW, el botón Modificar actúa como IR A EDICIÓN
                    window.location.href = `/admin/usuarios/update/${CRUD_APP.state.userId}`;
                }
                break;
                
            case 'borrar':
                if (CRUD_APP.state.mode === 'delete' && CRUD_APP.state.userId) {
                    const id = CRUD_APP.state.userId;
                    
                    crudAlertMessage(`🗑️ Enviando solicitud de DESACTIVACIÓN para ID ${id}...`, 'neutral');
                    
                    // Lógica para enviar DELETE a la API (que el backend maneja como soft delete)
                    fetch(`/api/v1/users/${id}`, { method: 'DELETE' })
                        .then(response => {
                            if (!response.ok) throw new Error(`HTTP ${response.status} al desactivar.`);
                            return response.json();
                        })
                        .then(() => {
                            crudAlertMessage(`✅ Usuario #${id} DESACTIVADO.`, 'success');
                            setTimeout(() => window.location.href = '/admin/usuarios', 1500);
                        })
                        .catch(error => {
                            crudAlertMessage(`❌ Falló la BAJA: ${error.message}`, 'error');
                            console.error("Error Soft Delete:", error);
                        });
                }
                break;
                
            case 'volver':
                window.location.href = '/admin/usuarios'; 
                break;

            default:
                break;
        }
    }

    // =================================================================================
    // 🚀 INICIALIZACIÓN AL CARGAR EL DOM
    // =================================================================================

    document.addEventListener('DOMContentLoaded', () => {
        
        // 1. Obtener todos los campos y configurar el submit
        if (CRUD_APP.elements.form) {
            CRUD_APP.elements.form.addEventListener('submit', window.handleFormSubmit);
            CRUD_APP.elements.allInputs = CRUD_APP.elements.form.querySelectorAll('input, select, textarea');
        } else {
             // Este log no debería verse si el script está en la página correcta.
             console.error("Error FATAL: No se encontró el formulario #usuarioForm.");
             return; 
        }
        
        // 2. Determinar ID y Modo a partir del path
        const url = window.location.pathname;
        const parts = url.split('/').filter(p => p.length > 0);
        
        let mode = 'create';
        let id = null;

        if (parts.length >= 3 && parts[1] === 'usuarios') {
            const action = parts[2];
            id = parts.length > 3 ? parts[3] : null;

            if (action === 'view') mode = 'view';
            else if (action === 'update') mode = 'edit';
            else if (action === 'delete') mode = 'delete';
            else if (action === 'crear') mode = 'create';
        }

        // 3. Establecer modo y ID en el estado global
        CRUD_APP.state.userId = id ? parseInt(id) : null;
        CRUD_APP.state.mode = mode;
        
        // 4. Cargar datos y actualizar la interfaz (asíncrono)
        loadAndFillUserData(CRUD_APP.state.userId, mode);
        
        console.log('✅ Inicialización de CRUD completada.');
    });

})();