/**
 * admin_titular_crud.js - Gestión Real de Licencias (Titulares)
 * Conexión completa con el Backend en Go para operaciones CRUD.
 */

(function() {
    
    // Objeto de estado y elementos encapsulado
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
            mode: 'create', // 'create', 'edit', 'view', 'delete'
            titularId: null,
        }
    };

    // =================================================================================
    // ⚙️ UTILITIES
    // =================================================================================

    /** Muestra el resultado REAL de la operación en la interfaz. */
    function crudAlertMessage(message, type = 'info') {
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
    }

    /** Habilita/Deshabilita campos del formulario. */
    function toggleFormFields(enable) {
        if (!CRUD_APP.elements.allInputs) return;
        CRUD_APP.elements.allInputs.forEach(input => {
            input.disabled = !enable;
            if (input.tagName !== 'SELECT') input.readOnly = !enable;
            input.classList.toggle('bg-gray-50', !enable);
        });
    }

    /** Configura la UI y carga datos si es edición. */
    async function setupUIAndLoadData() {
        const { mainTitle, btnCrear, btnModificar, btnBorrar } = CRUD_APP.elements;
        const { mode, titularId } = CRUD_APP.state;

        // Reset visual
        [btnCrear, btnModificar, btnBorrar].forEach(btn => btn?.classList.add('hidden'));

        if (mode === 'create') {
            mainTitle.innerHTML = '➕ Crear Nuevo Titular';
            btnCrear?.classList.remove('hidden');
            toggleFormFields(true);
        } else {
            // Si hay ID, cargamos los datos reales del servidor antes de mostrar
            if (titularId) {
                await fetchTitularData(titularId);
            }

            if (mode === 'edit') {
                mainTitle.innerHTML = `✏️ Modificar Titular #${titularId}`;
                btnModificar?.classList.remove('hidden');
                toggleFormFields(true);
            } else if (mode === 'delete') {
                mainTitle.innerHTML = `🗑️ Confirmar Baja Titular #${titularId}`;
                btnBorrar?.classList.remove('hidden');
                toggleFormFields(false);
            }
        }
    }

    // =================================================================================
    // 📡 COMUNICACIÓN REAL CON API
    // =================================================================================

    /** Obtiene los datos de una licencia específica para rellenar el formulario. */
    async function fetchTitularData(id) {
        try {
            const response = await fetch(`/api/v1/licencias/${id}`);
            if (!response.ok) throw new Error("No se pudo obtener la información del titular.");
            
            const result = await response.json();
            const data = result.data;

            // Mapeo automático de campos por ID o Name
            Object.keys(data).forEach(key => {
                const el = document.getElementById(key) || document.querySelector(`[name="${key}"]`);
                if (el) {
                    if (el.type === 'checkbox') el.checked = data[key];
                    else el.value = data[key] || "";
                }
            });
        } catch (error) {
            crudAlertMessage(`❌ Error al cargar datos: ${error.message}`, 'error');
        }
    }

    /** Maneja el envío real del formulario (POST / PUT). */
    window.handleFormSubmit = async function(event) {
        event.preventDefault();
        
        const form = event.target;
        const formData = new FormData(form);
        const payload = Object.fromEntries(formData.entries());

        // Sanitización de tipos para el Backend en Go
        if (payload.licencia) payload.licencia = payload.licencia.toString();
        if (payload.n_proxima_factura) payload.n_proxima_factura = parseInt(payload.n_proxima_factura) || 0;
        payload.estado = true; 

        const isEdit = CRUD_APP.state.mode === 'edit';
        const url = isEdit ? `/api/v1/licencias/${CRUD_APP.state.titularId}` : '/api/v1/licencias';
        const method = isEdit ? 'PUT' : 'POST';

        // Feedback de carga
        const submitBtn = event.submitter || document.activeElement;
        const originalText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '⏳ Procesando...';

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (response.ok) {
                crudAlertMessage(`✅ Operación exitosa: ${result.message || 'Datos guardados.'}`, 'success');
                setTimeout(() => window.location.href = '/admin/titulares', 1500);
            } else {
                throw new Error(result.error || 'Error desconocido al guardar en la BD.');
            }
        } catch (error) {
            crudAlertMessage(`❌ Error: ${error.message}`, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    };

    /** Maneja las acciones de los botones de la interfaz. */
    window.handleAction = async function(actionType) {
        switch (actionType) {
            case 'modificar':
                CRUD_APP.elements.form.requestSubmit();
                break;
                
            case 'borrar':
                if (!confirm(`¿Está seguro de eliminar permanentemente al titular #${CRUD_APP.state.titularId}?`)) return;
                try {
                    const response = await fetch(`/api/v1/licencias/${CRUD_APP.state.titularId}`, { method: 'DELETE' });
                    if (response.ok) {
                        crudAlertMessage('✅ Registro eliminado correctamente.', 'success');
                        setTimeout(() => window.location.href = '/admin/titulares', 1000);
                    } else {
                        throw new Error('No se pudo eliminar el registro de la base de datos.');
                    }
                } catch (error) {
                    crudAlertMessage(`❌ Error: ${error.message}`, 'error');
                }
                break;
                
            case 'volver':
                window.location.href = '/admin/titulares';
                break;
        }
    };

    // =================================================================================
    // 🚀 INICIALIZACIÓN
    // =================================================================================

    document.addEventListener('DOMContentLoaded', () => {
        if (CRUD_APP.elements.form) {
            CRUD_APP.elements.allInputs = CRUD_APP.elements.form.querySelectorAll('input, select, textarea');
        }

        const url = window.location.pathname;
        const parts = url.split('/').filter(p => p.length > 0);
        
        if (parts.length >= 3) {
            const action = parts[2]; // 'crear', 'update', 'view', 'delete'
            const id = parts[3] || null;

            CRUD_APP.state.titularId = id;
            
            if (action === 'update') CRUD_APP.state.mode = 'edit';
            else if (action === 'delete') CRUD_APP.state.mode = 'delete';
            else if (action === 'view') CRUD_APP.state.mode = 'view';
            else CRUD_APP.state.mode = 'create';
        }

        setupUIAndLoadData();

        // Word Counter
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