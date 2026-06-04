/**
 * ARCHIVO: static/js/admin_albaran_view.js
 * DESCRIPCIÓN: Controlador para la vista de detalle del Administrador.
 * ACTUALIZADO: 04/06/2026
 *   - ADD: renderBadges para cobrado, pagado, finalizado con colores.
 *   - ADD: fecha_pago y fecha_cobro mostradas junto a sus badges.
 *   - ADD: num_factura, hora_total, tlf_pasajero en vista.
 *   - FIX: Header actualizado con numero_albaran.
 */

document.addEventListener('DOMContentLoaded', async () => {
    const urlParts = window.location.pathname.split('/').filter(p => p !== "");
    const albaranId = urlParts[urlParts.length - 1];

    console.log(`🚀 [ADMIN VIEW] Iniciando vista para Albarán ID: ${albaranId}`);

    if (!albaranId || isNaN(albaranId)) {
        console.error("❌ ID de albarán no válido en la URL.");
        mostrarNotificacion("ID de albarán no válido.", "error");
        return;
    }

    try {
        const response = await fetch(`/api/v1/albaranes/id/${albaranId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            credentials: 'include'
        });

        if (response.status === 401 || response.status === 403) {
            window.location.href = '/login';
            return;
        }

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || "Fallo al conectar con el servidor.");
        }

        const result = await response.json();

        if (!result.data) {
            throw new Error("El servidor no devolvió información para este registro.");
        }

        const data = result.data;
        console.log("📥 [API DATA] Datos cargados con éxito:", data);

        // Poblar campos básicos
        if (typeof populateForm === 'function') {
            populateForm(data);
            console.log("✅ [ADMIN VIEW] Interfaz rellenada satisfactoriamente.");
        } else {
            console.warn("⚠️ populateForm no encontrado, usando fallback local.");
            fallbackPopulateView(data);
        }

        // Header número albarán
        const headerNum = document.getElementById('header_num');
        if (headerNum) headerNum.textContent = `#${data.numero_albaran}`;

        // Campos de solo lectura extra
        setViewField('tlf_pasajero',    data.tlf_pasajero);
        setViewField('hora_total',      data.hora_total != null ? data.hora_total : '—');

        // Sección 6: Facturación
        setViewDiv('num_factura_view',  data.num_factura  || '—');
        setViewDiv('fecha_cobro_view',  formatFecha(data.fecha_cobro));
        setViewDiv('fecha_pago_view',   formatFecha(data.fecha_pago));

        // Badges de estado
        renderBadge('badge_cobrado',   data.cobrado,   'Cobrado (Empresa)',   'blue');
        renderBadge('badge_pagado',    data.pagado,    'Pagado (Conductor)',  'green');
        renderBadge('badge_finalizado',data.finalizado,'Servicio Cerrado',   'teal');

        // Observaciones
        const obsEl = document.getElementById('observaciones_view');
        if (obsEl) obsEl.textContent = data.observaciones || '—';

        // Importe total
        const impEl = document.getElementById('importe_total_view');
        if (impEl) impEl.textContent = parseFloat(data.importe_total || 0).toFixed(2);

        configurarBotones(albaranId);

    } catch (error) {
        console.error("❌ [CRÍTICO]:", error.message);
        mostrarNotificacion(error.message, "error");
    } finally {
        const loader = document.getElementById('loadingIndicator');
        if (loader) loader.classList.add('hidden');
        if (window.lucide) lucide.createIcons();
    }
});

/**
 * Rellena un input de solo lectura por id
 */
function setViewField(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value ?? '—';
}

/**
 * Rellena un div/span de solo lectura por id
 */
function setViewDiv(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value || '—';
}

/**
 * Formatea una fecha ISO a DD/MM/YYYY o devuelve '—'
 */
function formatFecha(val) {
    if (!val) return '—';
    const d = val.substring(0, 10);
    const [y, m, day] = d.split('-');
    if (!y || !m || !day) return '—';
    return `${day}/${m}/${y}`;
}

/**
 * Renderiza un badge de estado activo/inactivo.
 * @param {string} id       - id del elemento badge en el DOM
 * @param {boolean} activo  - si el estado está activo
 * @param {string} label    - texto del badge
 * @param {string} color    - 'blue' | 'green' | 'teal'
 */
function renderBadge(id, activo, label, color) {
    const el = document.getElementById(id);
    if (!el) return;

    const palettes = {
        blue:  { on: 'border-blue-400 bg-blue-100 text-blue-800',  off: 'border-slate-200 bg-slate-100 text-slate-400', icon: 'check-circle-2', iconOff: 'circle' },
        green: { on: 'border-green-400 bg-green-100 text-green-800', off: 'border-slate-200 bg-slate-100 text-slate-400', icon: 'check-circle-2', iconOff: 'circle' },
        teal:  { on: 'border-teal-400 bg-teal-100 text-teal-800',  off: 'border-slate-200 bg-slate-100 text-slate-400', icon: 'check-circle-2', iconOff: 'circle' },
    };

    const p = palettes[color] || palettes.blue;
    const cls = activo ? p.on : p.off;
    const icon = activo ? p.icon : p.iconOff;

    el.className = `badge-status ${cls}`;
    el.innerHTML = `<i data-lucide="${icon}" class="w-4 h-4"></i> ${label}`;

    if (window.lucide) lucide.createIcons();
}

/**
 * Fallback para poblar campos si populateForm no está disponible
 */
function fallbackPopulateView(data) {
    const map = {
        'licencia_ref':   data.licencia_ref,
        'n_albaran':      data.numero_albaran,
        'fecha':          data.fecha ? data.fecha.substring(0, 10) : '',
        'hora_ini':       data.hora_ini,
        'hora_fin':       data.hora_fin,
        'empresa_nombre_view': data.empresa_nombre || '',
        'nombre_pasajero': data.nombre_pasajero || data.cliente || '',
        'tlf_pasajero':   data.tlf_pasajero,
        'dni_pasajero':   data.dni_pasajero,
        'matricula':      data.matricula,
        'origen':         data.origen,
        'parada':         data.parada,
        'destino':        data.destino,
        'referencia':     data.referencia,
        'espera_ini':     data.espera_ini,
        'espera_fin':     data.espera_fin,
        'hora_total':     data.hora_total,
        'km_ini':         data.km_ini,
        'km_fin':         data.km_fin,
        'km_totales':     data.km_totales,
        'asalariado':     data.asalariado,
        'autorizado_por': data.autorizado_por,
        'importe_suplidos': data.importe_suplidos,
    };

    Object.entries(map).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) el.value = val ?? '';
    });

    // Checkboxes de servicio como indicadores visuales
    const boolFields = { urbano_val: data.urbano, diurno_val: data.diurno, noct_fest_val: data.noct_fest, remolque_val: data.remolque };
    Object.entries(boolFields).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.toggle('text-green-600', !!val);
            el.classList.toggle('font-black', !!val);
        }
    });
}

/**
 * Configura los eventos de los botones de la cabecera
 */
function configurarBotones(id) {
    const btnEdit = document.getElementById('btn_edit_direct');
    if (btnEdit) {
        btnEdit.addEventListener('click', () => {
            window.location.href = `/admin/albaranes/update/${id}`;
        });
    }
}

/**
 * Muestra errores en la interfaz
 */
function mostrarNotificacion(mensaje, tipo) {
    const errDiv = document.getElementById('errorMessage');
    if (errDiv) {
        errDiv.textContent = mensaje;
        errDiv.classList.remove('hidden');
        errDiv.className = tipo === 'error'
            ? 'bg-red-100 text-red-700 p-4 rounded-xl'
            : 'bg-green-100 text-green-700 p-4 rounded-xl';
    } else {
        console.warn("Aviso al usuario:", mensaje);
    }
}