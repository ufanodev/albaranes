/**
 * ARCHIVO: static/js/albaran_update.js
 * DESCRIPCIÓN: Gestión integral de carga y actualización de albaranes (Panel Titular).
 * FIX: Sincronización estricta de IDs para Empresa (Evita salto a opción por defecto).
 */

let albaranID = null;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Extraer ID de la URL
    const pathParts = window.location.pathname.split('/');
    albaranID = pathParts[pathParts.length - 1];

    if (!albaranID || isNaN(albaranID)) {
        showStatus("❌ ID de albarán no detectado.", "error");
        return;
    }

    console.log(`🚀 [UPDATE] Iniciando edición para ID: ${albaranID}`);

    try {
        // 2. CARGA PREVIA DE CATÁLOGOS (Bloqueante)
        // Necesitamos que el select de empresas esté lleno ANTES de procesar los datos del albarán.
        await Promise.all([
            loadEmpresas(),
            loadConductores()
        ]);

        // 3. CARGA DE DATOS DEL ALBARÁN
        await loadAlbaranToEdit(albaranID);
        
    } catch (err) {
        console.error("❌ Error en la inicialización:", err);
        showStatus("🛑 Error crítico al cargar el formulario.", "error");
    }
    
    setupWordCounter();
    if (window.lucide) lucide.createIcons();
});

// --- FUNCIONES DE CARGA DE SELECTS ---

async function loadEmpresas() {
    const select = document.getElementById('empresa');
    if (!select) return;
    try {
        const res = await fetch('/api/v1/empresas');
        const json = await res.json();
        select.innerHTML = '<option value="">Seleccione empresa</option>';
        (json.data || []).forEach(emp => {
            const opt = document.createElement('option');
            opt.value = emp.id; // Importante: ID numérico
            opt.textContent = emp.nombre;
            select.appendChild(opt);
        });
    } catch (e) { console.error("Error empresas:", e); }
}

async function loadConductores() {
    const select = document.getElementById('asalariado_select');
    if (!select) return;
    try {
        const res = await fetch('/api/v1/conductores/mis-conductores');
        const json = await res.json();
        select.innerHTML = '<option value="">-- Conductor Titular --</option>';
        (json.data || []).forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.nombre; 
            opt.textContent = c.nombre;
            select.appendChild(opt);
        });
    } catch (e) { console.error("Error conductores:", e); }
}

// --- CARGA DEL REGISTRO ESPECÍFICO ---

async function loadAlbaranToEdit(id) {
    try {
        // Intentamos la ruta que tienes configurada en routes.go
        const response = await fetch(`/api/v1/albaranes/id/${id}`);
        
        if (!response.ok) throw new Error(`Error ${response.status}: Registro no encontrado.`);

        const result = await response.json();
        const data = result.data;

        if (!data) throw new Error("No hay datos disponibles.");

        // POBLADO MANUAL (Respetando IDs de la Plantilla Master)
        
        // 1. Identificadores y Cabecera
        document.getElementById('albaran_id').value = data.id;
        if (document.getElementById('header_num')) {
            document.getElementById('header_num').textContent = `#${data.numero_albaran}`;
        }

        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val || '';
        };

        // 2. Campos de Texto y Fecha
        setVal('licencia', data.licencia);
        setVal('n_albaran', data.numero_albaran);
        setVal('fecha', data.fecha ? data.fecha.split('T')[0] : '');
        setVal('nombre_pasajero', data.cliente);
        setVal('tlf_pasajero', data.tlf_pasajero);
        setVal('dni_pasajero', data.dni_pasajero);
        setVal('matricula', data.matricula);
        setVal('origen', data.origen);
        setVal('destino', data.destino);
        setVal('parada', data.parada);
        setVal('autorizado_por', data.autorizado_por);
        setVal('observaciones', data.observaciones);

        // 3. SINCRONIZACIÓN DE SELECTS (Punto crítico)
        // Forzamos la conversión a String para asegurar el match con el value del option
        if (data.empresa_ref) {
            document.getElementById('empresa').value = String(data.empresa_ref);
            console.log(`[DEBUG] Seleccionada Empresa ID: ${data.empresa_ref}`);
        }
        if (data.asalariado) {
            document.getElementById('asalariado_select').value = data.asalariado;
        }

        // 4. Formateo de Tiempos
        const formatH = (iso) => iso ? new Date(iso).toLocaleTimeString('es-ES', {hour: '2-digit', minute:'2-digit', hour12: false}) : '';
        setVal('hora_ini', formatH(data.hora_ini));
        setVal('hora_fin', formatH(data.hora_fin));
        setVal('espera_ini', formatH(data.espera_ini));
        setVal('espera_fin', formatH(data.espera_fin));

        // 5. Valores Numéricos
        setVal('km_nacionales', data.km_nacionales);
        setVal('km_internacionales', data.km_internacionales);
        setVal('km_totales', data.km_totales);
        setVal('importe_espera', data.importe_espera);
        setVal('importe_suplidos', data.importe_suplidos);
        setVal('importe_total', data.importe_total);

        // 6. Checkboxes
        const setCheck = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.checked = !!val;
        };
        setCheck('urbano', data.urbano);
        setCheck('remolque', data.remolque);
        setCheck('noct_fest', data.noct_fest);
        setCheck('adjuntos', data.adjuntos);

    } catch (err) {
        console.error("❌ Fallo al cargar:", err);
        showStatus(err.message, "error");
    }
}

// --- ENVÍO DE ACTUALIZACIÓN (PUT) ---

document.getElementById('albaranForm').onsubmit = async (event) => {
    event.preventDefault();
    const statusMsg = document.getElementById('statusMessage');
    const formData = new FormData(event.target);
    const payload = {};

    formData.forEach((value, key) => {
        const el = event.target.querySelector(`[name="${key}"]`);
        if (el && el.type === 'checkbox') payload[key] = el.checked;
        else payload[key] = value;
    });

    // Normalización de números para el Backend (Evita Error 1366)
    const numericFields = ['km_totales', 'km_nacionales', 'km_internacionales', 'importe_espera', 'importe_suplidos', 'importe_total', 'empresa_ref'];
    numericFields.forEach(f => {
        payload[f] = parseFloat(payload[f]) || 0;
    });

    try {
        const response = await fetch(`/api/v1/albaranes/${albaranID}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            showStatus("✅ Albarán actualizado correctamente.", "success");
            setTimeout(() => window.location.href = '/titulares', 1500);
        } else {
            const r = await response.json();
            throw new Error(r.error || "Error al actualizar.");
        }
    } catch (error) {
        showStatus(error.message, "error");
    }
};

// --- UTILIDADES ---

function showStatus(msg, type) {
    const el = document.getElementById('statusMessage');
    if (!el) return;
    el.textContent = msg;
    el.className = `block mt-6 p-4 rounded-xl text-center font-bold border-2 ${
        type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
    }`;
    el.classList.remove('hidden');
}

function setupWordCounter() {
    const obs = document.getElementById('observaciones');
    const wc = document.getElementById('wordCount');
    if (obs && wc) {
        obs.addEventListener('input', () => {
            const count = obs.value.trim().split(/\s+/).filter(w => w.length > 0).length;
            wc.textContent = `${count} palabras registradas`;
        });
    }
}