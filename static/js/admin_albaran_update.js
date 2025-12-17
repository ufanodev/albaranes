/**
 * admin_albaran_update.js
 * Gestión Maestra para Administración.
 * Carga diccionarios dinámicos y procesa 40 campos.
 */

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Obtener ID del albarán desde la URL (.../update/45)
    const urlParts = window.location.pathname.split('/');
    const albaranId = urlParts[urlParts.length - 1];

    if (!albaranId || isNaN(albaranId)) {
        showError("ID de albarán no detectado o no válido.");
        return;
    }

    console.log(`🚀 [MODO ADMIN] Iniciando edición integral - ID: ${albaranId}`);

    try {
        // 2. CARGA DE DICCIONARIOS (Triple Sincronización)
        // Usamos useTextAsValue = true para conductores porque la tabla albaranes guarda el nombre (varchar)
        await Promise.all([
            loadSelectData('/api/v1/licencias', 'licencia_ref', 'licencia'),
            loadSelectData('/api/v1/empresas', 'empresa_ref', 'nombre'),
            loadSelectData('/api/v1/conductores', 'asalariado', 'nombre', true) 
        ]);

        // 3. RECUPERAR DATOS ACTUALES
        const response = await fetch(`/api/v1/albaranes/id/${albaranId}`);
        const result = await response.json();

        if (!response.ok) throw new Error(result.error || "No se pudo recuperar el albarán");

        // 4. POBLAR FORMULARIO
        // Llama a admin_albaran_cargar.js (que debe estar incluido en el HTML)
        if (typeof populateForm === 'function') {
            populateForm(result.data);
            document.getElementById('header_id').textContent = `#${albaranId}`;
        } else {
            throw new Error("El cargador de campos (admin_albaran_cargar.js) no está disponible.");
        }

        // Ocultar loader si existe
        const loader = document.getElementById('loadingIndicator');
        if (loader) loader.style.display = 'none';

    } catch (err) {
        console.error("❌ [ERROR INICIALIZACIÓN]:", err.message);
        showError(err.message);
    }

    // 5. MANEJO DEL ENVÍO (PUT)
    const updateForm = document.getElementById('updateForm');
    if (updateForm) {
        updateForm.onsubmit = async (e) => {
            e.preventDefault();
            
            const statusMsg = document.getElementById('statusMessage');
            const errorMsg = document.getElementById('errorMessage');
            if (statusMsg) statusMsg.classList.add('hidden');
            if (errorMsg) errorMsg.classList.add('hidden');

            const formData = new FormData(updateForm);
            const payload = Object.fromEntries(formData.entries());

            // --- A. GESTIÓN DE CHECKBOXES (9 campos booleanos) ---
            const checkboxes = [
                'urbano', 'diurno', 'noct_fest', 'festivo', 
                'finalizado', 'enganche', 'enviado', 'cobrado', 'pagado'
            ];
            checkboxes.forEach(id => {
                const el = document.getElementById(id);
                if (el) payload[id] = el.checked;
            });

            // --- B. LIMPIEZA DE TIEMPOS (Evita Error 1292 en el servidor) ---
            // Si el campo está vacío, enviamos string vacío para que el controlador Go asigne NULL
            if (payload.hora && payload.hora.trim() === "") payload.hora = "";
            if (payload.tiempo_espera && payload.tiempo_espera.trim() === "") payload.tiempo_espera = "";

            // --- C. CONVERSIÓN DE TIPOS (GORM requiere tipos numéricos correctos) ---
            payload.licencia_ref = parseInt(payload.licencia_ref);
            payload.empresa_ref = parseInt(payload.empresa_ref);
            payload.num_plazas = parseInt(payload.num_plazas) || 0;
            
            // Decimales
            const floatFields = ['km_totales', 'km_nacionales', 'km_internacionales', 'importe_suplidos', 'importe_total'];
            floatFields.forEach(field => {
                payload[field] = parseFloat(payload[field]) || 0;
            });

            // --- D. PROTECCIÓN DE CAMPOS DE SISTEMA ---
            delete payload.id;
            delete payload.ID;

            console.log("📤 [ADMIN SEND] Enviando paquete de datos maestros:");
            console.table(payload); 

            try {
                // Endpoint específico de Administración (Poder Total)
                const res = await fetch(`/api/v1/albaranes/admin/${albaranId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const updateRes = await res.json();
                
                if (!res.ok) throw new Error(updateRes.error || "Error al actualizar el registro.");

                if (statusMsg) {
                    statusMsg.textContent = "✅ Cambios guardados con éxito. Redirigiendo...";
                    statusMsg.className = "mt-6 p-4 bg-green-600 text-white rounded-lg text-center font-black block shadow-lg";
                    statusMsg.classList.remove('hidden');
                }
                
                // Redirección a la raíz de administración tras 1.5s
                setTimeout(() => { window.location.href = '/admin'; }, 1500);

            } catch (err) {
                console.error("❌ [PROCESS ERROR]:", err.message);
                if (errorMsg) {
                    errorMsg.textContent = "Error al guardar: " + err.message;
                    errorMsg.classList.remove('hidden');
                    errorMsg.className = "mt-6 p-4 bg-red-600 text-white rounded-lg text-center font-bold block shadow-xl";
                }
            }
        };
    }
});

/**
 * Carga datos para elementos <select> desde la API
 * @param {string} url - Endpoint de la API
 * @param {string} elementId - ID del <select> en el HTML
 * @param {string} textField - Campo que se mostrará como texto
 * @param {boolean} useTextAsValue - Si es true, el value será el texto (para asalariado), si es false será el ID.
 */
async function loadSelectData(url, elementId, textField, useTextAsValue = false) {
    try {
        const r = await fetch(url);
        const d = await r.json();
        const list = d.data || d;
        const select = document.getElementById(elementId);
        if (!select) return;

        // Mantener la primera opción (ej: "-- Seleccione Conductor --")
        const firstOption = select.options[0] ? select.options[0].outerHTML : '';

        select.innerHTML = firstOption + list.map(item => {
            const val = useTextAsValue ? item[textField] : item.id;
            return `<option value="${val}">${item[textField]}</option>`;
        }).join('');
    } catch (e) {
        console.error(`❌ [LOAD ERROR] Combo ${elementId}:`, e);
    }
}

/**
 * Muestra error en la interfaz
 */
function showError(msg) {
    const errDiv = document.getElementById('errorMessage');
    if (errDiv) {
        errDiv.textContent = `❌ ERROR: ${msg}`;
        errDiv.classList.remove('hidden');
        errDiv.className = "mt-6 p-4 bg-red-600 text-white rounded-lg text-center font-bold block";
    }
}