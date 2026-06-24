/**
 * ARCHIVO: static/js/search.js
 * FUNCIÓN: Cerebro de búsqueda universal (User, Admin, Liquidaciones).
 * ACTUALIZADO: 24/06/2026
 *   - FIX: _bool() normaliza tinyint (0/1), boolean y string '0'/'1' uniformemente
 *   - FIX: matchPago usa _bool() en vez de comparación estricta === true/false
 *   - FIX: matchEstado usa _bool() en todos sus campos (enviado, cobrado, pagado)
 *   - FIX: applyFilters acepta pagado='true'/'false'/'' igual que admin_pago_tit.js
 */

window.SearchEngine = {
    empresasCatalog: {},
    licenciasCatalog: {},

    /**
     * Normaliza cualquier representación de boolean que MySQL/API pueda devolver:
     * true, 1, '1', 'true'  → true
     * false, 0, '0', 'false', null, undefined → false
     */
    _bool(val) {
        if (val === true  || val === 1  || val === '1'  || val === 'true')  return true;
        if (val === false || val === 0  || val === '0'  || val === 'false') return false;
        return false; // null / undefined / cualquier otro
    },

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
            console.log('🧠 [SearchEngine] Catálogos sincronizados.');
        } catch (e) {
            console.error('❌ [SearchEngine] Error en carga:', e);
        }
    },

    populateSelect(possibleIds, list, fieldName) {
        let select = null;
        for (const id of possibleIds) {
            select = document.getElementById(id);
            if (select) break;
        }
        if (!select) return;

        const ordenadas = [...list].sort((a, b) =>
            String(a[fieldName]).localeCompare(String(b[fieldName]), undefined, { numeric: true })
        );

        const isLicencia = possibleIds[0].toLowerCase().includes('licencia');
        const label = isLicencia ? 'LICENCIAS' : 'EMPRESAS';

        let html = `<option value="">🎯 TODAS LAS ${label}</option>`;
        html += ordenadas
            .map(item => `<option value="${item.id}">${String(item[fieldName]).toUpperCase()}</option>`)
            .join('');
        select.innerHTML = html;
    },

    applyFilters(data, params) {
        const {
            mode, empresa, licencia, ref, desde, hasta,
            palabra, estado, pagado, num_albaran
        } = params;

        const b = this._bool.bind(this); // alias corto

        return data.filter(i => {
            const nombreEmp  = this.getEmpresaNombre(i).toLowerCase();
            const numLicencia = this.getLicenciaNumero(i).toLowerCase();

            /* ── MODO PALABRA (búsqueda global) ── */
            if (mode === 'palabra') {
                if (!palabra || !palabra.trim()) return true;
                const query = palabra.toLowerCase();

                const asalariado = i.asalariado ? i.asalariado.toLowerCase() : 'titular';
                const albaran    = i.numero_albaran  ? String(i.numero_albaran).toLowerCase()  : '';
                const referencia = i.referencia      ? i.referencia.toLowerCase()              : '';
                const cliente    = i.cliente         ? i.cliente.toLowerCase()                 : '';
                const obs        = i.observaciones   ? i.observaciones.toLowerCase()           : '';
                const obsAdmin   = i.observaciones_admin ? i.observaciones_admin.toLowerCase() : '';

                return [albaran, referencia, nombreEmp, numLicencia,
                        asalariado, cliente, obs, obsAdmin].some(f => f.includes(query));
            }

            /* ── MODO CAMPOS (filtros específicos) ── */

            const matchEmpresa  = !empresa     || String(i.empresa_ref)   === String(empresa);
            const matchLicencia = !licencia    || String(i.licencia_ref)  === String(licencia);
            const matchRef      = !ref         || (i.referencia && i.referencia.toLowerCase().includes(ref.toLowerCase()));
            const matchAlbaran  = !num_albaran || (i.numero_albaran && String(i.numero_albaran).includes(num_albaran));

            const fItem      = i.fecha ? i.fecha.substring(0, 10) : '';
            const matchDesde = !desde || fItem >= desde;
            const matchHasta = !hasta || fItem <= hasta;

            /* ── matchPago: normaliza tinyint 0/1 y string 'true'/'false' ── */
            let matchPago = true;
            if (pagado === 'true'  || pagado === 'si')  matchPago =  b(i.pagado);
            if (pagado === 'false' || pagado === 'no')  matchPago = !b(i.pagado);
            // pagado === '' → sin filtro, matchPago permanece true

            /* ── matchEstado: estados compuestos según lógica SQL del negocio ──
             *   creado   : enviado=0, cobrado=0, pagado=0
             *   enviado  : enviado=1, cobrado=0, pagado=0
             *   pendiente: enviado=1, cobrado=1, pagado=0  (pendiente de pago al titular)
             *   pagado   : enviado=1, cobrado=1, pagado=1
             *   cobrado  : cobrado=1 (cubre pendiente + pagado)
             */
            let matchEstado = true;
            if (estado) {
                const env = b(i.enviado);
                const cob = b(i.cobrado);
                const pag = b(i.pagado);

                if      (estado === 'creado')    matchEstado = !env && !cob && !pag;
                else if (estado === 'enviado')   matchEstado =  env && !cob && !pag;
                else if (estado === 'pendiente') matchEstado =  env &&  cob && !pag;
                else if (estado === 'pagado')    matchEstado =  env &&  cob &&  pag;
                else if (estado === 'cobrado')   matchEstado =  cob; // pendiente O pagado
            }

            return matchEmpresa && matchLicencia && matchRef && matchAlbaran
                && matchDesde   && matchHasta    && matchEstado && matchPago;
        });
    },

    getEmpresaNombre(item) {
        return this.empresasCatalog[item.empresa_ref] || item.empresa_nombre || '---';
    },

    getLicenciaNumero(item) {
        return this.licenciasCatalog[item.licencia_ref] || item.licencia || '---';
    }
};