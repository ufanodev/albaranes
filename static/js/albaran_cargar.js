/**
 * albaran_cargar.js
 * Motor unificado para el mapeo de datos entre el Backend (JSON) y el Frontend (HTML).
 * Este archivo es el "traductor" oficial para albaran_view.html y albaran_update.html.
 */

function populateForm(data) {
    console.log("📦 [MAPPER] Procesando datos del albarán:", data);

    /**
     * Helper para asignar contenido a elementos (Input o Div/Span)
     */
    const setContent = (elementId, value) => {
        const el = document.getElementById(elementId);
        if (!el) return;

        // Limpieza de valores: si es null o vacío, ponemos un guion para la vista
        const val = (value !== null && value !== undefined && value !== '') ? value : '-';
        
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
            // En inputs, si el valor es el guion de "vacío", lo dejamos en blanco
            el.value = (val === '-') ? '' : val;
        } else {
            // En visualización (div/span), ponemos el valor procesado
            el.textContent = val;
        }
    };

    /**
     * Helper para gestionar Checkboxes
     */
    const setCheck = (elementId, value) => {
        const el = document.getElementById(elementId);
        if (el) {
            // Acepta true, 1, "Si" o "1" como valores marcados
            el.checked = (value === true || value === 1 || value === 'Si' || value === '1');
        }
    };

    /**
     * Helper para extraer la hora (HH:mm) de un string ISO o MySQL DateTime
     * Maneja: "2026-01-02T12:37:00Z" y "2026-01-02 12:37:00"
     */
    const formatTime = (timeStr) => {
        if (!timeStr) return '';
        let rawTime = timeStr;
        // Si viene formato ISO o MySQL con fecha, extraemos solo la parte del tiempo
        if (timeStr.includes('T')) {
            rawTime = timeStr.split('T')[1];
        } else if (timeStr.includes(' ')) {
            rawTime = timeStr.split(' ')[1];
        }
        return rawTime.substring(0, 5); // Retorna "HH:mm"
    };

    // --- PARTE 1: IDENTIFICACIÓN ---
    const nAlbaran = data.numero_albaran || data.Numero_albaran || '-';
    setContent('view_numero_albaran_header', nAlbaran);
    setContent('numero_albaran', nAlbaran);
    setContent('n_albaran', nAlbaran); // Para el input del update
    
    if (data.fecha || data.Fecha) {
        setContent('fecha', (data.fecha || data.Fecha).substring(0, 10));
    }

    // Tiempos de Servicio (Mapeo a columnas hora_ini / hora_fin de la DB)
    setContent('hora_ini', formatTime(data.hora_ini));
    setContent('hora_fin', formatTime(data.hora_fin));
    setContent('hora', formatTime(data.hora)); // Compatibilidad legacy

    // Licencia y Empresa
    if (data.LicenciaData) {
        setContent('licencia_ref', data.LicenciaData.licencia);
        setContent('licencia', data.LicenciaData.licencia);
    } else {
        setContent('licencia_ref', data.licencia_ref);
        setContent('licencia', data.licencia || data.licencia_ref);
    }

    if (data.EmpresaData) {
        setContent('empresa_nombre', data.EmpresaData.nombre);
        const empSelect = document.getElementById('empresa');
        if (empSelect) empSelect.value = data.empresa_ref;
    } else {
        setContent('empresa_nombre', data.empresa_nombre || '-');
    }

    // --- PARTE 2: CLIENTE Y VEHÍCULO (CORREGIDO) ---
    setContent('matricula', data.matricula);
    
    // 👤 MAPEO CRÍTICO: La DB devuelve 'cliente', la vista espera 'nombre_pasajero'
    setContent('nombre_pasajero', data.cliente || data.nombre_pasajero); 
    
    setContent('dni_pasajero', data.dni_pasajero);
    setContent('referencia', data.referencia);
    setContent('asalariado', data.asalariado);
    
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
    setCheck('remolque', data.remolque); 
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
    setCheck('adjuntos', data.adjuntos);

    // Formateo de moneda
    const fmt = (v) => (parseFloat(v) || 0).toFixed(2) + " €";
    
    const totalEl = document.getElementById('importe_total');
    if (totalEl) {
        if (totalEl.tagName === 'INPUT') {
            totalEl.value = (parseFloat(data.importe_total) || 0).toFixed(2);
        } else {
            totalEl.textContent = fmt(data.importe_total);
        }
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