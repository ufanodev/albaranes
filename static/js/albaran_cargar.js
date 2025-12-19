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

    // PARTE 1
    const nAlbaran = data.numero_albaran || data.Numero_albaran;
    setContent('numero_albaran', nAlbaran);
    setContent('n_albaran', nAlbaran);
    
    if (data.fecha || data.Fecha) {
        setContent('fecha', (data.fecha || data.Fecha).substring(0, 10));
    }

    if (data.hora || data.Hora) {
        const h = data.hora || data.Hora;
        setContent('hora', h.includes('T') ? h.split('T')[1].substring(0, 5) : h.substring(0, 5));
    }

    // Licencia y Empresa
    if (data.LicenciaData) {
        setContent('licencia_ref', data.LicenciaData.licencia);
    } else {
        setContent('licencia_ref', data.licencia_ref);
    }

    if (data.EmpresaData) {
        setContent('empresa_nombre', data.EmpresaData.nombre);
    } else {
        setContent('empresa_nombre', data.empresa_nombre || '-');
    }

    setContent('referencia', data.referencia);
    setContent('asalariado', data.asalariado);
    setContent('dni_pasajero', data.dni_pasajero);
    setContent('matricula', data.matricula);
    setContent('cliente', data.cliente);
    setContent('origen', data.origen);
    setContent('destino', data.destino);
    setContent('parada', data.parada);
    
    setCheck('festivo', data.festivo);
    setCheck('finalizado', data.finalizado);

    // PARTE 2
    setCheck('urbano', data.urbano);
    setCheck('diurno', data.diurno);
    setCheck('noct_fest', data.noct_fest);
    setContent('km_totales', data.km_totales);
    setContent('km_nacionales', data.km_nacionales);
    setContent('km_internacionales', data.km_internacionales);

    // PARTE 3
    if (data.tiempo_espera) {
        const te = data.tiempo_espera;
        setContent('tiempo_espera', te.includes('T') ? te.split('T')[1].substring(0, 5) : te.substring(0, 5));
    }

    setContent('num_plazas', data.num_plazas);
    setCheck('enganche', data.enganche);
    setContent('autorizado_por', data.autorizado_por);
    setContent('observaciones', data.observaciones);

    // Importes
    const fmt = (v) => (parseFloat(v) || 0).toFixed(2) + " €";
    const totalEl = document.getElementById('importe_total');
    if (totalEl) totalEl.textContent = fmt(data.importe_total);
    
    const suplidosEl = document.getElementById('importe_suplidos');
    if (suplidosEl) suplidosEl.textContent = fmt(data.importe_suplidos);

    // Facturación
    setContent('num_factura', data.num_factura);
    if (data.fecha_cobro) setContent('fecha_cobro', data.fecha_cobro.substring(0, 10));
    if (data.fecha_pago) setContent('fecha_pago', data.fecha_pago.substring(0, 10));
    setCheck('cobrado', data.cobrado);
    setCheck('pagado', data.pagado);
}