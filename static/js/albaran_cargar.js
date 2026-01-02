function populateForm(data) {
    console.log("📦 [MAPPER] Procesando datos del albarán:", data);

    const setContent = (elementId, value) => {
        const el = document.getElementById(elementId);
        if (!el) return;
        const val = (value !== null && value !== undefined && value !== '') ? value : '-';
        
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
            el.value = (val === '-') ? '' : val;
        } else {
            el.textContent = val;
        }
    };

    const setCheck = (elementId, value) => {
        const el = document.getElementById(elementId);
        if (el) el.checked = (value === true || value === 1 || value === 'Si');
    };

    const formatTime = (timeStr) => {
        if (!timeStr) return '';
        // Si viene formato ISO "2026-01-01T08:30:00Z" o similar
        if (timeStr.includes('T')) {
            return timeStr.split('T')[1].substring(0, 5);
        }
        // Si ya viene como "HH:mm:ss"
        return timeStr.substring(0, 5);
    };

    // --- PARTE 1: IDENTIFICACIÓN ---
    const nAlbaran = data.numero_albaran || data.Numero_albaran;
    setContent('view_numero_albaran_header', nAlbaran);
    setContent('numero_albaran', nAlbaran);
    setContent('n_albaran', nAlbaran); // Para el input del update
    
    if (data.fecha || data.Fecha) {
        setContent('fecha', (data.fecha || data.Fecha).substring(0, 10));
    }

    // Tiempos de Servicio
    setContent('hora_ini', formatTime(data.hora_ini));
    setContent('hora_fin', formatTime(data.hora_fin));
    setContent('hora', formatTime(data.hora)); // Compatibilidad legacy

    // Licencia y Empresa
    if (data.LicenciaData) {
        setContent('licencia_ref', data.LicenciaData.licencia);
        setContent('licencia', data.LicenciaData.licencia);
    } else {
        setContent('licencia_ref', data.licencia_ref);
    }

    if (data.EmpresaData) {
        setContent('empresa_nombre', data.EmpresaData.nombre);
        // Si es un SELECT (en Update), asignamos el ID
        const empSelect = document.getElementById('empresa');
        if (empSelect) empSelect.value = data.empresa_ref;
    } else {
        setContent('empresa_nombre', data.empresa_nombre || '-');
    }

    // --- PARTE 2: CLIENTE Y VEHÍCULO (NUEVOS CAMPOS) ---
    setContent('matricula', data.matricula);
    setContent('nombre_pasajero', data.nombre_pasajero); // Nuevo
    setContent('dni_pasajero', data.dni_pasajero);
    setContent('referencia', data.referencia);
    setContent('asalariado', data.asalariado);
    
    // Combo de asalariado si existe (en Update)
    const asalariadoSelect = document.getElementById('asalariado_select');
    if (asalariadoSelect) asalariadoSelect.value = data.asalariado;

    // --- PARTE 3: TRAYECTO Y DATOS TÉCNICOS ---
    setContent('origen', data.origen);
    setContent('destino', data.destino);
    setContent('parada', data.parada);
    
    // Tiempos de Espera
    setContent('espera_ini', formatTime(data.espera_ini));
    setContent('espera_fin', formatTime(data.espera_fin));
    setContent('tiempo_espera', formatTime(data.tiempo_espera));

    setCheck('urbano', data.urbano);
    setCheck('diurno', data.diurno);
    setCheck('noct_fest', data.noct_fest);
    setCheck('remolque', data.remolque); // Nuevo
    setCheck('festivo', data.festivo);

    // Kilómetros
    setContent('km_ini', data.km_ini);
    setContent('km_fin', data.km_fin);
    setContent('km_totales', data.km_totales);
    setContent('km_nacionales', data.km_nacionales);
    setContent('km_internacionales', data.km_internacionales);

    // --- PARTE 4: IMPORTES Y EXTRAS ---
    setContent('num_plazas', data.num_plazas);
    setContent('autorizado_por', data.autorizado_por);
    setContent('observaciones', data.observaciones);
    setCheck('adjuntos', data.adjuntos); // Nuevo

    // Formateo de moneda para visualización
    const fmt = (v) => (parseFloat(v) || 0).toFixed(2) + " €";
    
    // Para el campo editable (Update)
    const inputTotal = document.querySelector('input[name="importe_total"]');
    if (inputTotal) {
        inputTotal.value = (parseFloat(data.importe_total) || 0).toFixed(2);
    } else {
        // Para la vista (View)
        const totalEl = document.getElementById('importe_total');
        if (totalEl) totalEl.textContent = fmt(data.importe_total);
    }
    
    const suplidosEl = document.getElementById('importe_suplidos');
    if (suplidosEl) {
        if (suplidosEl.tagName === 'INPUT') {
            suplidosEl.value = (parseFloat(data.importe_suplidos) || 0).toFixed(2);
        } else {
            suplidosEl.textContent = fmt(data.importe_suplidos);
        }
    }

    // Ocultar cargando si existe
    const loader = document.getElementById('loadingIndicator');
    if (loader) loader.classList.add('hidden');
}