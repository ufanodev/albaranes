/**
 * ARCHIVO: static/js/admin_albaran_nuevo.js
 * DESCRIPCIÓN: Lógica de inserción administrativa rápida con soporte para facturación.
 * ACTUALIZADO: 23/04/2026 - REFACTOR: Soporte para bloque de facturación y liquidación.
 */

document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 [ADMIN-MAESTRO] Motor de Inserción blindado iniciado");

    // 1. Carga de Catálogos
    await Promise.all([cargarLicencias(), cargarEmpresas()]);

    // 2. Fecha de hoy por defecto (Local España)
    const fechaInput = document.getElementById('fecha');
    if (fechaInput) {
        const hoy = new Date();
        const offset = hoy.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(hoy - offset)).toISOString().split('T')[0];
        fechaInput.value = localISOTime;
    }

    // 3. Inicializar Lógicas de cálculo y eventos
    initCalculosKms();
    initFormattersEspera();
    
    // El listener del formulario
    document.getElementById('albaranForm')?.addEventListener('submit', handleInsertMaestro);
    
    if (window.lucide) lucide.createIcons();
});

/**
 * Carga todas las licencias del sistema para el administrador
 */
async function cargarLicencias() {
    const select = document.getElementById('licencia_ref');
    if (!select) return;
    try {
        const res = await fetch('/api/v1/licencias', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const result = await res.json();
        const list = result.data || result;
        select.innerHTML = '<option value="0" disabled selected>-- LICENCIA TITULAR --</option>';
        list.sort((a,b) => String(a.licencia).localeCompare(String(b.licencia), undefined, {numeric:true})).forEach(l => {
            select.innerHTML += `<option value="${l.id}">LICENCIA: ${l.licencia}</option>`;
        });
    } catch (err) { console.error("❌ Error licencias:", err); }
}

/**
 * Carga todas las empresas clientes
 */
async function cargarEmpresas() {
    const select = document.getElementById('empresa_ref');
    if (!select) return;
    try {
        const res = await fetch('/api/v1/empresas', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const result = await res.json();
        const list = result.data || result;
        select.innerHTML = '<option value="0" disabled selected>-- SELECCIONAR EMPRESA --</option>';
        list.sort((a, b) => a.nombre.localeCompare(b.nombre)).forEach(e => {
            select.innerHTML += `<option value="${e.id}">${e.nombre.toUpperCase()}</option>`;
        });
    } catch (err) { console.error("❌ Error empresas:", err); }
}

/**
 * Procesa el envío del albarán con rol de administrador
 */
async function handleInsertMaestro(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const data = {};

    // 1. PROCESAMIENTO DINÁMICO DE CAMPOS
    formData.forEach((value, key) => {
        const input = form.querySelector(`[name="${key}"]`);
        if (!input) return;
        
        const valStr = value.toString().trim();

        if (input.type === 'checkbox') {
            data[key] = input.checked;
        } 
        else if (input.type === 'number') {
            data[key] = valStr === "" ? 0 : parseFloat(valStr);
        } 
        else if (input.type === 'time') {
            data[key] = valStr === "" ? null : valStr;
        }
        else {
            data[key] = valStr === "" ? "-" : valStr;
        }
    });

    // 2. MAPEADO DE LÓGICA DE NEGOCIO
    data.cliente = data.nombre_pasajero || "-";
    delete data.nombre_pasajero;

    // Asegurar IDs numéricos desde los selects
    data.licencia_ref = parseInt(document.getElementById('licencia_ref').value) || 0;
    data.empresa_ref = parseInt(document.getElementById('empresa_ref').value) || 0;
    
    // Manejo especial de adjuntos (Checkbox + Ref)
    data.adjuntos_ref = data.adjuntos || "";
    data.adjuntos = !!data.adjuntos_bool; // Boolean real
    delete data.adjuntos_bool;

    // Forzado de tipos técnicos
    data.num_plazas = parseInt(data.num_plazas) || 4;
    
    // Validación mínima
    if (data.licencia_ref === 0 || data.empresa_ref === 0 || data.numero_albaran === "-") {
        showUIStatus("⚠️ Mínimo requerido: Licencia, Empresa y Nº Albarán.", "error");
        return;
    }

    console.log("📤 [DEBUG] Enviando Albarán Maestro:", data);

    try {
        const res = await fetch('/api/v1/albaranes', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}` 
            },
            body: JSON.stringify(data)
        });

        const result = await res.json();

        if (res.ok) {
            showUIStatus("✅ ALBARÁN MAESTRO GUARDADO CON ÉXITO", "success");
            setTimeout(() => window.location.href = '/admin', 1500);
        } else {
            throw new Error(result.error || "Error al procesar en el servidor");
        }
    } catch (err) {
        console.error("❌ Error en POST:", err);
        showUIStatus(`❌ FALLO: ${err.message}`, "error");
    }
}

/**
 * Muestra mensajes de estado en la interfaz
 */
function showUIStatus(msg, type) {
    const el = document.getElementById('statusMessage');
    if (!el) return;
    el.className = `mt-8 p-5 rounded-2xl text-center font-black w-full max-w-2xl border-2 uppercase text-xs tracking-widest block shadow-lg ${
        type === 'success' ? 'bg-green-100 text-green-700 border-green-500' : 'bg-red-100 text-red-700 border-red-500'
    }`;
    el.textContent = msg;
    el.classList.remove('hidden');
}

/**
 * Lógica de autocalculado de KMS
 */
function initCalculosKms() {
    const v1 = document.querySelector('input[name="km_ini"]');
    const v2 = document.querySelector('input[name="km_fin"]');
    const tot = document.querySelector('input[name="km_totales"]');
    
    const calc = () => { 
        if (v1 && v2 && tot) {
            const val1 = parseFloat(v1.value) || 0;
            const val2 = parseFloat(v2.value) || 0;
            if (val2 > 0) {
                tot.value = Math.max(0, (val2 - val1)).toFixed(2);
            }
        }
    };
    
    v1?.addEventListener('input', calc); 
    v2?.addEventListener('input', calc);
}

/**
 * Formateador para el campo de espera (decimal/HH.mm)
 */
function initFormattersEspera() {
    const horaTotal = document.querySelector('input[name="hora_total"]');
    if (horaTotal) {
        horaTotal.addEventListener('blur', () => {
            let val = parseFloat(horaTotal.value.replace(',', '.')) || 0;
            // Aseguramos formato decimal de dos puntos
            horaTotal.value = val.toFixed(2);
        });
    }
}