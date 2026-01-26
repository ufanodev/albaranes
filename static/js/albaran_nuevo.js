/**
 * ARCHIVO: static/js/albaran_nuevo.js
 * DESCRIPCIÓN: Lógica maestra para la creación de albaranes desde el panel de Titular.
 * ACTUALIZADO: 26/01/2026 - Versión final con Referencia, Horas y solución Error 1364.
 */

document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 [AUDITORÍA] [INIT] Iniciando Formulario de Albarán Master Final");

    // 1. Cargar datos iniciales desde la API
    await Promise.all([
        getLicenciaInfo(),
        cargarEmpresas()
    ]);

    // 2. Establecer fecha por defecto (hoy)
    const fechaInput = document.getElementById('fecha');
    if (fechaInput) {
        fechaInput.value = new Date().toISOString().split('T')[0];
    }
    
    // 3. Inicializar formateadores para campos numéricos
    initFormatters();
    
    // Renderizar iconos de Lucide
    if (window.lucide) {
        lucide.createIcons();
    }
});

/**
 * Obtiene la info de la licencia del usuario autenticado y la guarda en el dataset
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
            console.log(`[AUDITORÍA] [LICENCIA] Cargada con éxito: ${data.licencia_numero}`);
        }
    } catch (err) {
        console.error("❌ [AUDITORÍA] [LICENCIA] Error cargando licencia:", err);
    }
}

/**
 * Carga el selector de empresas con ordenación alfabética forzada (A-Z)
 */
async function cargarEmpresas() {
    const select = document.getElementById('empresa');
    if (!select) return;

    try {
        console.log("🔍 [AUDITORÍA] [EMPRESAS] Solicitando lista a la API...");
        const res = await fetch('/api/v1/empresas');
        const result = await res.json();

        if (!result.data || !Array.isArray(result.data)) {
            console.error("❌ [AUDITORÍA] [EMPRESAS] Datos inválidos");
            return;
        }

        // ORDENACIÓN FORZADA EN FRONTEND (A-Z)
        const empresasOrdenadas = result.data.sort((a, b) => {
            return a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });
        });

        console.log("📊 [AUDITORÍA] [EMPRESAS] Lista ordenada recibida:", empresasOrdenadas);

        select.innerHTML = '<option value="">-- Seleccionar Empresa (A-Z) --</option>';
        empresasOrdenadas.forEach(emp => {
            const opt = document.createElement('option');
            opt.value = emp.id;
            opt.textContent = emp.nombre.toUpperCase();
            select.appendChild(opt);
        });

    } catch (err) {
        console.error("❌ [AUDITORÍA] [EMPRESAS] Error crítico:", err);
    }
}

/**
 * Asegura que los campos numéricos no queden vacíos y tengan formato decimal
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
 * Maneja el envío del formulario mediante POST al controlador Go
 */
async function handleAction(action, event) {
    if (event) event.preventDefault();
    
    console.log("[AUDITORÍA] [ENVÍO] Iniciando captura total de campos...");
    
    const form = document.getElementById('albaranForm');
    const statusMsg = document.getElementById('statusMessage');
    const formData = new FormData(form);
    const plainData = {};

    // 1. Mapeo automático y gestión de checkboxes
    formData.forEach((value, key) => {
        const inputElement = form.querySelector(`[name="${key}"]`);
        if (inputElement && inputElement.type === 'checkbox') {
            plainData[key] = inputElement.checked;
        } else {
            plainData[key] = value;
        }
    });

    // 2. Metadatos obligatorios (Licencia Ref)
    const licId = document.getElementById('licencia').dataset.id;
    plainData.licencia_ref = licId ? parseInt(licId) : 0;
    
    // 3. Conversiones de integridad (Enteros)
    plainData.empresa_ref = parseInt(plainData.empresa_ref) || 0;
    plainData.num_plazas = parseInt(plainData.num_plazas) || 4;

    // 4. Sincronización de campos de Adjuntos
    // adjuntos_bool -> mapea a la columna 'adjuntos' (booleano)
    // adjuntos (el input text) -> mapea a 'adjuntos_ref' (string) en el backend
    plainData.adjuntos_bool = plainData.adjuntos_bool || false;

    // 5. SOLUCIÓN ERROR 1364: Forzar campos NOT NULL ausentes en el form
    plainData.km_ini = 0.0;
    plainData.km_fin = 0.0;
    plainData.importe_espera = 0.0;

    // 6. NORMALIZACIÓN DECIMAL (Evita errores de tipo en GORM/MySQL)
    const numericFields = [
        'km_totales', 'km_nacionales', 'km_internacionales', 
        'importe_suplidos', 'importe_total', 'hora_total'
    ];

    numericFields.forEach(field => {
        const val = parseFloat(plainData[field]);
        plainData[field] = isNaN(val) ? 0.0 : val;
    });

    console.log("📤 [AUDITORÍA] Payload Final capturado para el servidor:", plainData);

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
                <span>✅ Albarán guardado correctamente</span>
            </div>`;
            if (window.lucide) lucide.createIcons();
            
            form.reset();
            // Redirección al índice tras éxito
            setTimeout(() => window.location.href = '/titulares', 1500);
        } else {
            throw new Error(result.error || "Error interno del servidor al guardar");
        }
    } catch (err) {
        console.error("❌ [ERROR ENVÍO]:", err.message);
        statusMsg.classList.remove('hidden', 'bg-green-100', 'text-green-700', 'border-green-200');
        statusMsg.classList.add('bg-red-100', 'text-red-700', 'border-red-200');
        statusMsg.innerHTML = `<span>❌ ERROR: ${err.message}</span>`;
    }
}