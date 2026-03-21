/**
 * ARCHIVO: static/js/admin_albaran_nuevo.js
 * DESCRIPCIÓN: Inserción rápida para Administrador con valores por defecto para SQL.
 * ACTUALIZADO: 21/03/2026 - FIX: Prevención de errores de tipo en campos obligatorios.
 */

document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 [ADMIN] Motor de Inserción blindado iniciado");

    await Promise.all([cargarLicencias(), cargarEmpresas()]);

    // Establecer fecha de hoy por defecto
    const fechaInput = document.getElementById('fecha');
    if (fechaInput) {
        fechaInput.value = new Date().toISOString().split('T')[0];
    }

    initCalculosKms();
    document.getElementById('albaranForm')?.addEventListener('submit', handleInsertMaestro);
    
    if (window.lucide) lucide.createIcons();
});

async function cargarLicencias() {
    const select = document.getElementById('licencia_ref');
    if (!select) return;
    try {
        const res = await fetch('/api/v1/licencias', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const result = await res.json();
        const list = result.data || result;
        select.innerHTML = '<option value="0" disabled selected>-- SELECCIONAR LICENCIA --</option>';
        list.sort((a,b) => String(a.licencia).localeCompare(String(b.licencia), undefined, {numeric:true})).forEach(l => {
            select.innerHTML += `<option value="${l.id}">LICENCIA: ${l.licencia}</option>`;
        });
    } catch (err) { console.error("❌ Error licencias:", err); }
}

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

async function handleInsertMaestro(event) {
    event.preventDefault();
    const statusMsg = document.getElementById('statusMessage');
    const form = event.target;
    const formData = new FormData(form);
    const data = {};

    // 1. PROCESAMIENTO CON VALORES POR DEFECTO PARA SQL
    formData.forEach((value, key) => {
        const input = form.querySelector(`[name="${key}"]`);
        const valStr = value.toString().trim();

        if (input.type === 'checkbox') {
            data[key] = input.checked;
        } 
        else if (input.type === 'number') {
            // ✅ Para SQL Decimal/Int: si está vacío va a 0 (evita el error '-')
            data[key] = valStr === "" ? 0 : parseFloat(valStr);
        } 
        else if (input.type === 'time') {
            // ✅ Para SQL Time: si está vacío va a null (Go parseTimePtr lo ignora)
            data[key] = valStr === "" ? null : valStr;
        }
        else {
            // ✅ Para SQL String: si está vacío va a "-"
            data[key] = valStr === "" ? "-" : valStr;
        }
    });

    // 2. MAPEADO DE CAMPOS ESPECIALES Y FORZADO DE TIPOS
    // HTML 'nombre_pasajero' -> Backend 'cliente'
    data.cliente = data.nombre_pasajero || "-";
    delete data.nombre_pasajero;

    // Asegurar IDs numéricos
    data.licencia_ref = parseInt(document.getElementById('licencia_ref').value) || 0;
    data.empresa_ref = parseInt(document.getElementById('empresa_ref').value) || 0;
    
    // Otros valores técnicos
    data.num_plazas = parseInt(data.num_plazas) || 4;
    data.finalizado = true; // Por ser admin

    console.log("📤 [DEBUG] Payload Final a enviar:", data);

    // Validación de campos mínimos requeridos en el front
    if (data.licencia_ref === 0 || data.empresa_ref === 0 || data.numero_albaran === "-") {
        showUIStatus("⚠️ Mínimo requerido: Licencia, Empresa y Nº Albarán.", "error");
        return;
    }

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
            showUIStatus("✅ ALBARÁN GUARDADO CON ÉXITO", "success");
            setTimeout(() => window.location.href = '/admin', 1500);
        } else {
            throw new Error(result.error || "Error al procesar en el servidor");
        }
    } catch (err) {
        console.error("❌ Error en POST:", err);
        showUIStatus(`❌ FALLO: ${err.message}`, "error");
    }
}

function showUIStatus(msg, type) {
    const el = document.getElementById('statusMessage');
    if (!el) return;
    el.className = `mt-8 p-5 rounded-2xl text-center font-black w-full max-w-2xl border-2 uppercase text-xs tracking-widest block shadow-lg ${
        type === 'success' ? 'bg-green-100 text-green-700 border-green-500' : 'bg-red-100 text-red-700 border-red-500'
    }`;
    el.textContent = msg;
    el.classList.remove('hidden');
}

function initCalculosKms() {
    const v1 = document.querySelector('input[name="km_ini"]');
    const v2 = document.querySelector('input[name="km_fin"]');
    const tot = document.querySelector('input[name="km_totales"]');
    const calc = () => { 
        if (v1 && v2 && tot) {
            const val1 = parseFloat(v1.value) || 0;
            const val2 = parseFloat(v2.value) || 0;
            tot.value = Math.max(0, (val2 - val1)).toFixed(2); 
        }
    };
    v1?.addEventListener('input', calc); 
    v2?.addEventListener('input', calc);
}