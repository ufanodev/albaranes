/**
 * ARCHIVO: static/js/search.js
 * FUNCIÓN: Cerebro de búsqueda universal (User & Admin).
 */
window.SearchEngine = {
    empresasCatalog: {},
    licenciasCatalog: {},

    async initCatalog(isAdmin = false) {
        try {
            const headers = { 'Authorization': `Bearer ${localStorage.getItem('token')}` };
            
            // 1. Cargar Empresas
            const respEmp = await fetch('/api/v1/empresas', { headers });
            const jsonEmp = await respEmp.json();
            const listEmp = jsonEmp.data || [];
            listEmp.forEach(e => this.empresasCatalog[e.id] = e.nombre.toUpperCase());
            this.populateSelect(['empresaSelect', 'empresa'], listEmp, 'nombre');

            // 2. Cargar Licencias (Solo Admin)
            if (isAdmin) {
                const respLic = await fetch('/api/v1/licencias', { headers });
                const jsonLic = await respLic.json();
                const listLic = jsonLic.data || jsonLic || [];
                listLic.forEach(l => this.licenciasCatalog[l.id] = String(l.licencia).toUpperCase());
                this.populateSelect(['licenciaSelect', 'licencia'], listLic, 'licencia');
            }
            console.log("🧠 [SearchEngine] Catálogos sincronizados.");
        } catch (e) { console.error("❌ [SearchEngine] Error:", e); }
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
        
        const label = possibleIds[0].toLowerCase().includes('licencia') ? 'LICENCIAS' : 'EMPRESAS';
        let html = `<option value="">🎯 TODAS LAS ${label}</option>`;
        html += ordenadas.map(item => `<option value="${item.id}">${String(item[fieldName]).toUpperCase()}</option>`).join('');
        select.innerHTML = html;
    },

    applyFilters(data, params) {
        const { mode, empresa, licencia, ref, desde, hasta, palabra, estado, num_albaran } = params;
        return data.filter(i => {
            const nombreEmp = (this.getEmpresaNombre(i)).toLowerCase();
            const numLicencia = (this.getLicenciaNumero(i)).toLowerCase();
            
            if (mode === 'campos') {
                const matchEmpresa = !empresa || String(i.empresa_ref) === String(empresa);
                const matchLicencia = !licencia || String(i.licencia_ref) === String(licencia);
                const matchRef = !ref || (i.referencia && i.referencia.toLowerCase().includes(ref.toLowerCase()));
                const matchAlbaran = !num_albaran || (i.numero_albaran && String(i.numero_albaran).includes(num_albaran));
                const fechaItem = i.fecha ? i.fecha.substring(0, 10) : "";
                const matchDesde = !desde || (fechaItem >= desde);
                const matchHasta = !hasta || (fechaItem <= hasta);
                
                let matchEstado = true;
                if (estado) {
                    if (estado === 'creado') matchEstado = !i.enviado && !i.pagado && !i.cobrado;
                    else if (estado === 'enviado') matchEstado = i.enviado && !i.pagado;
                    else if (estado === 'pagado') matchEstado = i.pagado;
                    else if (estado === 'cobrado') matchEstado = i.cobrado;
                }
                return matchEmpresa && matchLicencia && matchRef && matchAlbaran && matchDesde && matchHasta && matchEstado;
            } else {
                const searchTxt = `${i.numero_albaran || ""} ${i.referencia || ""} ${nombreEmp} ${numLicencia} ${i.asalariado || ""} ${i.cliente || ""}`.toLowerCase();
                return !palabra || searchTxt.includes(palabra.toLowerCase());
            }
        });
    },

    getEmpresaNombre(item) { return this.empresasCatalog[item.empresa_ref] || item.empresa_nombre || "---"; },
    getLicenciaNumero(item) { return this.licenciasCatalog[item.licencia_ref] || item.licencia || "---"; }
};