/**
 * albaran_pendiente.js - Panel de Usuario (Titular)
 * Gestión completa: Búsqueda avanzada, Ordenación, Selección múltiple y Envío Masivo.
 * ACTUALIZADO: 27/01/2026
 */

(function() {
    // Variables de estado
    let localData = [];       // Datos brutos cargados de la API
    let filteredData = [];    // Datos tras aplicar filtros
    let page = 1;
    let size = 20; 
    let licId = null;
    let currentSort = { key: 'fecha', direction: 'desc' };
    let searchMode = 'campos'; // 'campos' o 'palabra'

    /**
     * Inicialización del módulo
     */
    async function startApp() {
        console.log('🚀 [PENDIENTES] Iniciando lógica unificada...');
        
        try {
            // 1. Obtener Identidad del Titular
            const resp = await fetch('/api/v1/user/licencia_info');
            const identity = await resp.json();
            licId = identity.licencia_id;

            // 2. Cargar Empresas para el filtro (Orden A-Z)
            const rEmp = await fetch('/api/v1/empresas');
            const dEmp = await rEmp.json();
            const empresaSelect = document.getElementById('empresa');
            if (empresaSelect) {
                const empresasOrdenadas = (dEmp.data || []).sort((a, b) => a.nombre.localeCompare(b.nombre));
                empresaSelect.innerHTML = '<option value="">Todas las empresas</option>' + 
                    empresasOrdenadas.map(e => `<option value="${e.nombre}">${e.nombre}</option>`).join('');
            }
        } catch (e) { 
            console.error("Error en inicio:", e); 
            return; 
        }

        setupEventListeners();
        await fetchData();
    }

    function setupEventListeners() {
        // Formulario de búsqueda (Filtrado en local)
        document.getElementById('searchForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            applyFilters();
        });

        // Entrada de búsqueda por palabra
        document.getElementById('palabra')?.addEventListener('input', () => {
            if (searchMode === 'palabra') applyFilters();
        });

        // Cambio de registros por página
        document.getElementById('recordsPerPage')?.addEventListener('change', (e) => {
            size = e.target.value === 'todos' ? filteredData.length : parseInt(e.target.value);
            page = 1; 
            render();
        });

        // Paginación botones
        document.getElementById('prevPageBtn')?.addEventListener('click', () => { if(page > 1) { page--; render(); } });
        document.getElementById('nextPageBtn')?.addEventListener('click', () => { if(page < Math.ceil(filteredData.length/size)) { page++; render(); } });

        // Selección múltiple (Check All)
        document.getElementById('selectAll')?.addEventListener('change', (e) => {
            document.querySelectorAll('.select-albaran').forEach(cb => cb.checked = e.target.checked);
        });
    }

    /**
     * Obtiene los datos de la base de datos
     */
    async function fetchData() {
        const body = document.getElementById('albaranResults');
        body.innerHTML = '<tr><td colspan="11" class="text-center py-20 italic font-medium text-slate-400">Consultando registros pendientes...</td></tr>';
        
        try {
            // Se solicita un pageSize alto para poder gestionar el filtrado/ordenación en el cliente sin re-consultar
            const response = await fetch(`/api/v1/albaranes/search-user?licencia_ref=${licId}&pageSize=5000`);
            const json = await response.json();
            const items = json.data || [];

            // FILTRO DE NEGOCIO: Pendiente = (no enviado AND no cobrado AND no pagado)
            localData = items.filter(i => !i.enviado && !i.cobrado && !i.pagado);
            
            applyFilters(); 
        } catch (e) { 
            body.innerHTML = '<tr><td colspan="11" class="text-center text-red-500 font-bold py-10">Error al conectar con el servidor</td></tr>'; 
        }
    }

    /**
     * Lógica de Filtrado Local
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
                // Búsqueda global por palabra
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
        window.sortTable(currentSort.key, true); 
    }

    /**
     * Renderizado de la tabla
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
            body.innerHTML = '<tr><td colspan="11" class="text-center py-24 text-slate-400 italic font-medium">No se han encontrado albaranes con estos criterios.</td></tr>';
            if (foot) foot.innerHTML = '';
            return;
        }

        let sumaTotal = 0;
        pageItems.forEach(i => {
            const imp = parseFloat(i.importe_total || 0);
            sumaTotal += imp;
            body.insertAdjacentHTML('beforeend', `
                <tr class="hover:bg-slate-50 border-b border-slate-100 text-xs transition-colors">
                    <td class="px-4 py-3 text-center"><input type="checkbox" value="${i.id}" class="select-albaran w-4 h-4 rounded text-primary-link focus:ring-primary-link cursor-pointer accent-orange-500"></td>
                    <td class="px-4 py-3 font-black text-slate-900">${i.numero_albaran}</td>
                    <td class="px-4 py-3 text-slate-500 font-medium">${i.fecha.substring(0,10)}</td>
                    <td class="px-4 py-3 text-secondary-blue font-black">${i.licencia}</td>
                    <td class="px-4 py-3 font-bold text-slate-700 uppercase">${i.empresa_nombre}</td>
                    <td class="px-4 py-3 text-slate-400 italic">${i.referencia || '-'}</td>
                    <td class="px-4 py-3 text-slate-600 font-semibold">${i.asalariado || 'Titular'}</td>
                    <td class="px-4 py-3 text-right font-black text-slate-800">€${imp.toFixed(2)}</td>
                    <td class="px-4 py-3 text-center">
                        <span class="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-[9px] font-black uppercase border border-blue-100 tracking-tighter">Creado</span>
                    </td>
                    <td class="px-4 py-3 text-[10px] text-slate-400 truncate max-w-[100px]" title="${i.observaciones||''}">${i.observaciones||'-'}</td>
                    <td class="px-4 py-3 text-center">
                        <div class="flex justify-center gap-3">
                            <a href="/titulares/view/${i.id}" class="text-slate-400 hover:text-secondary-blue transition-transform hover:scale-110" title="Ver Detalle"><i data-lucide="eye" class="w-4 h-4"></i></a>
                            <a href="/titulares/update?id=${i.id}" class="text-slate-400 hover:text-primary-link transition-transform hover:scale-110" title="Editar"><i data-lucide="pencil" class="w-4 h-4"></i></a>
                        </div>
                    </td>
                </tr>`);
        });

        if (foot) {
            foot.innerHTML = `<tr>
                <td colspan="7" class="px-4 py-4 text-right text-slate-400 text-[10px] uppercase font-black tracking-widest">Suma Subtotal (Página):</td>
                <td class="px-4 py-4 text-right text-base text-primary-link font-black">€${sumaTotal.toFixed(2)}</td>
                <td colspan="3"></td>
            </tr>`;
        }

        document.getElementById('totalLabel').textContent = `${filteredData.length} registros totales encontrados`;
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
     * LÓGICA DE ENVÍO MASIVO (Acción de Creado -> Enviado)
     */
    window.handleEnviarSeleccionados = async () => {
        const checkboxes = document.querySelectorAll('.select-albaran:checked');
        const ids = Array.from(checkboxes).map(cb => cb.value);

        if (ids.length === 0) {
            UI.showModal("Aviso", "No has seleccionado ningún albarán para enviar.");
            return;
        }

        if (!confirm(`¿Deseas marcar los ${ids.length} albaranes como ENVIADOS?`)) return;

        const btn = document.getElementById('btnEnviarMasivo');
        btn.disabled = true;
        btn.innerHTML = '<span class="animate-spin mr-2">⌛</span> Procesando...';

        let exitos = 0;
        for (const id of ids) {
            try {
                // Se usa el controlador de actualización parcial para usuarios
                const res = await fetch(`/api/v1/albaranes/user/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ enviado: true })
                });
                if (res.ok) exitos++;
            } catch (e) { console.error("Error actualizando ID " + id, e); }
        }

        UI.showModal("Proceso completado", `Se han procesado ${exitos} albaranes correctamente.`);
        
        // Reset y recarga
        await fetchData();
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="send" class="w-4 h-4 mr-2"></i> Enviar seleccionados';
        if (window.lucide) lucide.createIcons();
    };

    /**
     * UI y Exportación
     */
    window.UI = {
        setSearchModeManual(mode) {
            searchMode = mode;
            document.getElementById('palabraSection')?.classList.toggle('hidden', mode === 'campos');
            document.getElementById('searchForm')?.classList.toggle('hidden', mode === 'palabra');
            
            const btnCampos = document.getElementById('btn-mode-campos');
            const btnPalabra = document.getElementById('btn-mode-palabra');

            if(mode === 'campos') {
                btnCampos.className = "px-4 py-2 rounded-lg transition shadow-md bg-secondary-blue text-white font-black text-[10px] uppercase tracking-widest";
                btnPalabra.className = "px-4 py-2 rounded-lg transition shadow-md bg-white text-slate-400 font-black text-[10px] uppercase tracking-widest border border-slate-200";
            } else {
                btnPalabra.className = "px-4 py-2 rounded-lg transition shadow-md bg-secondary-blue text-white font-black text-[10px] uppercase tracking-widest";
                btnCampos.className = "px-4 py-2 rounded-lg transition shadow-md bg-white text-slate-400 font-black text-[10px] uppercase tracking-widest border border-slate-200";
            }
        },
        handleClearAllFilters() {
            document.getElementById('searchForm')?.reset();
            if (document.getElementById('palabra')) document.getElementById('palabra').value = '';
            applyFilters();
        },
        showModal(title, body) {
            document.getElementById('modalTitle').textContent = title;
            document.getElementById('modalBody').textContent = body;
            document.getElementById('actionModal').classList.remove('hidden');
            document.getElementById('actionModal').classList.add('flex');
        },
        closeModal() {
            document.getElementById('actionModal').classList.add('hidden');
            document.getElementById('actionModal').classList.remove('flex');
        }
    };

    window.handleGeneratePDF = () => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('l', 'pt', 'a4');
        const rows = filteredData.map(i => [
            i.numero_albaran, 
            i.fecha.substring(0,10), 
            i.licencia, 
            i.empresa_nombre, 
            i.referencia || '-', 
            i.asalariado || 'Titular', 
            parseFloat(i.importe_total).toFixed(2)+'€'
        ]);
        doc.autoTable({
            head: [['Nº Albarán', 'Fecha', 'Licencia', 'Empresa', 'Referencia', 'Conductor', 'Total']],
            body: rows,
            headStyles: { fillColor: [255, 140, 0] },
            theme: 'striped'
        });
        doc.save("Albaranes_Pendientes.pdf");
    };

    window.handleGenerateXLSX = () => {
        const data = filteredData.map(i => ({
            'Nº Albarán': i.numero_albaran,
            'Fecha': i.fecha.substring(0,10),
            'Empresa': i.empresa_nombre,
            'Referencia': i.referencia,
            'Importe': parseFloat(i.importe_total)
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Pendientes");
        XLSX.writeFile(wb, "Albaranes_Pendientes.xlsx");
    };

    window.handleLogout = () => {
        localStorage.removeItem('token');
        window.location.href = '/login';
    };

    document.addEventListener('DOMContentLoaded', startApp);
})();