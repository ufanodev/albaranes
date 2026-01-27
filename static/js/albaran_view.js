/**
 * ARCHIVO: static/js/albaran_view.js
 * DESCRIPCIÓN: Lógica mejorada para la visualización (Sólo Lectura) del albarán.
 * ACTUALIZADO: 27/01/2026 - Versión con debugging mejorado
 */

document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 [VIEW] Iniciando motor de renderizado de solo lectura...");

    // 1. Extracción del ID desde la URL (Soporta /titulares/view/77 o /titulares/view?id=77)
    let albaranId = new URLSearchParams(window.location.search).get('id');
    if (!albaranId) {
        const pathParts = window.location.pathname.split('/').filter(p => p !== "");
        albaranId = pathParts[pathParts.length - 1];
    }

    console.log(`🔍 [VIEW] URL completa: ${window.location.href}`);
    console.log(`🔍 [VIEW] ID extraído: ${albaranId}`);

    if (!albaranId || isNaN(albaranId)) {
        console.error("❌ [VIEW] ID no válido detectado en URL.");
        showError("El identificador del albarán es inválido.");
        return;
    }

    try {
        // 2. Consulta a la API
        console.log(`📡 [VIEW] Solicitando datos para Albarán ID: ${albaranId}`);
        const response = await fetch(`/api/v1/albaranes/id/${albaranId}`);

        console.log(`📊 [VIEW] Respuesta HTTP status: ${response.status}`);

        if (response.status === 401) {
            console.warn("⚠️ [VIEW] Usuario no autenticado, redirigiendo...");
            window.location.href = '/login';
            return;
        }

        if (!response.ok) {
            const errorData = await response.json();
            console.error("❌ [VIEW] Error en respuesta:", errorData);
            throw new Error(errorData.error || "No se pudo recuperar la información del servidor.");
        }

        const result = await response.json();
        console.log("📦 [VIEW] Respuesta completa del servidor:", result);

        const data = result.data;

        if (!data) {
            console.error("❌ [VIEW] No hay datos en la respuesta");
            throw new Error("El albarán no contiene datos válidos.");
        }

        console.log("✅ [VIEW] Datos maestros recibidos:", data);

        // 3. MAPEO INTEGRAL AL HTML
        
        // Helper para rellenar DIVs de texto con logging
        const setText = (id, value) => {
            const el = document.getElementById(id);
            if (el) {
                const displayValue = (value !== null && value !== undefined && value !== "") ? String(value) : '-';
                el.textContent = displayValue;
                console.log(`✓ [VIEW] ${id} = "${displayValue}"`);
            } else {
                console.warn(`⚠️ [VIEW] Elemento con ID '${id}' no encontrado en el HTML.`);
            }
        };

        // Helper para formatear tiempos (HH:mm)
        const fmtTime = (t) => {
            if (!t) return '--:--';
            if (t.includes('T')) return t.split('T')[1].substring(0, 5);
            return t.substring(0, 5);
        };

        console.log("🎨 [VIEW] Iniciando renderizado de campos...");

        // --- BLOQUE 1: IDENTIFICACIÓN DEL SERVICIO ---
        console.log("📋 [VIEW] Bloque 1: Identificación");
        setText('licencia', data.licencia);
        setText('numero_albaran', data.numero_albaran);
        setText('referencia', data.referencia);
        setText('fecha', data.fecha ? data.fecha.split('T')[0] : '-');
        setText('hora_ini', fmtTime(data.hora_ini));
        setText('hora_fin', fmtTime(data.hora_fin));

        // --- BLOQUE 2: CLIENTE Y PASAJERO ---
        console.log("👤 [VIEW] Bloque 2: Cliente y Pasajero");
        setText('empresa_nombre', data.empresa_nombre);
        setText('nombre_pasajero', data.nombre_pasajero);
        setText('tlf_pasajero', data.tlf_pasajero);
        setText('dni_pasajero', data.dni_pasajero);
        setText('matricula', data.matricula);

        // --- BLOQUE 3: RUTA Y TIEMPOS DE ESPERA ---
        console.log("🗺️ [VIEW] Bloque 3: Ruta y Tiempos");
        setText('origen', data.origen);
        setText('parada', data.parada);
        setText('destino', data.destino);
        setText('hora_total', parseFloat(data.hora_total || 0).toFixed(2));
        setText('espera_ini', fmtTime(data.espera_ini));
        setText('espera_fin', fmtTime(data.espera_fin));

        // --- BLOQUE 4: CONTROL DE KILOMETRAJE ---
        console.log("🚗 [VIEW] Bloque 4: Kilometraje");
        setText('km_totales', parseFloat(data.km_totales || 0).toFixed(2));
        setText('km_nacionales', parseFloat(data.km_nacionales || 0).toFixed(2));
        setText('km_internacionales', parseFloat(data.km_internacionales || 0).toFixed(2));

        const check = (id, val) => {
            const el = document.getElementById(id);
            if (el) {
                const isChecked = (val === true || val === 1 || String(val).toLowerCase() === 'true');
                el.checked = isChecked;
                console.log(`☑️ [VIEW] ${id} = ${isChecked}`);
            } else {
                console.warn(`⚠️ [VIEW] Checkbox '${id}' no encontrado`);
            }
        };
        check('urbano', data.urbano);
        check('diurno', data.diurno);
        check('noct_fest', data.noct_fest);

        // --- BLOQUE 5: LIQUIDACIÓN E IMPORTES ---
        console.log("💰 [VIEW] Bloque 5: Liquidación");
        setText('importe_suplidos', parseFloat(data.importe_suplidos || 0).toFixed(2));
        setText('autorizado_por', data.autorizado_por);
        setText('asalariado', data.asalariado || 'TITULAR DE LICENCIA');
        setText('num_plazas', data.num_plazas);
        setText('adjuntos_ref', data.adjuntos_ref);
        
        check('remolque', data.remolque);
        check('adjuntos_bool', data.adjuntos);

        // Observaciones (uso innerText para respetar saltos de línea)
        const obsEl = document.getElementById('observaciones');
        if (obsEl) {
            obsEl.innerText = data.observaciones || 'Sin observaciones registradas.';
            console.log(`📝 [VIEW] observaciones = "${data.observaciones}"`);
        } else {
            console.warn("⚠️ [VIEW] Campo 'observaciones' no encontrado");
        }

        // Importe Total (Bloque Negro)
        const impTotal = document.getElementById('importe_total');
        if (impTotal) {
            const totalValue = parseFloat(data.importe_total || 0).toFixed(2);
            impTotal.textContent = totalValue;
            console.log(`💵 [VIEW] importe_total = ${totalValue}`);
        } else {
            console.warn("⚠️ [VIEW] Campo 'importe_total' no encontrado");
        }

        // 4. FINALIZAR UI
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator) {
            loadingIndicator.classList.add('hidden');
            console.log("🔄 [VIEW] Indicador de carga ocultado");
        }

        if (window.lucide) {
            lucide.createIcons();
            console.log("✨ [VIEW] Iconos Lucide renderizados.");
        }

        console.log("✅ [VIEW] Proceso de renderizado finalizado con éxito.");
        console.log("📊 [VIEW] Resumen de datos cargados:", {
            licencia: data.licencia,
            numero_albaran: data.numero_albaran,
            importe_total: data.importe_total,
            fecha: data.fecha
        });

    } catch (error) {
        console.error("❌ [VIEW] Error crítico:", error);
        console.error("❌ [VIEW] Stack trace:", error.stack);
        showError(error.message);
    }
});

/**
 * Función para mostrar errores en la interfaz
 */
function showError(msg) {
    console.error("🚨 [VIEW] Mostrando error al usuario:", msg);
    const errEl = document.getElementById('errorMessage');
    if (errEl) {
        errEl.innerHTML = `<span>❌ Error de Carga: ${msg}</span>`;
        errEl.classList.remove('hidden');
    }
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) {
        loadingIndicator.classList.add('hidden');
    }
}