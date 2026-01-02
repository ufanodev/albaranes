/**
 * albaran_cargar.js
 * Motor unificado para el mapeo de datos entre el Backend (JSON) y el Frontend (HTML).
 * Compatible con albaran_view.html y albaran_update.html
 */

function populateForm(data) {
    console.log("📦 [MAPPER] Iniciando mapeo de datos del albarán:", data);

    /**
     * Helper para asignar contenido a elementos (Input o Div/Span)
     */
    const setContent = (elementId, value) => {
        const el = document.getElementById(elementId);
        if (!el) return;

        // Limpieza de valores nulos o indefinidos
        const val = (value !== null && value !== undefined && value !== '') ? value : '-';
        
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
            el.value = (val === '-') ? '' : val;
        } else {
            el.textContent = val;
        }
    };

    /**
     * Helper para gestionar Checkboxes
     */
    const setCheck = (elementId, value) => {
        const el = document.getElementById(elementId);
        if (el) {
            el.checked = (value === true || value === 1 || value === 'Si' || value === '1');
        }
    };

    /**
     * Helper para extraer la hora (HH:mm) de un string ISO o MySQL DateTime
     */
    const formatTime = (timeStr) => {
        if (!timeStr) return '';
        // Si es formato ISO "2026-01-02T12:37:00Z" o MySQL "2026-01-02 12:37:00"
        let rawTime = timeStr;
        if (timeStr.includes('T')) {
            rawTime = timeStr.split('T')[1];
        } else if (timeStr.includes(' ')) {
            rawTime = timeStr.split(' ')[1];
        }
        return rawTime.substring(0, 5); // Retorna "12:37"
    };

    // --- SECCIÓN 1: IDENTIFICACIÓN Y TIEMPOS ---
    const nAlbaran = data.numero_albaran || '-';
    setContent('view_numero_albaran_header', nAlbaran);
    setContent('numero_albaran', nAlbaran);
    setContent('n_albaran', nAlbaran); 
    
    if (data.fecha) {
        setContent('fecha', data.fecha.substring(0, 10));
    }

    // 🕒 Tiempos de Servicio (Mapeo exacto a columnas DB)
    setContent('hora_ini', formatTime(data.hora_ini));
    setContent('hora_fin', formatTime(data.hora_fin));

    // Licencia (Muestra el número de licencia si existe, si no el ID)
    setContent('licencia_ref', data.licencia || data.licencia_ref);
    setContent('licencia', data.licencia || data.licencia_ref); // Para el input readonly

    // Empresa
    if (data.empresa_data) {
        setContent('empresa_nombre', data.empresa_data.nombre);
    } else {
        setContent('empresa_nombre', data.empresa_nombre);
    }
    // Si estamos en edición, pre-seleccionamos el ID en el SELECT
    const empSelect = document.getElementById('empresa');
    if (empSelect) empSelect.value = data.empresa_ref;

    // --- SECCIÓN 2: CLIENTE Y VEHÍCULO ---
    setContent('matricula', data.matricula);
    setContent('dni_pasajero', data.dni_pasajero);
    setContent('referencia', data.referencia);
    setContent('asalariado', data.asalariado);
    
    // 👤 MAPEO CRÍTICO: La DB guarda en 'cliente', la vista muestra en 'nombre_pasajero'
    setContent('nombre_pasajero', data.cliente); 

    // Pre-selección de asalariado en combo de edición
    const asalariadoSelect = document.getElementById('asalariado_select');
    if (asalariadoSelect) asalariadoSelect.value = data.asalariado;

    // --- SECCIÓN 3: TRAYECTO Y DATOS TÉCNICOS ---
    setContent('origen', data.origen);
    setContent('destino', data.destino);
    setContent('parada', data.parada);
    
    // ⏳ Tiempos de Espera (Mapeo exacto a columnas DB)
    setContent('espera_ini', formatTime(data.espera_ini));
    setContent('espera_fin', formatTime(data.espera_fin));

    setCheck('urbano', data.urbano);
    setCheck('diurno', data.diurno);
    setCheck('noct_fest', data.noct_fest);
    setCheck('remolque', data.remolque); 
    setCheck('festivo', data.festivo);

    // Kilómetros
    setContent('km_ini', data.km_ini);
    setContent('km_fin', data.km_fin);
    setContent('km_totales', data.km_totales);
    setContent('km_nacionales', data.km_nacionales);
    setContent('km_internacionales', data.km_internacionales);

    // --- SECCIÓN 4: IMPORTES Y OTROS ---
    setContent('num_plazas', data.num_plazas);
    setContent('autorizado_por', data.autorizado_por);
    setContent('observaciones', data.observaciones);
    setCheck('adjuntos', data.adjuntos);

    // Formateo de moneda
    const fmt = (v) => (parseFloat(v) || 0).toFixed(2) + " €";
    
    // Total Albarán
    const totalView = document.getElementById('importe_total');
    if (totalView) {
        if (totalView.tagName === 'INPUT') {
            totalView.value = (parseFloat(data.importe_total) || 0).toFixed(2);
        } else {
            totalView.textContent = fmt(data.importe_total);
        }
    }
    
    // Suplidos
    const suplidosView = document.getElementById('importe_suplidos');
    if (suplidosView) {
        if (suplidosView.tagName === 'INPUT') {
            suplidosView.value = (parseFloat(data.importe_suplidos) || 0).toFixed(2);
        } else {
            suplidosView.textContent = fmt(data.importe_suplidos);
        }
    }

    // Finalización visual
    const loader = document.getElementById('loadingIndicator');
    if (loader) loader.classList.add('hidden');
    
    console.log("✅ [MAPPER] Mapeo completado satisfactoriamente.");
}