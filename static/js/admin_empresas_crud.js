// 📄 static/js/admin_empresas_crud.js
// Lógica para manejar la vista de Creación, Edición y Borrado (CRUD) de Empresas.

(function() {
    
    // Objeto de estado y elementos encapsulado
    const CRUD_APP = {
        elements: {
            form: document.getElementById('enterpriseForm'),
            mainTitle: document.getElementById('mainTitle'),
            statusMessage: document.getElementById('statusMessage'),
            
            // Botones
            btnCrear: document.getElementById('btnCrear'),
            btnModificar: document.getElementById('btnModificar'),
            btnBorrar: document.getElementById('btnBorrar'), 
            btnVolver: document.getElementById('btnVolver'),
            
            // Campos de entrada
            allInputs: null,
            enterpriseIdHidden: document.getElementById('enterpriseIdHidden'),
            nif: document.getElementById('nif'),
            nombre: document.getElementById('nombre'),
        },
        state: {
            mode: 'create', // 'create', 'update', 'delete'
            enterpriseId: null,
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

    /** Habilita/Deshabilita todos los campos de entrada del formulario. */
    function toggleFormFields(enable) {
        if (!CRUD_APP.elements.allInputs) return;

        CRUD_APP.elements.allInputs.forEach(input => {
            input.disabled = !enable;
            input.readOnly = !enable;
            input.classList.toggle('bg-gray-50', !enable);
            input.classList.toggle('cursor-default', !enable);
        });
        
        // El botón Volver siempre debe estar activo
        const btnVolver = document.getElementById('btnVolver');
        if (btnVolver) btnVolver.disabled = false;
    }
    
    /** Rellena el formulario con los datos de la empresa cargada. */
    function fillFormWithEnterpriseData(empresaData) {
        if (!empresaData) return;
        
        // Rellenar campos con valores de la API (usando los IDs del HTML)
        document.getElementById('nif').value = empresaData.nif || '';
        document.getElementById('nombre').value = empresaData.nombre || '';
        document.getElementById('email').value = empresaData.email || '';
        document.getElementById('telefono').value = empresaData.telefono || '';
        document.getElementById('direccion').value = empresaData.direccion || '';
        document.getElementById('cp').value = empresaData.cp || '';
        document.getElementById('observaciones').value = empresaData.observaciones || '';
    }


    /** Actualiza el título de la página y los estados de los botones según el modo. */
    function updateUIForMode(mode, empresaData = null) {
        const { mainTitle, btnCrear, btnModificar, btnBorrar, nif, btnVolver } = CRUD_APP.elements;
        const enterpriseID = CRUD_APP.state.enterpriseId;
        const enterpriseNombre = empresaData ? empresaData.nombre : '';

        // 1. Ocultar los botones de acción principal y remover la clase 'hidden'
        [btnCrear, btnModificar, btnBorrar].forEach(btn => {
            if (btn) {
                btn.style.display = 'none';
                btn.classList.add('hidden'); // Aseguramos que hidden de Tailwind esté activo
            }
        });
        
        // 2. Deshabilitar campos por defecto
        toggleFormFields(false); 

        switch (mode) {
            case 'update':
                mainTitle.textContent = `✏️ Modificar Empresa ID: ${enterpriseID}`;
                if (btnModificar) {
                    btnModificar.textContent = 'Guardar Cambios';
                    // 🔑 MOSTRAR MODIFICAR Y VOLVER
                    btnModificar.style.display = '';
                    btnModificar.classList.remove('hidden'); 
                    
                    // Asegurar que volver sea visible, aunque no debería ser hidden nunca
                    if (btnVolver) btnVolver.style.display = ''; 

                }
                toggleFormFields(true); // Habilitar edición
                nif.disabled = true; // NIF no se cambia al editar
                crudAlertMessage("Modo Edición: Modifique los campos y pulse 'Guardar Cambios'.", 'neutral');
                break;
                
            case 'delete':
                mainTitle.textContent = `🗑️ Confirmar Baja Empresa #${enterpriseID} (${enterpriseNombre})`;
                if (btnBorrar) {
                    btnBorrar.textContent = '🗑️ CONFIRMAR ELIMINACIÓN'; 
                    btnBorrar.style.display = ''; // Mostrar Borrar
                    btnBorrar.classList.remove('hidden');
                }
                toggleFormFields(false); // Deshabilitar campos
                crudAlertMessage(`ATENCIÓN: Se requiere confirmación para ELIMINAR la empresa #${enterpriseID}.`, 'error');
                break;

            case 'create':
            default:
                mainTitle.textContent = '➕ Crear Nueva Empresa';
                if (btnCrear) {
                    btnCrear.textContent = '➕ Crear';
                    btnCrear.style.display = ''; // Mostrar Crear
                    btnCrear.classList.remove('hidden');
                }
                toggleFormFields(true); // Habilitar campos
                crudAlertMessage('Modo Creación: Introduzca los datos de la nueva empresa.', 'info');
                break;
        }
        console.log(`[UI] 4. Modo ${mode.toUpperCase()} configurado.`);
    }
    
    // =================================================================================
    // 🌐 API & DATA LOADING
    // =================================================================================

    /** Carga los datos de una empresa específica desde la API y llena el formulario. */
    async function loadAndFillEnterpriseData(id, mode) {
        if (id && (mode === 'update' || mode === 'delete')) {
            
            console.log(`[API] 5. Iniciando carga asíncrona de datos para ID: ${id}.`);
            
            try {
                 // **Nota:** Asume que 'fetchProtected' está definido en js/utils.js
                 const response = await fetchProtected(`/api/v1/empresas/${id}`); 
                 const result = await response.json();
                 
                 if (response.ok && result.data) {
                     fillFormWithEnterpriseData(result.data);
                     updateUIForMode(mode, result.data);
                     console.log(`[API] 6. Datos cargados con éxito. Empresa: ${result.data.nombre}`);
                 } else {
                     console.error(`[API] 6. ⚠️ Error ${response.status}: No se pudo cargar la empresa. Redirigiendo a Crear.`);
                     
                     // Si la carga falla, volvemos a modo 'create' y avisamos.
                     CRUD_APP.state.mode = 'create';
                     updateUIForMode('create');
                     crudAlertMessage(`No se pudo encontrar la empresa #${id}. Listo para Crear.`, 'error');
                 }

            } catch (error) {
                console.error('[API] ❌ Error de conexión:', error);
                crudAlertMessage("Error de conexión al servidor. Intente más tarde.", 'error');
            }

        } else {
             // Si el ID es nulo (modo create), simplemente actualiza la UI al modo 'create'
             updateUIForMode('create');
        }
        
        // Asegurar conteo inicial de palabras
        updateWordCount();
    }

    /** Maneja la sumisión del formulario (Crear o Modificar). */
    window.handleFormSubmit = async function(event) {
        event.preventDefault();
        
        if (CRUD_APP.state.mode === 'delete') return; 

        const method = (CRUD_APP.state.mode === 'create') ? 'POST' : 'PUT';
        const url = (CRUD_APP.state.mode === 'create') ? '/api/v1/empresas' : `/api/v1/empresas/${CRUD_APP.state.enterpriseId}`;
        
        const submitBtn = (CRUD_APP.state.mode === 'create') ? CRUD_APP.elements.btnCrear : CRUD_APP.elements.btnModificar;
        submitBtn.disabled = true;
        
        console.log(`[Submit] 7. Iniciando llamada a API: ${method} ${url}`);

        const formData = new FormData(CRUD_APP.elements.form);
        const body = Object.fromEntries(formData.entries());

        try {
            const response = await fetchProtected(url, {
                method: method,
                body: JSON.stringify(body)
            });

            const result = await response.json();

            if (response.ok) {
                crudAlertMessage(`✅ Empresa ${CRUD_APP.state.mode === 'create' ? 'creada' : 'actualizada'} con éxito.`, 'success');
                console.log(`[Submit] 8. ✅ Éxito en ${method}. Redirigiendo...`);
                
                setTimeout(() => window.location.href = '/admin/empresas', 1500);
            } else {
                crudAlertMessage(`❌ Error al ${method === 'POST' ? 'crear' : 'actualizar'} la empresa: ${result.error || response.statusText}`, 'error');
                console.error(`[Submit] 8. 🔴 Fallo en ${method}.`, result);
            }
        } catch (error) {
            console.error('[Submit] ❌ Error de conexión:', error);
            crudAlertMessage('❌ Error de conexión o token inválido.', 'error');
        } finally {
            submitBtn.disabled = false;
        }
    }
    
    /** Lógica para manejar el borrado de la empresa (solo modo 'delete'). */
    function handleEnterpriseDeleteConfirmation() {
        if (CRUD_APP.state.mode !== 'delete') return;

        // 🌐 LLAMADA API: DELETE /api/v1/empresas/{id}
        console.log(`[Delete] 7. Confirmado. Llamando a DELETE /api/v1/empresas/${CRUD_APP.state.enterpriseId}`);
        
        fetchProtected(`/api/v1/empresas/${CRUD_APP.state.enterpriseId}`, { method: 'DELETE' })
            .then(response => {
                if (!response.ok) throw new Error(`Error ${response.status} al eliminar.`);
                return response.json();
            })
            .then(() => {
                crudAlertMessage(`✅ Empresa #${CRUD_APP.state.enterpriseId} eliminada permanentemente. Redirigiendo...`, 'success');
                console.log(`[Delete] 8. ✅ Borrado exitoso.`);
                setTimeout(() => window.location.href = '/admin/empresas', 1500);
            })
            .catch(error => {
                crudAlertMessage(`❌ Falló la eliminación: ${error.message}`, 'error');
                console.error("[Delete] 8. 🔴 Error DELETE:", error);
            });
    }

    // =================================================================================
    // 🔑 MODO DE INICIALIZACIÓN
    // =================================================================================

    /** Determina el modo de la página (Crear, Update, Delete) a partir de la URL. */
    function determineModeFromURL() {
        const url = window.location.pathname;
        const parts = url.split('/').filter(p => p.length > 0);
        
        let mode = 'create';
        let id = null;

        // Regla: Buscamos la acción después de 'empresas'
        if (parts.length >= 3 && parts[0] === 'admin' && parts[1] === 'empresas') {
            const action = parts[2];
            id = parts.length > 3 ? parts[3] : null;

            if (action === 'update') {
                mode = 'update';
            } else if (action === 'delete') {
                mode = 'delete';
            } else if (action === 'crear') {
                mode = 'create';
            }
        }

        // 3. Establecer modo y ID en el estado global
        CRUD_APP.state.enterpriseId = id;
        CRUD_APP.state.mode = mode;
        
        // Asignar el ID al input oculto si fue detectado
        if (id && CRUD_APP.elements.enterpriseIdHidden) {
            CRUD_APP.elements.enterpriseIdHidden.value = id;
        }
    }


    /** Actualiza el contador de palabras para el campo Observaciones. */
    function updateWordCount() {
        const observaciones = document.getElementById('observaciones');
        const wordCountElement = document.getElementById('wordCount');
        if (observaciones && wordCountElement) {
             const text = observaciones.value.trim();
             const wordCount = text ? text.split(/\s+/).filter(word => word.length > 0).length : 0;
             wordCountElement.textContent = `${wordCount} palabras`;
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        console.log('---[ admin_empresas_crud.js ]------------------------------');
        console.log('➡️ 1. Inicio de carga del formulario CRUD.');
        
        // 1. Obtener todos los campos del formulario
        if (CRUD_APP.elements.form) {
            CRUD_APP.elements.allInputs = CRUD_APP.elements.form.querySelectorAll('input, select, textarea');
        } else {
             console.error("Error FATAL: No se encontró el formulario #enterpriseForm.");
             return; 
        }
        
        // 2. Determinar ID y Modo a partir del path
        determineModeFromURL();
        console.log(`[Init] 2. Modo detectado: ${CRUD_APP.state.mode.toUpperCase()} (ID: ${CRUD_APP.state.enterpriseId || 'Nuevo'}).`);
        
        // 3. Cargar datos y actualizar la interfaz (asíncrono)
        loadAndFillEnterpriseData(CRUD_APP.state.enterpriseId, CRUD_APP.state.mode);
        
        // 4. Enlazar evento del botón de Borrar
        if (CRUD_APP.elements.btnBorrar) {
            CRUD_APP.elements.btnBorrar.addEventListener('click', handleEnterpriseDeleteConfirmation);
        }
        
        // 5. Enlazar el contador de palabras
        document.getElementById('observaciones').addEventListener('input', updateWordCount);

        console.log('✅ 9. Inicialización de CRUD de Empresas completada.');
    });

})();