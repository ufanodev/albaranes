/**
 * ARCHIVO: static/js/albaran_pendiente.js - Panel de Usuario (Titular)
 * GESTIÓN: Listado de Pendientes, Búsqueda, Paginación y Envío Masivo.
 * ACTUALIZADO: 24/03/2026 - FIX DEFINITIVO: Diccionario local para traducción de IDs a Nombres.
 */

(function() {
    // Variables de estado
    let localData = [];       
    let filteredData = [];    
    let empresasCatalog = {}; // Diccionario para traducir IDs a Nombres { "70": "CORTICHAPA" }
    let page = 1;
    let size = 20; 
    let currentUserLicId = null; 
    let currentSort = { key: 'fecha', direction: 'desc' };
    let searchMode = 'campos'; 

    /**
     * Inicialización del módulo
     */
    async function startApp() {
        console.log('🚀 [PENDIENTES] Iniciando motor con diccionario de empresas...');
        try {
            // 1. Obtener Identidad del Titular
            const resp = await fetch('/api/v1/user/licencia_info', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const identity = await resp.json();
            currentUserLicId = parseInt(identity.licencia_id);
            
            // 2. Cargar Empresas para el filtro y para el DICCIONARIO TRADUCTOR
            const rEmp = await fetch('/api/v1/empresas', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const dEmp = await rEmp.json();
            const empresasArr = dEmp.data || [];
            
            // Llenar el catálogo local para traducción inmediata
            empresasArr.forEach(e => {
                empresasCatalog[e.id] = e.nombre.toUpperCase();
            });
            console.log(`📦 Catálogo cargado: ${Object.keys(empresasCatalog).length} empresas listas.`);

            // Llenar el select del filtro
            const empresaSelect = document.getElementById('empresa');
            if (empresaSelect) {
                const ordenadas = [...empresasArr].sort((a, b) => a.nombre.localeCompare(b.nombre));
                empresaSelect.innerHTML = '<option value="">Todas las empresas</option>' + 
                    ordenadas.map(e => `<option value="${e.nombre}">${e.nombre.toUpperCase()}</option>`).join('');
            }

            setupEventListeners();
            await fetchData();

            // Si detecta que estamos en la vista de detalle, carga los campos adicionales
            if (window.location.pathname.includes('/view/')) {
                cargarDetalleAlbaran();
            }
        } catch (e) { 
            console.error("Error en inicio:", e); 
        }
    }

    function setupEventListeners() {
        document.getElementById('searchForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            applyFilters();
        });

        document.getElementById('palabra')?.addEventListener('input', () => {
            if (searchMode === 'palabra') applyFilters();
        });

        document.getElementById('recordsPerPage')?.addEventListener('change', (e) => {
            const val = e.target.value;
            size = val === 'todos' ? 9999 : parseInt(val);
            page = 1; 
            render();
        });

        document.getElementById('prevPageBtn')?.addEventListener('click', () => { if(page > 1) { page--; render(); } });
        document.getElementById('nextPageBtn')?.addEventListener('click', () => { if(page < Math.ceil(filteredData.length/size)) { page++; render(); } });

        document.getElementById('selectAll')?.addEventListener('change', (e) => {
            document.querySelectorAll('.select-albaran').forEach(cb => cb.checked = e.target.checked);
        });
    }

    async function fetchData() {
        const body = document.getElementById('albaranResults');
        if (body) body.innerHTML = '<tr><td colspan="11" class="text-center py-20 italic font-medium text-slate-400">Consultando registros...</td></tr>';
        
        try {
            const response = await fetch(`/api/v1/albaranes/search-user?licencia_ref=${currentUserLicId}&pageSize=5000`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const json = await response.json();
            const items = json.data || [];

            // Solo los pendientes de este usuario
            localData = items.filter(i => 
                parseInt(i.licencia_ref) === currentUserLicId && !i.enviado && !i.cobrado && !i.pagado
            );
            
            applyFilters(); 
        } catch (e) { 
            if(body) body.innerHTML = '<tr><td colspan="11" class="text-center text-red-500 font-bold py-10">Error de conexión</td></tr>'; 
        }
    }

    function applyFilters() {
        const empresa = document.getElementById('empresa')?.value;
        const ref = document.getElementById('referencia_input')?.value?.toLowerCase();
        const palabra = document.getElementById('palabra')?.value?.toLowerCase();

        filteredData = localData.filter(i => {
            // Buscamos el nombre en el catálogo usando el ID numérico que viene de la BD
            const nombreEmp = empresasCatalog[i.empresa_ref] || i.empresa_nombre || "";

            if (searchMode === 'campos') {
                const matchEmpresa = !empresa || (nombreEmp === empresa);
                const matchRef = !ref || (i.referencia && i.referencia.toLowerCase().includes(ref));
                return matchEmpresa && matchRef;
            } else {
                const searchTxt = `${i.numero_albaran} ${i.referencia} ${nombreEmp} ${i.asalariado}`.toLowerCase();
                return !palabra || searchTxt.includes(palabra);
            }
        });

        const badge = document.getElementById('activeFiltersCount');
        if (badge) badge.textContent = `${filteredData.length} REGISTROS FILTRADOS`;

        page = 1;
        window.sortTable(currentSort.key, true); 
    }

    /**
     * ✅ RENDERIZADO CON TRADUCCIÓN DE DICCIONARIO
     */
    function render() {
        const body = document.getElementById('albaranResults');
        const foot = document.getElementById('albaranTotal');
        if (!body) return;

        body.innerHTML = '';
        const startIdx = (page - 1) * size;
        const pageItems = filteredData.slice(startIdx, startIdx + size);

        if (pageItems.length === 0) {
            body.innerHTML = '<tr><td colspan="11" class="text-center py-24 text-slate-400 italic">No hay albaranes encontrados.</td></tr>';
            if (foot) foot.innerHTML = '';
            return;
        }

        let sumaTotal = 0;
        pageItems.forEach(i => {
            const imp = parseFloat(i.importe_total || 0);
            sumaTotal += imp;
            
            // TRADUCCIÓN: Si tenemos el ID en el catálogo, ponemos el nombre real
            const nombreFinal = empresasCatalog[i.empresa_ref] || i.empresa_nombre || "ID: " + i.empresa_ref;
            const licenciaNom = i.LicenciaData?.licencia || i.licencia || i.licencia_ref || "-";

            body.insertAdjacentHTML('beforeend', `
                <tr class="hover:bg-slate-50 border-b border-slate-100 text-xs transition-colors group">
                    <td class="px-4 py-3 text-center"><input type="checkbox" value="${i.id}" class="select-albaran w-4 h-4 rounded accent-orange-500"></td>
                    <td class="px-4 py-3 font-black text-slate-900">${i.numero_albaran || "N/A"}</td>
                    <td class="px-4 py-3 text-slate-500">${i.fecha ? i.fecha.substring(0, 10) : "-"}</td>
                    <td class="px-4 py-3 text-secondary-blue font-black">${licenciaNom}</td>
                    <td class="px-4 py-3 font-bold text-slate-700 uppercase truncate max-w-[150px]" title="${nombreFinal}">${nombreFinal}</td>
                    <td class="px-4 py-3 text-slate-400 italic">${i.referencia || "-"}</td>
                    <td class="px-4 py-3 text-slate-600 font-semibold">${i.asalariado || "TITULAR"}</td>
                    <td class="px-4 py-3 text-right font-black text-slate-800">€${imp.toFixed(2)}</td>
                    <td class="px-4 py-3 text-center"><span class="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[9px] font-black uppercase border border-blue-100">Creado</span></td>
                    <td class="px-4 py-3 text-[10px] text-slate-400 truncate max-w-[120px]">${i.observaciones || "-"}</td>
                    <td class="px-4 py-3 text-center">
                        <div class="flex justify-center gap-2">
                            <button onclick="window.location.href='/titulares/view/${i.id}'" class="p-1.5 border rounded-lg hover:text-blue-600 transition"><i data-lucide="eye" class="w-4 h-4"></i></button>
                            <button onclick="window.location.href='/titulares/update/${i.id}'" class="p-1.5 border rounded-lg hover:text-orange-500 transition"><i data-lucide="pencil" class="w-4 h-4"></i></button>
                        </div>
                    </td>
                </tr>`);
        });

        if (foot) {
            foot.innerHTML = `<tr><td colspan="7" class="px-4 py-5 text-right text-slate-400 text-[10px] font-black uppercase tracking-widest">Suma Subtotal:</td><td class="px-4 py-5 text-right text-sm text-primary-link font-black">€${sumaTotal.toFixed(2)}</td><td colspan="3"></td></tr>`;
        }
        if(document.getElementById('totalLabel')) document.getElementById('totalLabel').textContent = `${filteredData.length} registros totales`;
        if(document.getElementById('pageInfo')) document.getElementById('pageInfo').textContent = `${page} / ${Math.ceil(filteredData.length / size) || 1}`;
        if (window.lucide) lucide.createIcons();
    }

    /**
     * ENVÍO MASIVO
     */
    window.handleEnviarSeleccionados = async () => {
        const checkboxes = document.querySelectorAll('.select-albaran:checked');
        const ids = Array.from(checkboxes).map(cb => cb.value);
        if (ids.length === 0) return;
        if (!confirm(`¿Enviar ${ids.length} albaranes?`)) return;

        const btn = document.getElementById('btnEnviarMasivo');
        btn.disabled = true; btn.innerHTML = 'PROCESANDO...';

        for (const id of ids) {
            const item = localData.find(i => i.id == id);
            if (!item) continue;
            const payload = { 
                ...item, enviado: true, finalizado: true, 
                fecha: item.fecha ? item.fecha.substring(0, 10) : null,
                tlf_pasajero: item.tlf_pasajero || "-",
                cliente: item.cliente || item.nombre_pasajero || "-"
            };
            delete payload.LicenciaData; delete payload.EmpresaData;

            await fetch(`/api/v1/albaranes/user/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify(payload)
            });
        }
        btn.disabled = false; btn.innerHTML = 'Enviar seleccionados';
        await fetchData(); 
    };

    /**
     * VISTA DE DETALLE (VIEW)
     */
    async function cargarDetalleAlbaran() {
        const id = window.location.pathname.split('/').pop();
        if (!id || isNaN(id)) return;

        try {
            const resp = await fetch(`/api/v1/albaranes/${id}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const result = await resp.json();
            if (resp.ok && result.data) {
                const d = result.data;
                const safeSet = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val || "-"; };
                
                const nomEmp = empresasCatalog[d.empresa_ref] || d.empresa_nombre || "---";

                safeSet('view-licencia', d.licencia || d.licencia_ref);
                safeSet('view-numero_albaran', d.numero_albaran);
                safeSet('view-fecha', d.fecha ? d.fecha.substring(0, 10) : "");
                safeSet('view-empresa', nomEmp);
                safeSet('view-nombre_pasajero', d.cliente);
                safeSet('view-importe_total', d.importe_total);
                
                if(document.getElementById('view-urbano')) document.getElementById('view-urbano').checked = d.urbano;
                if(document.getElementById('view-diurno')) document.getElementById('view-diurno').checked = d.diurno;

                const bigTotal = document.querySelector('.text-4xl.font-black');
                if(bigTotal) bigTotal.textContent = d.importe_total;
            }
        } catch (e) { console.error(e); }
    }

    window.sortTable = (key, isInitial = false) => {
        if (!isInitial) {
            currentSort.direction = (currentSort.key === key && currentSort.direction === 'asc') ? 'desc' : 'asc';
            currentSort.key = key;
        }
        filteredData.sort((a, b) => {
            let vA = a[key], vB = b[key];
            if (key === 'empresa') {
                vA = empresasCatalog[a.empresa_ref] || ""; vB = empresasCatalog[b.empresa_ref] || "";
            }
            if (key === 'importe_total') { vA = parseFloat(vA || 0); vB = parseFloat(vB || 0); }
            if (key === 'fecha') { vA = new Date(vA).getTime(); vB = new Date(vB).getTime(); }
            return (vA < vB ? -1 : 1) * (currentSort.direction === 'asc' ? 1 : -1);
        });
        render();
    }

    window.UI = {
        setSearchModeManual(mode) {
            searchMode = mode;
            document.getElementById('palabraSection')?.classList.toggle('hidden', mode === 'campos');
            document.getElementById('searchForm')?.classList.toggle('hidden', mode === 'palabra');
        },
        handleClearAllFilters() { document.getElementById('searchForm')?.reset(); applyFilters(); },
        closeModal() { document.getElementById('actionModal').classList.replace('flex', 'hidden'); }
    };

    window.handleLogout = () => { localStorage.removeItem('token'); window.location.href = '/login'; };
    document.addEventListener('DOMContentLoaded', startApp);
})();