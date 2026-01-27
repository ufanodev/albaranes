/**
 * ARCHIVO: albaran_enviado.js - Panel de Usuario (Titular)
 * GESTIÓN: Histórico de Albaranes (Enviados, Cobrados, Pagados)
 * ACTUALIZADO: 27/01/2026 - Ordenación A-Z Empresas, Fix UI Búsqueda y Ordenación Total.
 */

(function() {
    // Variables de estado
    let localData = [];       
    let filteredData = [];    
    let page = 1;
    let size = 20;
    let licId = null;
    let currentSort = { key: 'fecha', direction: 'desc' };
    let searchMode = 'campos'; 

    /**
     * Inicialización del módulo
     */
    async function startApp() {
        console.log('🚀 [HISTORIAL] Iniciando módulo...');
        try {
            // 1. Obtener Identidad del Titular
            const resp = await fetch('/api/v1/user/licencia_info');
            const identity = await resp.json();
            licId = identity.licencia_id;

            // 2. Cargar Empresas para el filtro (Orden Alfabético A-Z)
            const rEmp = await fetch('/api/v1/empresas');
            const dEmp = await rEmp.json();
            const empresaSelect = document.getElementById('empresa');
            
            if (empresaSelect) {
                // Forzamos ordenación alfabética por nombre antes de renderizar el combo
                const empresasOrdenadas = (dEmp.data || []).sort((a, b) => 
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
        // Escuchar el submit del formulario (funciona para ambos modos sin ocultar el botón)
        document.getElementById('searchForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            applyFilters();
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
    }

    /**
     * Obtiene los datos y filtra para historial (Enviado/Cobrado/Pagado)
     */
    async function fetchData() {
        const body = document.getElementById('albaranResults');
        body.innerHTML = '<tr><td colspan="9" class="text-center py-20 italic font-medium text-slate-400">Consultando historial...</td></tr>';
        
        try {
            const response = await fetch(`/api/v1/albaranes/search-user?licencia_ref=${licId}&pageSize=5000`);
            const json = await response.json();
            const items = json.data || [];

            // FILTRO MAESTRO: Solo lo que ya ha salido de pendientes (enviado, cobrado o pagado)
            localData = items.filter(i => i.enviado === true || i.cobrado === true || i.pagado === true);
            
            applyFilters(); 
        } catch (e) { 
            body.innerHTML = '<tr><td colspan="9" class="text-center text-red-500 font-bold py-10">Error de conexión con el servidor</td></tr>'; 
        }
    }

    /**
     * Lógica de Filtrado Local
     */
    function applyFilters() {
        const empresa = document.getElementById('empresa')?.value;
        const ref = document.getElementById('referencia_input')?.value.toLowerCase();
        const estadoFiltro = document.getElementById('estado_filtro')?.value;
        const desde = document.getElementById('fecha_desde')?.value;
        const hasta = document.getElementById('fecha_hasta')?.value;
        const palabra = document.getElementById('palabra')?.value.toLowerCase();

        filteredData = localData.filter(i => {
            if (searchMode === 'campos') {
                const matchEmpresa = !empresa || i.empresa_nombre === empresa;
                const matchRef = !ref || (i.referencia && i.referencia.toLowerCase().includes(ref));
                const matchDesde = !desde || i.fecha >= desde;
                const matchHasta = !hasta || i.fecha <= hasta;
                
                let matchEstado = true;
                if (estadoFiltro === 'enviado') {
                    matchEstado = i.enviado && !i.cobrado && !i.pagado;
                } else if (estadoFiltro === 'pagado') {
                    matchEstado = i.cobrado || i.pagado;
                }

                return matchEmpresa && matchRef && matchDesde && matchHasta && matchEstado;
            } else {
                return !palabra || 
                       i.numero_albaran.toLowerCase().includes(palabra) || 
                       (i.referencia && i.referencia.toLowerCase().includes(palabra)) ||
                       (i.empresa_nombre && i.empresa_nombre.toLowerCase().includes(palabra)) ||
                       (i.asalariado && i.asalariado.toLowerCase().includes(palabra));
            }
        });

        document.getElementById('activeFiltersCount').textContent = `${filteredData.length} REGISTROS`;
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
        const startIdx = (page - 1) * size;
        const pageItems = filteredData.slice(startIdx, startIdx + size);

        if (pageItems.length === 0) {
            body.innerHTML = '<tr><td colspan="9" class="text-center py-24 text-slate-400 italic">No se han encontrado albaranes.</td></tr>';
            if (foot) foot.innerHTML = '';
            return;
        }

        let sumaTotal = 0;
        pageItems.forEach(i => {
            const imp = parseFloat(i.importe_total || 0);
            sumaTotal += imp;
            
            let badge = '<span class="px-2.5 py-0.5 bg-orange-100 text-orange-700 rounded-full text-[9px] font-black uppercase border border-orange-200">Enviado</span>';
            if (i.cobrado || i.pagado) {
                badge = '<span class="px-2.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[9px] font-black uppercase border border-emerald-200">Cobrado</span>';
            }

            body.insertAdjacentHTML('beforeend', `
                <tr class="hover:bg-slate-50 border-b border-slate-100 text-xs transition-colors">
                    <td class="px-4 py-4 font-black text-slate-900">${i.numero_albaran}</td>
                    <td class="px-4 py-4 text-slate-500 font-medium">${i.fecha.substring(0,10)}</td>
                    <td class="px-4 py-4 text-secondary-blue font-black">${i.licencia}</td>
                    <td class="px-4 py-4 font-bold text-slate-700 uppercase">${i.empresa_nombre}</td>
                    <td class="px-4 py-4 text-slate-400 italic">${i.referencia || '-'}</td>
                    <td class="px-4 py-4 text-slate-600 font-semibold">${i.asalariado || 'Titular'}</td>
                    <td class="px-4 py-4 text-right font-black text-slate-900 tracking-tight">€${imp.toFixed(2)}</td>
                    <td class="px-4 py-4 text-center">${badge}</td>
                    <td class="px-4 py-4 text-center">
                        <a href="/titulares/view/${i.id}" class="text-slate-400 hover:text-secondary-blue transition-transform hover:scale-125 inline-block">
                            <i data-lucide="eye" class="w-5 h-5"></i>
                        </a>
                    </td>
                </tr>`);
        });

        if (foot) {
            foot.innerHTML = `<tr>
                <td colspan="6" class="px-4 py-4 text-right text-slate-400 text-[10px] uppercase font-black">Suma Subtotal (Página):</td>
                <td class="px-4 py-4 text-right text-base text-primary-link font-black">€${sumaTotal.toFixed(2)}</td>
                <td colspan="2"></td>
            </tr>`;
        }

        document.getElementById('totalLabel').textContent = `${filteredData.length} registros totales`;
        document.getElementById('pageInfo').textContent = `${page} / ${Math.ceil(filteredData.length / size) || 1}`;
        if (window.lucide) lucide.createIcons();
    }

    /**
     * Ordenación de columnas (Universal para todos los campos)
     */
    window.sortTable = (key, isInitial = false) => {
        if (!isInitial) {
            currentSort.direction = (currentSort.key === key && currentSort.direction === 'asc') ? 'desc' : 'asc';
            currentSort.key = key;
        }

        filteredData.sort((a, b) => {
            let vA, vB;

            if (key === 'estado_badge') {
                const getW = (x) => (x.cobrado || x.pagado ? 2 : 1);
                vA = getW(a); vB = getW(b);
            } else {
                switch(key) {
                    case 'empresa': vA = (a.empresa_nombre || "").toLowerCase(); vB = (b.empresa_nombre || "").toLowerCase(); break;
                    case 'importe_total': vA = parseFloat(a.importe_total || 0); vB = parseFloat(b.importe_total || 0); break;
                    case 'fecha': vA = new Date(a.fecha).getTime(); vB = new Date(b.fecha).getTime(); break;
                    case 'licencia': vA = (a.licencia || "").toLowerCase(); vB = (b.licencia || "").toLowerCase(); break;
                    case 'asalariado': vA = (a.asalariado || "titular").toLowerCase(); vB = (b.asalariado || "titular").toLowerCase(); break;
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
        const columns = ['numero_albaran', 'fecha', 'licencia', 'empresa', 'referencia', 'asalariado', 'importe_total', 'estado_badge'];
        columns.forEach(col => {
            const icon = document.getElementById(`sort-${col}`);
            if (!icon) return;
            if (col === currentSort.key) {
                icon.setAttribute('data-lucide', currentSort.direction === 'asc' ? 'chevron-up' : 'chevron-down');
                icon.style.opacity = "1";
            } else {
                icon.setAttribute('data-lucide', 'chevrons-up-down');
                icon.style.opacity = "0.3";
            }
        });
        if (window.lucide) lucide.createIcons();
    }

    /**
     * UI Modos de Búsqueda
     */
    window.UI = {
        setSearchModeManual(mode) {
            searchMode = mode;
            // Ocultamos los divs de inputs, pero NO el último div (que contiene el botón Filtrar)
            const camposDivs = document.querySelectorAll('#searchForm > div:not(:last-child)');
            const palabraSec = document.getElementById('palabraSection');
            const btnC = document.getElementById('btn-mode-campos');
            const btnP = document.getElementById('btn-mode-palabra');

            if(mode === 'campos') {
                camposDivs.forEach(el => el.classList.remove('hidden'));
                palabraSec.classList.add('hidden');
                btnC.className = "px-4 py-2 rounded-lg bg-secondary-blue text-white font-black text-[10px] uppercase shadow-md";
                btnP.className = "px-4 py-2 rounded-lg bg-white text-slate-400 border font-black text-[10px] uppercase";
            } else {
                camposDivs.forEach(el => el.classList.add('hidden'));
                palabraSec.classList.remove('hidden');
                btnP.className = "px-4 py-2 rounded-lg bg-secondary-blue text-white font-black text-[10px] uppercase shadow-md";
                btnC.className = "px-4 py-2 rounded-lg bg-white text-slate-400 border font-black text-[10px] uppercase";
            }
        },
        handleClearAllFilters() {
            document.getElementById('searchForm')?.reset();
            const p = document.getElementById('palabra');
            if (p) p.value = '';
            applyFilters();
        }
    };

    /**
     * Exportaciones
     */
    window.handleGeneratePDF = () => {
        const { jsPDF } = window.jspdf; const doc = new jsPDF('l', 'pt', 'a4');
        const rows = filteredData.map(i => [i.numero_albaran, i.fecha.substring(0,10), i.licencia, i.empresa_nombre, i.referencia, i.asalariado || 'Titular', parseFloat(i.importe_total).toFixed(2)+'€']);
        doc.autoTable({ head: [['Nº', 'Fecha', 'Licencia', 'Empresa', 'Ref', 'Conductor', 'Total']], body: rows, headStyles: { fillColor: [255, 140, 0] }});
        doc.save("Historial_Albaranes.pdf");
    };

    window.handleGenerateXLSX = () => {
        const ws = XLSX.utils.json_to_sheet(filteredData.map(i => ({ Nº: i.numero_albaran, Fecha: i.fecha.substring(0,10), Empresa: i.empresa_nombre, Importe: i.importe_total })));
        const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Historial");
        XLSX.writeFile(wb, "Historial_Albaranes.xlsx");
    };

    window.handleLogout = () => { localStorage.removeItem('token'); window.location.href = '/login'; };
    document.addEventListener('DOMContentLoaded', startApp);
})();