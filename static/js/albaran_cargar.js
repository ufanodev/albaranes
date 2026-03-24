/**
 * ARCHIVO: static/js/albaran_cargar.js
 * FUNCIÓN: Motor universal de inyección de datos (Pura y automática).
 * ACTUALIZADO: 24/03/2026 - Soporte para detección de etiquetas y IDs normalizados.
 */

const AlbaranLoader = {
    /**
     * Formatea una fecha ISO a estándar europeo DD-MM-YYYY
     */
    formatEuropeanDate(isoValue) {
        if (!isoValue || isoValue === "") return "-";
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
        if (typeof isoValue === 'string' && isoValue.length === 5 && isoValue.includes(':')) {
            return isoValue;
        }
        try {
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
     */
    populateForm(data) {
        if (!data) return;
        const container = document.getElementById('albaranForm');
        if (!container) {
            console.error("❌ [LOADER] No se encontró el contenedor #albaranForm");
            return;
        }

        console.log("%c🚀 [LOADER] Inyectando datos en IDs coincidentes...", "color: #FF8C00; font-weight: bold;");

        // Recorremos todas las llaves del objeto JSON (ej: cliente, numero_albaran, etc.)
        Object.keys(data).forEach(key => {
            // Buscamos el elemento HTML que tenga exactamente ese ID
            const el = document.getElementById(key);
            if (el) {
                this.assignValue(el, data[key], key);
            }
        });

        // 1. Caso especial: El número de albarán en la cabecera del HTML (id="header_num")
        const headerNum = document.getElementById('header_num');
        if (headerNum && data.numero_albaran) {
            headerNum.textContent = `#${data.numero_albaran}`;
        }

        // 2. Caso especial: El importe grande en el cuadro oscuro (clase view-dark)
        const bigTotal = document.querySelector('.view-dark');
        if (bigTotal && data.importe_total) {
            bigTotal.textContent = parseFloat(data.importe_total).toFixed(2);
        }

        console.log("%c✅ [LOADER] Datos volcados con éxito.", "color: #10B981; font-weight: bold;");
    },

    /**
     * Inyecta el valor en el elemento detectando si es Input o Contenedor de Texto
     */
    assignValue(el, value, key) {
        const finalValue = (value === null || value === undefined) ? '' : value;
        const isInput = ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName);

        // Identificar tipo por nombre de clave
        const isDateField = key.toLowerCase().includes('fecha');
        const isTimeField = key.toLowerCase().includes('hora') || key.toLowerCase().includes('espera_');

        if (isInput) {
            // --- LÓGICA PARA FORMULARIOS (NUEVO / UPDATE) ---
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
        else {
            // --- LÓGICA PARA VISTAS (DIV / SPAN) ---
            if (isDateField && finalValue) {
                el.textContent = this.formatEuropeanDate(finalValue);
            } else if (isTimeField && finalValue) {
                el.textContent = this.formatTime(finalValue);
            } else {
                el.textContent = finalValue;
            }
            
            // Si el campo está vacío en vista, ponemos un guion elegante
            if (finalValue === '' || finalValue === null) {
                el.innerHTML = '<span class="text-slate-300">---</span>';
            }
        }
    }
};

// Exportación global
window.AlbaranLoader = AlbaranLoader;
window.populateForm = AlbaranLoader.populateForm.bind(AlbaranLoader);