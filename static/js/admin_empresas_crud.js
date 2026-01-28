/**
 * ARCHIVO: static/js/admin_empresas_crud.js
 * DESCRIPCIÓN: Gestión Maestra de Empresas (CRUD) con alta robustez.
 * ACTUALIZADO: 28/01/2026 - Manejo de errores no-JSON y trazabilidad completa.
 */

(function() {
    console.log("🏢 [EMPRESAS] Inicializando script CRUD v2.0 (Robustez)...");

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
     * Carga datos de la empresa
     */
    async function loadEmpresa(id) {
        console.log(`📡 [API] Solicitando datos ID: ${id}...`);
        try {
            const res = await fetch(`/api/v1/empresas/${id}`);
            
            if (!res.ok) {
                const errorText = await res.text();
                throw new Error(`Servidor respondió con status ${res.status}`);
            }

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
            console.log("✅ [UI] Datos cargados correctamente.");
        } catch (e) {
            console.error("❌ [ERROR] Fallo al cargar empresa:", e);
            showStatus("No se pudo recuperar la ficha de la empresa.", "error");
        }
    }

    /**
     * Actualiza el texto del switch
     */
    function updateEstadoVisual() {
        if (!CRUD.elements.estadoTexto || !CRUD.elements.estadoToggle) return;
        const isActive = CRUD.elements.estadoToggle.checked;
        CRUD.elements.estadoTexto.textContent = isActive ? "Activa" : "Inactiva";
        CRUD.elements.estadoTexto.className = `text-[10px] font-black uppercase tracking-widest ${isActive ? 'text-green-600' : 'text-red-600'}`;
    }

    /**
     * HANDLER PRINCIPAL: Guardado de datos con validación de respuesta
     */
    window.handleFormSubmit = async function(e) {
        if (e) e.preventDefault();
        console.log("💾 [SAVE] Preparando envío...");

        if (CRUD.elements.submitBtn) {
            CRUD.elements.submitBtn.disabled = true;
            CRUD.elements.submitBtn.innerHTML = '<span class="animate-spin mr-2">🌀</span> Procesando...';
        }

        const formData = new FormData(CRUD.elements.form);
        const payload = Object.fromEntries(formData.entries());
        
        // Forzamos el booleano del estado
        payload.estado = CRUD.elements.estadoToggle ? CRUD.elements.estadoToggle.checked : true;

        console.log("📝 [SAVE] Datos a enviar:", payload);

        const isEdit = CRUD.state.mode === 'update';
        const url = isEdit ? `/api/v1/empresas/${CRUD.state.empresaId}` : '/api/v1/empresas';
        const method = isEdit ? 'PUT' : 'POST';

        try {
            const res = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            console.log(`📡 [API] HTTP Status: ${res.status}`);

            // 🛡️ VERIFICACIÓN DE TIPO DE CONTENIDO
            const contentType = res.headers.get("content-type");
            
            if (res.ok) {
                const result = await res.json();
                showStatus("✅ Empresa guardada correctamente", "success");
                setTimeout(() => window.location.href = '/admin/empresas', 1500);
            } else {
                // Si el servidor mandó un JSON de error (400, 409, etc)
                if (contentType && contentType.includes("application/json")) {
                    const errJson = await res.json();
                    showStatus(`Error: ${errJson.error || 'Operación fallida'}`, "error");
                } else {
                    // Si el servidor mandó un 404 o 500 en formato HTML/Texto
                    const rawText = await res.text();
                    console.error("❌ [API] Respuesta no-JSON detectada:", rawText);
                    showStatus(`Error crítico (${res.status}): Ruta no encontrada o fallo de servidor`, "error");
                }
                resetSubmitButton();
            }
        } catch (error) {
            console.error("❌ [NETWORK] Error de comunicación:", error);
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
        
        console.log(`🚀 [INIT] Modo activo: ${CRUD.state.mode.toUpperCase()}`);
    });
})();