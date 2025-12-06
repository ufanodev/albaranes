// Archivo: static/js/albaran_cargar.js
// Contiene las funciones auxiliares para cargar y mapear datos de un albarán.

/**
 * Rellena los campos del HTML con los datos JSON.
 * Esta función debe ser llamada por el script principal de la vista (ej: albaran_view.js o albaran_borrar.js).
 */
function populateForm(data) {
    // Helper para asignar valor (maneja nulos)
    const setVal = (elementId, value) => {
        const el = document.getElementById(elementId);
        if (el) el.value = (value !== null && value !== undefined) ? value : '';
    };

    // Helper para checkboxes (maneja bool o 1/0)
    const setCheck = (elementId, value) => {
        const el = document.getElementById(elementId);
        if (el) el.checked = (value === true || value === 1 || value === 'Si');
    };

    // Helper para fecha (toma YYYY-MM-DD)
    const setDate = (elementId, value) => {
        const el = document.getElementById(elementId);
        if (el && value) el.value = value.substring(0, 10);
    };

    // --- Mapeo de Campos ---
    setVal('numero_albaran', data.Numero_albaran || data.numero_albaran);
    setDate('fecha', data.Fecha || data.fecha);
    
    // Relaciones (Si el backend devuelve objetos anidados)
    if (data.LicenciaData) {
        setVal('licencia_ref', data.LicenciaData.Licencia || data.LicenciaData.licencia);
    } else {
        setVal('licencia_ref', data.LicenciaRef || data.licencia_ref);
    }

    if (data.EmpresaData) {
        setVal('empresa_nombre', data.EmpresaData.Nombre || data.EmpresaData.nombre);
    } else {
        // En vistas de solo lectura, mostrar el ID si el nombre no está disponible
        setVal('empresa_nombre', `Empresa ID: ${data.EmpresaRef}`);
    }

    setVal('referencia', data.Referencia || data.referencia);
    setVal('asalariado', data.Asalariado || data.asalariado);
    setVal('hora', data.Hora || data.hora);
    setVal('dni_pasajero', data.Dni_pasajero || data.dni_pasajero);
    setVal('matricula', data.Matricula || data.matricula);
    setVal('num_plazas', data.Num_plazas || data.num_plazas);
    
    // Datos Viaje
    setVal('cliente', data.Cliente || data.cliente);
    setVal('origen', data.Origen || data.origen);
    setVal('destino', data.Destino || data.destino);
    setVal('parada', data.Parada || data.parada);

    // Importes (Formatear a 2 decimales)
    const fmtMoney = (val) => (parseFloat(val) || 0).toFixed(2);
    setVal('km_totales', data.Km_totales || data.km_totales);
    setVal('km_nacionales', data.Km_nacionales || data.km_nacionales);
    setVal('km_internacionales', data.Km_internacionales || data.km_internacionales);
    setVal('tiempo_espera', data.Tiempo_espera || data.tiempo_espera);
    setVal('importe_total', fmtMoney(data.Importe_total || data.importe_total) + " €");
    setVal('importe_suplidos', fmtMoney(data.Importe_suplidos || data.importe_suplidos) + " €");
    
    setVal('autorizado_por', data.Autorizado_por || data.autorizado_por);
    setVal('observaciones', data.Observaciones || data.observaciones);

    // Facturación
    // Nota: Para la vista de borrado, el HTML usa <span> para num_factura y fecha_cobro
    // Por eso usamos textContent si no es un input.
    const numFacturaEl = document.getElementById('num_factura');
    const fechaCobroEl = document.getElementById('fecha_cobro');
    
    if (numFacturaEl && numFacturaEl.tagName !== 'INPUT') {
        numFacturaEl.textContent = data.Num_factura || data.num_factura || '-';
    } else if (numFacturaEl) {
        numFacturaEl.value = data.Num_factura || data.num_factura || '-';
    }
    
    const fechaCobro = data.Fecha_cobro || data.fecha_cobro;
    if (fechaCobroEl && fechaCobroEl.tagName !== 'INPUT') {
        fechaCobroEl.textContent = fechaCobro ? fechaCobro.substring(0, 10) : '-';
    } else if (fechaCobroEl) {
        fechaCobroEl.value = fechaCobro ? fechaCobro.substring(0, 10) : '-';
    }


    // Checkboxes
    setCheck('urbano', data.Urbano || data.urbano);
    setCheck('diurno', data.Diurno || data.diurno);
    setCheck('noct_fest', data.Noct_fest || data.noct_fest);
    setCheck('festivo', data.Festivo || data.festivo);
    setCheck('finalizado', data.Finalizado || data.finalizado);
    setCheck('enganche', data.Enganche || data.enganche);
    setCheck('cobrado', data.Cobrado || data.cobrado);
    setCheck('pagado', data.Pagado || data.pagado);
}

function showError(msg) {
    const el = document.getElementById('errorMessage');
    if (el) {
        el.textContent = `Error: ${msg}`;
        el.classList.remove('hidden');
    }
    const loading = document.getElementById('loadingIndicator');
    if (loading) loading.style.display = 'none';
}

// =====================================================================
// FUNCIONES GLOBALES REQUERIDAS POR EL HTML
// =====================================================================
// Mantenemos goBack global para el botón "Volver"
window.goBack = () => {
    console.log("Navegando hacia atrás en el historial...");
    window.history.back();
};