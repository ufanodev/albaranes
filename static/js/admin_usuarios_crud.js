/**
 * admin_usuarios_crud.js - Gestión de Usuarios (Creación y Edición)
 * Corregido: Exposición global de funciones para interactividad HTML.
 */

// Usamos una estructura de objeto global para no contaminar pero exponemos lo necesario
const CRUD_APP = {
    elements: {
        form: document.getElementById('usuarioForm'),
        mainTitle: document.getElementById('mainTitle'),
        statusMessage: document.getElementById('statusMessage'),
        btnCrear: document.getElementById('btn-crear'),
        btnModificar: document.getElementById('btn-modificar'),
        btnBorrar: document.getElementById('btn-borrar'),
        emailSelect: document.getElementById('email_select'),        
        emailAdminInput: document.getElementById('admin_email_nuevo'), 
        emailRealInput: document.getElementById('email'),            
        licenciaSelect: document.getElementById('licencia_ref'),
        wrapperTitular: document.getElementById('wrapper_email_titular'),
        wrapperAdmin: document.getElementById('wrapper_email_admin'),
        idInput: document.getElementById('id')
    },
    state: {
        mode: 'create',
        userId: null,
        licenciasData: []
    }
};

// =================================================================================
// 🎭 LÓGICA DINÁMICA DE CAMPOS (EXPUESTA GLOBALMENTE)
// =================================================================================

/**
 * Intercambia la interfaz de email según el rol seleccionado
 */
window.handleRoleChange = function(role) {
    console.log("🎭 Cambio de rol detectado:", role);
    const { wrapperTitular, wrapperAdmin, emailSelect, emailAdminInput, emailRealInput, licenciaSelect } = CRUD_APP.elements;

    if (role === 'admin') {
        // MODO ADMINISTRADOR: Mostrar Input Texto
        wrapperTitular.classList.add('hidden');
        wrapperAdmin.classList.remove('hidden');
        
        emailSelect.required = false;
        emailAdminInput.required = true;
        
        // Un Admin no suele requerir vinculación a licencia física
        if(licenciaSelect) licenciaSelect.value = "0";
        
        // Sincronizar el hidden con lo que haya en el input de texto
        emailRealInput.value = emailAdminInput.value;
    } else {
        // MODO USUARIO (TITULAR): Mostrar Combo Select
        wrapperTitular.classList.remove('hidden');
        wrapperAdmin.classList.add('hidden');
        
        emailAdminInput.required = false;
        emailSelect.required = true;
        
        // Sincronizar el hidden con lo seleccionado en el combo
        emailRealInput.value = emailSelect.value;
    }
};

/**
 * Sincroniza el email del selector o del input con el campo hidden 'email'
 */
window.syncEmail = function(element) {
    const val = element.value;
    CRUD_APP.elements.emailRealInput.value = val;
    console.log("📧 Email sincronizado:", val);

    // Si es el combo, intentar auto-vincular la licencia
    if (element.id === 'email_select') {
        const found = CRUD_APP.state.licenciasData.find(l => l.email === val);
        if (found && CRUD_APP.elements.licenciaSelect) {
            CRUD_APP.elements.licenciaSelect.value = found.id;
        }
    }
};

// =================================================================================
// 📡 SERVICIOS API
// =================================================================================

const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('token')}`
});

async function loadCombos() {
    try {
        const response = await fetch('/api/v1/licencias', { headers: getAuthHeaders() });
        const result = await response.json();
        CRUD_APP.state.licenciasData = result.data || [];

        const { emailSelect, licenciaSelect } = CRUD_APP.elements;
        emailSelect.innerHTML = '<option value="">--- Seleccione Email ---</option>';
        licenciaSelect.innerHTML = '<option value="0">--- Sin Licencia (Admin) ---</option>';

        CRUD_APP.state.licenciasData.forEach(lic => {
            const optEmail = document.createElement('option');
            optEmail.value = lic.email;
            optEmail.textContent = `${lic.email} (${lic.nombre})`;
            emailSelect.appendChild(optEmail);

            const optLic = document.createElement('option');
            optLic.value = lic.id;
            optLic.textContent = `LIC ${lic.licencia} - ${lic.nombre}`;
            licenciaSelect.appendChild(optLic);
        });
    } catch (error) { console.error("Error cargando combos:", error); }
}

async function loadUserData(id) {
    try {
        const resp = await fetch('/api/v1/users', { headers: getAuthHeaders() });
        const result = await resp.json();
        const user = (result.data || []).find(u => u.id == id);
        
        if (user) {
            CRUD_APP.elements.idInput.value = user.id;
            document.getElementById('usuario').value = user.usuario;
            document.getElementById('role').value = user.role;
            document.getElementById('activo').value = String(user.activo);
            document.getElementById('licencia_ref').value = user.licencia_ref || 0;
            
            // 1. Aplicar visibilidad según el rol cargado
            window.handleRoleChange(user.role);

            // 2. Rellenar el campo visible correspondiente
            if (user.role === 'admin') {
                CRUD_APP.elements.emailAdminInput.value = user.email;
            } else {
                CRUD_APP.elements.emailSelect.value = user.email;
            }
            
            // 3. Rellenar el hidden input
            CRUD_APP.elements.emailRealInput.value = user.email;
        }
    } catch (e) { console.error("Error cargando usuario:", e); }
}

// =================================================================================
// 🎯 HANDLERS Y ACCIONES
// =================================================================================

window.handleFormSubmit = async function(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const payload = Object.fromEntries(formData.entries());

    payload.licencia_ref = parseInt(payload.licencia_ref) || 0;
    payload.activo = (payload.activo === 'true');
    
    if (CRUD_APP.state.mode === 'edit' && !payload.password) {
        delete payload.password;
    }

    const isEdit = CRUD_APP.state.mode === 'edit';
    const url = isEdit ? `/api/v1/users/${CRUD_APP.state.userId}` : '/api/v1/users';
    
    try {
        const res = await fetch(url, {
            method: isEdit ? 'PUT' : 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            alert("✅ Guardado correctamente.");
            window.location.href = '/admin/usuarios';
        } else {
            const err = await res.json();
            alert("❌ Error: " + (err.error || "Fallo en el servidor"));
        }
    } catch (e) { alert("❌ Error de comunicación"); }
};

window.handleAction = (type) => {
    if (type === 'volver') window.location.href = '/admin/usuarios';
    if (type === 'modificar') CRUD_APP.elements.form.requestSubmit();
    if (type === 'borrar') {
        if(confirm("¿Seguro que deseas desactivar este usuario?")) {
            fetch(`/api/v1/users/${CRUD_APP.state.userId}`, { 
                method: 'DELETE', headers: getAuthHeaders() 
            }).then(() => window.location.href = '/admin/usuarios');
        }
    }
};

// =================================================================================
// 🚀 INICIALIZACIÓN
// =================================================================================

document.addEventListener('DOMContentLoaded', async () => {
    await loadCombos();

    const parts = window.location.pathname.split('/').filter(p => p.length > 0);
    const lastPart = parts[parts.length - 1];

    if (!isNaN(lastPart) && lastPart !== "") {
        CRUD_APP.state.mode = 'edit';
        CRUD_APP.state.userId = lastPart;
        
        CRUD_APP.elements.mainTitle.innerHTML = `✏️ Modificar Usuario #${lastPart}`;
        CRUD_APP.elements.btnModificar.classList.remove('hidden');
        CRUD_APP.elements.btnBorrar.classList.remove('hidden');
        CRUD_APP.elements.btnCrear.classList.add('hidden');
        
        await loadUserData(lastPart);
    }

    if (window.lucide) lucide.createIcons();
});