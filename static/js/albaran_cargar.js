/**
 * ARCHIVO: static/js/albaran_cargar.js
 * FUNCIÓN: Motor universal de inyección de datos para todas las vistas.
 * ACTUALIZADO: 15/04/2026 - FIX: Sincronización de zona horaria (Local España vs Cloud Francia).
 */

const AlbaranLoader = {
    formatEuropeanDate(isoValue) {
        if (!isoValue) return "-";
        // Al usar split('T')[0] evitamos que el objeto Date reste un día por la zona horaria
        const cleanDate = typeof isoValue === 'string' ? isoValue.split('T')[0] : isoValue;
        const date = new Date(cleanDate);
        if (isNaN(date.getTime())) return isoValue;
        return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    },

    formatTime(isoValue) {
        if (!isoValue) return "--:--";
        
        // Si ya es un formato corto HH:mm y no viene del ISO del servidor, lo devolvemos tal cual
        if (typeof isoValue === 'string' && isoValue.includes(':') && isoValue.length === 5) {
            return isoValue;
        }

        try {
            const date = new Date(isoValue);
            if (isNaN(date.getTime())) {
                // Si falla el objeto Date pero es un string con ":" (ej: "09:00:00")
                if (typeof isoValue === 'string' && isoValue.includes(':')) {
                    return isoValue.substring(0, 5);
                }
                return "--:--";
            }

            /**
             * SOLUCIÓN ZONA HORARIA:
             * Usamos toLocaleTimeString configurando la zona horaria de Europa/Madrid.
             * Esto forzará que si el servidor manda 10:00Z (UTC), el navegador 
             * lo muestre como 12:00 (España Verano) o 11:00 (España Invierno).
             */
            return date.toLocaleTimeString('es-ES', { 
                hour: '2-digit', 
                minute: '2-digit', 
                hour12: false,
                timeZone: 'Europe/Madrid' 
            });
        } catch (e) { 
            return "--:--"; 
        }
    },

    /**
     * @param {Object} data - Objeto JSON del albarán desde el servidor
     */
    populateForm(data) {
        if (!data) return;
        console.log("📦 [LOADER] Inyectando datos con ajuste horario:", data);

        // Mapeos de compatibilidad (Backend -> HTML)
        const mappedData = { ...data };
        if (data.cliente) mappedData.nombre_pasajero = data.cliente;
        if (data.adjuntos_ref) mappedData.adjuntos = data.adjuntos_ref;

        Object.keys(mappedData).forEach(key => {
            const elements = document.querySelectorAll(`#${key}, [name="${key}"]`);
            elements.forEach(el => {
                this.assignValue(el, mappedData[key], key);
            });
        });

        const headerNum = document.getElementById('header_num');
        if (headerNum && data.numero_albaran) headerNum.textContent = `#${data.numero_albaran}`;

        const bigTotal = document.getElementById('importe_total');
        if (bigTotal && data.importe_total !== undefined) {
            const val = parseFloat(data.importe_total).toFixed(2);
            if (bigTotal.tagName === 'INPUT') bigTotal.value = val;
            else bigTotal.textContent = val;
        }
    },

    assignValue(el, value, key) {
        const isInput = ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName);
        const isDateField = key.toLowerCase().includes('fecha');
        const isTimeField = (key.toLowerCase().includes('hora') || key.toLowerCase().includes('espera_')) && key !== 'hora_total';

        let val = (value === null || value === undefined) ? '' : value;

        if (isInput) {
            if (el.type === 'checkbox') {
                el.checked = Boolean(value);
            } else if (el.type === 'date') {
                // Fix para inputs de tipo fecha: siempre YYYY-MM-DD literal
                el.value = val ? String(val).split('T')[0] : '';
            } else if (el.type === 'time') {
                el.value = this.formatTime(val);
            } else if (key === 'hora_total') {
                el.value = val !== '' ? parseFloat(val).toFixed(2) : '0.00';
            } else {
                el.value = val;
            }
        } else {
            if (isDateField && val) {
                el.textContent = this.formatEuropeanDate(val);
            } else if (isTimeField && val) {
                el.textContent = this.formatTime(val);
            } else if (key === 'hora_total') {
                el.textContent = val !== '' ? parseFloat(val).toFixed(2) : '0.00';
            } else {
                el.textContent = val;
            }
            
            if (val === '') el.innerHTML = '<span class="text-slate-300">---</span>';
        }
    }
};

window.AlbaranLoader = AlbaranLoader;