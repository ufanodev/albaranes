/**
 * admin_albaran_cargar.js
 * Funciones para cargar y mapear datos de un albarán en la vista de ADMINISTRADOR.
 * Corregido: Sin símbolos de moneda en inputs numéricos para evitar errores de parseo.
 */

function populateForm(data) {
    console.log("📥 [DATA RECEIVE] Iniciando mapeo de datos desde el servidor:", data);

    // Helper para asignar valor a INPUTS (maneja nulos y tipos numéricos)
    const setVal = (elementId, value) => {
        const el = document.getElementById(elementId);
        if (!el) {
            console.warn(`⚠️ [MAPPER] Elemento no encontrado: ${elementId}`);
            return;
        }

        // Limpieza de datos: si es nulo o undefined, string vacío
        let cleanValue = (value !== null && value !== undefined) ? value : '';

        // REGLA CRÍTICA: Si es un input numérico, no enviar símbolos de moneda (€)
        if (el.type === "number") {
            // Aseguramos que sea un número válido para el input HTML5
            el.value = cleanValue !== '' ? parseFloat(cleanValue).toFixed(2) : '';
        } 
        // Si es un input de hora, formatear a HH:mm
        else if (el.type === "time" && cleanValue.includes('T')) {
            el.value = cleanValue.substring(11, 16);
        }
        // Si es un input de fecha, formatear a YYYY-MM-DD
        else if (el.type === "date" && cleanValue.includes('T')) {
            el.value = cleanValue.substring(0, 10);
        }
        else {
            el.value = cleanValue;
        }
    };

    // Helper para marcar CHECKBOXES
    const setCheck = (elementId, value) => {
        const el = document.getElementById(elementId);
        if (el) {
            el.checked = (value === true || value === 1 || value === 'Si');
        }
    };

    // Helper para elementos de texto puro (span/div)
    const setText = (elementId, value) => {
        const el = document.getElementById(elementId);
        if (el) el.textContent = (value !== null && value !== undefined && value !== "") ? value : '-';
    };

    try {
        // --- 1. DATOS IDENTIFICATIVOS ---
        console.log("🔍 [MAPPER] Mapeando Identificación...");
        if (data.LicenciaData) setVal('licencia_ref', data.LicenciaData.id);
        else setVal('licencia_ref', data.licencia_ref);
        
        setVal('numero_albaran', data.numero_albaran);
        setText('view_numero_albaran_header', data.numero_albaran);
        if (data.fecha) setVal('fecha', data.fecha.substring(0, 10));

        if (data.EmpresaData) setVal('empresa_ref', data.EmpresaData.id);
        else setVal('empresa_ref', data.empresa_ref);
        setVal('referencia', data.referencia);

        // --- 2. CONDUCTOR Y VEHÍCULO ---
        setVal('asalariado', data.asalariado);
        setVal('matricula', data.matricula);
        setVal('num_plazas', data.num_plazas);

        // --- 3. ITINERARIO ---
        setVal('cliente', data.cliente);
        setVal('dni_pasajero', data.dni_pasajero);
        setVal('hora', data.hora ? data.hora.substring(11, 16) : '');
        setVal('origen', data.origen);
        setVal('destino', data.destino);
        setVal('parada', data.parada);

        // --- 4. CHECKBOXES ---
        setCheck('urbano', data.urbano);
        setCheck('diurno', data.diurno);
        setCheck('noct_fest', data.noct_fest);
        setCheck('festivo', data.festivo);
        setCheck('finalizado', data.finalizado);
        setCheck('enganche', data.enganche);
        setCheck('cobrado', data.cobrado);
        setCheck('pagado', data.pagado);

        // --- 5. LIQUIDACIÓN (IMPORTES PUROS SIN €) ---
        console.log("🔍 [MAPPER] Mapeando Importes...");
        setVal('km_totales', data.km_totales);
        setVal('km_nacionales', data.km_nacionales);
        setVal('km_internacionales', data.km_internacionales);
        setVal('tiempo_espera', data.tiempo_espera ? data.tiempo_espera.substring(11, 16) : '');
        setVal('importe_suplidos', data.importe_suplidos);
        setVal('importe_total', data.importe_total);
        setVal('autorizado_por', data.autorizado_por);
        setVal('observaciones', data.observaciones);

        // --- 6. GESTIÓN ADMINISTRATIVA ---
        setVal('observaciones_admin', data.observaciones_admin);
        setVal('num_factura', data.num_factura);
        
        if (data.fecha_cobro) setVal('fecha_cobro', data.fecha_cobro.substring(0, 10));
        if (data.fecha_pago) setVal('fecha_pago', data.fecha_pago.substring(0, 10));

        console.log("✅ [DATA RECEIVE] Formulario mapeado con éxito.");
    } catch (err) {
        console.error("❌ [MAPPER ERROR] Error al procesar datos:", err);
    }
}