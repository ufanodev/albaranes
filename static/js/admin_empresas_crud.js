/**
 * ARCHIVO: static/js/admin_empresas_crud.js
 * DESCRIPCIÓN: Gestión Maestra de Empresas (CRUD) compatible con acceso libre.
 * ACTUALIZADO: 26/03/2026 - FIX: Soporte para envío sin token JWT.
 */

(function() {
    console.log("🏢 [EMPRESAS] Inicializando script CRUD v2.1 (Acceso Flexible)...");

    const CRUD = {
        elements: {
            form: document.getElementById('empresaForm'),
            mainTitle: document.getElementById('mainTitle'),
            statusMessage: document.getElementById('statusMessage'),
            submitBtn: document.getElementById('submitBtn'),
            estadoToggle: document.getElementById('estado'),
            estadoTexto: document.getElementById('estadoTexto')
        },
        state: {
            mode: 'create',
            empresaId: null
        }
    };

    /**
     * Muestra alertas visuales con control de logs
     */
    function showStatus(msg, type) {
        const el = CRUD.elements.statusMessage;
        if (!el) return;
        console.log(`📢 [STATUS] ${type.toUpperCase()}: ${msg}`);
        el.className = `w-full p-4 rounded-2xl text-center font-bold text-xs uppercase tracking-widest border-2 transition-all duration-300 ${
            type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
        }`;
        el.textContent = msg;
        el.classList.remove('hidden');
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    /**
     * Carga datos de la empresa (Solo modo UPDATE/VIEW)
     */
    async function loadEmpresa(id) {
        console.log(`📡 [API] Solicitando datos ID: ${id}...`);
        
        // Preparar headers (el GET individual suele requerir token en admin)
        const headers = {};
        const token = localStorage.getItem('token');
        if (token) headers['Authorization'] = `Bearer ${token}`;

        try {
            const res = await fetch(`/api/v1/empresas/${id}`, { headers });
            
            if (!res.ok) throw new Error(`Status ${res.status}`);

            const result = await res.json();
            const data = result.data || result;

            // Mapeo seguro de campos
            const fields = ['nif', 'nombre', 'direccion', 'poblacion', 'telefono', 'email'];
            fields.forEach(f => {
                const el = document.getElementById(f);
                if (el) el.value = data[f] || '';
            });

            if (CRUD.elements.estadoToggle) {
                CRUD.elements.estadoToggle.checked = (data.estado !== false && data.estado !== 0);
                updateEstadoVisual();
            }
        } catch (e) {
            console.error("❌ [ERROR] Fallo al cargar empresa:", e);
            showStatus("No se pudo recuperar la ficha. Verifica tus permisos.", "error");
        }
    }

    function updateEstadoVisual() {
        if (!CRUD.elements.estadoTexto || !CRUD.elements.estadoToggle) return;
        const isActive = CRUD.elements.estadoToggle.checked;
        CRUD.elements.estadoTexto.textContent = isActive ? "Activa" : "Inactiva";
        CRUD.elements.estadoTexto.className = `text-[10px] font-black uppercase tracking-widest ${isActive ? 'text-green-600' : 'text-red-600'}`;
    }

    /**
     * HANDLER PRINCIPAL: Guardado de datos
     */
    window.handleFormSubmit = async function(e) {
        if (e) e.preventDefault();
        console.log("💾 [SAVE] Iniciando proceso de guardado...");

        if (CRUD.elements.submitBtn) {
            CRUD.elements.submitBtn.disabled = true;
            CRUD.elements.submitBtn.innerHTML = '<span class="animate-spin mr-2">🌀</span> Procesando...';
        }

        const formData = new FormData(CRUD.elements.form);
        const payload = Object.fromEntries(formData.entries());
        payload.estado = CRUD.elements.estadoToggle ? CRUD.elements.estadoToggle.checked : true;

        const isEdit = CRUD.state.mode === 'update';
        const url = isEdit ? `/api/v1/empresas/${CRUD.state.empresaId}` : '/api/v1/empresas';
        const method = isEdit ? 'PUT' : 'POST';

        // 🛡️ CONFIGURACIÓN DE HEADERS FLEXIBLE
        const headers = { 'Content-Type': 'application/json' };
        const token = localStorage.getItem('token');
        if (token) headers['Authorization'] = `Bearer ${token}`;

        try {
            const res = await fetch(url, {
                method: method,
                headers: headers,
                body: JSON.stringify(payload)
            });

            const contentType = res.headers.get("content-type");
            
            if (res.ok) {
                showStatus("✅ Empresa guardada correctamente", "success");
                setTimeout(() => window.location.href = '/admin/empresas', 1500);
            } else {
                if (contentType && contentType.includes("application/json")) {
                    const errJson = await res.json();
                    showStatus(`Error: ${errJson.error || 'Operación fallida'}`, "error");
                } else {
                    showStatus(`Error crítico (${res.status}): No autorizado o fallo de servidor`, "error");
                }
                resetSubmitButton();
            }
        } catch (error) {
            console.error("❌ [NETWORK] Error:", error);
            showStatus("Fallo de red: No se pudo contactar con el servidor.", "error");
            resetSubmitButton();
        }
    };

    function resetSubmitButton() {
        if (CRUD.elements.submitBtn) {
            CRUD.elements.submitBtn.disabled = false;
            CRUD.elements.submitBtn.innerHTML = '<i data-lucide="save" class="w-6 h-6"></i> Guardar Empresa';
            if (window.lucide) lucide.createIcons();
        }
    }

    /**
     * Inicialización y Routing
     */
    document.addEventListener('DOMContentLoaded', () => {
        if (!CRUD.elements.form) return;

        const path = window.location.pathname;
        const segments = path.split('/').filter(s => s.length > 0);
        const id = segments[segments.length - 1];

        if (segments.includes('view')) {
            CRUD.state.mode = 'view';
            CRUD.state.empresaId = id;
            CRUD.elements.mainTitle.textContent = "Ficha de Empresa";
            CRUD.elements.form.querySelectorAll('input, select, textarea').forEach(i => i.disabled = true);
            if (CRUD.elements.submitBtn) CRUD.elements.submitBtn.classList.add('hidden');
            loadEmpresa(id);
        } else if (segments.includes('update')) {
            CRUD.state.mode = 'update';
            CRUD.state.empresaId = id;
            CRUD.elements.mainTitle.textContent = "Editar Empresa";
            loadEmpresa(id);
        } else {
            CRUD.state.mode = 'create';
            CRUD.elements.mainTitle.textContent = "Nueva Empresa";
        }

        if (CRUD.elements.estadoToggle) {
            CRUD.elements.estadoToggle.addEventListener('change', updateEstadoVisual);
            updateEstadoVisual(); 
        }
        
        if (window.lucide) lucide.createIcons();
        console.log(`🚀 [INIT] Modo activo: ${CRUD.state.mode.toUpperCase()}`);
    });
})();