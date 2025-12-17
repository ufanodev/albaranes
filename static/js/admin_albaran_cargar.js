/**
 * admin_albaran_cargar.js
 * Funciones maestras para cargar y mapear datos de un albarán en la vista de ADMINISTRADOR.
 * Versión: 3.2 (Mapeo completo de base de datos)
 */

function populateForm(data) {
    console.log("🛠️ [ADMIN LOAD] Iniciando mapeo de campos extendido...");

    // Helper para asignar valor a INPUTS (maneja nulos)
    const setVal = (elementId, value) => {
        const el = document.getElementById(elementId);
        if (el) el.value = (value !== null && value !== undefined) ? value : '';
    };

    // Helper para marcar CHECKBOXES (maneja bool o 1/0)
    const setCheck = (elementId, value) => {
        const el = document.getElementById(elementId);
        if (el) el.checked = (value === true || value === 1 || value === 'Si');
    };

    // Helper para elementos de texto puro como SPAN o DIV (textContent)
    const setText = (elementId, value) => {
        const el = document.getElementById(elementId);
        if (el) el.textContent = (value !== null && value !== undefined && value !== "") ? value : '-';
    };

    // --- 1. DATOS IDENTIFICATIVOS Y CABECERA ---
    // Manejo de la Licencia (Prioriza objeto Preload LicenciaData)
    if (data.LicenciaData) {
        setVal('licencia_ref', data.LicenciaData.licencia || data.LicenciaData.Licencia);
    } else {
        setVal('licencia_ref', data.licencia_ref);
    }
    
    setVal('numero_albaran', data.numero_albaran);
    setText('view_numero_albaran_header', data.numero_albaran); // El ID del H1 del header
    
    if (data.fecha) {
        setVal('fecha', data.fecha.substring(0, 10)); // Formato YYYY-MM-DD
    }

    // Manejo de la Empresa (Prioriza objeto Preload EmpresaData)
    if (data.EmpresaData) {
        setVal('empresa_nombre', data.EmpresaData.nombre || data.EmpresaData.Nombre);
    } else {
        setVal('empresa_nombre', data.empresa_ref);
    }
    setVal('referencia', data.referencia);

    // --- 2. PERSONAL Y VEHÍCULO ---
    setVal('asalariado', data.asalariado);
    setVal('matricula', data.matricula);
    setVal('num_plazas', data.num_plazas);

    // --- 3. ITINERARIO Y CLIENTE ---
    setVal('cliente', data.cliente);
    setVal('dni_pasajero', data.dni_pasajero);
    // Formateo de hora (extrae HH:mm de ISO string)
    setVal('hora', data.hora ? data.hora.substring(11, 16) : '');
    setVal('origen', data.origen);
    setVal('destino', data.destino);
    setVal('parada', data.parada);

    // --- 4. CHECKBOXES (TARIFAS, EXTRAS Y ESTADOS) ---
    setCheck('urbano', data.urbano);
    setCheck('diurno', data.diurno);
    setCheck('noct_fest', data.noct_fest);
    setCheck('festivo', data.festivo);
    setCheck('finalizado', data.finalizado);
    setCheck('enganche', data.enganche);
    setCheck('cobrado', data.cobrado);
    setCheck('pagado', data.pagado);

    // --- 5. LIQUIDACIÓN (KMS E IMPORTES) ---
    setVal('km_totales', data.km_totales);
    setVal('km_nacionales', data.km_nacionales);
    setVal('km_internacionales', data.km_internacionales);
    
    // Formateo de tiempo de espera (HH:mm)
    setVal('tiempo_espera', data.tiempo_espera ? data.tiempo_espera.substring(11, 16) : '');
    
    // Formateo de moneda a 2 decimales
    const fmtMoney = (val) => (parseFloat(val) || 0).toFixed(2) + " €";
    setVal('importe_suplidos', fmtMoney(data.importe_suplidos));
    setVal('importe_total', fmtMoney(data.importe_total));
    
    setVal('autorizado_por', data.autorizado_por);
    setVal('observaciones', data.observaciones);

    // --- 6. GESTIÓN ADMINISTRATIVA (CAMPOS EXCLUSIVOS ADMIN) ---
    setVal('observaciones_admin', data.observaciones_admin);
    
    // Mapeo a los SPAN de facturación y fechas contables (usando setText)
    setText('num_factura', data.num_factura);
    setText('fecha_cobro', data.fecha_cobro ? data.fecha_cobro.substring(0, 10) : '');
    setText('fecha_pago', data.fecha_pago ? data.fecha_pago.substring(0, 10) : '');

    console.log("✅ [ADMIN LOAD] Formulario mapeado con éxito.");
}

/**
 * Muestra mensaje de error en la interfaz si falla la carga
 */
function showError(msg) {
    const el = document.getElementById('errorMessage');
    if (el) {
        el.textContent = `Error: ${msg}`;
        el.classList.remove('hidden');
    }
    const loading = document.getElementById('loadingIndicator');
    if (loading) loading.style.display = 'none';
}

/**
 * Función global para regresar a la página anterior
 */
window.goBack = () => {
    console.log("🔙 Navegando hacia atrás...");
    window.history.back();
};