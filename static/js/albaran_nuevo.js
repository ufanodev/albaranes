/**
 * ARCHIVO: static/js/albaran_nuevo.js
 * DESCRIPCIÓN: Lógica para la creación de albaranes desde el panel de Titular.
 * ACTUALIZADO: 26/01/2026 - Solución error 1364 (km_ini) y sincronización total.
 */

document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 [AUDITORÍA] [INIT] Iniciando Formulario de Albarán");

    // 1. Cargar datos iniciales
    await Promise.all([
        getLicenciaInfo(),
        cargarEmpresas()
    ]);

    // 2. Fecha por defecto (hoy)
    const fechaInput = document.getElementById('fecha');
    if (fechaInput) {
        fechaInput.value = new Date().toISOString().split('T')[0];
    }
    
    // 3. Inicializar formateadores numéricos
    initFormatters();
    
    // Renderizar iconos
    if (window.lucide) {
        lucide.createIcons();
    }
});

/**
 * Obtiene la info de la licencia del usuario autenticado
 */
async function getLicenciaInfo() {
    try {
        const res = await fetch('/api/v1/user/licencia_info');
        if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
        
        const data = await res.json();
        if (data.licencia_numero) {
            const inputLic = document.getElementById('licencia');
            inputLic.value = data.licencia_numero;
            inputLic.dataset.id = data.licencia_id; 
            console.log(`[AUDITORÍA] [LICENCIA] Cargada: ${data.licencia_numero}`);
        }
    } catch (err) {
        console.error("❌ [AUDITORÍA] Error cargando licencia:", err);
    }
}

/**
 * Carga el selector de empresas con logs de depuración y ordenación forzada
 */
async function cargarEmpresas() {
    const select = document.getElementById('empresa');
    if (!select) return;

    try {
        console.log("🔍 [AUDITORÍA] [EMPRESAS] Solicitando lista a la API...");
        const res = await fetch('/api/v1/empresas');
        const result = await res.json();

        // LOG 1: Ver datos brutos recibidos
        console.log("📦 [AUDITORÍA] [EMPRESAS] Datos brutos recibidos:", result.data);

        if (!result.data || !Array.isArray(result.data)) {
            console.error("❌ [AUDITORÍA] [EMPRESAS] Formato de datos inválido");
            return;
        }

        // ORDENACIÓN FORZADA EN FRONTEND (A-Z)
        // Esto garantiza el orden incluso si el backend no lo envía ordenado
        const empresasOrdenadas = result.data.sort((a, b) => {
            return a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });
        });

        // LOG 2: Ver datos tras la ordenación en JS
        console.log("📊 [AUDITORÍA] [EMPRESAS] Lista ordenada para el combo:", empresasOrdenadas);

        // Limpiar y Llenar el Select
        select.innerHTML = '<option value="">-- Seleccionar Empresa (A-Z) --</option>';
        
        empresasOrdenadas.forEach(emp => {
            const opt = document.createElement('option');
            opt.value = emp.id;
            opt.textContent = emp.nombre.toUpperCase(); // Forzamos mayúsculas para uniformidad
            select.appendChild(opt);
        });

        console.log("✅ [AUDITORÍA] [EMPRESAS] Combo renderizado correctamente.");

    } catch (err) {
        console.error("❌ [AUDITORÍA] [EMPRESAS] Error crítico en la carga:", err);
    }
}

/**
 * Asegura que los campos numéricos no queden vacíos y tengan 2 decimales
 */
function initFormatters() {
    const numFields = [
        'importe_suplidos', 'importe_total', 'km_totales', 
        'km_nacionales', 'km_internacionales', 'hora_total'
    ];
    numFields.forEach(name => {
        const input = document.querySelector(`input[name="${name}"]`);
        if (input) {
            input.addEventListener('blur', () => {
                if (input.value === "" || isNaN(input.value)) {
                    input.value = "0.00";
                } else {
                    input.value = parseFloat(input.value).toFixed(2);
                }
            });
        }
    });
}

/**
 * Maneja el envío del formulario mediante POST
 */
async function handleAction(action, event) {
    if (event) event.preventDefault();
    
    console.log("[AUDITORÍA] [ENVÍO] Iniciando captura de datos...");
    
    const form = document.getElementById('albaranForm');
    const statusMsg = document.getElementById('statusMessage');
    const formData = new FormData(form);
    const plainData = {};

    // 1. Mapeo de datos y conversión de Checkboxes
    formData.forEach((value, key) => {
        const inputElement = form.querySelector(`[name="${key}"]`);
        if (inputElement && inputElement.type === 'checkbox') {
            plainData[key] = inputElement.checked;
        } else {
            plainData[key] = value;
        }
    });

    // 2. Inyección de metadatos (ID de licencia)
    const licId = document.getElementById('licencia').dataset.id;
    plainData.licencia_ref = licId ? parseInt(licId) : 0;
    plainData.empresa_ref = parseInt(plainData.empresa_ref) || 0;
    plainData.num_plazas = parseInt(plainData.num_plazas) || 4;

    // 3. MAPEO DE ADJUNTOS (Sincronización frontend/backend)
    // El checkbox 'adjuntos_bool' mapea a 'adjuntos' (bool) en DB
    plainData.adjuntos_bool = plainData.adjuntos_bool || false;
    // El input text 'adjuntos' mapea a 'adjuntos_ref' (string) en DB

    // 4. FIX ERROR 1364 (km_ini / km_fin) y NORMALIZACIÓN DECIMAL
    // Forzamos 0.00 en los campos que la DB exige como NOT NULL pero no están en el form
    plainData.km_ini = 0.0;
    plainData.km_fin = 0.0;
    plainData.importe_espera = 0.0;

    const numericFields = [
        'km_totales', 'km_nacionales', 'km_internacionales', 
        'importe_suplidos', 'importe_total', 'hora_total'
    ];

    numericFields.forEach(field => {
        const val = parseFloat(plainData[field]);
        plainData[field] = isNaN(val) ? 0.0 : val;
    });

    console.log("📤 [AUDITORÍA] Payload Final:", plainData);

    try {
        const response = await fetch('/api/v1/albaranes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(plainData)
        });

        const result = await response.json();

        if (response.ok) {
            statusMsg.classList.remove('hidden', 'bg-red-100', 'text-red-700', 'border-red-200');
            statusMsg.classList.add('bg-green-100', 'text-green-700', 'border-green-200');
            statusMsg.innerHTML = `<div class="flex items-center justify-center gap-2">
                <i data-lucide="check-circle"></i>
                <span>✅ Albarán guardado con éxito</span>
            </div>`;
            if (window.lucide) lucide.createIcons();
            
            form.reset();
            // Redirección al panel tras pausa breve
            setTimeout(() => window.location.href = '/titulares', 1500);
        } else {
            throw new Error(result.error || "Error interno al guardar");
        }
    } catch (err) {
        console.error("❌ [ERROR ENVÍO]:", err.message);
        statusMsg.classList.remove('hidden', 'bg-green-100', 'text-green-700', 'border-green-200');
        statusMsg.classList.add('bg-red-100', 'text-red-700', 'border-red-200');
        statusMsg.innerHTML = `<span>❌ ERROR: ${err.message}</span>`;
    }
}