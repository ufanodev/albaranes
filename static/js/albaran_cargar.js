// Archivo: static/js/albaran_cargar.js
// Carga los datos de un albarán específico para visualización (solo lectura).

document.addEventListener('DOMContentLoaded', async () => {
    const loadingIndicator = document.getElementById('loadingIndicator');
    const errorMessage = document.getElementById('errorMessage');

    // 1. Obtener el ID de la URL
    // La URL es del tipo /titulares/view/32
    const pathParts = window.location.pathname.split('/');
    const id = pathParts[pathParts.length - 1];

    if (!id || isNaN(id)) {
        showError("ID de albarán no válido.");
        return;
    }

    try {
        // 2. Llamar a la API
        const response = await fetch(`/api/v1/albaranes/${id}`);
        
        if (response.status === 401) {
            window.location.href = '/login';
            return;
        }
        
        if (!response.ok) {
            throw new Error(`Error ${response.status}: No se pudo cargar el albarán.`);
        }

        const json = await response.json();
        const data = json.data; // El backend devuelve { data: { ... } }

        if (!data) {
            throw new Error("No se recibieron datos del servidor.");
        }

        // 3. Rellenar el formulario
        populateForm(data);
        
        // Ocultar indicador de carga
        if (loadingIndicator) loadingIndicator.style.display = 'none';

    } catch (error) {
        console.error(error);
        showError(error.message);
        if (loadingIndicator) loadingIndicator.textContent = "Error";
    }
});

/**
 * Rellena los campos del HTML con los datos JSON.
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
    setVal('num_factura', data.Num_factura || data.num_factura || '-');
    // Si fecha_cobro es nula, mostramos guión o vacío
    const fechaCobro = data.Fecha_cobro || data.fecha_cobro;
    document.getElementById('fecha_cobro').textContent = fechaCobro ? fechaCobro.substring(0, 10) : '-';

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