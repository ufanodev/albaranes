/**
 * ARCHIVO: static/js/albaran_update.js
 * DESCRIPCIÓN: Lógica para cargar datos existentes y actualizar albaranes.
 * ACTUALIZADO: 27/01/2026
 */

document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 [INIT] Iniciando modo edición de albarán...");

    // 1. Obtener ID de la URL (ejemplo: /titulares/editar?id=50)
    const urlParams = new URLSearchParams(window.location.search);
    const albaranId = urlParams.get('id');

    if (!albaranId) {
        console.error("❌ No se encontró ID en la URL");
        alert("Error: No se ha especificado un ID de albarán.");
        return;
    }

    // 2. Cargar catálogos y luego los datos del albarán
    await cargarCatálogos();
    await loadAlbaranToEdit(albaranId);

    // 3. Inicializar iconos y formateadores
    if (window.lucide) lucide.createIcons();
    initFormatters();
});

async function cargarCatálogos() {
    console.log("📦 Cargando catálogos...");
    await cargarEmpresas();
    // Agrega cargarAsalariados() si usas un select para conductores
}

async function cargarEmpresas() {
    const select = document.getElementById('empresa');
    if (!select) return;
    try {
        const res = await fetch('/api/v1/empresas');
        const result = await res.json();
        
        // Ordenación A-Z por seguridad en el cliente
        const empresas = result.data.sort((a, b) => a.nombre.localeCompare(b.nombre));

        select.innerHTML = '<option value="">-- Seleccionar Empresa (A-Z) --</option>';
        empresas.forEach(emp => {
            const opt = document.createElement('option');
            opt.value = emp.id;
            opt.textContent = emp.nombre.toUpperCase();
            select.appendChild(opt);
        });
    } catch (err) {
        console.error("❌ Error cargando empresas:", err);
    }
}

async function loadAlbaranToEdit(id) {
    try {
        const res = await fetch(`/api/v1/albaranes/${id}`);
        if (!res.ok) throw new Error("Albarán no encontrado");
        const { data } = await res.json();

        console.log("📦 Datos recibidos del servidor:", data);

        // --- BLOQUE 1: IDENTIFICACIÓN ---
        document.getElementById('albaran_id').value = data.id;
        document.getElementById('licencia').value = data.licencia || '';
        document.getElementById('n_albaran').value = data.numero_albaran;
        document.getElementById('referencia').value = data.referencia || '';
        document.getElementById('fecha').value = data.fecha ? data.fecha.split('T')[0] : '';

        // Helper para formatear ISO string o Time string a HH:mm
        const fTime = (str) => {
            if (!str) return '';
            if (str.includes('T')) return str.split('T')[1].substring(0, 5);
            return str.substring(0, 5);
        };

        document.getElementById('hora_ini').value = fTime(data.hora_ini);
        document.getElementById('hora_fin').value = fTime(data.hora_fin);

        // --- BLOQUE 2: CLIENTE ---
        document.getElementById('empresa').value = data.empresa_ref;
        document.getElementById('nombre_pasajero').value = data.cliente || ''; 
        document.getElementById('tlf_pasajero').value = data.tlf_pasajero || '';
        document.getElementById('dni_pasajero').value = data.dni_pasajero || '';
        document.getElementById('matricula').value = data.matricula || '';

        // --- BLOQUE 3: RUTA Y ESPERAS ---
        document.getElementById('origen').value = data.origen || '';
        document.getElementById('destino').value = data.destino || '';
        document.getElementById('parada').value = data.parada || '';
        document.getElementById('hora_total').value = data.hora_total || '0.00';
        document.getElementById('espera_ini').value = fTime(data.espera_ini);
        document.getElementById('espera_fin').value = fTime(data.espera_fin);

        // --- BLOQUE 4: KILOMETRAJE ---
        document.getElementById('urbano').checked = data.urbano;
        document.getElementById('diurno').checked = data.diurno;
        document.getElementById('noct_fest').checked = data.noct_fest;
        document.getElementById('km_totales').value = data.km_totales || '0.00';
        document.getElementById('km_nacionales').value = data.km_nacionales || '0.00';
        document.getElementById('km_internacionales').value = data.km_internacionales || '0.00';

        // --- BLOQUE 5: LIQUIDACIÓN ---
        document.getElementById('importe_suplidos').value = data.importe_suplidos || '0.00';
        document.getElementById('autorizado_por').value = data.autorizado_por || '';
        document.getElementById('asalariado').value = data.asalariado || '';
        document.getElementById('remolque').checked = data.remolque;
        document.getElementById('num_plazas').value = data.num_plazas || 4;
        
        // Mapeo correcto de Adjuntos (Check y Texto)
        if(document.getElementById('adjuntos_bool')) {
            document.getElementById('adjuntos_bool').checked = data.adjuntos;
        }
        if(document.getElementById('adjuntos_ref')) {
            document.getElementById('adjuntos_ref').value = data.adjuntos_ref || '';
        }

        document.getElementById('observaciones').value = data.observaciones || '';
        document.getElementById('importe_total').value = data.importe_total || '0.00';

    } catch (err) {
        console.error("❌ Error en loadAlbaranToEdit:", err);
        alert("No se pudo cargar el albarán para editar.");
    }
}

/**
 * Maneja la acción de actualización (PUT)
 */
async function handleAction(action, event) {
    if (event) event.preventDefault();
    
    const id = document.getElementById('albaran_id').value;
    const form = document.getElementById('albaranForm');
    const statusMsg = document.getElementById('statusMessage');
    const formData = new FormData(form);
    const plainData = {};

    formData.forEach((value, key) => {
        const input = form.querySelector(`[name="${key}"]`);
        if (input && input.type === 'checkbox') {
            plainData[key] = input.checked;
        } else {
            plainData[key] = value;
        }
    });

    // Inyectar metadatos necesarios
    plainData.empresa_ref = parseInt(plainData.empresa_ref);
    plainData.num_plazas = parseInt(plainData.num_plazas);
    
    // Normalizar decimales para evitar errores 1366 en MySQL
    const numericFields = ['km_totales', 'importe_total', 'importe_suplidos', 'hora_total'];
    numericFields.forEach(f => {
        plainData[f] = parseFloat(plainData[f]) || 0.0;
    });

    try {
        console.log("📤 Enviando actualización:", plainData);
        const res = await fetch(`/api/v1/albaranes/user/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(plainData)
        });

        const result = await res.json();

        if (res.ok) {
            statusMsg.classList.remove('hidden', 'bg-red-100', 'text-red-700');
            statusMsg.classList.add('bg-green-100', 'text-green-700', 'p-4', 'rounded-xl');
            statusMsg.textContent = "✅ " + (result.message || "Albarán actualizado con éxito");
            setTimeout(() => window.location.href = '/titulares', 1500);
        } else {
            throw new Error(result.error || "Error al actualizar el albarán");
        }
    } catch (err) {
        statusMsg.classList.remove('hidden', 'bg-green-100', 'text-green-700');
        statusMsg.classList.add('bg-red-100', 'text-red-700', 'p-4', 'rounded-xl');
        statusMsg.textContent = "❌ Error: " + err.message;
    }
}

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