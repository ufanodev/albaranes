/**
 * albaran_pendiente.js - Panel de Usuario (Titular)
 * Gestión completa: Búsqueda avanzada, Ordenación, Selección múltiple, Exportación y Envío.
 */

(function() {
    // Variables de estado privadas
    let localData = [];       // Datos brutos cargados de la API (enviado=0, cobrado=0, pagado=0)
    let filteredData = [];    // Datos tras aplicar los filtros de búsqueda superior
    let page = 1;
    let size = 10;
    let licId = null;
    let currentSort = { key: 'fecha', direction: 'desc' };
    let searchMode = 'campos'; // 'campos' o 'palabra'

    /**
     * Inicialización del módulo
     */
    async function startApp() {
        console.log('🚀 [PENDIENTES] Iniciando lógica unificada con búsqueda y ordenación...');
        
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

        // 3. Vincular Eventos
        setupEventListeners();

        // 4. Cargar Datos
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

        // Selección múltiple
        document.getElementById('selectAll')?.addEventListener('change', (e) => {
            document.querySelectorAll('.select-albaran').forEach(cb => cb.checked = e.target.checked);
        });
    }

    /**
     * Obtiene los datos de la base de datos (Filtro 0,0,0)
     */
    async function fetchData() {
        const body = document.getElementById('albaranResults');
        body.innerHTML = '<tr><td colspan="11" class="text-center py-20 italic">Cargando datos...</td></tr>';
        try {
            const response = await fetch(`/api/v1/albaranes/search-user?licencia_ref=${licId}&page=1&pageSize=3000`);
            const json = await response.json();
            const items = json.data || [];

            // Base de la vista: Solo lo que no ha sido procesado (Pendientes)
            localData = items.filter(i => i.enviado === false && i.cobrado === false && i.pagado === false);
            
            applyFilters(); // Inicializa filteredData y ordena
        } catch (e) { body.innerHTML = '<tr><td colspan="11" class="text-center text-red-500">Error de conexión</td></tr>'; }
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
                       (i.empresa_nombre && i.empresa_nombre.toLowerCase().includes(palabra)) ||
                       (i.asalariado && i.asalariado.toLowerCase().includes(palabra));
            }
        });

        const badge = document.getElementById('activeFiltersCount');
        if (badge) badge.textContent = `${filteredData.length} REGISTROS FILTRADOS`;

        page = 1;
        window.sortTable(currentSort.key, true); // Re-ordenar y renderizar
    }

    /**
     * Renderizado de la tabla (11 columnas)
     */
    function render() {
        const body = document.getElementById('albaranResults');
        const foot = document.getElementById('albaranTotal');
        if (!body) return;

        body.innerHTML = '';
        if (document.getElementById('selectAll')) document.getElementById('selectAll').checked = false;

        const startIdx = (page - 1) * size;
        const pageItems = filteredData.slice(startIdx, startIdx + size);

        if (pageItems.length === 0) {
            body.innerHTML = '<tr><td colspan="11" class="text-center py-20 text-gray-400 italic">Sin resultados.</td></tr>';
            if (foot) foot.innerHTML = '';
            return;
        }

        let sumaTotal = 0;
        pageItems.forEach(i => {
            const imp = parseFloat(i.importe_total || 0);
            sumaTotal += imp;
            body.insertAdjacentHTML('beforeend', `
                <tr class="hover:bg-primary-pastel/5 border-b border-gray-100 text-xs">
                    <td class="px-4 py-3 text-center"><input type="checkbox" value="${i.id}" class="select-albaran w-4 h-4 rounded cursor-pointer"></td>
                    <td class="px-4 py-3 font-black text-gray-900">${i.numero_albaran}</td>
                    <td class="px-4 py-3 text-gray-500">${i.fecha.substring(0,10)}</td>
                    <td class="px-4 py-3 text-secondary-blue font-bold">${i.licencia}</td>
                    <td class="px-4 py-3 font-medium text-gray-700">${i.empresa_nombre}</td>
                    <td class="px-4 py-3 text-gray-400 italic">${i.referencia || '-'}</td>
                    <td class="px-4 py-3 text-gray-600">${i.asalariado || 'Titular'}</td>
                    <td class="px-4 py-3 text-right font-black text-slate-800">€${imp.toFixed(2)}</td>
                    <td class="px-4 py-3 text-center"><span class="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[9px] font-black uppercase border border-blue-100">Creado</span></td>
                    <td class="px-4 py-3 text-[10px] text-gray-400 truncate max-w-[120px]" title="${i.observaciones||''}">${i.observaciones||'-'}</td>
                    <td class="px-4 py-3 text-center">
                        <div class="flex justify-center gap-2">
                            <a href="/titulares/view/${i.id}" class="text-secondary-blue hover:scale-110 transition"><i data-lucide="eye" class="w-4 h-4"></i></a>
                            <a href="/titulares/update/${i.id}" class="text-primary-link hover:scale-110 transition"><i data-lucide="pencil" class="w-4 h-4"></i></a>
                        </div>
                    </td>
                </tr>`);
        });

        if (foot) {
            foot.innerHTML = `<tr>
                <td colspan="7" class="px-4 py-4 text-right text-gray-600 text-[10px] uppercase font-black">Suma de la Página:</td>
                <td class="px-4 py-4 text-right text-lg text-primary-link font-black">€${sumaTotal.toFixed(2)}</td>
                <td colspan="3"></td>
            </tr>`;
        }

        document.getElementById('totalLabel').textContent = `${filteredData.length} registros totales`;
        document.getElementById('pageInfo').textContent = `${page} / ${Math.ceil(filteredData.length / size) || 1}`;
        if (window.lucide) lucide.createIcons();
    }

    /**
     * Ordenación de columnas dinámica
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
        updateSortIcons();
    };

    function updateSortIcons() {
        const keys = ['numero_albaran', 'fecha', 'empresa', 'referencia', 'importe_total'];
        keys.forEach(k => {
            const el = document.getElementById(`sort-${k}`);
            if(!el) return;
            el.setAttribute('data-lucide', k === currentSort.key ? (currentSort.direction === 'asc' ? 'chevron-up' : 'chevron-down') : 'chevrons-up-down');
        });
        if (window.lucide) lucide.createIcons();
    }

    /**
     * UI Helpers
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
     * Exportaciones y Acciones
     */
    window.handleGeneratePDF = () => {
        const { jsPDF } = window.jspdf; const doc = new jsPDF('l', 'pt', 'a4');
        const rows = filteredData.map(i => [i.numero_albaran, i.fecha.substring(0,10), i.licencia, i.empresa_nombre, i.referencia, i.asalariado || 'Titular', parseFloat(i.importe_total).toFixed(2)+'€']);
        doc.autoTable({ head: [['Nº', 'Fecha', 'Licencia', 'Empresa', 'Ref', 'Conductor', 'Total']], body: rows, headStyles: { fillColor: [255, 140, 0] }});
        doc.save("Albaranes_Pendientes.pdf");
    };

    window.handleGenerateXLSX = () => {
        const ws = XLSX.utils.json_to_sheet(filteredData.map(i => ({ Nº: i.numero_albaran, Fecha: i.fecha.substring(0,10), Empresa: i.empresa_nombre, Importe: i.importe_total })));
        const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Pendientes");
        XLSX.writeFile(wb, "Albaranes_Pendientes.xlsx");
    };

    window.handleEnviarSeleccionados = async () => {
        const ids = Array.from(document.querySelectorAll('.select-albaran:checked')).map(cb => cb.value);
        if (ids.length === 0) return window.handleAction('Aviso', 'Selecciona al menos un albarán.');
        if (!confirm(`¿Enviar ${ids.length} albaranes?`)) return;
        window.handleAction('Procesando', 'Actualizando registros...');
        for (const id of ids) {
            await fetch(`/api/v1/albaranes/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enviado: true }) });
        }
        window.location.reload();
    };

    document.addEventListener('DOMContentLoaded', startApp);
    window.handleActionModal = () => document.getElementById('actionModal').classList.add('hidden');
})();