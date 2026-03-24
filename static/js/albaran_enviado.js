/**
 * ARCHIVO: static/js/albaran_enviado.js - Panel de Usuario (Titular)
 * GESTIÓN: Histórico de Albaranes (Enviados, Cobrados, Pagados)
 * ACTUALIZADO: 24/03/2026 - FIX DEFINITIVO: Mapeo de IDs a Nombres de Empresa.
 */

(function() {
    let localData = [];       
    let filteredData = [];    
    let empresasCatalog = {}; // Diccionario para traducir IDs a Nombres { "70": "CORTICHAPA" }
    let page = 1;
    let size = 20;
    let licId = null;
    let currentSort = { key: 'fecha', direction: 'desc' };
    let searchMode = 'campos'; 

    /**
     * Inicialización del módulo
     */
    async function startApp() {
        console.log('🚀 [HISTORIAL] Iniciando módulo con diccionario de empresas...');
        try {
            // 1. Obtener Identidad del Titular
            const resp = await fetch('/api/v1/user/licencia_info', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const identity = await resp.json();
            licId = identity.licencia_id;

            // 2. Cargar Empresas para el filtro y el DICCIONARIO
            const rEmp = await fetch('/api/v1/empresas', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const dEmp = await rEmp.json();
            const empresasArr = dEmp.data || [];
            
            // Llenar el catálogo para traducción inmediata
            empresasArr.forEach(e => {
                empresasCatalog[e.id] = e.nombre.toUpperCase();
            });

            const empresaSelect = document.getElementById('empresa');
            if (empresaSelect) {
                const empresasOrdenadas = [...empresasArr].sort((a, b) => 
                    a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })
                );
                empresaSelect.innerHTML = '<option value="">Todas las empresas</option>' + 
                    empresasOrdenadas.map(e => `<option value="${e.nombre}">${e.nombre.toUpperCase()}</option>`).join('');
            }
        } catch (e) { 
            console.error("Error en inicio:", e); 
            return; 
        }

        setupEventListeners();
        await fetchData();
    }

    function setupEventListeners() {
        document.getElementById('searchForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            applyFilters();
        });

        document.getElementById('recordsPerPage')?.addEventListener('change', (e) => {
            size = e.target.value === 'todos' ? filteredData.length : parseInt(e.target.value);
            page = 1; 
            render();
        });

        document.getElementById('prevPageBtn')?.addEventListener('click', () => { if(page > 1) { page--; render(); } });
        document.getElementById('nextPageBtn')?.addEventListener('click', () => { if(page < Math.ceil(filteredData.length/size)) { page++; render(); } });
        
        // Búsqueda por palabra en tiempo real
        document.getElementById('palabra')?.addEventListener('input', () => {
            if (searchMode === 'palabra') applyFilters();
        });
    }

    async function fetchData() {
        const body = document.getElementById('albaranResults');
        body.innerHTML = '<tr><td colspan="9" class="text-center py-20 italic font-medium text-slate-400">Consultando historial...</td></tr>';
        
        try {
            const response = await fetch(`/api/v1/albaranes/search-user?licencia_ref=${licId}&pageSize=5000`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const json = await response.json();
            const items = json.data || [];

            // FILTRO MAESTRO: Enviado, Cobrado o Pagado (ya procesados)
            localData = items.filter(i => i.enviado || i.cobrado || i.pagado);
            
            applyFilters(); 
        } catch (e) { 
            body.innerHTML = '<tr><td colspan="9" class="text-center text-red-500 font-bold py-10">Error de conexión</td></tr>'; 
        }
    }

    function applyFilters() {
        const empresa = document.getElementById('empresa')?.value;
        const ref = document.getElementById('referencia_input')?.value?.toLowerCase();
        const desde = document.getElementById('fecha_desde')?.value;
        const hasta = document.getElementById('fecha_hasta')?.value;
        const palabra = document.getElementById('palabra')?.value?.toLowerCase();

        filteredData = localData.filter(i => {
            // Buscamos el nombre real para filtrar
            const nombreEmp = empresasCatalog[i.empresa_ref] || i.empresa_nombre || "";

            if (searchMode === 'campos') {
                const matchEmpresa = !empresa || (nombreEmp === empresa);
                const matchRef = !ref || (i.referencia && i.referencia.toLowerCase().includes(ref));
                const matchDesde = !desde || i.fecha >= desde;
                const matchHasta = !hasta || i.fecha <= hasta;
                return matchEmpresa && matchRef && matchDesde && matchHasta;
            } else {
                const searchTxt = `${i.numero_albaran} ${i.referencia} ${nombreEmp} ${i.asalariado}`.toLowerCase();
                return !palabra || searchTxt.includes(palabra);
            }
        });

        document.getElementById('activeFiltersCount').textContent = `${filteredData.length} ENVIADOS`;
        page = 1;
        window.sortTable(currentSort.key, true); 
    }

    function render() {
        const body = document.getElementById('albaranResults');
        if (!body) return;
        body.innerHTML = '';

        const startIdx = (page - 1) * size;
        const pageItems = filteredData.slice(startIdx, startIdx + size);

        if (pageItems.length === 0) {
            body.innerHTML = '<tr><td colspan="9" class="text-center py-24 text-slate-400 italic">No hay albaranes en el historial.</td></tr>';
            return;
        }

        pageItems.forEach(i => {
            const imp = parseFloat(i.importe_total || 0);
            
            // ✅ TRADUCCIÓN: Usar el diccionario local para el nombre de empresa
            const nombreEmpresaFinal = empresasCatalog[i.empresa_ref] || i.empresa_nombre || "ID: " + i.empresa_ref;

            // Lógica de Badges de Estado
            let badge = '';
            if (i.pagado) {
                badge = '<span class="px-2.5 py-0.5 bg-green-100 text-green-700 rounded-full text-[9px] font-black uppercase border border-green-200">Pagado</span>';
            } else if (i.cobrado) {
                badge = '<span class="px-2.5 py-0.5 bg-teal-100 text-teal-700 rounded-full text-[9px] font-black uppercase border border-teal-200">Cobrado</span>';
            } else {
                badge = '<span class="px-2.5 py-0.5 bg-orange-100 text-orange-700 rounded-full text-[9px] font-black uppercase border border-orange-200">Enviado</span>';
            }

            body.insertAdjacentHTML('beforeend', `
                <tr class="hover:bg-slate-50 border-b border-slate-100 text-xs transition-colors group">
                    <td class="px-4 py-4 font-black text-slate-900">${i.numero_albaran}</td>
                    <td class="px-4 py-4 text-slate-500 font-medium">${i.fecha ? i.fecha.substring(0,10) : "-"}</td>
                    <td class="px-4 py-4 text-blue-600 font-black">${i.licencia || i.licencia_ref}</td>
                    <td class="px-4 py-4 font-bold text-slate-700 uppercase truncate max-w-[150px]" title="${nombreEmpresaFinal}">${nombreEmpresaFinal}</td>
                    <td class="px-4 py-4 text-slate-400 italic">${i.referencia || '-'}</td>
                    <td class="px-4 py-4 text-slate-600 font-semibold">${i.asalariado || 'TITULAR'}</td>
                    <td class="px-4 py-4 text-right font-black text-slate-900 tracking-tight">€${imp.toFixed(2)}</td>
                    <td class="px-4 py-4 text-center">${badge}</td>
                    <td class="px-4 py-4 text-center">
                        <a href="/titulares/view/${i.id}" class="text-slate-400 hover:text-blue-600 transition-transform hover:scale-125 inline-block">
                            <i data-lucide="eye" class="w-5 h-5"></i>
                        </a>
                    </td>
                </tr>`);
        });

        document.getElementById('totalLabel').textContent = `${filteredData.length} registros totales`;
        document.getElementById('pageInfo').textContent = `${page} / ${Math.ceil(filteredData.length / size) || 1}`;
        if (window.lucide) lucide.createIcons();
    }

    /**
     * Ordenación Universal
     */
    window.sortTable = (key, isInitial = false) => {
        if (!isInitial) {
            currentSort.direction = (currentSort.key === key && currentSort.direction === 'asc') ? 'desc' : 'asc';
            currentSort.key = key;
        }

        filteredData.sort((a, b) => {
            let vA, vB;

            if (key === 'estado') {
                const getWeight = (x) => x.pagado ? 3 : (x.cobrado ? 2 : 1);
                vA = getWeight(a); vB = getWeight(b);
            } else if (key === 'empresa') {
                vA = empresasCatalog[a.empresa_ref] || ""; vB = empresasCatalog[b.empresa_ref] || "";
            } else {
                switch(key) {
                    case 'importe_total': vA = parseFloat(a.importe_total || 0); vB = parseFloat(b.importe_total || 0); break;
                    case 'fecha': vA = new Date(a.fecha).getTime(); vB = new Date(b.fecha).getTime(); break;
                    case 'licencia': vA = parseInt(a.licencia || a.licencia_ref); vB = parseInt(b.licencia || b.licencia_ref); break;
                    default: vA = (a[key] || "").toString().toLowerCase(); vB = (b[key] || "").toString().toLowerCase();
                }
            }

            if (vA < vB) return currentSort.direction === 'asc' ? -1 : 1;
            if (vA > vB) return currentSort.direction === 'asc' ? 1 : -1;
            return 0;
        });

        render();
        updateSortIcons();
    };

    function updateSortIcons() {
        const columns = ['numero_albaran', 'fecha', 'licencia', 'empresa', 'referencia', 'asalariado', 'importe_total', 'estado'];
        columns.forEach(col => {
            const icon = document.getElementById(`sort-${col}`);
            if (!icon) return;
            icon.setAttribute('data-lucide', col === currentSort.key ? (currentSort.direction === 'asc' ? 'chevron-up' : 'chevron-down') : 'chevrons-up-down');
            icon.style.opacity = col === currentSort.key ? "1" : "0.3";
        });
        if (window.lucide) lucide.createIcons();
    }

    window.UI = {
        setSearchModeManual(mode) {
            searchMode = mode;
            document.getElementById('searchForm').classList.toggle('hidden', mode === 'palabra');
            document.getElementById('palabraSection').classList.toggle('hidden', mode === 'campos');
            
            document.getElementById('btn-mode-campos').className = mode === 'campos' ? "px-4 py-2 rounded-lg bg-secondary-blue text-white font-black text-[10px] uppercase shadow-md" : "px-4 py-2 rounded-lg bg-white text-slate-400 font-black text-[10px] uppercase border";
            document.getElementById('btn-mode-palabra').className = mode === 'palabra' ? "px-4 py-2 rounded-lg bg-secondary-blue text-white font-black text-[10px] uppercase shadow-md" : "px-4 py-2 rounded-lg bg-white text-slate-400 font-black text-[10px] uppercase border";
        }
    };

    window.handleLogout = () => { localStorage.removeItem('token'); window.location.href = '/login'; };
    document.addEventListener('DOMContentLoaded', startApp);
})();