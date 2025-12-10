// Archivo: static/js/admin_conductor_crud.js
// Lógica para el CRUD de Conductores: modos 'create', 'edit', 'view', 'delete'.

// NOTA: Este script depende de que 'conductores_cargar.js' haya expuesto globalmente:
// window.fillFormWithConductorData, window.loadConductorDataFromAPI, window.saveConductorToAPI.

(function() {
    
    const CRUD_APP = {
        elements: {
            form: document.getElementById('conductorForm'),
            mainTitle: document.getElementById('mainTitle'),
            statusMessage: document.getElementById('statusMessage'),
            // Selectores robustos para los botones
            btnCrear: document.querySelector('.btn-crear[type="submit"]'), 
            btnModificar: document.querySelector('.btn-modificar'),
            btnBorrar: document.querySelector('.btn-borrar'),
            btnVolver: document.querySelector('.btn-volver'),
            allInputs: null, // Se llenará en DOMContentLoaded
        },
        state: {
            mode: 'create', 
            licenciaId: null,
            isSubmitting: false
        }
    };

    // =================================================================================
    // ⚙️ UTILITIES & UI CONTROL
    // =================================================================================

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
            const isLicenciaField = input.id === 'licencia';
            
            // La licencia es ID y se bloquea en modos de edición/visualización/eliminación
            if (isLicenciaField && CRUD_APP.state.mode !== 'create') {
                input.readOnly = true;
                input.disabled = true;
                return;
            }
            
            // Habilita/deshabilita el resto de campos
            input.disabled = !enable;
            input.readOnly = !enable;
        });
    }

    /** Actualiza la UI y la visibilidad de botones según el modo. */
    function updateUIForMode(mode, conductorData = null) {
        const { mainTitle, btnCrear, btnModificar, btnBorrar, btnVolver } = CRUD_APP.elements;
        const licencia = CRUD_APP.state.licenciaId;
        
        // 1. Ocultar todos los botones de acción principal
        [btnCrear, btnModificar, btnBorrar].forEach(btn => {
            if (btn) btn.style.display = 'none';
        });

        // 2. Deshabilitar formulario por defecto
        toggleFormFields(false); 

        // 3. Lógica específica por modo
        switch (mode) {
            case 'create':
                mainTitle.textContent = '➕ Crear Nuevo Conductor';
                if (btnCrear) btnCrear.style.display = ''; // ✅ ACTIVAR CREAR
                toggleFormFields(true); // Habilitar formulario
                crudAlertMessage("Modo Creación.", 'info');
                break;

            case 'edit':
                mainTitle.textContent = `✏️ Modificar Conductor [${licencia}]`;
                if (btnModificar) {
                    btnModificar.textContent = '💾 Guardar Cambios';
                    btnModificar.style.display = ''; // ✅ ACTIVAR GUARDAR CAMBIOS
                    btnModificar.disabled = false;
                }
                if (btnBorrar) btnBorrar.style.display = ''; // Mostrar Borrar
                toggleFormFields(true); // 🔑 HABILITAR EDICIÓN DE CAMPOS
                crudAlertMessage("Modo Edición.", 'neutral');
                break;
                
            case 'view':
                mainTitle.textContent = `👁️ Detalle Conductor [${licencia}]`;
                if (btnModificar) {
                    btnModificar.textContent = '✏️ Ir a Edición';
                    btnModificar.style.display = ''; // ✅ ACTIVAR IR A EDICIÓN
                    btnModificar.disabled = false;
                }
                if (btnBorrar) btnBorrar.style.display = ''; // Mostrar Borrar (Soft delete/eliminar)
                // toggleFormFields(false) ya se ejecutó arriba
                crudAlertMessage("Modo Solo Lectura.", 'info');
                break;

            case 'delete':
                mainTitle.textContent = `🗑️ Eliminar Conductor [${licencia}]`;
                if (btnBorrar) {
                    btnBorrar.textContent = '🗑️ CONFIRMAR ELIMINACIÓN'; 
                    btnBorrar.style.display = ''; // ✅ ACTIVAR CONFIRMAR BAJA
                    btnBorrar.disabled = false;
                }
                crudAlertMessage(`ATENCIÓN: Confirme la ELIMINACIÓN de [${licencia}].`, 'error');
                break;
        }
        
        // El botón de Volver es siempre visible
        if (btnVolver) btnVolver.style.display = ''; 
    }

    /** Carga los datos del conductor (si hay licencia) y actualiza la UI. */
    async function loadAndFillConductorData(licencia, mode) {
        // Validación de dependencias
        if (typeof loadConductorDataFromAPI !== 'function' || typeof fillFormWithConductorData !== 'function') {
            console.error("Error: Dependencias de conductores_cargar.js no cargadas.");
            updateUIForMode('create');
            return;
        }

        if (licencia && mode !== 'create') {
            crudAlertMessage("⏳ Cargando datos del conductor...", 'neutral');
            
            const conductorData = await loadConductorDataFromAPI(licencia); 

            if (conductorData) {
                fillFormWithConductorData(conductorData); 
                updateUIForMode(mode, conductorData);
            } else {
                updateUIForMode('create');
                crudAlertMessage(`No se pudo encontrar el conductor [${licencia}]. Listo para crear.`, 'error');
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
        
        if (CRUD_APP.state.isSubmitting) return; 
        CRUD_APP.state.isSubmitting = true;

        const mode = CRUD_APP.state.mode;
        const form = event.target;
        const formData = {};
        new FormData(form).forEach((value, key) => { formData[key] = value; });

        if (!formData.licencia || !formData.nombre || !formData.conductor) {
             CRUD_APP.state.isSubmitting = false;
             return crudAlertMessage('❌ Error: Licencia, Nombre y Nº Conductor son obligatorios.', 'error');
        }
        
        try {
            crudAlertMessage(`⏳ Enviando solicitud de ${mode}...`, 'neutral');
            
            // 🔑 LLAMADA REAL A LA API (usa saveConductorToAPI de conductores_cargar.js)
            const result = await saveConductorToAPI(mode, formData);
            
            crudAlertMessage(`✅ Operación de ${mode} exitosa! [${result.licencia || formData.licencia}]`, 'success');
            
            // Redirección tras éxito
            setTimeout(() => window.location.href = '/admin/conductor', 1500);
            
        } catch (error) {
            crudAlertMessage(`❌ Falló ${mode}: ${error.message}`, 'error');
            console.error(`Error en la operación ${mode}:`, error);
        } finally {
            CRUD_APP.state.isSubmitting = false;
        }
    }

    /** Maneja las acciones de botones (Modificar, Borrar, Volver). */
    window.handleAction = function(actionType) {
        const licencia = CRUD_APP.state.licenciaId;
        
        switch (actionType) {
            case 'modificar':
                if (CRUD_APP.state.mode === 'edit') {
                    // MODO EDIT: El botón Modificar actúa como GUARDAR
                    CRUD_APP.elements.form.dispatchEvent(new Event('submit', { cancelable: true }));
                } else if (CRUD_APP.state.mode === 'view') {
                    // MODO VIEW: El botón Modificar actúa como IR A EDICIÓN
                    window.location.href = `/admin/conductor/update/${licencia}`;
                }
                break;
                
            case 'borrar':
                if (CRUD_APP.state.mode === 'delete' && licencia) {
                    
                    crudAlertMessage(`🗑️ Enviando solicitud de ELIMINACIÓN para [${licencia}]...`, 'neutral');
                    
                    // Lógica para enviar DELETE a la API (DELETE /api/v1/conductores/:licencia)
                    fetch(`/api/v1/conductores/${licencia}`, { method: 'DELETE' })
                        .then(response => {
                            if (response.status === 404) throw new Error("Conductor no encontrado en el servidor.");
                            if (!response.ok) throw new Error(`HTTP ${response.status} al eliminar.`);
                            return response.json();
                        })
                        .then(() => {
                            crudAlertMessage(`✅ Conductor [${licencia}] ELIMINADO.`, 'success');
                            setTimeout(() => window.location.href = '/admin/conductor', 1500);
                        })
                        .catch(error => {
                            crudAlertMessage(`❌ Falló la eliminación: ${error.message}`, 'error');
                            console.error("Error Delete:", error);
                        });
                }
                break;
                
            case 'volver':
                window.location.href = '/admin/conductor'; 
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
             console.error("Error FATAL: No se encontró el formulario #conductorForm.");
             return; 
        }
        
        // 2. Determinar Licencia y Modo a partir del path
        const url = window.location.pathname;
        const parts = url.split('/').filter(p => p.length > 0);
        
        let mode = 'create';
        let licencia = null;

        if (parts.length >= 3 && parts[1] === 'conductor') {
            const action = parts[2];
            licencia = parts.length > 3 ? parts[3] : null; 

            if (action === 'view') mode = 'view';
            else if (action === 'update') mode = 'edit';
            else if (action === 'delete') mode = 'delete';
            else if (action === 'crear') mode = 'create';
        }

        // 3. Establecer modo y Licencia en el estado global
        CRUD_APP.state.licenciaId = licencia;
        CRUD_APP.state.mode = mode;
        
        // 4. Cargar datos y actualizar la interfaz (asíncrono)
        loadAndFillConductorData(CRUD_APP.state.licenciaId, mode);
        
        console.log(`✅ CRUD Conductor Inicializado. Modo: ${mode.toUpperCase()}`);
    });

})();