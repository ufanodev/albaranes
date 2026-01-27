/**
 * ARCHIVO: static/js/albaran_nuevo.js
 * DESCRIPCIÓN: Lógica maestra para la creación de albaranes desde el panel de Titular.
 * ACTUALIZADO: 27/01/2026 - Versión definitiva con Referencia, Horas y solución Error 1364/1366.
 */

document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 [AUDITORÍA] [INIT] Iniciando Formulario de Albarán Master Final");

    // 1. Cargar datos iniciales desde la API (Licencia y Empresas)
    await Promise.all([
        getLicenciaInfo(),
        cargarEmpresas()
    ]);

    // 2. Establecer fecha por defecto (hoy)
    const fechaInput = document.getElementById('fecha');
    if (fechaInput) {
        fechaInput.value = new Date().toISOString().split('T')[0];
    }
    
    // 3. Inicializar formateadores para campos numéricos (onBlur)
    initFormatters();
    
    // 4. Renderizar iconos de Lucide
    if (window.lucide) {
        lucide.createIcons();
    }
});

/**
 * Obtiene la información de la licencia del titular autenticado
 */
async function getLicenciaInfo() {
    try {
        const res = await fetch('/api/v1/user/licencia_info');
        if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
        
        const data = await res.json();
        if (data.licencia_numero) {
            const inputLic = document.getElementById('licencia');
            inputLic.value = data.licencia_numero;
            // Guardamos el ID real en un dataset para el envío
            inputLic.dataset.id = data.licencia_id; 
            console.log(`[AUDITORÍA] [LICENCIA] Cargada: ${data.licencia_numero} (ID: ${data.licencia_id})`);
        }
    } catch (err) {
        console.error("❌ [AUDITORÍA] [LICENCIA] Error cargando licencia:", err);
    }
}

/**
 * Carga el selector de empresas con ordenación alfabética (A-Z)
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

        // ORDENACIÓN ALFABÉTICA (A-Z)
        const empresasOrdenadas = result.data.sort((a, b) => {
            return a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });
        });

        select.innerHTML = '<option value="">-- Seleccionar Empresa --</option>';
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
 * Formatea automáticamente los decimales al salir del campo
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
                let val = parseFloat(input.value);
                if (input.value === "" || isNaN(val)) {
                    input.value = "0.00";
                } else {
                    input.value = val.toFixed(2);
                }
            });
        }
    });
}

/**
 * Lógica principal de envío al controlador Go
 */
async function handleAction(action, event) {
    if (event) event.preventDefault();
    
    console.log("[AUDITORÍA] [ENVÍO] Procesando formulario...");
    
    const form = document.getElementById('albaranForm');
    const statusMsg = document.getElementById('statusMessage');
    const formData = new FormData(form);
    const plainData = {};

    // 1. Conversión de FormData a Objeto Plano y gestión de Checkboxes
    formData.forEach((value, key) => {
        const input = form.querySelector(`[name="${key}"]`);
        if (input && input.type === 'checkbox') {
            plainData[key] = input.checked;
        } else {
            plainData[key] = value;
        }
    });

    // 2. Inyección de IDs y Metadatos
    const licId = document.getElementById('licencia').dataset.id;
    plainData.licencia_ref = licId ? parseInt(licId) : 0;
    plainData.empresa_ref = parseInt(plainData.empresa_ref) || 0;
    plainData.num_plazas = parseInt(plainData.num_plazas) || 4;

    // 3. Sincronización de Adjuntos (Backend espera 'adjuntos' para bool y 'adjuntos_ref' para texto)
    plainData.adjuntos = plainData.adjuntos_bool || false; // mapeo al bool de DB
    // Nota: plainData.adjuntos ya contiene el texto del input name="adjuntos"

    // 4. FIX ERROR 1364/1366: Asegurar que campos numéricos NOT NULL tengan valor
    plainData.km_ini = 0.0;
    plainData.km_fin = 0.0;
    plainData.importe_espera = 0.0;

    // 5. Conversión explícita a Float de campos decimales
    const numericFields = [
        'km_totales', 'km_nacionales', 'km_internacionales', 
        'importe_suplidos', 'importe_total', 'hora_total'
    ];

    numericFields.forEach(field => {
        const val = parseFloat(plainData[field]);
        plainData[field] = isNaN(val) ? 0.0 : val;
    });

    console.log("📤 [AUDITORÍA] Enviando Payload:", plainData);

    try {
        const response = await fetch('/api/v1/albaranes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(plainData)
        });

        const result = await response.json();

        if (response.ok) {
            // Feedback de éxito
            statusMsg.classList.remove('hidden', 'bg-red-100', 'text-red-700', 'border-red-200');
            statusMsg.classList.add('bg-green-100', 'text-green-700', 'border-green-200', 'p-4', 'rounded-xl');
            statusMsg.innerHTML = `<div class="flex items-center justify-center gap-2 font-bold">
                <i data-lucide="check-circle"></i>
                <span>Albarán guardado correctamente</span>
            </div>`;
            
            if (window.lucide) lucide.createIcons();
            
            form.reset();
            // Redirección al listado principal tras un breve retardo
            setTimeout(() => window.location.href = '/titulares', 1500);
        } else {
            throw new Error(result.error || "Error al procesar el albarán");
        }
    } catch (err) {
        console.error("❌ [ERROR ENVÍO]:", err.message);
        statusMsg.classList.remove('hidden', 'bg-green-100', 'text-green-700', 'border-green-200');
        statusMsg.classList.add('bg-red-100', 'text-red-700', 'border-red-200', 'p-4', 'rounded-xl');
        statusMsg.innerHTML = `<span class="font-bold">❌ ERROR: ${err.message}</span>`;
    }
}