/**
 * ARCHIVO: static/js/albaran_cargar.js
 * FUNCIÓN: Motor universal de inyección de datos para todas las vistas.
 * ACTUALIZADO: 22/04/2026 - FIX: Formato forzado DD/MM/YYYY literal.
 */

const AlbaranLoader = {
    formatEuropeanDate(isoValue) {
        if (!isoValue) return "-";
        
        // 1. Extraemos solo la parte YYYY-MM-DD (ignorando T00:00:00Z)
        const cleanDate = String(isoValue).split('T')[0];
        const parts = cleanDate.split('-');

        // 2. Si tiene el formato esperado, invertimos el orden manualmente
        if (parts.length === 3) {
            // Resultado: DD/MM/YYYY
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }

        // Fallback: Si por alguna razón falla, devolvemos el valor original limpio
        return cleanDate;
    },

    formatTime(isoValue) {
        if (!isoValue) return "--:--";
        
        if (typeof isoValue === 'string' && isoValue.includes(':') && isoValue.length === 5) {
            return isoValue;
        }

        try {
            const date = new Date(isoValue);
            if (isNaN(date.getTime())) {
                if (typeof isoValue === 'string' && isoValue.includes(':')) {
                    return isoValue.substring(0, 5);
                }
                return "--:--";
            }

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