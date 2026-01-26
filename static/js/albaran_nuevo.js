/**
 * ARCHIVO: static/js/albaran_nuevo.js
 * DESCRIPCIÓN: Lógica para la creación de albaranes desde el panel de Titular.
 * ADAPTACIÓN: Compatible con Master Plantilla Final (Importes, Teléfono, Origen/Parada y Kms).
 */

document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 [AUDITORÍA] [INIT] Iniciando Formulario de Albarán Master Final");

    // 1. Cargar datos iniciales desde la API (Combos y Licencia)
    await Promise.all([
        getLicenciaInfo(),
        cargarEmpresas(),
        cargarAsalariados()
    ]);

    // 2. Establecer fecha por defecto (hoy)
    const fechaInput = document.getElementById('fecha');
    if (fechaInput) {
        fechaInput.value = new Date().toISOString().split('T')[0];
    }
    
    // 3. Inicializar utilidades y validadores
    initWordCounter();
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
            inputLic.dataset.id = data.licencia_id; // Fundamental para la relación en DB
            console.log(`[AUDITORÍA] [LICENCIA] Cargada con éxito: ${data.licencia_numero}`);
        }
    } catch (err) {
        console.error("❌ [AUDITORÍA] [LICENCIA] Error cargando licencia:", err);
    }
}

/**
 * Carga el selector de empresas disponibles
 */
async function cargarEmpresas() {
    const select = document.getElementById('empresa');
    if (!select) return;
    try {
        const res = await fetch('/api/v1/empresas');
        const result = await res.json();
        
        select.innerHTML = '<option value="">-- Seleccionar Empresa --</option>';
        result.data.forEach(emp => {
            const opt = document.createElement('option');
            opt.value = emp.id;
            opt.textContent = emp.nombre;
            select.appendChild(opt);
        });
    } catch (err) {
        console.error("❌ [AUDITORÍA] [EMPRESAS] Error:", err);
    }
}

/**
 * Carga el selector de conductores asignados a la licencia
 */
async function cargarAsalariados() {
    const select = document.getElementById('asalariado_select');
    if (!select) return;
    try {
        const res = await fetch('/api/v1/conductores/mis-conductores');
        const result = await res.json();
        
        select.innerHTML = '<option value="">-- Conductor Titular --</option>';
        result.data.forEach(con => {
            const opt = document.createElement('option');
            opt.value = con.nombre;
            opt.textContent = con.nombre;
            select.appendChild(opt);
        });
    } catch (err) {
        console.error("❌ [AUDITORÍA] [CONDUCTORES] Error:", err);
    }
}

/**
 * Contador de palabras para el campo observaciones (obligatorio para desglose)
 */
function initWordCounter() {
    const obs = document.getElementById('observaciones');
    const display = document.getElementById('wordCount');
    if (!obs || !display) return;

    obs.addEventListener('input', () => {
        const words = obs.value.trim().split(/\s+/).filter(w => w.length > 0).length;
        display.textContent = `${words} palabras registradas`;
        
        // Efecto visual si hay contenido
        if (words > 0) display.classList.add('text-primary-link');
        else display.classList.remove('text-primary-link');
    });
}

/**
 * Asegura que los campos numéricos no queden vacíos al perder el foco
 */
function initFormatters() {
    const numFields = ['importe_espera', 'importe_suplidos', 'importe_total', 'km_totales', 'km_nacionales', 'km_internacionales'];
    numFields.forEach(name => {
        const input = document.querySelector(`input[name="${name}"]`);
        if (input) {
            input.addEventListener('blur', () => {
                if (input.value === "") input.value = "0.00";
                else input.value = parseFloat(input.value).toFixed(2);
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

    // 1. Mapeo de datos y conversión de Checkboxes a Booleano
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

    // 3. Conversiones de tipo (IDs y Enteros)
    plainData.empresa_ref = parseInt(plainData.empresa_ref) || 0;
    plainData.num_plazas = parseInt(plainData.num_plazas) || 4;

    // 4. FIX DECIMALES (Normalización estricta para MySQL Decimal)
    const numericFields = [
        'km_totales', 'km_nacionales', 'km_internacionales', 
        'importe_espera', 'importe_suplidos', 'importe_total'
    ];

    numericFields.forEach(field => {
        // Si el campo está vacío o no es un número, se envía 0.00
        const val = parseFloat(plainData[field]);
        plainData[field] = isNaN(val) ? 0.0 : val;
    });

    console.log("📤 [AUDITORÍA] Enviando Payload Final:", plainData);

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
                <span>${result.message || '✅ Albarán guardado con éxito'}</span>
            </div>`;
            lucide.createIcons();
            
            form.reset();
            // Redirección al panel principal tras pausa breve
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