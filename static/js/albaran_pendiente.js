/**
 * ARCHIVO: static/js/albaran_pendiente.js - Panel de Usuario (Titular)
 * GESTIÓN: Listado de Pendientes con mapeo robusto y seguridad por Licencia.
 * ACTUALIZADO: 23/03/2026 - Mantenimiento de filtros, paginación y ordenación original.
 */

(function() {
    // Variables de estado
    let localData = [];       
    let filteredData = [];    
    let page = 1;
    let size = 20; 
    let currentUserLicId = null; 
    let currentSort = { key: 'fecha', direction: 'desc' };
    let searchMode = 'campos'; 

    async function startApp() {
        console.log('🚀 [PENDIENTES] Iniciando lógica de usuario...');
        
        try {
            // 1. Obtener Identidad del Titular (Seguridad: solo cargar sus datos)
            const resp = await fetch('/api/v1/user/licencia_info', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const identity = await resp.json();
            currentUserLicId = parseInt(identity.licencia_id);
            
            console.log(`🔐 Sesión blindada para Licencia ID: ${currentUserLicId}`);

            // 2. Cargar Empresas para el filtro
            const rEmp = await fetch('/api/v1/empresas', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const dEmp = await rEmp.json();
            const empresaSelect = document.getElementById('empresa');
            if (empresaSelect) {
                const empresasOrdenadas = (dEmp.data || []).sort((a, b) => a.nombre.localeCompare(b.nombre));
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
        // Mantener búsqueda como está
        document.getElementById('searchForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            applyFilters();
        });

        document.getElementById('palabra')?.addEventListener('input', () => {
            if (searchMode === 'palabra') applyFilters();
        });

        // Mantener paginación corregida
        document.getElementById('recordsPerPage')?.addEventListener('change', (e) => {
            const val = e.target.value;
            size = val === 'todos' ? filteredData.length : parseInt(val);
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
        body.innerHTML = '<tr><td colspan="11" class="text-center py-20 italic font-medium text-slate-400">Consultando registros...</td></tr>';
        
        try {
            // Petición al endpoint de búsqueda de usuario
            const response = await fetch(`/api/v1/albaranes/search-user?licencia_ref=${currentUserLicId}&pageSize=5000`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const json = await response.json();
            const items = json.data || [];

            // ✅ FILTRO DE SEGURIDAD ESTRICTO: 
            // 1. Solo mi Licencia ID
            // 2. Solo albaranes que NO han sido enviados, cobrados ni pagados
            localData = items.filter(i => 
                parseInt(i.licencia_ref) === currentUserLicId && 
                !i.enviado && !i.cobrado && !i.pagado
            );
            
            applyFilters(); 
        } catch (e) { 
            body.innerHTML = '<tr><td colspan="11" class="text-center text-red-500 font-bold py-10">Error de conexión</td></tr>'; 
        }
    }

    function applyFilters() {
        const empresa = document.getElementById('empresa')?.value;
        const ref = document.getElementById('referencia_input')?.value?.toLowerCase();
        const desde = document.getElementById('fecha_desde')?.value;
        const hasta = document.getElementById('fecha_hasta')?.value;
        const palabra = document.getElementById('palabra')?.value?.toLowerCase();

        filteredData = localData.filter(i => {
            if (searchMode === 'campos') {
                const matchEmpresa = !empresa || (i.empresa_nombre && i.empresa_nombre === empresa);
                const matchRef = !ref || (i.referencia && i.referencia.toLowerCase().includes(ref));
                const matchDesde = !desde || i.fecha >= desde;
                const matchHasta = !hasta || i.fecha <= hasta;
                return matchEmpresa && matchRef && matchDesde && matchHasta;
            } else {
                const txtEmpresa = (i.EmpresaData?.nombre || i.empresa_nombre || "").toLowerCase();
                const txtAlbaran = (i.numero_albaran || "").toLowerCase();
                const txtRef = (i.referencia || "").toLowerCase();
                const txtCond = (i.asalariado || "").toLowerCase();

                return !palabra || 
                       txtAlbaran.includes(palabra) || 
                       txtRef.includes(palabra) ||
                       txtEmpresa.includes(palabra) ||
                       txtCond.includes(palabra);
            }
        });

        const badge = document.getElementById('activeFiltersCount');
        if (badge) badge.textContent = `${filteredData.length} REGISTROS FILTRADOS`;

        page = 1;
        window.sortTable(currentSort.key, true); 
    }

    function render() {
        const body = document.getElementById('albaranResults');
        const foot = document.getElementById('albaranTotal');
        if (!body) return;

        body.innerHTML = '';
        const startIdx = (page - 1) * size;
        const pageItems = filteredData.slice(startIdx, startIdx + size);

        if (pageItems.length === 0) {
            body.innerHTML = '<tr><td colspan="11" class="text-center py-24 text-slate-400 italic">No hay albaranes pendientes encontrados.</td></tr>';
            if (foot) foot.innerHTML = '';
            return;
        }

        let sumaTotal = 0;
        pageItems.forEach(i => {
            const imp = parseFloat(i.importe_total || 0);
            sumaTotal += imp;
            
            // ✅ MAPEADO ROBUSTO PARA CAMPOS DE IMAGEN
            const numAlbaran = i.numero_albaran || "N/A";
            const fecha = i.fecha ? i.fecha.substring(0, 10) : "-";
            const licenciaNom = i.LicenciaData?.licencia || i.licencia || i.licencia_ref || "-";
            const empresaNom = i.EmpresaData?.nombre || i.empresa_nombre || (i.empresa_ref ? `ID: ${i.empresa_ref}` : "-");
            const referencia = i.referencia || "-";
            const conductor = i.asalariado || "TITULAR";
            const observaciones = (i.observaciones && i.observaciones !== "-") ? i.observaciones : "";

            body.insertAdjacentHTML('beforeend', `
                <tr class="hover:bg-slate-50 border-b border-slate-100 text-xs transition-colors group">
                    <td class="px-4 py-3 text-center">
                        <input type="checkbox" value="${i.id}" class="select-albaran w-4 h-4 rounded text-primary-link focus:ring-primary-link cursor-pointer accent-orange-500">
                    </td>
                    <td class="px-4 py-3 font-black text-slate-900">${numAlbaran}</td>
                    <td class="px-4 py-3 text-slate-500 font-medium">${fecha}</td>
                    <td class="px-4 py-3 text-secondary-blue font-black">${licenciaNom}</td>
                    <td class="px-4 py-3 font-bold text-slate-700 uppercase truncate max-w-[150px]" title="${empresaNom}">${empresaNom}</td>
                    <td class="px-4 py-3 text-slate-400 italic font-medium">${referencia}</td>
                    <td class="px-4 py-3 text-slate-600 font-semibold">${conductor}</td>
                    <td class="px-4 py-3 text-right font-black text-slate-800 bg-slate-100/30">€${imp.toFixed(2)}</td>
                    <td class="px-4 py-3 text-center">
                        <span class="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[9px] font-black uppercase border border-blue-100 tracking-tighter">Creado</span>
                    </td>
                    <td class="px-4 py-3 text-[10px] text-slate-400 truncate max-w-[120px]" title="${observaciones}">${observaciones || '-'}</td>
                    <td class="px-4 py-3 text-center">
                        <div class="flex justify-center gap-2">
                            <button onclick="window.location.href='/titulares/view/${i.id}'" 
                                    class="p-1.5 bg-white border border-slate-200 text-slate-400 hover:text-secondary-blue hover:border-secondary-blue rounded-lg transition shadow-sm" title="Ver Detalle">
                                <i data-lucide="eye" class="w-4 h-4"></i>
                            </button>
                            <button onclick="window.location.href='/titulares/update/${i.id}'" 
                                    class="p-1.5 bg-white border border-slate-200 text-slate-400 hover:text-primary-link hover:border-primary-link rounded-lg transition shadow-sm" title="Editar">
                                <i data-lucide="pencil" class="w-4 h-4"></i>
                            </button>
                        </div>
                    </td>
                </tr>`);
        });

        if (foot) {
            foot.innerHTML = `<tr>
                <td colspan="7" class="px-4 py-5 text-right text-slate-400 text-[10px] uppercase font-black tracking-widest">Subtotal Página:</td>
                <td class="px-4 py-5 text-right text-sm text-primary-link font-black bg-orange-50/50">€${sumaTotal.toFixed(2)}</td>
                <td colspan="3" class="bg-orange-50/50"></td>
            </tr>`;
        }

        document.getElementById('totalLabel').textContent = `${filteredData.length} albaranes encontrados en total`;
        document.getElementById('pageInfo').textContent = `${page} / ${Math.ceil(filteredData.length / size) || 1}`;
        if (window.lucide) lucide.createIcons();
    }

    // Funciones globales requeridas por el HTML
    window.sortTable = (key, isInitial = false) => {
        if (!isInitial) {
            currentSort.direction = (currentSort.key === key && currentSort.direction === 'asc') ? 'desc' : 'asc';
            currentSort.key = key;
        }
        filteredData.sort((a, b) => {
            let vA = a[key], vB = b[key];
            if (key === 'empresa') { 
                vA = a.EmpresaData?.nombre || a.empresa_nombre || ""; 
                vB = b.EmpresaData?.nombre || b.empresa_nombre || ""; 
            }
            if (key === 'importe_total') { vA = parseFloat(vA || 0); vB = parseFloat(vB || 0); }
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

    window.handleEnviarSeleccionados = async () => {
        const checkboxes = document.querySelectorAll('.select-albaran:checked');
        const ids = Array.from(checkboxes).map(cb => cb.value);
        if (ids.length === 0) {
            UI.showModal("Aviso", "Por favor, selecciona al menos un registro.");
            return;
        }
        if (!confirm(`¿Deseas enviar los ${ids.length} albaranes seleccionados?`)) return;

        let ok = 0;
        for (const id of ids) {
            const res = await fetch(`/api/v1/albaranes/user/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify({ enviado: true })
            });
            if (res.ok) ok++;
        }
        UI.showModal("Éxito", `${ok} albaranes marcados como enviados.`);
        fetchData();
    };

    window.UI = {
        setSearchModeManual(mode) {
            searchMode = mode;
            document.getElementById('palabraSection')?.classList.toggle('hidden', mode === 'campos');
            document.getElementById('searchForm')?.classList.toggle('hidden', mode === 'palabra');
            const btnC = document.getElementById('btn-mode-campos'), btnP = document.getElementById('btn-mode-palabra');
            if(mode === 'campos') {
                btnC.className = "px-4 py-2 rounded-lg bg-secondary-blue text-white font-black text-[10px] uppercase shadow-md";
                btnP.className = "px-4 py-2 rounded-lg bg-white text-slate-400 border font-black text-[10px] uppercase";
            } else {
                btnP.className = "px-4 py-2 rounded-lg bg-secondary-blue text-white font-black text-[10px] uppercase shadow-md";
                btnC.className = "px-4 py-2 rounded-lg bg-white text-slate-400 border font-black text-[10px] uppercase";
            }
        },
        handleClearAllFilters() {
            document.getElementById('searchForm')?.reset();
            const p = document.getElementById('palabra'); if (p) p.value = '';
            applyFilters();
        },
        closeModal() { document.getElementById('actionModal').classList.replace('flex', 'hidden'); },
        showModal(title, msg) {
            document.getElementById('modalTitle').textContent = title;
            document.getElementById('modalBody').textContent = msg;
            document.getElementById('actionModal').classList.replace('hidden', 'flex');
        }
    };

    window.handleLogout = () => { localStorage.removeItem('token'); window.location.href = '/login'; };
    document.addEventListener('DOMContentLoaded', startApp);
})();