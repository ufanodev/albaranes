/**
 * ARCHIVO: static/js/albaran_update.js
 * DESCRIPCIÓN: Lógica para titulares: Carga secuencial y actualización de albaranes.
 * FIX: Solución de Race Condition en selectores y normalización de empresa_ref.
 * ACTUALIZADO: 27/01/2026
 */

document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 [AUDITORÍA] [INIT] Iniciando motor de edición de albarán...");

    // 1. Obtención del ID desde la URL (/titulares/update/74)
    const segments = window.location.pathname.split('/').filter(p => p !== "");
    const albaranId = segments[segments.length - 1];

    if (!albaranId || isNaN(albaranId)) {
        console.error("❌ [AUDITORÍA] ID no válido detectado en URL:", albaranId);
        showStatus("Error: No se pudo identificar el albarán.", "error");
        return;
    }

    try {
        // 2. CARGA SECUENCIAL (Protocolo de Seguridad)
        // Primero poblamos el selector de empresas y esperamos su resolución completa
        await cargarEmpresas();
        
        // 3. Pequeño delay técnico (50ms) para asegurar que el DOM ha renderizado las opciones
        setTimeout(async () => {
            await loadAlbaranToEdit(albaranId);
        }, 50);

    } catch (err) {
        console.error("❌ [AUDITORÍA] Error en el flujo de inicialización:", err);
    }

    // 4. Inicializar componentes visuales y formateadores
    if (window.lucide) lucide.createIcons();
    initFormatters();
    
    // 5. Listener de envío
    document.getElementById('albaranForm')?.addEventListener('submit', handleFormSubmit);
});

/**
 * Carga el selector de empresas con ordenación alfabética
 */
async function cargarEmpresas() {
    console.log("🔍 [AUDITORÍA] [EMPRESAS] Cargando catálogo...");
    const select = document.getElementById('empresa');
    if (!select) return;

    try {
        const res = await fetch('/api/v1/empresas');
        const result = await res.json();
        
        const empresas = (result.data || []).sort((a, b) => 
            a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })
        );

        select.innerHTML = '<option value="">-- Seleccionar Empresa --</option>';
        empresas.forEach(emp => {
            const opt = document.createElement('option');
            opt.value = emp.id;
            opt.textContent = emp.nombre.toUpperCase();
            select.appendChild(opt);
        });
        console.log("✅ [AUDITORÍA] [EMPRESAS] Selector poblado correctamente.");
    } catch (e) {
        console.error("❌ [AUDITORÍA] [EMPRESAS] Fallo al cargar:", e);
    }
}

/**
 * Obtiene los datos del albarán y rellena el formulario con validación de opciones
 */
async function loadAlbaranToEdit(id) {
    console.log(`🔍 [AUDITORÍA] [LOAD] Recuperando datos del Albarán ID: ${id}`);
    try {
        const res = await fetch(`/api/v1/albaranes/id/${id}`);
        if (!res.ok) throw new Error("Albarán no encontrado en el servidor");
        
        const { data } = await res.json();
        console.log("📦 [AUDITORÍA] [LOAD] Datos íntegros recibidos:", data);

        // Helper para rellenar campos estándar
        const fill = (id, val) => { 
            const el = document.getElementById(id);
            if(el) el.value = (val !== null && val !== undefined) ? val : ''; 
        };

        const fmtT = (t) => t ? (t.includes('T') ? t.split('T')[1].substring(0,5) : t.substring(0,5)) : '';

        // --- BLOQUE 1: IDENTIFICACIÓN ---
        fill('albaran_id', data.id);
        fill('licencia', data.licencia);
        fill('n_albaran', data.numero_albaran);
        fill('referencia', data.referencia);
        fill('fecha', data.fecha ? data.fecha.split('T')[0] : '');
        fill('hora_ini', fmtT(data.hora_ini));
        fill('hora_fin', fmtT(data.hora_fin));

        // --- BLOQUE 2: CLIENTE (Validación de existencia en Select) ---
        const empSelect = document.getElementById('empresa');
        if (empSelect) {
            const empresaIdStr = String(data.empresa_ref);
            const existeOpcion = Array.from(empSelect.options).some(opt => opt.value === empresaIdStr);
            
            if (existeOpcion) {
                empSelect.value = empresaIdStr;
                console.log(`🏢 [AUDITORÍA] [EMPRESA] ID ${empresaIdStr} asignado exitosamente.`);
            } else {
                console.warn(`⚠️ [AUDITORÍA] [EMPRESA] El ID ${empresaIdStr} no figura en la lista de empresas activas.`);
            }
        }

        fill('nombre_pasajero', data.nombre_pasajero);
        fill('tlf_pasajero', data.tlf_pasajero);
        fill('dni_pasajero', data.dni_pasajero);
        fill('matricula', data.matricula);

        // --- BLOQUE 3: RUTA ---
        fill('origen', data.origen);
        fill('parada', data.parada);
        fill('destino', data.destino);
        fill('hora_total', parseFloat(data.hora_total || 0).toFixed(2));
        fill('espera_ini', fmtT(data.espera_ini));
        fill('espera_fin', fmtT(data.espera_fin));

        // --- BLOQUE 4: KILOMETRAJE ---
        const check = (id, val) => { const el = document.getElementById(id); if (el) el.checked = !!val; };
        check('urbano', data.urbano);
        check('diurno', data.diurno);
        check('noct_fest', data.noct_fest);
        check('remolque', data.remolque);

        fill('km_totales', parseFloat(data.km_totales || 0).toFixed(2));
        fill('km_nacionales', parseFloat(data.km_nacionales || 0).toFixed(2));
        fill('km_internacionales', parseFloat(data.km_internacionales || 0).toFixed(2));

        // --- BLOQUE 5: LIQUIDACIÓN ---
        fill('importe_suplidos', parseFloat(data.importe_suplidos || 0).toFixed(2));
        fill('autorizado_por', data.autorizado_por);
        fill('asalariado', data.asalariado);
        fill('num_plazas', data.num_plazas);
        fill('adjuntos_ref', data.adjuntos_ref);
        fill('observaciones', data.observaciones);
        fill('importe_total', parseFloat(data.importe_total || 0).toFixed(2));

        if (document.getElementById('adjuntos_bool')) {
            document.getElementById('adjuntos_bool').checked = !!data.adjuntos;
        }

    } catch (e) { 
        console.error("❌ [AUDITORÍA] [LOAD] Error:", e); 
        showStatus("Error al cargar los datos del registro.", "error");
    }
}

/**
 * Maneja el envío del formulario con normalización de tipos para el Backend
 */
async function handleFormSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('albaran_id')?.value;
    const form = e.target;
    const formData = new FormData(form);
    const payload = {};

    // 1. Mapeo de campos y Checkboxes
    formData.forEach((v, k) => {
        const input = form.querySelector(`[name="${k}"]`);
        payload[k] = (input && input.type === 'checkbox') ? input.checked : v;
    });

    // 2. NORMALIZACIÓN CRÍTICA (Evita rechazos en Go/GORM)
    payload.empresa_ref = parseInt(document.getElementById('empresa').value) || 0;
    payload.num_plazas = parseInt(payload.num_plazas) || 4;
    
    const floatFields = ['km_totales', 'importe_total', 'importe_suplidos', 'hora_total', 'km_nacionales', 'km_internacionales'];
    floatFields.forEach(f => {
        payload[f] = parseFloat(payload[f]) || 0.0;
    });

    // Sincronizar campo booleano de adjuntos
    payload.adjuntos = payload.adjuntos_bool || false;

    try {
        console.log("📤 [AUDITORÍA] [PUT] Enviando actualización...", payload);
        const res = await fetch(`/api/v1/albaranes/user/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            showStatus("✅ Albarán actualizado correctamente.", "success");
            setTimeout(() => window.location.href = '/titulares/pendientes', 1200);
        } else {
            const errData = await res.json();
            throw new Error(errData.error || "Error en la actualización");
        }
    } catch (e) { 
        console.error("❌ [AUDITORÍA] [PUT] Fallo:", e);
        showStatus(e.message, "error"); 
    }
}

/**
 * Feedback visual para el usuario
 */
function showStatus(msg, type) {
    const el = document.getElementById('statusMessage');
    if (!el) return;
    el.className = `mt-6 p-4 rounded-xl text-center font-bold w-full max-w-md border-2 ${
        type === 'success' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'
    }`;
    el.textContent = msg;
    el.classList.remove('hidden');
}

/**
 * Formateo de decimales onBlur
 */
function initFormatters() {
    const fields = ['importe_total', 'importe_suplidos', 'km_totales', 'hora_total'];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('blur', () => {
                if (el.value) el.value = parseFloat(el.value).toFixed(2);
            });
        }
    });
}