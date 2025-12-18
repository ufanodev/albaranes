/**
 * admin_usuarios_crud.js - Gestión de Usuarios (Versión Integrada)
 */

(function() {
    const CRUD_APP = {
        elements: {
            form: document.getElementById('usuarioForm'),
            mainTitle: document.getElementById('mainTitle'),
            statusMessage: document.getElementById('statusMessage'),
            btnCrear: document.getElementById('btn-crear'),
            btnModificar: document.getElementById('btn-modificar'),
            btnBorrar: document.getElementById('btn-borrar'),
            passwordInput: document.getElementById('password'),
            emailSelect: document.getElementById('email_select'),
            emailRealInput: document.getElementById('email'), 
            licenciaSelect: document.getElementById('licencia_ref')
        },
        state: {
            mode: 'create',
            userId: null,
            isProcessing: false,
            licenciasData: []
        }
    };

    // =================================================================================
    // ⚙️ MOTOR DE CARGA (GET LICENCIAS)
    // =================================================================================

    async function loadCombosFromLicencias() {
        console.log("➡️ [1] ENTRADA: Solicitando licencias...");
        const { emailSelect, licenciaSelect } = CRUD_APP.elements;
        
        if (!emailSelect || !licenciaSelect) {
            console.error("❌ [ERROR] Selectores no encontrados. Revisa el HTML.");
            return;
        }

        try {
            // Quitamos la barra final para evitar la redirección 301 de GIN
            const response = await fetch('/api/v1/licencias');
            const result = await response.json();
            
            CRUD_APP.state.licenciasData = result.data || [];
            console.log(`📥 [2] SALIDA: ${CRUD_APP.state.licenciasData.length} licencias cargadas.`);

            emailSelect.innerHTML = '<option value="">--- Seleccione Email ---</option>';
            licenciaSelect.innerHTML = '<option value="0">--- Sin Licencia (Admin) ---</option>';

            CRUD_APP.state.licenciasData.forEach(lic => {
                // Rellenar Email
                const optEmail = document.createElement('option');
                optEmail.value = lic.email;
                optEmail.textContent = `${lic.email} (${lic.nombre})`;
                emailSelect.appendChild(optEmail);

                // Rellenar Licencia
                const optLic = document.createElement('option');
                optLic.value = lic.id;
                optLic.textContent = `LIC ${lic.licencia} - ${lic.nombre}`;
                licenciaSelect.appendChild(optLic);
            });
            console.log("✅ [3] DOM actualizado con licencias.");
        } catch (error) {
            console.error("❌ [ERROR] Falló fetch licencias:", error);
        }
    }

    window.syncEmail = function(select) {
        const emailValue = select.value;
        if (CRUD_APP.elements.emailRealInput) CRUD_APP.elements.emailRealInput.value = emailValue;

        const t = CRUD_APP.state.licenciasData.find(l => l.email === emailValue);
        if (t && CRUD_APP.elements.licenciaSelect) {
            CRUD_APP.elements.licenciaSelect.value = t.id;
            console.log(`🔗 Auto-link: ${emailValue} -> ID ${t.id}`);
        }
    };

    // =================================================================================
    // 📡 DATA LOAD (REEMPLAZA A usuarios_cargar.js)
    // =================================================================================

    async function loadUserData(id) {
        console.log(`📡 [4] ENTRADA: Cargando datos usuario ID ${id}`);
        try {
            const resp = await fetch('/api/v1/users');
            const result = await resp.json();
            const user = (result.data || []).find(u => u.id == id);
            
            if (user) {
                document.getElementById('id').value = user.id;
                document.getElementById('usuario').value = user.usuario;
                document.getElementById('email').value = user.email;
                document.getElementById('role').value = user.role;
                document.getElementById('activo').value = String(user.activo);
                document.getElementById('licencia_ref').value = user.licencia_ref;
                if (CRUD_APP.elements.emailSelect) CRUD_APP.elements.emailSelect.value = user.email;
                console.log("✅ [5] SALIDA: Formulario de edición rellenado.");
            }
        } catch (e) {
            console.error("❌ Error cargando usuario:", e);
        }
    }

    // =================================================================================
    // 🎯 UI & HANDLERS
    // =================================================================================

    function crudAlertMessage(msg, type) {
        const el = CRUD_APP.elements.statusMessage;
        if (!el) return;
        el.textContent = msg;
        el.className = `status-message block mt-4 p-4 text-center font-bold rounded border ${
            type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`;
        el.classList.remove('hidden');
    }

    window.handleFormSubmit = async function(event) {
        event.preventDefault();
        const formData = new FormData(event.target);
        const payload = Object.fromEntries(formData.entries());

        payload.licencia_ref = parseInt(payload.licencia_ref) || 0;
        payload.activo = (payload.activo === 'true');
        if (CRUD_APP.state.mode === 'edit' && !payload.password) delete payload.password;

        const isEdit = CRUD_APP.state.mode === 'edit';
        const url = isEdit ? `/api/v1/users/${CRUD_APP.state.userId}` : '/api/v1/users';
        
        try {
            const res = await fetch(url, {
                method: isEdit ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                crudAlertMessage("✅ Guardado correctamente", "success");
                setTimeout(() => window.location.href = '/admin/usuarios', 1500);
            } else {
                const err = await res.json();
                crudAlertMessage("❌ Error: " + err.error, "error");
            }
        } catch (e) { crudAlertMessage("❌ Error de red", "error"); }
    };

    window.handleAction = (type) => {
        if (type === 'volver') window.location.href = '/admin/usuarios';
        if (type === 'modificar') CRUD_APP.elements.form.requestSubmit();
    };

    // =================================================================================
    // 🚀 INIT
    // =================================================================================

    document.addEventListener('DOMContentLoaded', async () => {
        console.log("🚀 [INIT] Iniciando admin_usuarios_crud.js");

        // 1. Cargar Combos
        await loadCombosFromLicencias();

        // 2. Determinar Modo e ID
        const parts = window.location.pathname.split('/').filter(p => p.length > 0);
        const lastPart = parts[parts.length - 1];

        if (!isNaN(lastPart) && lastPart !== "") {
            CRUD_APP.state.mode = 'edit';
            CRUD_APP.state.userId = lastPart;
            await loadUserData(lastPart);
            
            // Actualizar UI
            CRUD_APP.elements.mainTitle.innerHTML = `✏️ Modificar Usuario #${lastPart}`;
            CRUD_APP.elements.btnModificar.classList.remove('hidden');
            CRUD_APP.elements.btnBorrar.classList.remove('hidden');
            CRUD_APP.elements.btnCrear.classList.add('hidden');
        } else {
            console.log("📝 Modo CREATE detectado.");
        }

        if (window.lucide) lucide.createIcons();
    });
})();