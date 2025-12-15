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
            
            // CRÍTICO: Elementos de Input/Select
            inputLicencia: document.getElementById('licencia'), 
            inputConductor: document.getElementById('conductor'), 
            inputNombre: document.getElementById('nombre'),       
            
            inputActivo: document.getElementById('activo'),
            allInputs: null, 
        },
        state: {
            mode: 'create', 
            licenciaId: null,      // Licencia (clave URL)
            nConductorId: null,    // Número de Conductor (clave URL)
            idUnico: null,         // ID único (para borrado)
            isSubmitting: false,
            originalConductorData: null // Almacena datos cargados para el PUT preciso
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


    /** * Habilita/Deshabilita todos los campos de entrada del formulario. */
    function toggleFormFields(enable) {
        if (!CRUD_APP.elements.allInputs) return;

        CRUD_APP.elements.allInputs.forEach(input => {
            const isLicenciaField = input.id === 'licencia';
            const isActivoField = input.id === 'activo';
            
            if (enable) {
                // Habilitación General (para CREATE o EDIT)
                
                // 1. Licencia: Solo editable en modo 'create'.
                if (isLicenciaField && CRUD_APP.state.mode !== 'create') {
                    input.disabled = true;
                    return;
                }

                // 2. Campo 'activo' (Estado): Solo editable en modo 'edit'.
                if (isActivoField && CRUD_APP.state.mode !== 'edit') {
                    input.disabled = true;
                    return;
                }
                
                // 3. El resto de campos (incluyendo Email, Teléfono, NConductor) se habilitan.
                input.disabled = false;
                input.readOnly = false;

            } else {
                // Deshabilitación Total (para VIEW o DELETE)
                input.disabled = true;
                input.readOnly = true;
            }
        });
    }

    /** Actualiza la UI y la visibilidad de botones según el modo. */
    function updateUIForMode(mode, conductorData = null) {
        const { mainTitle, btnCrear, btnModificar, btnBorrar, btnVolver } = CRUD_APP.elements;
        const { licenciaId, nConductorId, idUnico } = CRUD_APP.state;
        
        let displayId = licenciaId; 
        if (idUnico) displayId = `ID: ${idUnico}`;
        else if (licenciaId && nConductorId && mode !== 'create') displayId = `${licenciaId} / ${nConductorId}`; 

        // 1. Ocultar todos los botones de acción principal
        [btnCrear, btnModificar, btnBorrar, btnVolver].forEach(btn => {
            if (btn) btn.style.display = 'none';
        });

        // 2. Deshabilitar formulario por defecto
        toggleFormFields(false); 

        switch (mode) {
            case 'create':
                mainTitle.textContent = '➕ Crear Nuevo Conductor';
                if (btnCrear) btnCrear.style.display = ''; 
                if (btnVolver) btnVolver.style.display = '';
                toggleFormFields(true); // 🎯 HABILITA TODO
                crudAlertMessage("Modo Creación. Complete los datos.", 'info');
                break;

            case 'edit':
                mainTitle.textContent = `✏️ Modificar Conductor [${displayId}]`;
                if (btnModificar) {
                    btnModificar.textContent = '💾 Guardar Cambios';
                    btnModificar.style.display = ''; 
                    btnModificar.disabled = false;
                }
                if (btnBorrar) btnBorrar.style.display = ''; 
                if (btnVolver) btnVolver.style.display = '';
                toggleFormFields(true); // Habilita campos editables
                crudAlertMessage("Modo Edición. Modifique los campos necesarios.", 'neutral');
                break;
                
            case 'view':
                mainTitle.textContent = `👁️ Detalle Conductor [${displayId}]`;
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
                mainTitle.textContent = `🗑️ Eliminar Conductor [${displayId}]`;
                if (btnBorrar) {
                    btnBorrar.textContent = '🗑️ CONFIRMAR DESACTIVACIÓN'; 
                    btnBorrar.style.display = ''; 
                    btnBorrar.disabled = false;
                }
                if (btnVolver) btnVolver.style.display = '';
                crudAlertMessage(`ATENCIÓN: Confirme la DESACTIVACIÓN de [${displayId}].`, 'error');
                break;
        }
    }

    /** * Carga los datos del conductor, priorizando la búsqueda precisa.
     * 🎯 CORRECCIÓN: Si estamos en modo DELETE por ID, evitamos la llamada API.
     */
    async function loadAndFillConductorData(licencia, nConductor, mode) {
        
        console.log(`[LOG FE] 7. Inicio de carga de datos para modo: ${mode}. Clave: ${licencia}/${nConductor}`); 
        
        // 1. Manejar modo DELETE por ID: No necesita API GET, solo UI.
        if (mode === 'delete' && CRUD_APP.state.idUnico) {
            updateUIForMode(mode);
            crudAlertMessage(`Listo para desactivar el conductor ID ${CRUD_APP.state.idUnico}.`, 'error');
            return;
        }
        
        // 2. Cargar lista de licencias (para SELECT)
        if (mode === 'create' || mode === 'view' || mode === 'edit') {
            await loadLicenciasToSelect(licencia); 
        }

        if (licencia && mode !== 'create') {
            crudAlertMessage("⏳ Cargando datos del conductor...", 'neutral');
            
            if (typeof fillFormWithConductorData !== 'function') {
                 console.error("Error: Dependencias de conductor_cargar.js no cargadas.");
                 crudAlertMessage("Error crítico: No se puede cargar el API.", 'error');
                 return;
            }

            let conductorData = null;
            
            // 3. Determinar el método de carga (Preciso vs. Legacy)
            if (nConductor && typeof loadConductorDataFromAPIPrecisa === 'function') {
                conductorData = await loadConductorDataFromAPIPrecisa(licencia, nConductor);
            } else if (typeof loadConductorDataFromAPI === 'function') {
                conductorData = await loadConductorDataFromAPI(licencia); 
            } else {
                 console.error("Error: loadConductorDataFromAPI o Precisa no están definidos.");
                 crudAlertMessage("Error crítico: No se puede cargar el API.", 'error');
                 return;
            }


            if (conductorData) {
                CRUD_APP.state.originalConductorData = conductorData; 
                CRUD_APP.state.idUnico = conductorData.id; 
                
                fillFormWithConductorData(conductorData); 
                updateUIForMode(mode, conductorData);
            } else {
                // Fallo si el conductor preciso o el conductor legacy no se encuentran
                crudAlertMessage(`❌ Conductor [${licencia}/${nConductor || 'Legacy'}] no encontrado.`, 'error');
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
        
        // 1. Recoger datos del formulario
        new FormData(form).forEach((value, key) => { formData[key] = value; });
        
        // 2. Asegurar que la Licencia se incluya en el payload (si está deshabilitada en edit, no se recoge con FormData)
        if (mode !== 'create' && CRUD_APP.state.licenciaId && !formData.licencia) {
             formData.licencia = CRUD_APP.state.licenciaId;
        }
        
        // --- Validación de campos requeridos (FRONTEND) ---
        const nombreTrim = (formData.nombre || '').trim();
        const conductorTrim = (formData.conductor || '').trim();
        const emailTrim = (formData.email || '').trim();
        
        if (!formData.licencia || !nombreTrim || !conductorTrim || !emailTrim) {
             CRUD_APP.state.isSubmitting = false;
             return crudAlertMessage('❌ Error: Licencia, Nombre, Nº Conductor y Email son obligatorios.', 'error');
        }
        // ------------------

        if (typeof saveConductorToAPI !== 'function') {
             CRUD_APP.state.isSubmitting = false;
             return crudAlertMessage('❌ Error: API de guardado no disponible.', 'error');
        }

        try {
            crudAlertMessage(`⏳ Enviando solicitud de ${mode}...`, 'neutral');
            
            // CLAVE: Usamos el NConductor original cargado del estado para construir el PUT preciso.
            const nConductorOriginal = CRUD_APP.state.originalConductorData ? CRUD_APP.state.originalConductorData.conductor : null;
            
            const result = await saveConductorToAPI(mode, formData, nConductorOriginal);
            
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
    window.handleAction = async function(actionType) {
        const { licenciaId, nConductorId, idUnico, mode } = CRUD_APP.state;
        
        switch (actionType) {
            case 'modificar':
                if (mode === 'edit') {
                    // MODO EDIT: El botón Modificar actúa como GUARDAR (submit)
                    CRUD_APP.elements.form.dispatchEvent(new Event('submit', { cancelable: true }));
                } else if (mode === 'view') {
                    // MODO VIEW: El botón Modificar actúa como IR A EDICIÓN
                    const targetUrl = (licenciaId && nConductorId) 
                        ? `/admin/conductor/update/${licenciaId}/${nConductorId}` // Preciso
                        : `/admin/conductor/update/${licenciaId}`; // Legacy
                    window.location.href = targetUrl;
                }
                break;
                
            case 'borrar':
                if (mode === 'delete') {
                    // Lógica de borrado híbrido
                    if (typeof deleteConductorFromAPI !== 'function') {
                        return crudAlertMessage('❌ Error: API de borrado no disponible.', 'error');
                    }
                    
                    const deleteParams = {
                        id: idUnico, 
                        licencia: licenciaId,
                        nconductor: nConductorId
                    };
                    
                    crudAlertMessage(`🗑️ Enviando solicitud de DESACTIVACIÓN...`, 'neutral');
                    
                    try {
                        await deleteConductorFromAPI(deleteParams);
                        
                        let displayId = idUnico ? `ID: ${idUnico}` : (licenciaId && nConductorId ? `${licenciaId}/${nConductorId}` : licenciaId);
                        crudAlertMessage(`✅ Conductor [${displayId}] DESACTIVADO.`, 'success');
                        
                        setTimeout(() => window.location.href = '/admin/conductor', 1500);
                        
                    } catch (error) {
                        crudAlertMessage(`❌ Falló la desactivación: ${error.message}`, 'error');
                        console.error("Error Delete:", error);
                    }
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
        
        // 2. Determinar Licencia, ID y Modo a partir del path (Soporte Híbrido)
        const url = window.location.pathname;
        const parts = url.split('/').filter(p => p.length > 0);
        
        let mode = 'create';
        let licencia = null;
        let idUnico = null;
        let nconductor = null; 

        if (parts.length >= 3 && parts[1] === 'conductor') {
            const action = parts[2];
            
            if (action === 'update' || action === 'view' || action === 'delete') {
                 licencia = parts.length > 3 ? parts[3] : null;
                 nconductor = parts.length > 4 ? parts[4] : null; 
                 
                 if (action === 'update') mode = 'edit';
                 else if (action === 'view') mode = 'view';
                 else if (action === 'delete') mode = 'delete';
                 
            } else if (action === 'delete_by_id') {
                idUnico = parts.length > 3 ? parseInt(parts[3]) : null;
                licencia = String(idUnico || '');
                mode = 'delete';
            } else if (action === 'delete_lc') {
                licencia = parts.length > 3 ? parts[3] : null;
                nconductor = parts.length > 4 ? parts[4] : null;
                mode = 'delete';
            } else if (action === 'crear') {
                mode = 'create';
            }
        }

        // 3. Establecer modo y IDs en el estado global
        CRUD_APP.state.licenciaId = licencia;
        CRUD_APP.state.nConductorId = nconductor;
        CRUD_APP.state.idUnico = (typeof idUnico === 'number' && !isNaN(idUnico)) ? idUnico : null;
        CRUD_APP.state.mode = mode;
        
        console.log(`[DEBUG] IDs: Licencia: ${CRUD_APP.state.licenciaId}, NConductor: ${CRUD_APP.state.nConductorId}, ID Único: ${CRUD_APP.state.idUnico}`);

        // 4. Cargar datos y actualizar la interfaz (asíncrono)
        loadAndFillConductorData(CRUD_APP.state.licenciaId, CRUD_APP.state.nConductorId, mode);
        
        console.log(`✅ CRUD Conductor Inicializado. Modo: ${mode.toUpperCase()}`);
    });

})();