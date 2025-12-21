/**
 * albaran_enviado.js - Panel de Usuario (Titular)
 * Gestión completa de Enviados: Búsqueda avanzada, Ordenación y Exportación.
 */

(function() {
    // Variables de estado privadas
    let localData = [];       // Datos cargados de la API con enviado=true
    let filteredData = [];    // Datos tras aplicar los filtros de búsqueda
    let page = 1;
    let size = 20;
    let licId = null;
    let currentSort = { key: 'fecha', direction: 'desc' };
    let searchMode = 'campos'; 

    /**
     * Inicialización del módulo
     */
    async function startApp() {
        console.log('🚀 [ENVIADOS] Iniciando lógica completa...');
        
        try {
            // 1. Obtener Identidad
            const resp = await fetch('/api/v1/user/licencia_info');
            const identity = await resp.json();
            licId = identity.licencia_id;

            // 2. Cargar Empresas para el select de filtros
            const rEmp = await fetch('/api/v1/empresas');
            const dEmp = await rEmp.json();
            const empresaSelect = document.getElementById('empresa');
            if (empresaSelect) {
                empresaSelect.innerHTML = '<option value="">Todas las empresas</option>' + 
                    (dEmp.data || []).map(e => `<option value="${e.nombre}">${e.nombre}</option>`).join('');
            }
        } catch (e) { console.error("Error en inicio:", e); return; }

        setupEventListeners();
        await fetchData();
    }

    function setupEventListeners() {
        // Formulario de búsqueda
        document.getElementById('searchForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            applyFilters();
        });

        // Paginación
        document.getElementById('recordsPerPage')?.addEventListener('change', (e) => {
            size = e.target.value === 'todos' ? filteredData.length : parseInt(e.target.value);
            page = 1; render();
        });
        document.getElementById('prevPageBtn')?.addEventListener('click', () => { if(page > 1) { page--; render(); } });
        document.getElementById('nextPageBtn')?.addEventListener('click', () => { if(page < Math.ceil(filteredData.length/size)) { page++; render(); } });
    }

    /**
     * Obtiene los datos de la base de datos (Solo enviados: 1)
     */
    async function fetchData() {
        const body = document.getElementById('albaranResults');
        body.innerHTML = '<tr><td colspan="10" class="text-center py-20 italic">Cargando enviados...</td></tr>';
        try {
            const response = await fetch(`/api/v1/albaranes/search-user?licencia_ref=${licId}&page=1&pageSize=4000`);
            const json = await response.json();
            const items = json.data || [];

            // 🎯 FILTRO BASE: Solo lo que ya ha sido enviado
            localData = items.filter(i => i.enviado === true);
            
            applyFilters(); 
        } catch (e) { body.innerHTML = '<tr><td colspan="10" class="text-center text-red-500">Error de conexión</td></tr>'; }
    }

    /**
     * Lógica de Filtrado (Búsqueda)
     */
    function applyFilters() {
        const empresa = document.getElementById('empresa')?.value;
        const ref = document.getElementById('referencia_input')?.value.toLowerCase();
        const desde = document.getElementById('fecha_desde')?.value;
        const hasta = document.getElementById('fecha_hasta')?.value;
        const palabra = document.getElementById('palabra')?.value.toLowerCase();

        filteredData = localData.filter(i => {
            if (searchMode === 'campos') {
                const matchEmpresa = !empresa || i.empresa_nombre === empresa;
                const matchRef = !ref || (i.referencia && i.referencia.toLowerCase().includes(ref));
                const matchDesde = !desde || i.fecha >= desde;
                const matchHasta = !hasta || i.fecha <= hasta;
                return matchEmpresa && matchRef && matchDesde && matchHasta;
            } else {
                return !palabra || 
                       i.numero_albaran.toLowerCase().includes(palabra) || 
                       (i.referencia && i.referencia.toLowerCase().includes(palabra)) ||
                       (i.empresa_nombre && i.empresa_nombre.toLowerCase().includes(palabra));
            }
        });

        document.getElementById('activeFiltersCount').textContent = `${filteredData.length} REGISTROS`;
        page = 1;
        window.sortTable(currentSort.key, true); 
    }

    /**
     * Renderizado de la tabla (10 columnas)
     */
    function render() {
        const body = document.getElementById('albaranResults');
        const foot = document.getElementById('albaranTotal');
        if (!body) return;

        body.innerHTML = '';
        const startIdx = (page - 1) * size;
        const pageItems = filteredData.slice(startIdx, startIdx + size);

        if (pageItems.length === 0) {
            body.innerHTML = '<tr><td colspan="10" class="text-center py-20 italic text-gray-400">No hay registros enviados que coincidan.</td></tr>';
            if (foot) foot.innerHTML = '';
            return;
        }

        let sumaTotal = 0;
        pageItems.forEach(i => {
            const imp = parseFloat(i.importe_total || 0);
            sumaTotal += imp;

            let badge = '<span class="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[9px] font-black uppercase border border-blue-100">Enviado</span>';
            if (i.pagado || i.cobrado) badge = '<span class="px-2 py-0.5 bg-green-50 text-green-600 rounded text-[9px] font-black uppercase border border-green-100">Pagado</span>';
            if (i.finalizado) badge = '<span class="px-2 py-0.5 bg-purple-50 text-purple-600 rounded text-[9px] font-black uppercase border border-purple-100">Finalizado</span>';

            body.insertAdjacentHTML('beforeend', `
                <tr class="hover:bg-primary-pastel/5 border-b border-gray-100 text-xs">
                    <td class="px-4 py-3 font-black text-gray-900">${i.numero_albaran}</td>
                    <td class="px-4 py-3 text-gray-500">${i.fecha.substring(0,10)}</td>
                    <td class="px-4 py-3 text-secondary-blue font-bold">${i.licencia}</td>
                    <td class="px-4 py-3 font-medium text-gray-700">${i.empresa_nombre}</td>
                    <td class="px-4 py-3 text-gray-400 italic">${i.referencia || '-'}</td>
                    <td class="px-4 py-3 text-gray-600">${i.asalariado || 'Titular'}</td>
                    <td class="px-4 py-3 text-right font-black text-slate-800">€${imp.toFixed(2)}</td>
                    <td class="px-4 py-3 text-center">${badge}</td>
                    <td class="px-4 py-3 text-[10px] text-gray-400 truncate max-w-[120px] italic" title="${i.observaciones||''}">${i.observaciones||'-'}</td>
                    <td class="px-4 py-3 text-center">
                        <a href="/titulares/view/${i.id}" class="text-secondary-blue hover:scale-125 transition-transform inline-block"><i data-lucide="eye" class="w-4 h-4"></i></a>
                    </td>
                </tr>`);
        });

        if (foot) {
            foot.innerHTML = `<tr>
                <td colspan="6" class="px-4 py-4 text-right text-gray-600 text-[10px] uppercase font-black">Suma Página:</td>
                <td class="px-4 py-4 text-right text-lg text-primary-link font-black">€${sumaTotal.toFixed(2)}</td>
                <td colspan="3"></td>
            </tr>`;
        }

        document.getElementById('totalLabel').textContent = `${filteredData.length} albaranes enviados encontrados`;
        document.getElementById('pageInfo').textContent = `${page} / ${Math.ceil(filteredData.length / size) || 1}`;
        if (window.lucide) lucide.createIcons();
    }

    /**
     * Ordenación de columnas
     */
    window.sortTable = (key, isInitial = false) => {
        if (!isInitial) {
            currentSort.direction = (currentSort.key === key && currentSort.direction === 'asc') ? 'desc' : 'asc';
            currentSort.key = key;
        }
        filteredData.sort((a, b) => {
            let vA = a[key], vB = b[key];
            if (key === 'empresa') { vA = a.empresa_nombre; vB = b.empresa_nombre; }
            if (key === 'importe_total') { vA = parseFloat(vA); vB = parseFloat(vB); }
            if (key === 'fecha') { vA = new Date(vA).getTime(); vB = new Date(vB).getTime(); }
            if (vA < vB) return currentSort.direction === 'asc' ? -1 : 1;
            if (vA > vB) return currentSort.direction === 'asc' ? 1 : -1;
            return 0;
        });
        render();
        ['numero_albaran', 'fecha', 'empresa', 'importe_total'].forEach(k => {
            const el = document.getElementById(`sort-${k}`);
            if(el) el.setAttribute('data-lucide', k === currentSort.key ? (currentSort.direction === 'asc' ? 'chevron-up' : 'chevron-down') : 'chevrons-up-down');
        });
        if (window.lucide) lucide.createIcons();
    };

    /**
     * UI Modos
     */
    window.UI = {
        setSearchModeManual(mode) {
            searchMode = mode;
            document.getElementById('palabraSection')?.classList.toggle('hidden', mode === 'campos');
            document.getElementById('searchForm')?.classList.toggle('hidden', mode === 'palabra');
            document.getElementById('btn-mode-campos')?.classList.toggle('bg-secondary-blue', mode === 'campos');
            document.getElementById('btn-mode-palabra')?.classList.toggle('bg-primary-pastel', mode === 'palabra');
        },
        handleClearAllFilters() {
            document.getElementById('searchForm')?.reset();
            if (document.getElementById('palabra')) document.getElementById('palabra').value = '';
            applyFilters();
        }
    };

    /**
     * Exportaciones
     */
    window.handleGeneratePDF = () => {
        const { jsPDF } = window.jspdf; const doc = new jsPDF('l', 'pt', 'a4');
        const rows = filteredData.map(i => [i.numero_albaran, i.fecha.substring(0,10), i.empresa_nombre, i.referencia, i.asalariado || 'Titular', parseFloat(i.importe_total).toFixed(2)+'€']);
        doc.autoTable({ head: [['Nº', 'Fecha', 'Empresa', 'Ref', 'Conductor', 'Total']], body: rows, headStyles: { fillColor: [255, 140, 0] }});
        doc.save("Albaranes_Enviados.pdf");
    };

    window.handleGenerateXLSX = () => {
        const ws = XLSX.utils.json_to_sheet(filteredData.map(i => ({ Nº: i.numero_albaran, Fecha: i.fecha.substring(0,10), Empresa: i.empresa_nombre, Importe: i.importe_total })));
        const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Enviados");
        XLSX.writeFile(wb, "Albaranes_Enviados.xlsx");
    };

    document.addEventListener('DOMContentLoaded', startApp);
    window.handleActionModal = () => document.getElementById('actionModal').classList.add('hidden');
})();