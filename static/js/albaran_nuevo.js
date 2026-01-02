/**
 * albaran_nuevo.js - Gestión de creación de nuevos albaranes
 */

document.addEventListener('DOMContentLoaded', async () => {
    console.log("[JS] Inicializando formulario de nuevo albarán...");
    
    // 1. Cargar datos iniciales
    await cargarDatosTitular();
    await cargarEmpresas();
    await cargarConductores();

    // 2. Inicializar listeners para cálculos automáticos
    setupCalculosKms();
    setupContadorPalabras();
    
    if (window.lucide) lucide.createIcons();
});

/**
 * Obtiene la licencia del titular autenticado y la pone en el campo readonly
 */
async function cargarDatosTitular() {
    try {
        const response = await fetch('/api/v1/titular/me'); // Ajustar según tu endpoint de perfil
        const data = await response.json();
        if (response.ok && data.licencia) {
            document.getElementById('licencia').value = data.licencia;
        }
    } catch (error) {
        console.error("Error al cargar datos del titular:", error);
    }
}

/**
 * Carga el combo de Empresas
 */
async function cargarEmpresas() {
    const select = document.getElementById('empresa');
    try {
        const response = await fetch('/api/v1/empresas');
        const empresas = await response.json();
        
        select.innerHTML = '<option value="">-- Seleccione Empresa --</option>';
        empresas.forEach(emp => {
            const option = document.createElement('option');
            option.value = emp.id; // Guardamos el ID como referencia
            option.textContent = emp.nombre;
            select.appendChild(option);
        });
    } catch (error) {
        console.error("Error al cargar empresas:", error);
    }
}

/**
 * Carga el combo de Conductores / Asalariados
 */
async function cargarConductores() {
    const select = document.getElementById('asalariado_select');
    try {
        const response = await fetch('/api/v1/conductores');
        const conductores = await response.json();
        
        select.innerHTML = '<option value="">-- Seleccione Conductor --</option>';
        // Añadimos una opción para el titular mismo si fuera necesario
        select.innerHTML += '<option value="TITULAR">EL TITULAR</option>';

        conductores.forEach(cond => {
            const option = document.createElement('option');
            option.value = cond.nombre; // Guardamos el nombre para el campo 'asalariado'
            option.textContent = `${cond.nombre} (${cond.dni})`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error("Error al cargar conductores:", error);
    }
}

/**
 * Lógica para calcular Kms Totales automáticamente (Fin - Inicio)
 */
function setupCalculosKms() {
    const kmIni = document.querySelector('input[name="km_ini"]');
    const kmFin = document.querySelector('input[name="km_fin"]');
    const kmTotales = document.querySelector('input[name="km_totales"]');

    const calcular = () => {
        const valIni = parseFloat(kmIni.value) || 0;
        const valFin = parseFloat(kmFin.value) || 0;
        if (valFin >= valIni) {
            kmTotales.value = (valFin - valIni).toFixed(2);
        } else {
            kmTotales.value = "0.00";
        }
    };

    kmIni.addEventListener('input', calcular);
    kmFin.addEventListener('input', calcular);
}

/**
 * Contador de palabras para el área de observaciones
 */
function setupContadorPalabras() {
    const textarea = document.getElementById('observaciones');
    const counter = document.getElementById('wordCount');

    textarea.addEventListener('input', () => {
        const text = textarea.value.trim();
        const words = text ? text.split(/\s+/).length : 0;
        counter.textContent = `${words} palabras registradas`;
    });
}

/**
 * Manejo del envío del formulario
 */
async function handleAction(action, event) {
    if (event) event.preventDefault();
    
    const form = document.getElementById('albaranForm');
    const formData = new FormData(form);
    const statusMsg = document.getElementById('statusMessage');

    // Convertir FormData a JSON
    const data = {};
    formData.forEach((value, key) => {
        // Manejo de checkboxes (booleanos)
        if (['urbano', 'diurno', 'noct_fest', 'remolque', 'adjuntos'].includes(key)) {
            data[key] = true;
        } else if (['km_ini', 'km_fin', 'km_totales', 'km_nacionales', 'km_internacionales', 'importe_suplidos', 'importe_total'].includes(key)) {
            data[key] = parseFloat(value) || 0;
        } else if (key === 'empresa_ref' || key === 'num_plazas') {
            data[key] = parseInt(value);
        } else {
            data[key] = value;
        }
    });

    // Asegurar que los checkboxes no enviados se marquen como false
    const checkboxes = ['urbano', 'diurno', 'noct_fest', 'remolque', 'adjuntos'];
    checkboxes.forEach(cb => {
        if (!formData.has(cb)) data[cb] = false;
    });

    try {
        const response = await fetch('/api/v1/albaranes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (response.ok) {
            statusMsg.textContent = "✅ Albarán guardado correctamente";
            statusMsg.className = "mt-6 p-4 rounded-xl text-center font-bold w-full max-w-md border-2 bg-green-100 border-green-500 text-green-700 block";
            form.reset();
            // Recargar datos básicos tras reset
            await cargarDatosTitular();
            setTimeout(() => window.location.href = '/titulares', 2000);
        } else {
            throw new Error(result.error || "Fallo al guardar");
        }
    } catch (error) {
        statusMsg.textContent = "❌ Error: " + error.message;
        statusMsg.className = "mt-6 p-4 rounded-xl text-center font-bold w-full max-w-md border-2 bg-red-100 border-red-500 text-red-700 block";
    }
}