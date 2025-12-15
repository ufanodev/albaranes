// Archivo: static/js/admin_conductor_crud.js (COMPLETO Y FINAL)

(function() {
    
    const CRUD_APP = {
        elements: {
            form: document.getElementById('conductorForm'),
            mainTitle: document.getElementById('mainTitle'),
            statusMessage: document.getElementById('statusMessage'),
            
            // Selectores de botones
            btnCrear: document.getElementById('btnCrear'), 
            btnModificar: document.getElementById('btnModificar'),
            btnBorrar: document.getElementById('btnBorrar'),
            btnVolver: document.getElementById('btnVolver'),
            
            // CRÍTICO: Elementos de Input/Select (añadidos para inyección directa de valor)
            inputLicencia: document.getElementById('licencia'), 
            inputConductor: document.getElementById('conductor'), 
            inputNombre: document.getElementById('nombre'),       
            
            inputActivo: document.getElementById('activo'),
            allInputs: null, 
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

    /** Muestra un mensaje de estado en la interfaz. */
    function crudAlertMessage(message, type = 'info') {
        const { statusMessage } = CRUD_APP.elements;
        if (!statusMessage) return;

        statusMessage.textContent = message;
        statusMessage.className = `status-message status-${type}`;
        statusMessage.classList.remove('hidden');
        setTimeout(() => statusMessage.classList.add('hidden'), 5000);
    }
    
    /** Carga la lista de licencias en el SELECT. */
    async function loadLicenciasToSelect(selectedLicencia = null) {
        const { inputLicencia } = CRUD_APP.elements;
        
        console.log('[LOG FE] 4. Ejecutando loadLicenciasToSelect.'); 

        if (!inputLicencia) {
            console.error('[LOG FE] ❌ ERROR: Elemento SELECT (licencia) no encontrado en el DOM.'); 
            return;
        }
        
        if (typeof loadLicenciaDropdownData !== 'function') {
             console.error('[LOG FE] ❌ ERROR: loadLicenciaDropdownData no está definido (Verificar carga de conductor_cargar.js).');
             inputLicencia.innerHTML = '<option value="">❌ Error de dependencia: conductor_cargar.js</option>';
             return;
        }
        
        try {
            const licencias = await loadLicenciaDropdownData(); 
            
            if (licencias.length === 0) {
                 inputLicencia.innerHTML = '<option value="">(No hay conductores registrados)</option>';
                 console.log('[LOG FE] 5. El SELECT se dejó vacío (0 conductores).');
                 return;
            }

            inputLicencia.innerHTML = '<option value="">-- Seleccione Licencia --</option>';

            licencias.forEach(lic => {
                const option = document.createElement('option');
                option.value = lic.licencia;
                option.textContent = `${lic.licencia} - ${lic.nombre}`;
                
                if (selectedLicencia && selectedLicencia === lic.licencia) {
                    option.selected = true;
                }
                
                inputLicencia.appendChild(option);
            });
            console.log(`[LOG FE] 6. SELECT de licencias poblado con ${licencias.length} ítems.`);
            
        } catch (error) {
            console.error("[LOG FE] 🛑 Error fatal al poblar el SELECT:", error);
            inputLicencia.innerHTML = '<option value="">❌ Error al cargar licencias</option>';
        }
    }


    /** Habilita/Deshabilita todos los campos de entrada del formulario. */
    function toggleFormFields(enable) {
        if (!CRUD_APP.elements.allInputs) return;

        CRUD_APP.elements.allInputs.forEach(input => {
            const isLicenciaField = input.id === 'licencia';
            const isActivoField = input.id === 'activo';
            
            // 1. La Licencia (SELECT) se bloquea en modos de edición/visualización/eliminación
            if (isLicenciaField) {
                 if (CRUD_APP.state.mode !== 'create') {
                     input.disabled = true; 
                     return;
                 }
                 input.disabled = !enable;
                 return;
            }
            
            // 2. El campo 'activo' (borrado lógico) solo es editable en modo 'edit'
            if (isActivoField) {
                 input.disabled = CRUD_APP.state.mode !== 'edit' || !enable;
                 return;
            }

            // 3. Habilita/deshabilita el resto de campos 
            if (input.tagName.toLowerCase() === 'select') {
                 input.disabled = !enable;
            } else {
                 input.disabled = !enable;
                 input.readOnly = !enable;
            }
        });
    }

    /** Actualiza la UI y la visibilidad de botones según el modo. */
    function updateUIForMode(mode, conductorData = null) {
        const { mainTitle, btnCrear, btnModificar, btnBorrar, btnVolver } = CRUD_APP.elements;
        const licencia = CRUD_APP.state.licenciaId;
        
        // 1. Ocultar todos los botones de acción principal
        [btnCrear, btnModificar, btnBorrar, btnVolver].forEach(btn => {
            if (btn) btn.style.display = 'none';
        });

        // 2. Deshabilitar formulario por defecto
        toggleFormFields(false); 

        // 3. Lógica específica por modo
        switch (mode) {
            case 'create':
                mainTitle.textContent = '➕ Crear Nuevo Conductor';
                if (btnCrear) btnCrear.style.display = ''; 
                if (btnVolver) btnVolver.style.display = '';
                toggleFormFields(true); 
                crudAlertMessage("Modo Creación. Complete los datos.", 'info');
                break;

            case 'edit':
                mainTitle.textContent = `✏️ Modificar Conductor [${licencia}]`;
                if (btnModificar) {
                    btnModificar.textContent = '💾 Guardar Cambios';
                    btnModificar.style.display = ''; 
                    btnModificar.disabled = false;
                }
                if (btnBorrar) btnBorrar.style.display = ''; 
                if (btnVolver) btnVolver.style.display = '';
                toggleFormFields(true); 
                crudAlertMessage("Modo Edición. Modifique los campos necesarios.", 'neutral');
                break;
                
            case 'view':
                mainTitle.textContent = `👁️ Detalle Conductor [${licencia}]`;
                if (btnModificar) {
                    btnModificar.textContent = '✏️ Ir a Edición';
                    btnModificar.style.display = ''; 
                    btnModificar.disabled = false;
                }
                if (btnBorrar) btnBorrar.style.display = ''; 
                if (btnVolver) btnVolver.style.display = '';
                crudAlertMessage("Modo Solo Lectura.", 'info');
                break;

            case 'delete':
                mainTitle.textContent = `🗑️ Eliminar Conductor [${licencia}]`;
                if (btnBorrar) {
                    btnBorrar.textContent = '🗑️ CONFIRMAR ELIMINACIÓN'; 
                    btnBorrar.style.display = ''; 
                    btnBorrar.disabled = false;
                }
                if (btnVolver) btnVolver.style.display = '';
                crudAlertMessage(`ATENCIÓN: Confirme la ELIMINACIÓN de [${licencia}].`, 'error');
                break;
        }
    }

    /** Carga los datos del conductor (si hay licencia) y actualiza la UI. */
    async function loadAndFillConductorData(licencia, mode) {
        
        console.log(`[LOG FE] 7. Inicio de carga de datos para modo: ${mode}`); 
        
        await loadLicenciasToSelect(licencia); 

        if (licencia && mode !== 'create') {
            crudAlertMessage("⏳ Cargando datos del conductor...", 'neutral');
            
            if (typeof loadConductorDataFromAPI !== 'function' || typeof fillFormWithConductorData !== 'function') {
                 console.error("Error: Dependencias de conductor_cargar.js no cargadas.");
                 crudAlertMessage("Error crítico: No se puede cargar el API.", 'error');
                 return;
            }

            const conductorData = await loadConductorDataFromAPI(licencia); 

            if (conductorData) {
                fillFormWithConductorData(conductorData); 
                updateUIForMode(mode, conductorData);
            } else {
                setTimeout(() => window.location.href = '/admin/conductor', 1000);
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
        
        // 1. Recoger datos del formulario (lo que no está disabled)
        new FormData(form).forEach((value, key) => { formData[key] = value; });
        
        // 2. 🔑 CORRECCIÓN CLAVE PARA MODO EDIT: Inyectar campos deshabilitados
        
        // Inyectar Licencia (siempre disabled en EDIT/VIEW)
        if (mode !== 'create' && CRUD_APP.state.licenciaId && !formData.licencia) {
             formData.licencia = CRUD_APP.state.licenciaId;
             console.log(`[LOG FE] Inyectando Licencia ${formData.licencia} desde el estado global.`);
        }
        
        // Inyectar Nombre y Conductor (aunque no deberían fallar, lo hacemos por si hay un bug en el DOM/FormData)
        if (mode !== 'create') {
            // Utilizamos el valor actual del elemento DOM, no el estado antiguo.
            if (!formData.nombre && CRUD_APP.elements.inputNombre) {
                formData.nombre = CRUD_APP.elements.inputNombre.value;
            }
             if (!formData.conductor && CRUD_APP.elements.inputConductor) {
                formData.conductor = CRUD_APP.elements.inputConductor.value;
            }
        }
        
        // 🚨 LOG DE DEPURACIÓN 🚨
        console.log('[LOG FE] Datos FINALES a enviar (formData):', formData);
        const nombreTrim = (formData.nombre || '').trim();
        const conductorTrim = (formData.conductor || '').trim();
        console.log(`[LOG FE] Validación: Licencia='${formData.licencia}', Nombre='${nombreTrim}', Conductor='${conductorTrim}'`);

        // 3. Validación de campos obligatorios básicos (Licencia, Nombre, Nº Conductor)
        if (!formData.licencia || !nombreTrim || !conductorTrim) {
             CRUD_APP.state.isSubmitting = false;
             return crudAlertMessage('❌ Error: Licencia, Nombre y Nº Conductor son obligatorios.', 'error');
        }
        
        if (typeof saveConductorToAPI !== 'function') {
             CRUD_APP.state.isSubmitting = false;
             return crudAlertMessage('❌ Error: API de guardado no disponible.', 'error');
        }

        try {
            crudAlertMessage(`⏳ Enviando solicitud de ${mode}...`, 'neutral');
            
            const result = await saveConductorToAPI(mode, formData);
            
            crudAlertMessage(`✅ Operación de ${mode} exitosa! [${result.licencia || formData.licencia}]`, 'success');
            
            setTimeout(() => window.location.href = '/admin/conductor', 1500);
            
        } catch (error) {
            crudAlertMessage(`❌ Falló ${mode}: ${error.message}`, 'error');
            console.error(`Error en la operación ${mode}:`, error);
        } finally {
            CRUD_APP.state.isSubmitting = false;
        }
    }

    /** Maneja las acciones de botones (Modificar/Ir a Editar, Borrar, Volver). */
    window.handleAction = function(actionType) {
        const licencia = CRUD_APP.state.licenciaId;
        
        switch (actionType) {
            case 'modificar':
                if (CRUD_APP.state.mode === 'edit') {
                    // MODO EDIT: El botón Modificar actúa como GUARDAR (submit)
                    CRUD_APP.elements.form.dispatchEvent(new Event('submit', { cancelable: true }));
                } else if (CRUD_APP.state.mode === 'view') {
                    // MODO VIEW: El botón Modificar actúa como IR A EDICIÓN
                    window.location.href = `/admin/conductor/update/${licencia}`;
                }
                break;
                
            case 'borrar':
                if (CRUD_APP.state.mode === 'delete' && licencia) {
                    
                    crudAlertMessage(`🗑️ Enviando solicitud de DESACTIVACIÓN para [${licencia}]...`, 'neutral');
                    
                    fetch(`/api/v1/conductores/${licencia}`, { 
                        method: 'DELETE',
                        headers: typeof getAuthHeaders === 'function' ? getAuthHeaders() : {}
                    })
                    .then(response => {
                        if (!response.ok) return response.json().then(err => { throw new Error(err.error || `HTTP ${response.status}`); });
                        return response.json();
                    })
                    .then(() => {
                        crudAlertMessage(`✅ Conductor [${licencia}] DESACTIVADO.`, 'success');
                        setTimeout(() => window.location.href = '/admin/conductor', 1500);
                    })
                    .catch(error => {
                        crudAlertMessage(`❌ Falló la desactivación: ${error.message}`, 'error');
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
        
        // 1. Configurar el submit y obtener inputs
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