/**
 * admin_titular_crud.js - Gestión Maestra de Licencias (Titulares)
 * Maneja los modos: view (ver), update (editar), crear y borrar.
 */

(function() {
    
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
            mode: 'create', // detectado por URL
            titularId: null,
        }
    };

    // =================================================================================
    // ⚙️ UTILITIES
    // =================================================================================

    /** Muestra alertas en la interfaz (usada también por licencias_cargar.js) */
    window.crudAlertMessage = function(message, type = 'info') {
        const { statusMessage } = CRUD_APP.elements;
        if (!statusMessage) return;

        statusMessage.textContent = message;
        statusMessage.className = `status-message block mt-6 p-4 text-center font-bold rounded-lg border transition-all ${
            type === 'success' ? 'bg-green-100 text-green-800 border-green-300' : 
            type === 'error' ? 'bg-red-100 text-red-800 border-red-300' : 
            'bg-indigo-100 text-indigo-800 border-indigo-300'
        }`;
        
        statusMessage.classList.remove('hidden');
        statusMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    /** Bloquea o habilita todos los campos del formulario */
    function toggleFormFields(enable) {
        if (!CRUD_APP.elements.allInputs) return;
        console.log(`%c🛠️ [UI] ${enable ? 'Habilitando' : 'Bloqueando'} campos del formulario`, "color: #8b5cf6;");
        
        CRUD_APP.elements.allInputs.forEach(input => {
            input.disabled = !enable;
            if (input.tagName !== 'SELECT') input.readOnly = !enable;
            
            if (!enable) {
                input.classList.add('bg-gray-100', 'cursor-not-allowed', 'opacity-80');
            } else {
                input.classList.remove('bg-gray-100', 'cursor-not-allowed', 'opacity-80');
            }
        });
    }

    /** Configura la interfaz basándose en el modo detectado */
    async function setupUIAndLoadData() {
        const { mainTitle, btnCrear, btnModificar, btnBorrar } = CRUD_APP.elements;
        const { mode, titularId } = CRUD_APP.state;

        console.log(`%c🚀 [INIT] Ejecutando Setup para modo: ${mode.toUpperCase()}`, "font-weight: bold; color: #10b981;");

        // Reset visual de botones
        [btnCrear, btnModificar, btnBorrar].forEach(btn => btn?.classList.add('hidden'));

        if (mode === 'create') {
            mainTitle.innerHTML = '➕ Crear Nuevo Titular';
            btnCrear?.classList.remove('hidden');
            toggleFormFields(true);
        } else {
            // Carga de datos real desde la API (definida en licencias_cargar.js)
            if (titularId && typeof loadLicenciaFromAPI === 'function') {
                const data = await loadLicenciaFromAPI(titularId);
                if (data) {
                    fillFormWithLicenciaData(data);
                } else {
                    window.crudAlertMessage("No se pudieron cargar los datos del titular.", "error");
                    return;
                }
            }

            if (mode === 'edit') {
                mainTitle.innerHTML = `✏️ Modificar Titular #${titularId}`;
                btnModificar?.classList.remove('hidden');
                toggleFormFields(true);
            } else if (mode === 'view') {
                mainTitle.innerHTML = `👁️ Visualizando Titular #${titularId}`;
                toggleFormFields(false); // Solo lectura
            } else if (mode === 'delete') {
                mainTitle.innerHTML = `🗑️ Confirmar Baja Titular #${titularId}`;
                btnBorrar?.classList.remove('hidden');
                toggleFormFields(false);
            }
        }
    }

    // =================================================================================
    // 💾 EVENT HANDLERS (POST / PUT)
    // =================================================================================

    window.handleFormSubmit = async function(event) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        const payload = Object.fromEntries(formData.entries());

        // Tipado para Backend Go
        if (payload.licencia) payload.licencia = payload.licencia.toString();
        if (payload.n_proxima_factura) payload.n_proxima_factura = parseInt(payload.n_proxima_factura) || 0;
        if (payload.userlevel) payload.userlevel = parseInt(payload.userlevel) || 3;
        payload.estado = true; 

        const isEdit = CRUD_APP.state.mode === 'edit';
        const url = isEdit ? `/api/v1/licencias/${CRUD_APP.state.titularId}` : '/api/v1/licencias';
        const method = isEdit ? 'PUT' : 'POST';

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                window.crudAlertMessage(`✅ Datos guardados correctamente.`, 'success');
                setTimeout(() => window.location.href = '/admin/titulares', 1500);
            } else {
                const err = await response.json();
                throw new Error(err.error || 'Error al guardar.');
            }
        } catch (error) {
            window.crudAlertMessage(`❌ Error: ${error.message}`, 'error');
        }
    };

    window.handleAction = async function(actionType) {
        if (actionType === 'volver') {
            window.location.href = '/admin/titulares';
        } else if (actionType === 'modificar') {
            CRUD_APP.elements.form.requestSubmit();
        } else if (actionType === 'borrar') {
            if (confirm("¿Eliminar este titular definitivamente?")) {
                // Lógica de delete aquí...
            }
        }
    };

    // =================================================================================
    // 🚀 INICIO DE LA APP
    // =================================================================================

    document.addEventListener('DOMContentLoaded', () => {
        // Captura inicial de inputs
        if (CRUD_APP.elements.form) {
            CRUD_APP.elements.allInputs = CRUD_APP.elements.form.querySelectorAll('input, select, textarea');
        }

        // Análisis de URL: /admin/titulares/view/21
        const url = window.location.pathname;
        const parts = url.split('/').filter(p => p.length > 0);
        console.log("%c🌐 [ROUTER] Desglose de URL:", "color: #3b82f6;", parts);
        
        if (parts.length >= 3) {
            // parts[0]=admin, parts[1]=titulares, parts[2]=view, parts[3]=21
            const action = parts[2]; 
            const id = parts[3] || null;

            CRUD_APP.state.titularId = id;
            
            if (action === 'view') CRUD_APP.state.mode = 'view';
            else if (action === 'update') CRUD_APP.state.mode = 'edit';
            else if (action === 'delete') CRUD_APP.state.mode = 'delete';
            else CRUD_APP.state.mode = 'create';
        }

        setupUIAndLoadData();

        // Word counter
        const obs = document.getElementById('observaciones');
        if (obs) {
            obs.addEventListener('input', () => {
                const count = obs.value.trim().split(/\s+/).filter(w => w.length > 0).length;
                const counter = document.getElementById('wordCount');
                if (counter) counter.textContent = `${count} palabras`;
            });
        }
    });
})();