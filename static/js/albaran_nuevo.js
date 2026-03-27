/**
 * ARCHIVO: static/js/albaran_nuevo.js
 * DESCRIPCIÓN: Lógica maestra para la creación de albaranes.
 * ACTUALIZADO: 27/03/2026 - FIX FINAL: Protección parseFloat para 0.35 y Pop-up ERROR.
 */

document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 [INIT] Formulario de Albarán iniciado.");

    // 1. Carga de datos iniciales
    await Promise.all([
        getLicenciaInfo(),
        cargarEmpresas()
    ]);

    // 2. Fecha de hoy por defecto
    const fechaInput = document.getElementById('fecha');
    if (fechaInput) {
        fechaInput.value = new Date().toISOString().split('T')[0];
    }
    
    // 3. Inicializar formateadores visuales
    initFormatters();
    
    if (window.lucide) lucide.createIcons();
});

/**
 * Función para limpiar y mostrar el Pop-up de ERROR descriptivo
 */
function handleDatabaseError(rawError) {
    let msg = typeof rawError === 'object' ? (rawError.error || rawError.message) : String(rawError);
    
    // Limpieza de rutas técnicas del backend
    const errorIndex = msg.indexOf("Error ");
    if (errorIndex !== -1) {
        msg = msg.substring(errorIndex);
    }

    // Traducción para errores de Duplicado (MySQL 1062)
    if (msg.includes("Duplicate entry") || msg.includes("1062")) {
        const match = msg.match(/'([^']+)'/);
        const valorConflictivo = match ? match[1] : "desconocido";
        msg = `El Nº de Albarán o Referencia '${valorConflictivo}' ya está registrado.\n\nPor favor, usa un número diferente.`;
    }

    // DISPARO DEL POP-UP
    alert(`❌ ERROR\n\n${msg}`);
    return msg;
}

/**
 * Recupera la información de la licencia del titular
 */
async function getLicenciaInfo() {
    try {
        const res = await fetch('/api/v1/user/licencia_info');
        const data = await res.json();
        if (data.licencia_id) {
            const inputLic = document.getElementById('licencia');
            inputLic.value = data.licencia_numero || "";
            inputLic.dataset.id = data.licencia_id; 
            console.log("✅ Licencia cargada:", data.licencia_numero);
        }
    } catch (err) {
        console.error("❌ Error cargando licencia:", err);
    }
}

/**
 * Carga el catálogo de empresas
 */
async function cargarEmpresas() {
    const select = document.getElementById('empresa');
    if (!select) return;
    try {
        const res = await fetch('/api/v1/empresas');
        const result = await res.json();
        const data = result.data || result;
        if (!Array.isArray(data)) return;

        const ordenadas = data.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

        select.innerHTML = '<option value="">-- Seleccionar Empresa --</option>';
        ordenadas.forEach(emp => {
            const opt = document.createElement('option');
            opt.value = emp.id;
            opt.textContent = emp.nombre.toUpperCase();
            select.appendChild(opt);
        });
    } catch (err) {
        console.error("❌ Error cargando empresas:", err);
    }
}

/**
 * Formatea decimales y valida la lógica sexagesimal (.59 máx)
 */
function initFormatters() {
    const numFields = ['importe_suplidos', 'importe_total', 'km_totales', 'km_nacionales', 'km_internacionales', 'hora_total'];
    
    numFields.forEach(name => {
        const input = document.querySelector(`input[name="${name}"]`);
        if (input) {
            input.addEventListener('blur', () => {
                let cleanVal = input.value.replace(',', '.');
                let val = parseFloat(cleanVal);
                
                if (cleanVal === "" || isNaN(val)) {
                    input.value = "0.00";
                    return;
                }

                // Lógica Sexagesimal para Espera Total
                if (name === 'hora_total') {
                    let horas = Math.floor(val);
                    let minutos = Math.round((val - horas) * 100);
                    if (minutos > 59) minutos = 59;
                    const minStr = minutos < 10 ? "0" + minutos : minutos;
                    input.value = `${horas}.${minStr}`;
                } else {
                    input.value = val.toFixed(2);
                }
            });
        }
    });
}

/**
 * Procesa y envía el formulario al Backend Go
 */
async function handleAction(action, event) {
    if (event) event.preventDefault();
    
    const form = document.getElementById('albaranForm');
    const statusMsg = document.getElementById('statusMessage');
    const formData = new FormData(form);
    const plainData = {};

    // 1. Recolección de datos
    formData.forEach((value, key) => {
        const input = form.querySelector(`[name="${key}"]`);
        if (input && input.type === 'checkbox') {
            plainData[key] = input.checked;
        } else {
            plainData[key] = value;
        }
    });

    // 2. MAPEOS OBLIGATORIOS PARA BACKEND GO
    plainData.cliente = plainData.nombre_pasajero || "";
    delete plainData.nombre_pasajero;
    delete plainData.NombrePasajero;

    plainData.adjuntos_ref = plainData.adjuntos || "";
    plainData.adjuntos = plainData.adjuntos_bool || false;
    delete plainData.adjuntos_bool;

    const licId = document.getElementById('licencia').dataset.id;
    plainData.licencia_ref = parseInt(licId) || 0;
    plainData.empresa_ref = parseInt(plainData.empresa_ref) || 0;
    plainData.num_plazas = parseInt(plainData.num_plazas) || 4;

    // 3. CONVERSIÓN SEGURA DE NÚMEROS (Protección 0.35)
    
    // Campos decimales estándar
    const decimalFields = ['km_totales', 'km_nacionales', 'km_internacionales', 'importe_suplidos', 'importe_total'];
    decimalFields.forEach(field => {
        let raw = String(plainData[field] ?? '').replace(',', '.');
        plainData[field] = parseFloat(raw) || 0.0;
    });

    // Campo Sexagesimal Protegido (hora_total)
    // Ya formateado por initFormatters como "0.35", solo limpiamos comas
    const horaRaw = String(plainData['hora_total'] ?? '0').replace(',', '.');
    plainData['hora_total'] = parseFloat(horaRaw) || 0.0;

    // Prevención de errores NOT NULL
    plainData.km_ini = 0.0;
    plainData.km_fin = 0.0;
    plainData.importe_espera = 0.0;

    // 4. Limpieza de tiempos vacíos
    ['hora_fin', 'espera_ini', 'espera_fin'].forEach(f => {
        if (!plainData[f]) delete plainData[f];
    });

    console.log("📝 Payload Final Enviado:", plainData);

    try {
        const response = await fetch('/api/v1/albaranes', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(plainData)
        });

        let result;
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            result = await response.json();
        } else {
            const rawText = await response.text();
            result = { error: rawText };
        }

        if (response.ok) {
            statusMsg.className = "mt-6 p-4 rounded-xl text-center font-bold w-full max-w-md border-2 bg-green-100 text-green-700 border-green-200";
            statusMsg.innerHTML = `ALBARÁN REGISTRADO CON ÉXITO`;
            statusMsg.classList.remove('hidden');
            
            form.reset();
            setTimeout(() => window.location.href = '/titulares', 1500);
        } else {
            // DISPARO DEL POP-UP DE ERROR
            console.error("🔥 Error de servidor:", result.error);
            const cleanMsg = handleDatabaseError(result.error);
            
            statusMsg.className = "mt-6 p-4 rounded-xl text-center font-bold w-full max-w-md border-2 bg-red-100 text-red-700 border-red-200";
            statusMsg.innerHTML = `❌ ERROR: ${cleanMsg.split('\n')[0]}`;
            statusMsg.classList.remove('hidden');
        }
    } catch (err) {
        console.error("🌐 Error de red:", err);
        alert("❌ ERROR DE CONEXIÓN\n\nNo se pudo contactar con el servidor local.");
    }
}