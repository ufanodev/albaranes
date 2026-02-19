/**
 * ARCHIVO: admin_albaran_cargar.js
 * FUNCIÓN: Motor universal para llenar formularios de albaranes (View, Edit, Copy).
 * ACTUALIZADO: 19/02/2026
 */

const AlbaranLoader = {
    // Formateador de tiempo robusto para inputs type="time"
    formatTime(isoValue) {
        if (!isoValue) return "";
        // Si ya viene como HH:mm o HH:mm:ss, extraemos los primeros 5
        if (isoValue.includes(':') && !isoValue.includes('T')) return isoValue.substring(0, 5);
        // Si es formato ISO fecha
        try {
            const date = new Date(isoValue);
            if (isNaN(date.getTime())) return "";
            return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false });
        } catch (e) { return ""; }
    },

    /**
     * @param {Object} data - Datos del albarán desde la API
     * @param {Boolean} isCloning - Si es true, ignora IDs y permite editar campos clave
     */
    populateForm(data, isCloning = false) {
        if (!data) return;
        const form = document.getElementById('albaranForm');
        if (!form) return;

        console.log(`🚀 [LOADER] Poblando datos. Modo: ${isCloning ? 'CLONACIÓN' : 'EDICIÓN/VISTA'}`);

        // 1. Manejo del Header visual (si existe)
        const headerNum = document.getElementById('header_num');
        if (headerNum) headerNum.textContent = isCloning ? `(NUEVA COPIA)` : `#${data.numero_albaran}`;

        // 2. Mapeo Automático por Atributo 'name' o 'id'
        // Esto hace que funcione en cualquier HTML sin importar el orden
        Object.keys(data).forEach(key => {
            
            // REGLA DE CLONACIÓN: No heredar identificadores únicos ni datos de cobro antiguos
            if (isCloning && ['id', 'ID', 'created_at', 'updated_at', 'num_factura', 'fecha_cobro', 'fecha_pago'].includes(key)) {
                return;
            }

            // Buscamos el elemento por nombre (estándar de formularios) o por ID
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
                    el.value = (value === null || value === undefined) ? '' : value;
                }
            }
        });

        // 3. Ajustes específicos de campos con nombres distintos entre DB e ID de HTML
        const mapping = {
            'cliente': 'nombre_pasajero', // Si en DB es cliente y en HTML nombre_pasajero
            'licencia': 'licencia_ref'
        };

        Object.entries(mapping).forEach(([dbKey, htmlId]) => {
            const el = document.getElementById(htmlId);
            if (el && data[dbKey]) {
                el.value = data[dbKey];
            }
        });

        // 4. LÓGICA DE CLONACIÓN (Desbloqueo)
        if (isCloning) {
            const fieldsToUnlock = ['licencia_ref', 'numero_albaran', 'n_albaran'];
            fieldsToUnlock.forEach(id => {
                const field = document.getElementById(id);
                if (field) {
                    field.readOnly = false;
                    field.disabled = false;
                    field.classList.remove('input-readonly', 'bg-slate-100');
                    if (id.includes('albaran')) field.value = "COPIA-" + (field.value || "");
                }
            });
        }
    }
};

// Exponer funciones al scope global para que los otros scripts las vean
window.loadAlbaranToEdit = AlbaranLoader.populateForm.bind(AlbaranLoader);
window.populateForm = AlbaranLoader.populateForm.bind(AlbaranLoader);