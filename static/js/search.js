/**
 * ARCHIVO: static/js/search.js
 * FUNCIÓN: Cerebro de búsqueda universal (User, Admin, Liquidaciones).
 * ACTUALIZADO: 26/03/2026 - FIX: Búsqueda por palabra excluyente y robusta.
 */

window.SearchEngine = {
    empresasCatalog: {},
    licenciasCatalog: {},

    /**
     * Inicializa catálogos de empresas y licencias.
     */
    async initCatalog(isAdmin = false) {
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
            
            const [respEmp, respLic] = await Promise.all([
                fetch('/api/v1/empresas', { headers }),
                isAdmin ? fetch('/api/v1/licencias', { headers }) : Promise.resolve(null)
            ]);

            const jsonEmp = await respEmp.json();
            const listEmp = jsonEmp.data || [];
            listEmp.forEach(e => this.empresasCatalog[e.id] = e.nombre.toUpperCase());
            this.populateSelect(['empresa', 'empresaSelect', 'empresa_ref'], listEmp, 'nombre');

            if (isAdmin && respLic) {
                const jsonLic = await respLic.json();
                const listLic = jsonLic.data || jsonLic || [];
                listLic.forEach(l => this.licenciasCatalog[l.id] = String(l.licencia).toUpperCase());
                this.populateSelect(['licenciaSelect', 'licencia', 'licencia_ref'], listLic, 'licencia');
            }
            console.log("🧠 [SearchEngine] Catálogos sincronizados.");
        } catch (e) {
            console.error("❌ [SearchEngine] Error en carga:", e);
        }
    },

    populateSelect(possibleIds, list, fieldName) {
        let select = null;
        for (let id of possibleIds) {
            select = document.getElementById(id);
            if (select) break;
        }
        if (!select) return;

        const ordenadas = [...list].sort((a, b) => 
            String(a[fieldName]).localeCompare(String(b[fieldName]), undefined, {numeric: true})
        );
        
        const isLicencia = possibleIds[0].toLowerCase().includes('licencia');
        const label = isLicencia ? 'LICENCIAS' : 'EMPRESAS';
        
        let html = `<option value="">🎯 TODAS LAS ${label}</option>`;
        html += ordenadas.map(item => `<option value="${item.id}">${String(item[fieldName]).toUpperCase()}</option>`).join('');
        select.innerHTML = html;
    },

    /**
     * Aplica filtrado lógico. 
     * Si el modo es 'palabra', ignora los filtros de campos individuales.
     */
    applyFilters(data, params) {
        const { mode, empresa, licencia, ref, desde, hasta, palabra, estado, pagado, num_albaran } = params;
        
        return data.filter(i => {
            const nombreEmp = (this.getEmpresaNombre(i)).toLowerCase();
            const numLicencia = (this.getLicenciaNumero(i)).toLowerCase();

            // --- MODO PALABRA (Búsqueda Global) ---
            if (mode === 'palabra') {
                if (!palabra || palabra.trim() === "") return true;
                
                const query = palabra.toLowerCase();
                const searchTxt = [
                    i.numero_albaran,
                    i.referencia,
                    nombreEmp,
                    numLicencia,
                    i.asalariado,
                    i.cliente,
                    i.observaciones,
                    i.observaciones_admin
                ].join(" ").toLowerCase();

                return searchTxt.includes(query);
            }

            // --- MODO CAMPOS (Filtros Específicos) ---
            const matchEmpresa = !empresa || String(i.empresa_ref) === String(empresa);
            const matchLicencia = !licencia || String(i.licencia_ref) === String(licencia);
            const matchRef = !ref || (i.referencia && i.referencia.toLowerCase().includes(ref.toLowerCase()));
            const matchAlbaran = !num_albaran || (i.numero_albaran && String(i.numero_albaran).includes(num_albaran));
            
            const fItem = i.fecha ? i.fecha.substring(0, 10) : "";
            const matchDesde = !desde || (fItem >= desde);
            const matchHasta = !hasta || (fItem <= hasta);
            
            let matchPago = true;
            if (pagado === 'si' || pagado === 'true') matchPago = i.pagado === true;
            if (pagado === 'no' || pagado === 'false') matchPago = i.pagado === false;

            let matchEstado = true;
            if (estado) {
                if (estado === 'creado') matchEstado = !i.enviado && !i.pagado && !i.cobrado;
                else if (estado === 'enviado') matchEstado = i.enviado && !i.pagado;
                else if (estado === 'pagado') matchEstado = i.pagado;
                else if (estado === 'cobrado') matchEstado = i.cobrado;
            }

            return matchEmpresa && matchLicencia && matchRef && matchAlbaran && matchDesde && matchHasta && matchEstado && matchPago;
        });
    },

    getEmpresaNombre(item) {
        return this.empresasCatalog[item.empresa_ref] || item.empresa_nombre || "---";
    },

    getLicenciaNumero(item) {
        return this.licenciasCatalog[item.licencia_ref] || item.licencia || "---";
    }
};