/**
 * admin_albaran_copiar.js
 * Lógica para generar un nuevo albarán basado en uno existente.
 * Recupera datos de un ID origen y realiza un POST (Create).
 */

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Obtener ID del albarán origen desde la URL
    const urlParts = window.location.pathname.split('/');
    const albaranOrigenId = urlParts[urlParts.length - 1];

    if (!albaranOrigenId || isNaN(albaranOrigenId)) {
        showError("ID de origen no válido.");
        return;
    }

    console.log(`📂 [MODO COPIA] Preparando nuevo registro basado en ID: ${albaranOrigenId}`);

    try {
        // 2. Carga de Diccionarios (Igual que en Update)
        await Promise.all([
            loadSelectData('/api/v1/licencias', 'licencia_ref', 'licencia'),
            loadSelectData('/api/v1/empresas', 'empresa_ref', 'nombre'),
            loadSelectData('/api/v1/conductores', 'asalariado', 'nombre', true) 
        ]);

        // 3. Recuperar datos del albarán origen
        const response = await fetch(`/api/v1/albaranes/id/${albaranOrigenId}`);
        const result = await response.json();

        if (!response.ok) throw new Error(result.error || "No se pudo leer el origen");

        // 4. Poblar el formulario
        if (typeof populateForm === 'function') {
            populateForm(result.data);
            // Referenciamos el origen en el título
            document.getElementById('header_id').textContent = `(Origen #${albaranOrigenId})`;
            
            // Opcional: Limpiar el número de albarán para obligar a poner uno nuevo
            // document.getElementById('numero_albaran').value = ""; 
        }

    } catch (err) {
        console.error("❌ [ERROR]:", err.message);
        showError(err.message);
    }

    // 5. MANEJO DEL ENVÍO (POST /copy)
    const copyForm = document.getElementById('copyForm');
    if (copyForm) {
        copyForm.onsubmit = async (e) => {
            e.preventDefault();
            
            const statusMsg = document.getElementById('statusMessage');
            const errorMsg = document.getElementById('errorMessage');
            if (statusMsg) statusMsg.classList.add('hidden');
            if (errorMsg) errorMsg.classList.add('hidden');

            const formData = new FormData(copyForm);
            const payload = Object.fromEntries(formData.entries());

            // --- A. GESTIÓN DE CHECKBOXES ---
            const checkboxes = [
                'urbano', 'diurno', 'noct_fest', 'festivo', 
                'finalizado', 'enganche', 'enviado', 'cobrado', 'pagado'
            ];
            checkboxes.forEach(id => {
                const el = document.getElementById(id);
                if (el) payload[id] = el.checked;
            });

            // --- B. LIMPIEZA Y CONVERSIÓN ---
            // IMPORTANTE: Eliminamos IDs para asegurar que la DB asigne uno nuevo
            delete payload.id;
            delete payload.ID;

            payload.licencia_ref = parseInt(payload.licencia_ref);
            payload.empresa_ref = parseInt(payload.empresa_ref);
            payload.num_plazas = parseInt(payload.num_plazas) || 0;
            
            const floatFields = ['km_totales', 'km_nacionales', 'km_internacionales', 'importe_suplidos', 'importe_total'];
            floatFields.forEach(field => {
                payload[field] = parseFloat(payload[field]) || 0;
            });

            // Limpieza de strings de tiempo vacíos
            if (payload.hora && payload.hora.trim() === "") payload.hora = "";
            if (payload.tiempo_espera && payload.tiempo_espera.trim() === "") payload.tiempo_espera = "";

            console.log("📤 [COPY SEND] Creando nuevo registro a partir de copia...");

            try {
                // Notar que usamos POST y el endpoint /copy
                const res = await fetch(`/api/v1/albaranes/copy`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const copyRes = await res.json();
                
                if (!res.ok) throw new Error(copyRes.error || "Error al crear la copia.");

                if (statusMsg) {
                    statusMsg.textContent = "✅ Copia creada con éxito. Redirigiendo...";
                    statusMsg.className = "mt-6 p-4 bg-blue-600 text-white rounded-lg text-center font-black block shadow-lg";
                    statusMsg.classList.remove('hidden');
                }
                
                // Volver al panel de admin
                setTimeout(() => { window.location.href = '/admin'; }, 1500);

            } catch (err) {
                console.error("❌ [COPY ERROR]:", err.message);
                if (errorMsg) {
                    errorMsg.textContent = "Error al copiar: " + err.message;
                    errorMsg.classList.remove('hidden');
                }
            }
        };
    }
});

/**
 * Carga datos para elementos <select>
 */
async function loadSelectData(url, elementId, textField, useTextAsValue = false) {
    try {
        const r = await fetch(url);
        const d = await r.json();
        const list = d.data || d;
        const select = document.getElementById(elementId);
        if (!select) return;

        const firstOption = select.options[0] ? select.options[0].outerHTML : '';
        select.innerHTML = firstOption + list.map(item => {
            const val = useTextAsValue ? item[textField] : item.id;
            return `<option value="${val}">${item[textField]}</option>`;
        }).join('');
    } catch (e) {
        console.error(`❌ [LOAD ERROR] ${elementId}:`, e);
    }
}

function showError(msg) {
    const errDiv = document.getElementById('errorMessage');
    if (errDiv) {
        errDiv.textContent = `❌ ERROR: ${msg}`;
        errDiv.classList.remove('hidden');
    }
}