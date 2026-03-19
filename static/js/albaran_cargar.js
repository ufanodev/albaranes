/**
 * ARCHIVO: static/js/admin_albaran_cargar.js
 * FUNCIÓN: Motor universal para llenar formularios de albaranes.
 * ACTUALIZADO: 19/02/2026 - FIX: Mapeo de EmpresaRef y Referencia.
 */

const AlbaranLoader = {
    // Formateador de tiempo para inputs type="time" (HH:mm)
    formatTime(isoValue) {
        if (!isoValue) return "";
        // Si ya es un string corto tipo "14:30", devolverlo
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
     * @param {Boolean} isCloning - Si es true, limpia IDs y campos de cobro.
     */
    populateForm(data, isCloning = false) {
        if (!data) return;
        const form = document.getElementById('albaranForm');
        if (!form) {
            console.error("❌ [LOADER] No se encontró el elemento #albaranForm");
            return;
        }

        console.log("🚀 [LOADER] Procesando datos del albarán:", data.numero_albaran);

        // 1. Mapeo Automático General (Busca por name o id)
        Object.keys(data).forEach(key => {
            // Regla de exclusión para clonación
            if (isCloning && ['id', 'ID', 'created_at', 'updated_at', 'num_factura', 'fecha_cobro', 'fecha_pago'].includes(key)) {
                return;
            }

            const el = form.querySelector(`[name="${key}"]`) || document.getElementById(key);

            if (el) {
                const value = data[key];

                if (el.type === 'checkbox') {
                    el.checked = Boolean(value);
                } 
                else if (el.type === 'date') {
                    el.value = value ? value.substring(0, 10) : '';
                } 
                else if (el.type === 'time') {
                    el.value = this.formatTime(value);
                } 
                else {
                    // Manejo de valores null (común en punteros de Go como Referencia)
                    el.value = (value === null || value === undefined) ? '' : value;
                }
            }
        });

        // 2. Mapeo Específico (Sincronización Model Go -> HTML ID)
        // Aquí corregimos los campos que no coinciden exactamente
        const specialMapping = {
            'cliente': 'nombre_pasajero',   // JSON: cliente -> HTML: nombre_pasajero
            'empresa_ref': 'empresa',       // JSON: empresa_ref -> HTML: empresa (select)
            'licencia_ref': 'licencia_ref', // JSON: licencia_ref -> HTML: licencia_ref
            'referencia': 'referencia'      // JSON: referencia -> HTML: referencia
        };

        Object.entries(specialMapping).forEach(([jsonKey, htmlId]) => {
            const el = document.getElementById(htmlId);
            if (el) {
                const val = data[jsonKey];
                el.value = (val === null || val === undefined) ? '' : val;
                
                // IMPORTANTE: Disparar evento 'change' para que los selects se actualicen
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });

        // 3. Lógica visual de cabecera
        const headerNum = document.getElementById('header_num');
        if (headerNum) {
            headerNum.textContent = isCloning ? `COPIA DE #${data.numero_albaran}` : `#${data.numero_albaran}`;
        }

        // 4. Desbloqueo si es modo clonación o edición
        if (isCloning) {
            this.unlockFieldsForCloning(form);
        }
    },

    unlockFieldsForCloning(form) {
        const toUnlock = ['licencia_ref', 'numero_albaran', 'n_albaran', 'referencia', 'empresa'];
        toUnlock.forEach(id => {
            const field = document.getElementById(id) || form.querySelector(`[name="${id}"]`);
            if (field) {
                field.readOnly = false;
                field.disabled = false;
                field.classList.remove('bg-gray-100', 'cursor-not-allowed');
                if (id.includes('albaran')) field.value = "COPY-" + (field.value || "");
            }
        });
    }
};

// Exposición global
window.AlbaranLoader = AlbaranLoader;
window.populateForm = AlbaranLoader.populateForm.bind(AlbaranLoader);