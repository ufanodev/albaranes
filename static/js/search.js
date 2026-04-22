/**
 * ARCHIVO: static/js/search.js
 * FUNCIÓN: Cerebro de búsqueda universal (User, Admin, Liquidaciones).
 * ACTUALIZADO: 22/04/2026 - FIX: Búsqueda profunda por palabra (soporte nulos y 'Titular').
 */

window.SearchEngine = {
    empresasCatalog: {},
    licenciasCatalog: {},

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

    applyFilters(data, params) {
        const { mode, empresa, licencia, ref, desde, hasta, palabra, estado, pagado, num_albaran } = params;
        
        return data.filter(i => {
            const nombreEmp = (this.getEmpresaNombre(i)).toLowerCase();
            const numLicencia = (this.getLicenciaNumero(i)).toLowerCase();

            // --- MODO PALABRA (Búsqueda Global) ---
            if (mode === 'palabra') {
                if (!palabra || palabra.trim() === "") return true;
                
                const query = palabra.toLowerCase();

                // FIX: Normalizamos los valores para que nunca sean null/undefined
                const asalariado = i.asalariado ? i.asalariado.toLowerCase() : "titular"; // Si está vacío, buscamos por 'titular'
                const albaran = i.numero_albaran ? String(i.numero_albaran).toLowerCase() : "";
                const referencia = i.referencia ? i.referencia.toLowerCase() : "";
                const cliente = i.cliente ? i.cliente.toLowerCase() : "";
                const obs = i.observaciones ? i.observaciones.toLowerCase() : "";
                const obsAdmin = i.observaciones_admin ? i.observaciones_admin.toLowerCase() : "";

                // Creamos un array de términos de búsqueda reales
                const searchFields = [
                    albaran,
                    referencia,
                    nombreEmp,
                    numLicencia,
                    asalariado,
                    cliente,
                    obs,
                    obsAdmin
                ];

                // Verificamos si la query existe en alguno de los campos
                return searchFields.some(field => field.includes(query));
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