/**
 * ARCHIVO: static/js/albaran_cargar.js
 * FUNCIÓN: Motor universal de inyección de datos para todas las vistas.
 * ACTUALIZADO: 27/03/2026 - FIX: Soporte para decimales sexagesimales (0.35) y mapeo dual.
 */

const AlbaranLoader = {
    formatEuropeanDate(isoValue) {
        if (!isoValue) return "-";
        const date = new Date(isoValue);
        if (isNaN(date.getTime())) return isoValue;
        return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    },

    formatTime(isoValue) {
        if (!isoValue) return "--:--";
        if (typeof isoValue === 'string' && isoValue.includes(':') && isoValue.length <= 8) return isoValue.substring(0, 5);
        try {
            const date = new Date(isoValue);
            if (isNaN(date.getTime())) return "--:--";
            return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false });
        } catch (e) { return "--:--"; }
    },

    /**
     * @param {Object} data - Objeto JSON del albarán desde el servidor
     */
    populateForm(data) {
        if (!data) return;
        console.log("📦 [LOADER] Inyectando datos:", data);

        // Mapeos de compatibilidad (Backend -> HTML)
        const mappedData = { ...data };
        if (data.cliente) mappedData.nombre_pasajero = data.cliente;
        if (data.adjuntos_ref) mappedData.adjuntos = data.adjuntos_ref;

        Object.keys(mappedData).forEach(key => {
            // Buscamos por ID (Vistas Detalle) o por atributo Name (Formularios Admin/Titular)
            const elements = document.querySelectorAll(`#${key}, [name="${key}"]`);
            
            elements.forEach(el => {
                this.assignValue(el, mappedData[key], key);
            });
        });

        // Caso especial Cabecera
        const headerNum = document.getElementById('header_num');
        if (headerNum && data.numero_albaran) headerNum.textContent = `#${data.numero_albaran}`;

        // Caso especial Importe Total (Caja Oscura)
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
        // Excluimos hora_total del formateo de reloj (HH:mm)
        const isTimeField = (key.toLowerCase().includes('hora') || key.toLowerCase().includes('espera_')) && key !== 'hora_total';

        let val = (value === null || value === undefined) ? '' : value;

        if (isInput) {
            // --- MODO FORMULARIO (Admin / Nuevo) ---
            if (el.type === 'checkbox') {
                el.checked = Boolean(value);
            } else if (el.type === 'date') {
                el.value = val ? String(val).substring(0, 10) : '';
            } else if (el.type === 'time') {
                el.value = this.formatTime(val);
            } else if (key === 'hora_total') {
                el.value = val !== '' ? parseFloat(val).toFixed(2) : '0.00';
            } else {
                el.value = val;
            }
        } else {
            // --- MODO VISTA (Detalle Albarán) ---
            if (isDateField && val) {
                el.textContent = this.formatEuropeanDate(val);
            } else if (isTimeField && val) {
                el.textContent = this.formatTime(val);
            } else if (key === 'hora_total') {
                // Forzamos visualización decimal exacta (0.35)
                el.textContent = val !== '' ? parseFloat(val).toFixed(2) : '0.00';
            } else {
                el.textContent = val;
            }
            
            // Estética para campos vacíos en vista
            if (val === '') el.innerHTML = '<span class="text-slate-300">---</span>';
        }
    }
};

window.AlbaranLoader = AlbaranLoader;