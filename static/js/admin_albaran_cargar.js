/**
 * ARCHIVO: static/js/admin_albaran_cargar.js
 * DESCRIPCIÓN: Motor de mapeo de datos para la vista de detalle del Administrador.
 * ACTUALIZADO: 15/04/2026 - FIX: Sincronización de zona horaria (Local España vs Cloud Francia).
 */

function populateForm(data) {
    if (!data) return;
    console.log("📦 [ADMIN MAPPER] Procesando albarán maestro con ajuste horario:", data);

    // --- HELPERS DE FORMATO CON FIX DE ZONA HORARIA ---

    /** Formatea fecha ISO a estándar europeo DD/MM/YYYY evitando resta de día */
    const formatEuroDate = (isoStr) => {
        if (!isoStr) return "-";
        try {
            // Extraemos solo la parte de la fecha antes de la 'T' para evitar desfase UTC
            const cleanDate = isoStr.split('T')[0];
            const d = new Date(cleanDate);
            if (isNaN(d.getTime())) return isoStr;
            return d.toLocaleDateString('es-ES', { 
                day: '2-digit', 
                month: '2-digit', 
                year: 'numeric' 
            });
        } catch (e) { return "-"; }
    };

    /** Limpia strings de tiempo ISO o MySQL y ajusta a zona Europa/Madrid */
    const formatTime = (timeStr) => {
        if (!timeStr) return "--:--";
        
        // Si ya es un formato corto HH:mm literal (ej: desde un input), lo devolvemos
        if (typeof timeStr === 'string' && timeStr.includes(':') && timeStr.length === 5) {
            return timeStr;
        }

        try {
            const date = new Date(timeStr);
            if (isNaN(date.getTime())) {
                // Fallback: si no es un ISO válido pero tiene ":" extraemos los primeros 5 caracteres
                return timeStr.includes(':') ? timeStr.substring(0, 5) : "--:--";
            }

            /**
             * SOLUCIÓN DESFASE 2 HORAS:
             * Forzamos al navegador a interpretar la hora como local de Madrid.
             */
            return date.toLocaleTimeString('es-ES', { 
                hour: '2-digit', 
                minute: '2-digit', 
                hour12: false,
                timeZone: 'Europe/Madrid' 
            });
        } catch (e) { return "--:--"; }
    };

    /** ASIGNADOR UNIVERSAL: Detecta si es Input vs Text */
    const setVal = (id, value, isDate = false, isTime = false) => {
        const el = document.getElementById(id);
        if (!el) return;

        let finalValue = (value !== null && value !== undefined && value !== '') ? value : "-";
        
        if (isDate && value) finalValue = formatEuroDate(value);
        if (isTime && value) finalValue = formatTime(value);

        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) {
            // Para inputs tipo date, necesitamos formato YYYY-MM-DD literal
            if (el.type === 'date' && value) {
                el.value = value.split('T')[0];
            } else {
                el.value = (finalValue === "-") ? "" : finalValue;
            }
        } else {
            el.textContent = finalValue;
        }
    };

    // --- 1. IDENTIFICACIÓN Y CABECERA ---
    setVal('header_num', `#${data.numero_albaran}`);
    setVal('licencia_ref', data.licencia || data.licencia_ref);
    setVal('n_albaran', data.numero_albaran);
    setVal('fecha', data.fecha, true);
    setVal('hora_ini', data.hora_ini, false, true);
    setVal('hora_fin', data.hora_fin, false, true);

    // --- 2. FACTURACIÓN Y CLIENTE ---
    const empresaNombre = data.empresa_data?.nombre || data.empresa_nombre || "-";
    setVal('empresa_nombre_view', empresaNombre.toUpperCase());
    setVal('matricula', data.matricula);
    setVal('nombre_pasajero', data.cliente);
    setVal('dni_pasajero', data.dni_pasajero);
    setVal('tlf_pasajero', data.tlf_pasajero);

    // --- 3. ITINERARIO ---
    setVal('origen', data.origen);
    setVal('destino', data.destino);
    setVal('referencia', data.referencia);
    setVal('parada', data.parada);
    setVal('espera_ini', data.espera_ini, false, true);
    setVal('espera_fin', data.espera_fin, false, true);

    // --- 4. KILOMETRAJE ---
    setVal('km_ini', data.km_ini);
    setVal('km_fin', data.km_fin);
    setVal('km_totales', data.km_totales);

    // --- 5. ECONOMÍA Y CONDUCTOR ---
    setVal('asalariado', data.asalariado);
    setVal('autorizado_por', data.autorizado_por);
    
    const suplidos = parseFloat(data.importe_suplidos) || 0;
    setVal('importe_suplidos', suplidos.toFixed(2) + " €");
    
    const totalEl = document.getElementById('importe_total_view');
    if (totalEl) {
        totalEl.textContent = (parseFloat(data.importe_total) || 0).toFixed(2);
    }

    // --- 6. ESTADO ADMINISTRATIVO ---
    setVal('num_factura_view', data.num_factura);
    setVal('fecha_cobro_view', data.fecha_cobro, true);
    
    const obsEl = document.getElementById('observaciones_view');
    if (obsEl) {
        obsEl.textContent = data.observaciones || "Sin observaciones registradas.";
    }

    // --- 7. SINCRONIZACIÓN VISUAL DE CHECKBOXES (Km Badges) ---
    const syncBadge = (id, active) => {
        const el = document.getElementById(id);
        if (!el) return;
        const parent = el.parentElement;
        if (active) {
            parent.classList.add('bg-orange-100', 'border-orange-300', 'text-orange-700', 'opacity-100');
            parent.classList.remove('bg-slate-100', 'opacity-80');
        } else {
            parent.classList.remove('bg-orange-100', 'border-orange-300', 'text-orange-700', 'opacity-100');
            parent.classList.add('bg-slate-100', 'opacity-80');
        }
    };

    syncBadge('urbano_val', data.urbano);
    syncBadge('diurno_val', data.diurno);
    syncBadge('noct_fest_val', data.noct_fest);
    syncBadge('remolque_val', data.remolque);

    // --- 8. RENDERIZADO DINÁMICO DE BADGES DE ESTADO ---
    const statusContainer = document.getElementById('status_badges_container');
    if (statusContainer) {
        statusContainer.innerHTML = '';
        
        const hasFactura = data.num_factura && data.num_factura !== '-';
        const factClass = hasFactura ? "bg-blue-100 text-blue-700 border-blue-200" : "bg-slate-100 text-slate-400 border-slate-200";
        const factIcon = hasFactura ? "file-check" : "file-minus";
        const factText = hasFactura ? "FACTURADO" : "NO FACTURADO";
        
        statusContainer.innerHTML += `
            <div class="badge-status ${factClass}">
                <i data-lucide="${factIcon}" class="w-3 h-3"></i> ${factText}
            </div>`;
        
        const hasCobro = data.fecha_cobro;
        const cobroClass = hasCobro ? "bg-green-100 text-green-700 border-green-200" : "bg-orange-100 text-orange-700 border-orange-200";
        const cobroIcon = hasCobro ? "check-circle" : "clock";
        const cobroText = hasCobro ? "COBRADO" : "PENDIENTE COBRO";
        
        statusContainer.innerHTML += `
            <div class="badge-status ${cobroClass}">
                <i data-lucide="${cobroIcon}" class="w-3 h-3"></i> ${cobroText}
            </div>`;
    }

    if (window.lucide) {
        lucide.createIcons();
    }
}

window.populateForm = populateForm;