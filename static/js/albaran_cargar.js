/**
 * ARCHIVO: static/js/albaran_cargar.js
 * FUNCIÓN: Motor universal para llenar formularios y vistas de albaranes.
 * ACTUALIZADO: 19/03/2026 - FIX: Formato Europeo (DD-MM-YYYY HH:mm) y Mapeo de Cliente.
 */

const AlbaranLoader = {
    /**
     * Formatea una fecha ISO (2026-03-19...) a estándar europeo DD-MM-YYYY
     */
    formatEuropeanDate(isoValue) {
        if (!isoValue) return "-";
        try {
            const date = new Date(isoValue);
            if (isNaN(date.getTime())) return isoValue;
            
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            
            return `${day}-${month}-${year}`;
        } catch (e) { return "-"; }
    },

    /**
     * Formatea una hora ISO a HH:mm (24h) limpia
     */
    formatTime(isoValue) {
        if (!isoValue) return "--:--";
        // Si ya viene formateado como "HH:mm" (5 caracteres)
        if (typeof isoValue === 'string' && isoValue.length === 5 && isoValue.includes(':')) {
            return isoValue;
        }
        try {
            // Si es un objeto Date o string ISO
            const date = new Date(isoValue);
            if (isNaN(date.getTime())) return "--:--";
            return date.toLocaleTimeString('es-ES', { 
                hour: '2-digit', 
                minute: '2-digit', 
                hour12: false 
            });
        } catch (e) { return "--:--"; }
    },

    /**
     * @param {Object} data - Datos del albarán desde la API (JSON)
     * @param {Boolean} isCloning - Si es true, limpia IDs y campos administrativos.
     */
    populateForm(data, isCloning = false) {
        if (!data) return;
        const form = document.getElementById('albaranForm');
        if (!form) {
            console.error("❌ [LOADER] No se encontró el contenedor #albaranForm");
            return;
        }

        console.log("%c🚀 [LOADER] Cargando datos con formato europeo...", "color: #FF8C00; font-weight: bold;");

        // 1. MAPEADO AUTOMÁTICO GENERAL (Busca por name o id)
        Object.keys(data).forEach(key => {
            if (isCloning && ['id', 'ID', 'created_at', 'updated_at', 'num_factura', 'fecha_cobro', 'fecha_pago'].includes(key)) {
                return;
            }

            const el = form.querySelector(`[name="${key}"]`) || document.getElementById(key);
            if (el) {
                this.assignValue(el, data[key], key);
            }
        });

        // 2. MAPEADO ESPECÍFICO (Corrección de nombres DB vs HTML)
        const specialMapping = {
            'cliente': 'nombre_pasajero',   // Pedro Picapiedra
            'empresa_ref': 'empresa',       
            'licencia_ref': 'licencia',     
            'referencia': 'referencia'      
        };

        Object.entries(specialMapping).forEach(([jsonKey, htmlId]) => {
            const el = document.getElementById(htmlId) || form.querySelector(`[name="${htmlId}"]`);
            if (el) {
                const val = data[jsonKey];
                this.assignValue(el, val, jsonKey);
                // Notificar cambio para disparar validaciones o plugins
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });

        // 3. Ajuste visual de la cabecera
        const headerNum = document.getElementById('header_num');
        if (headerNum) {
            headerNum.textContent = isCloning ? `COPIA DE #${data.numero_albaran}` : `#${data.numero_albaran}`;
        }

        if (isCloning) this.unlockFieldsForCloning(form);
        console.log("%c✅ [LOADER] Mapeo completado con éxito.", "color: #10B981; font-weight: bold;");
    },

    /**
     * Inyecta el valor en el elemento detectando el tipo de campo
     */
    assignValue(el, value, key) {
        const finalValue = (value === null || value === undefined) ? '' : value;
        const isInput = ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName);

        // Identificar si el campo es de tipo Fecha u Hora por su nombre
        const isDateField = key.toLowerCase().includes('fecha');
        const isTimeField = key.toLowerCase().includes('hora') || key.toLowerCase().includes('espera_');

        if (isInput) {
            // --- LÓGICA PARA EDICIÓN (FORMULARIOS) ---
            if (el.type === 'checkbox') {
                el.checked = Boolean(value);
            } else if (el.type === 'date') {
                // El navegador requiere YYYY-MM-DD para el calendario
                el.value = finalValue ? String(finalValue).substring(0, 10) : '';
            } else if (el.type === 'time') {
                el.value = this.formatTime(finalValue);
            } else {
                el.value = finalValue;
            }
        } 
        else {
            // --- LÓGICA PARA VISTA (DIV / SPAN) ---
            if (isDateField && finalValue) {
                el.textContent = this.formatEuropeanDate(finalValue);
            } else if (isTimeField && finalValue) {
                el.textContent = this.formatTime(finalValue);
            } else {
                el.textContent = finalValue;
            }
            
            // Si el campo está vacío, ponemos un guion elegante
            if (finalValue === '' || finalValue === null) {
                el.innerHTML = '<span class="text-gray-300">-</span>';
            }
        }
    },

    /**
     * Habilita campos bloqueados cuando se clona un registro
     */
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

// Exportación global para que otros scripts lo vean
window.AlbaranLoader = AlbaranLoader;
window.populateForm = AlbaranLoader.populateForm.bind(AlbaranLoader);