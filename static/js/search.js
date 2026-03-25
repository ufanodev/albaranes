/**
 * ARCHIVO: static/js/search.js
 * IMPORTANCIA: Máxima (Motor de Datos Común)
 * FUNCIÓN: Diccionario de empresas y filtrado lógico universal.
 */

window.SearchEngine = {
    empresasCatalog: {},

    // Inicializa el catálogo para todas las vistas
    async initCatalog() {
        try {
            const resp = await fetch('/api/v1/empresas', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const json = await resp.json();
            const list = json.data || [];
            list.forEach(e => {
                this.empresasCatalog[e.id] = e.nombre.toUpperCase();
            });
            // Poblamos el select si existe en el HTML actual
            this.populateEmpresaSelect(list);
            console.log("🧠 [SearchEngine] Catálogo e hilos de búsqueda listos.");
        } catch (e) {
            console.error("❌ [SearchEngine] Error cargando catálogo:", e);
        }
    },

    populateEmpresaSelect(list) {
        const select = document.getElementById('empresa');
        if (!select) return;
        const ordenadas = [...list].sort((a, b) => a.nombre.localeCompare(b.nombre));
        select.innerHTML = '<option value="">🎯 Todas las empresas</option>' + 
            ordenadas.map(e => `<option value="${e.id}">${e.nombre.toUpperCase()}</option>`).join('');
    },

    // La lógica de filtrado que usarán todos los .js
    applyFilters(data, params) {
        const { mode, empresa, ref, desde, hasta, palabra, estado } = params;
        
        return data.filter(i => {
            const nombreEmp = (this.empresasCatalog[i.empresa_ref] || i.empresa_nombre || "").toLowerCase();
            
            if (mode === 'campos') {
                const matchEmpresa = !empresa || String(i.empresa_ref) === String(empresa);
                const matchRef = !ref || (i.referencia && i.referencia.toLowerCase().includes(ref.toLowerCase()));
                const matchDesde = !desde || i.fecha >= desde;
                const matchHasta = !hasta || i.fecha <= hasta;
                
                // Filtro de estado para la vista de búsqueda
                let matchEstado = true;
                if (estado === 'creado') matchEstado = !i.enviado && !i.pagado;
                else if (estado === 'enviado') matchEstado = i.enviado && !i.pagado;
                else if (estado === 'pagado') matchEstado = i.pagado;

                return matchEmpresa && matchRef && matchDesde && matchHasta && matchEstado;
            } else {
                // Modo Palabra (Búsqueda global)
                const searchTxt = `${i.numero_albaran} ${i.referencia} ${nombreEmp} ${i.asalariado} ${i.cliente || ""}`.toLowerCase();
                return !palabra || searchTxt.includes(palabra.toLowerCase());
            }
        });
    },

    getEmpresaNombre(item) {
        return this.empresasCatalog[item.empresa_ref] || item.empresa_nombre || "---";
    }
};