/**
 * ARCHIVO: static/js/admin_titular_crud.js
 * DESCRIPCIÓN: Gestión Maestra de Licencias (Titulares).
 * ACTUALIZADO: 28/01/2026 - Ajuste de campos finales (Email, Teléfonos, Matrícula).
 */

(function() {
    
    const CRUD_APP = {
        elements: {
            form: document.getElementById('titularForm'),
            mainTitle: document.getElementById('mainTitle'),
            statusMessage: document.getElementById('statusMessage'),
            submitBtn: document.getElementById('submitBtn'),
            allInputs: null,
            estadoToggle: document.getElementById('estado')
        },
        state: {
            mode: 'create', // view | edit | create
            titularId: null,
        }
    };

    // =================================================================================
    // ⚙️ UTILITIES
    // =================================================================================

    function showStatus(message, type = 'info') {
        const el = CRUD_APP.elements.statusMessage;
        if (!el) return;

        el.className = `w-full p-4 rounded-2xl text-center font-bold text-xs uppercase tracking-widest border-2 transition-all duration-300 ${
            type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 
            type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 
            'bg-blue-50 border-blue-200 text-blue-700'
        }`;
        
        el.textContent = message;
        el.classList.remove('hidden');
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function toggleFormFields(enable) {
        if (!CRUD_APP.elements.allInputs) return;
        
        CRUD_APP.elements.allInputs.forEach(input => {
            input.disabled = !enable;
            if (input.tagName !== 'SELECT' && input.tagName !== 'TEXTAREA') {
                input.readOnly = !enable;
            }
            
            if (!enable) {
                input.classList.add('bg-slate-100', 'cursor-not-allowed', 'opacity-60');
            } else {
                input.classList.remove('bg-slate-100', 'cursor-not-allowed', 'opacity-60');
            }
        });
    }

    /** Mapeo ajustado a los campos del HTML actual */
    function fillForm(data) {
        if (!data) return;
        
        // Se eliminaron campos de facturación y se mantiene el resto
        const fields = [
            'licencia', 'dni', 'nombre', 'email', 'telefono', 
            'movil', 'userlevel', 'direccion', 'cp', 
            'poblacion', 'matricula_taxi', 'observaciones'
        ];

        fields.forEach(f => {
            const el = document.getElementById(f);
            if (el) el.value = data[f] || '';
        });

        if (CRUD_APP.elements.estadoToggle) {
            CRUD_APP.elements.estadoToggle.checked = (data.estado === true || data.estado === 1);
        }
    }

    async function setupUIAndLoadData() {
        const { submitBtn } = CRUD_APP.elements;
        const mode = CRUD_APP.state.mode;

        if (mode === 'create') {
            document.getElementById('mainTitle').textContent = 'Nuevo Titular';
            toggleFormFields(true);
        } else {
            try {
                const response = await fetch(`/api/v1/licencias/${CRUD_APP.state.titularId}`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });
                const result = await response.json();
                
                if (response.ok && result.data) {
                    fillForm(result.data);
                } else {
                    showStatus("No se pudo recuperar la ficha del titular.", "error");
                    return;
                }
            } catch (err) {
                showStatus("Error de conexión al cargar datos.", "error");
                return;
            }

            if (mode === 'view') {
                document.getElementById('mainTitle').textContent = `Ficha: Licencia ${CRUD_APP.state.titularId}`;
                if (submitBtn) submitBtn.classList.add('hidden');
                toggleFormFields(false);
            } else if (mode === 'edit') {
                document.getElementById('mainTitle').textContent = `Editar: Licencia ${CRUD_APP.state.titularId}`;
                toggleFormFields(true);
            }
        }
        if (window.lucide) lucide.createIcons();
    }

    // =================================================================================
    // 💾 ACTIONS
    // =================================================================================

    window.handleFormSubmit = async function(event) {
        event.preventDefault();
        showStatus("Procesando solicitud...", "info");
        
        const formData = new FormData(event.target);
        const payload = Object.fromEntries(formData.entries());

        // Normalización
        payload.licencia = String(payload.licencia);
        payload.userlevel = parseInt(payload.userlevel) || 2;
        payload.estado = CRUD_APP.elements.estadoToggle ? CRUD_APP.elements.estadoToggle.checked : true;

        // Si la contraseña está vacía en edición, no la enviamos para no sobrescribir
        if (CRUD_APP.state.mode === 'edit' && !payload.pwd) {
            delete payload.pwd;
        }

        const isEdit = CRUD_APP.state.mode === 'edit';
        const url = isEdit ? `/api/v1/licencias/${CRUD_APP.state.titularId}` : '/api/v1/licencias';
        const method = isEdit ? 'PUT' : 'POST';

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}` 
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                showStatus(`✅ Titular ${isEdit ? 'actualizado' : 'creado'} correctamente.`, 'success');
                setTimeout(() => window.location.href = '/admin/titulares', 1500);
            } else {
                const err = await response.json();
                throw new Error(err.error || 'Error al procesar la solicitud.');
            }
        } catch (error) {
            showStatus(`❌ Error: ${error.message}`, 'error');
        }
    };

    document.addEventListener('DOMContentLoaded', () => {
        CRUD_APP.elements.allInputs = CRUD_APP.elements.form.querySelectorAll('input, select, textarea');

        const path = window.location.pathname;
        const segments = path.split('/').filter(s => s.length > 0);
        
        if (segments.includes('view')) {
            CRUD_APP.state.mode = 'view';
            CRUD_APP.state.titularId = segments[segments.length - 1];
        } else if (segments.includes('update')) {
            CRUD_APP.state.mode = 'edit';
            CRUD_APP.state.titularId = segments[segments.length - 1];
        } else {
            CRUD_APP.state.mode = 'create';
        }

        setupUIAndLoadData();
    });

})();