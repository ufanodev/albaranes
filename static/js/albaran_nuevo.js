/**
 * ARCHIVO: static/js/albaran_nuevo.js
 * DESCRIPCIÓN: Lógica para la creación de albaranes desde el panel de Titular.
 * AUDITORÍA: Logs detallados para rastreo de carga de datos y envío de formularios.
 */

document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 [AUDITORÍA] [INIT] Iniciando Formulario de Albarán Unificado");

    // 1. Cargar datos iniciales (Licencia, Empresas, Asalariados)
    await Promise.all([
        getLicenciaInfo(),
        cargarEmpresas(),
        cargarAsalariados()
    ]);

    // 2. Establecer fecha por defecto (hoy)
    document.getElementById('fecha').value = new Date().toISOString().split('T')[0];
    console.log(`[AUDITORÍA] [FECHA] Fecha inicializada: ${document.getElementById('fecha').value}`);

    // 3. Inicializar listeners para cálculos automáticos
    initCalculosKms();
    initWordCounter();
    
    lucide.createIcons();
});

/**
 * Obtiene la info de la licencia del usuario autenticado
 * CORRECCIÓN: Ruta ajustada a /api/v1/user/licencia_info según routes.go
 */
async function getLicenciaInfo() {
    console.log("[AUDITORÍA] [LICENCIA] Solicitando información de licencia...");
    try {
        const res = await fetch('/api/v1/user/licencia_info');
        if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
        
        const data = await res.json();
        if (data.licencia_numero) {
            document.getElementById('licencia').value = data.licencia_numero;
            document.getElementById('licencia').dataset.id = data.licencia_id;
            console.log(`[AUDITORÍA] [LICENCIA] Cargada con éxito: ${data.licencia_numero} (ID: ${data.licencia_id})`);
        }
    } catch (err) {
        console.error("❌ [AUDITORÍA] [LICENCIA] Error cargando licencia:", err);
    }
}

/**
 * Carga el selector de empresas disponibles
 */
async function cargarEmpresas() {
    console.log("[AUDITORÍA] [EMPRESAS] Cargando listado de empresas...");
    const select = document.getElementById('empresa');
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
        console.log(`[AUDITORÍA] [EMPRESAS] ${result.data.length} empresas cargadas.`);
    } catch (err) {
        console.error("❌ [AUDITORÍA] [EMPRESAS] Error:", err);
    }
}

/**
 * Carga el selector de conductores (Asalariados) de esa licencia
 */
async function cargarAsalariados() {
    console.log("[AUDITORÍA] [CONDUCTORES] Cargando conductores asignados...");
    const select = document.getElementById('asalariado_select');
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
        console.log(`[AUDITORÍA] [CONDUCTORES] ${result.data.length} conductores cargados.`);
    } catch (err) {
        console.error("❌ [AUDITORÍA] [CONDUCTORES] Error:", err);
    }
}

/**
 * Lógica de cálculos de Kilometraje
 */
function initCalculosKms() {
    const kmIni = document.querySelector('input[name="km_ini"]');
    const kmFin = document.querySelector('input[name="km_fin"]');
    const kmTot = document.querySelector('input[name="km_totales"]');

    const calcular = () => {
        const valIni = parseFloat(kmIni.value) || 0;
        const valFin = parseFloat(kmFin.value) || 0;
        if (valFin >= valIni) {
            kmTot.value = (valFin - valIni).toFixed(2);
            kmFin.classList.remove('border-red-500');
        } else if (valFin > 0) {
            kmFin.classList.add('border-red-500');
        }
    };

    kmIni.addEventListener('input', calcular);
    kmFin.addEventListener('input', calcular);
}

/**
 * Contador de palabras para observaciones
 */
function initWordCounter() {
    const obs = document.getElementById('observaciones');
    const count = document.getElementById('wordCount');
    if (!obs) return;
    obs.addEventListener('input', () => {
        const words = obs.value.trim().split(/\s+/).filter(w => w.length > 0).length;
        count.textContent = `${words} palabras registradas`;
    });
}

/**
 * Maneja el envío del formulario al servidor
 * CORRECCIÓN: Parseo estricto de decimales para evitar Error 1366 en MySQL
 */
async function handleAction(action, event) {
    if (event) event.preventDefault();
    
    console.log("[AUDITORÍA] [ENVÍO] Iniciando captura de formulario para INSERT...");
    
    const form = document.getElementById('albaranForm');
    const statusMsg = document.getElementById('statusMessage');
    const formData = new FormData(form);
    
    const plainData = {};
    formData.forEach((value, key) => {
        // Manejo de checkboxes para enviar booleanos reales
        if (form.querySelector(`[name="${key}"]`).type === 'checkbox') {
            plainData[key] = form.querySelector(`[name="${key}"]`).checked;
        } else {
            plainData[key] = value;
        }
    });

    // --- BLOQUE DE AUDITORÍA Y FORMATEO DE TIPOS ---
    
    // 1. Inyectar ID de Licencia desde dataset
    const licId = document.getElementById('licencia').dataset.id;
    plainData.licencia_ref = licId ? parseInt(licId) : 0;

    // 2. Parseo de IDs de relación
    plainData.empresa_ref = parseInt(plainData.empresa_ref) || 0;

    // 3. FIX DECIMALES: Asegurar 0.0 si el campo está vacío (Evita Error 1366)
    const numericFields = [
        'km_ini', 'km_fin', 'km_totales', 'km_nacionales', 
        'km_internacionales', 'importe_total', 'importe_suplidos'
    ];

    numericFields.forEach(field => {
        const originalValue = plainData[field];
        plainData[field] = parseFloat(originalValue) || 0;
        if (originalValue === "") {
            console.log(`[AUDITORÍA] [LIMPIEZA] Campo ${field} estaba vacío, normalizado a 0`);
        }
    });

    // 4. Num plazas
    plainData.num_plazas = parseInt(plainData.num_plazas) || 4;

    console.log("📤 [AUDITORÍA] [DATA] Payload final preparado:", plainData);

    try {
        const response = await fetch('/api/v1/albaranes', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(plainData)
        });

        const result = await response.json();

        if (response.ok) {
            console.log("[AUDITORÍA] [ÉXITO] Albarán guardado en servidor.");
            statusMsg.classList.remove('hidden', 'bg-red-100', 'text-red-700', 'border-red-200');
            statusMsg.classList.add('bg-green-100', 'text-green-700', 'border-green-200');
            statusMsg.innerHTML = `<span>✅ ${result.message || 'Albarán guardado'}</span>`;
            
            form.reset();
            setTimeout(() => window.location.href = '/titulares', 1500);
        } else {
            throw new Error(result.error || "Error en la persistencia de datos");
        }
    } catch (err) {
        console.error("❌ [AUDITORÍA] [ERROR] Fallo en el envío:", err.message);
        statusMsg.classList.remove('hidden', 'bg-green-100', 'text-green-700', 'border-green-200');
        statusMsg.classList.add('bg-red-100', 'text-red-700', 'border-red-200');
        statusMsg.innerHTML = `<span>❌ ERROR: ${err.message}</span>`;
    }
}