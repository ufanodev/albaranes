/**
 * albaran_nuevo.js
 * Lógica para la creación de albaranes desde el panel de Titular.
 */

document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 [INIT] Iniciando Formulario de Albarán Unificado");

    // 1. Cargar datos iniciales (Licencia, Empresas, Asalariados)
    await Promise.all([
        getLicenciaInfo(),
        cargarEmpresas(),
        cargarAsalariados()
    ]);

    // 2. Establecer fecha por defecto (hoy)
    document.getElementById('fecha').value = new Date().toISOString().split('T')[0];

    // 3. Inicializar listeners para cálculos automáticos
    initCalculosKms();
    initWordCounter();
    
    lucide.createIcons();
});

/**
 * Obtiene la info de la licencia del usuario autenticado
 */
async function getLicenciaInfo() {
    try {
        const res = await fetch('/api/v1/albaranes/user-licencia');
        const data = await res.json();
        if (data.licencia_numero) {
            document.getElementById('licencia').value = data.licencia_numero;
            // Guardamos el ID en un atributo data para el envío
            document.getElementById('licencia').dataset.id = data.licencia_id;
        }
    } catch (err) {
        console.error("❌ Error cargando licencia:", err);
    }
}

/**
 * Carga el selector de empresas disponibles
 */
async function cargarEmpresas() {
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
    } catch (err) {
        console.error("❌ Error cargando empresas:", err);
    }
}

/**
 * Carga el selector de conductores (Asalariados) de esa licencia
 */
async function cargarAsalariados() {
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
    } catch (err) {
        console.error("❌ Error cargando asalariados:", err);
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
    obs.addEventListener('input', () => {
        const words = obs.value.trim().split(/\s+/).filter(w => w.length > 0).length;
        count.textContent = `${words} palabras registradas`;
    });
}

/**
 * Maneja el envío del formulario al servidor
 */
async function handleAction(action, event) {
    if (event) event.preventDefault();
    
    const form = document.getElementById('albaranForm');
    const statusMsg = document.getElementById('statusMessage');
    const formData = new FormData(form);
    
    // Convertir FormData a JSON plano
    const plainData = {};
    formData.forEach((value, key) => {
        // Manejo de checkboxes
        if (form.querySelector(`[name="${key}"]`).type === 'checkbox') {
            plainData[key] = true;
        } else {
            plainData[key] = value;
        }
    });

    // Inyectar IDs numéricos correctos
    plainData.licencia_ref = parseInt(document.getElementById('licencia').dataset.id);
    plainData.empresa_ref = parseInt(plainData.empresa_ref);
    
    // Ajustes de tipos numéricos
    plainData.km_ini = parseFloat(plainData.km_ini) || 0;
    plainData.km_fin = parseFloat(plainData.km_fin) || 0;
    plainData.importe_total = parseFloat(plainData.importe_total) || 0;
    plainData.importe_suplidos = parseFloat(plainData.importe_suplidos) || 0;

    console.log("📤 [SEND] Enviando albarán:", plainData);

    try {
        const response = await fetch('/api/v1/albaranes', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}` 
            },
            body: JSON.stringify(plainData)
        });

        const result = await response.json();

        if (response.ok) {
            statusMsg.classList.remove('hidden', 'bg-red-100', 'text-red-700', 'border-red-200');
            statusMsg.classList.add('bg-green-100', 'text-green-700', 'border-green-200');
            statusMsg.innerHTML = `<span>✅ ${result.message}</span>`;
            form.reset();
            // Recargar info básica
            getLicenciaInfo();
            setTimeout(() => window.location.href = '/titulares', 2000);
        } else {
            throw new Error(result.error || "Error desconocido al guardar");
        }
    } catch (err) {
        statusMsg.classList.remove('hidden', 'bg-green-100', 'text-green-700', 'border-green-200');
        statusMsg.classList.add('bg-red-100', 'text-red-700', 'border-red-200');
        statusMsg.innerHTML = `<span>❌ ERROR: ${err.message}</span>`;
    }
}