/**
 * ARCHIVO: static/js/albaran_cargar.js
 * FUNCIÓN: Motor universal para llenar formularios y vistas de albaranes.
 * ACTUALIZADO: 19/03/2026 - FIX: Mapeo Cliente -> Nombre Pasajero con Logs de Auditoría.
 */

const AlbaranLoader = {
    // Formateador de tiempo para elementos visuales o inputs (HH:mm)
    formatTime(isoValue) {
        if (!isoValue) return "";
        if (typeof isoValue === 'string' && isoValue.length === 5 && isoValue.includes(':')) {
            return isoValue;
        }
        try {
            const date = new Date(isoValue);
            if (isNaN(date.getTime())) return "";
            return date.toLocaleTimeString('es-ES', { 
                hour: '2-digit', 
                minute: '2-digit', 
                hour12: false 
            });
        } catch (e) { return ""; }
    },

    /**
     * @param {Object} data - Datos del albarán desde la API (JSON)
     * @param {Boolean} isCloning - Si es true, limpia identificadores y campos de cobro.
     */
    populateForm(data, isCloning = false) {
        if (!data) return;
        const form = document.getElementById('albaranForm');
        if (!form) {
            console.error("❌ [LOADER] No se encontró el contenedor #albaranForm");
            return;
        }

        console.log("%c🚀 [LOADER] Iniciando mapeo de datos...", "color: #FF8C00; font-weight: bold;");

        // 1. MAPEADO AUTOMÁTICO GENERAL (Busca por atributo 'name' o por 'id')
        Object.keys(data).forEach(key => {
            if (isCloning && ['id', 'ID', 'created_at', 'updated_at', 'num_factura', 'fecha_cobro', 'fecha_pago'].includes(key)) {
                return;
            }

            const el = form.querySelector(`[name="${key}"]`) || document.getElementById(key);
            if (el) {
                this.assignValue(el, data[key]);
            }
        });

        // 2. MAPEADO ESPECÍFICO (Corrección de discrepancias DB vs HTML)
        // ✅ AQUÍ ESTÁ EL TRUCO: 'cliente' (SQL) -> 'nombre_pasajero' (HTML)
        const specialMapping = {
            'cliente': 'nombre_pasajero',   // Pedro Picapiedra
            'empresa_ref': 'empresa',       // ID numérico
            'licencia_ref': 'licencia',     // ID numérico
            'referencia': 'referencia'      // Texto Ref
        };

        console.log("%c🔍 [LOADER] Aplicando mapeos especiales...", "color: #3B82F6;");

        Object.entries(specialMapping).forEach(([jsonKey, htmlId]) => {
            const el = document.getElementById(htmlId) || form.querySelector(`[name="${htmlId}"]`);
            if (el) {
                const val = data[jsonKey];
                console.log(`   🔗 Mapeando: ${jsonKey} ("${val}") -> #${htmlId}`);
                this.assignValue(el, val);
                
                // Disparar evento change por si hay lógica dependiente
                el.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
                console.warn(`   ⚠️ No se encontró el elemento HTML #${htmlId} para la clave ${jsonKey}`);
            }
        });

        // 3. Ajuste de cabecera visual
        const headerNum = document.getElementById('header_num');
        if (headerNum) {
            headerNum.textContent = isCloning ? `COPIA DE #${data.numero_albaran}` : `#${data.numero_albaran}`;
        }

        if (isCloning) this.unlockFieldsForCloning(form);
        
        console.log("%c✅ [LOADER] Proceso finalizado.", "color: #10B981; font-weight: bold;");
    },

    /**
     * Asigna valores inteligentemente según el tipo de elemento
     */
    assignValue(el, value) {
        const finalValue = (value === null || value === undefined) ? '' : value;

        // Caso A: Elementos de Formulario (INPUT, SELECT, TEXTAREA)
        if (['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)) {
            if (el.type === 'checkbox') {
                el.checked = Boolean(value);
            } else if (el.type === 'date') {
                el.value = finalValue ? String(finalValue).substring(0, 10) : '';
            } else if (el.type === 'time') {
                el.value = this.formatTime(finalValue);
            } else {
                el.value = finalValue;
            }
        } 
        // Caso B: Elementos de Visualización (DIV, SPAN, P, TD)
        else {
            el.textContent = finalValue;
            // Si el campo estaba vacío, poner un guion para que no se rompa el diseño
            if (finalValue === '') el.innerHTML = '<span class="text-gray-300">-</span>';
        }
    },

    unlockFieldsForCloning(form) {
        const toUnlock = ['licencia', 'numero_albaran', 'referencia', 'empresa'];
        toUnlock.forEach(id => {
            const field = document.getElementById(id) || form.querySelector(`[name="${id}"]`);
            if (field) {
                field.readOnly = false;
                field.disabled = false;
                field.classList.remove('bg-gray-100', 'cursor-not-allowed', 'opacity-70');
                if (id.includes('albaran')) field.value = "COPY-" + (field.value || "");
            }
        });
    }
};

// Exposición global
window.AlbaranLoader = AlbaranLoader;
window.populateForm = AlbaranLoader.populateForm.bind(AlbaranLoader);