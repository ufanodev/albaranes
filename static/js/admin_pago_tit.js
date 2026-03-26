/**
 * ARCHIVO: static/js/admin_pago_tit.js
 * DESCRIPCIÓN: Gestión Maestra de Pagos a Titulares con exportación y motor dual.
 * ACTUALIZADO: 26/03/2026
 */

const STATE = {
    allData: [],        // Datos brutos filtrados inicialmente por "enviado"
    filteredData: [],   // Datos resultantes tras filtros locales
    currentPage: 1,
    pageSize: 25,
    sortKey: 'fecha',
    sortDir: 'desc',
    searchMode: 'campos' // 'campos' o 'palabra'
};

const UI_PAGOS = {
    formatDate(iso) { 
        if (!iso || iso.startsWith('0001')) return '-';
        return iso.substring(0, 10); 
    },
    alertMessage(message, type = 'info') {
        const s = document.getElementById('statusMessage');
        if (!s) return;
        s.textContent = message;
        const bg = type === 'success' ? 'bg-green-100 border-green-500 text-green-700' : 'bg-red-100 border-red-500 text-red-700';
        s.className = `fixed bottom-5 right-5 z-[2000] p-4 rounded-xl shadow-2xl border-2 font-black text-xs uppercase tracking-widest transition-all duration-300 ${bg}`;
        s.classList.remove('hidden');
        setTimeout(() => s.classList.add('hidden'), 5000);
    }
};

// =================================================================================
// 🔍 INICIALIZACIÓN Y MOTOR DE BÚSQUEDA
// =================================================================================

async function initPagoTit() {
    console.log("💰 [PAGOS] Iniciando módulo...");
    // 1. Catálogos vía SearchEngine
    await SearchEngine.initCatalog(true);
    // 2. Cargar datos
    await loadData();
    setupTableEvents();
}

async function loadData() {
    const tbody = document.getElementById('albaranResults');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="11" class="p-10 text-center italic text-gray-400 animate-pulse font-bold uppercase tracking-widest">Sincronizando Liquidaciones...</td></tr>';
    
    try {
        const token = localStorage.getItem('token');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        
        // Obtenemos todos los albaranes (pageSize alto para filtrar en cliente)
        const res = await fetch('/api/v1/albaranes/search?pageSize=10000', { headers });
        const json = await res.json();
        const data = json.data || [];
        
        // Filtro base: Solo albaranes ENVIADOS (los que generan deuda)
        STATE.allData = data.filter(a => a.enviado === true);
        window.handleSearch();
    } catch (err) { 
        console.error("Error loadData:", err);
        UI_PAGOS.alertMessage("Error al conectar con la base de datos", "error"); 
    }
}

window.handleSearch = (e) => {
    if (e) e.preventDefault();
    
    // Captura segura de inputs
    const params = {
        mode: STATE.searchMode,
        licencia: document.getElementById('licenciaSelect')?.value || "",
        empresa: document.getElementById('empresa')?.value || "",
        pagado: document.getElementById('pagado')?.value || "",
        ref: document.getElementById('referencia')?.value || "",
        palabra: document.getElementById('palabra')?.value || ""
    };

    // Filtrado lógico universal
    STATE.filteredData = SearchEngine.applyFilters(STATE.allData, params);
    
    // Re-ordenar y renderizar
    handleSort(STATE.sortKey, 'string', true); 
    STATE.currentPage = 1;
    renderTable();
};

// =================================================================================
// 📊 RENDERIZADO Y TABLA
// =================================================================================

function renderTable() {
    const tbody = document.getElementById('albaranResults');
    const tableFooter = document.getElementById('tableFooter');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    const start = (STATE.currentPage - 1) * STATE.pageSize;
    const pageData = STATE.filteredData.slice(start, start + STATE.pageSize);

    if (pageData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" class="p-10 text-center font-bold text-orange-500 uppercase tracking-widest">Sin resultados coincidentes</td></tr>';
        if (tableFooter) tableFooter.classList.add('hidden');
        updatePaginationUI();
        return;
    }

    let sumaTotalPagina = 0;
    pageData.forEach(alb => {
        const importe = parseFloat(alb.importe_total || 0);
        sumaTotalPagina += importe;
        const isPag = alb.pagado === true;

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-orange-50/50 transition-colors border-b border-gray-100 group';
        
        tr.innerHTML = `
            <td class="px-4 py-3 text-center">
                <input type="checkbox" value="${alb.id}" class="cb-seleccion h-4 w-4 rounded border-gray-300 text-primary-link cursor-pointer" ${isPag ? 'disabled checked' : ''}>
            </td>
            <td class="px-4 py-3 text-gray-400 font-bold">#${alb.id}</td>
            <td class="px-4 py-3 font-black text-slate-800">${alb.numero_albaran}</td>
            <td class="px-4 py-3 font-black text-blue-600 uppercase">${SearchEngine.getLicenciaNumero(alb)}</td>
            <td class="px-4 py-3 font-bold text-slate-500">${UI_PAGOS.formatDate(alb.fecha)}</td>
            <td class="px-4 py-3 font-black uppercase truncate max-w-[150px] text-slate-700">${SearchEngine.getEmpresaNombre(alb)}</td>
            <td class="px-4 py-3 text-right font-black text-primary-link bg-orange-50/20">€${importe.toFixed(2)}</td>
            <td class="px-4 py-3 text-center font-black">
                ${isPag ? '<span class="text-green-600">PAGADO</span>' : '<span class="text-red-500">PENDIENTE</span>'}
            </td>
            <td class="px-4 py-3 text-slate-400 font-bold">${UI_PAGOS.formatDate(alb.fecha_pago)}</td>
            <td class="px-4 py-3 truncate max-w-[120px] italic text-slate-400" title="${alb.observaciones_admin || ''}">${alb.observaciones_admin || '-'}</td>
            <td class="px-4 py-3 text-center">
                <button onclick="window.location.href='/admin/albaranes/view/${alb.id}'" class="p-1 text-blue-500 hover:bg-blue-50 rounded transition"><i data-lucide="eye" class="w-4 h-4"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    const elTotal = document.getElementById('totalImporte');
    if (elTotal) elTotal.textContent = `€${sumaTotalPagina.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
    if (tableFooter) tableFooter.classList.remove('hidden');
    updatePaginationUI();
}

// =================================================================================
// 💰 LÓGICA DE PAGOS Y EXPORTACIÓN
// =================================================================================

window.handleBulkPay = async () => {
    const checkedBoxes = Array.from(document.querySelectorAll('.cb-seleccion:checked:not(:disabled)'));
    if (checkedBoxes.length === 0) return UI_PAGOS.alertMessage("Selecciona registros pendientes para liquidar", "error");

    const ids = checkedBoxes.map(cb => cb.value);
    if (!confirm(`¿Confirmar liquidación masiva de ${ids.length} albaranes?`)) return;

    UI_PAGOS.alertMessage("Sincronizando...", "info");
    const token = localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
        for (const id of ids) {
            await fetch(`/api/v1/albaranes/id/${id}`, {
                method: 'PUT',
                headers: headers,
                body: JSON.stringify({ pagado: true, fecha_pago: new Date().toISOString() })
            });
        }
        UI_PAGOS.alertMessage("✅ Liquidación exitosa", "success");
        await loadData();
    } catch (err) { UI_PAGOS.alertMessage("Error en la operación", "error"); }
};

// --- PUENTES DE EXPORTACIÓN ---
window.handleExportPDF = () => {
    if (!STATE.filteredData.length) return alert("No hay datos para exportar");
    Oficina.generarPDF('Liquidacion_Titulares', STATE.filteredData);
};

window.handleExportXLSX = () => {
    if (!STATE.filteredData.length) return alert("No hay datos para exportar");
    Oficina.generarExcel('Liquidacion_Titulares', STATE.filteredData);
};

// =================================================================================
// 🛠️ UTILIDADES (ORDENACIÓN, PAGINACIÓN, MODOS)
// =================================================================================

window.handleSort = (key, type, isInitial = false) => {
    if (!isInitial) {
        STATE.sortDir = (STATE.sortKey === key && STATE.sortDir === 'asc') ? 'desc' : 'asc';
        STATE.sortKey = key;
    }
    STATE.filteredData.sort((a, b) => {
        let vA = a[key] || '', vB = b[key] || '';
        if (key === 'licencia_ref') { vA = SearchEngine.getLicenciaNumero(a); vB = SearchEngine.getLicenciaNumero(b); }
        if (key === 'empresa_nombre') { vA = SearchEngine.getEmpresaNombre(a); vB = SearchEngine.getEmpresaNombre(b); }
        if (type === 'number' || key === 'importe_total') { vA = parseFloat(vA); vB = parseFloat(vB); }
        if (type === 'date' || key === 'fecha') { vA = new Date(vA).getTime(); vB = new Date(vB).getTime(); }
        return STATE.sortDir === 'asc' ? (vA < vB ? -1 : 1) : (vA < vB ? 1 : -1);
    });
    if (!isInitial) renderTable();
};

function updatePaginationUI() {
    const total = STATE.filteredData.length;
    const totalPages = Math.ceil(total / STATE.pageSize) || 1;
    const elRes = document.getElementById('resultsCount');
    const elPag = document.getElementById('pageInfo');
    if (elRes) elRes.textContent = total;
    if (elPag) elPag.textContent = `Página ${STATE.currentPage} / ${totalPages}`;
    
    document.getElementById('prevPageBtn').disabled = STATE.currentPage === 1;
    document.getElementById('nextPageBtn').disabled = STATE.currentPage >= totalPages;
    if (window.lucide) lucide.createIcons();
}

function setupTableEvents() {
    const recs = document.getElementById('recordsPerPage');
    if (recs) recs.onchange = (e) => { STATE.pageSize = parseInt(e.target.value); STATE.currentPage = 1; renderTable(); };
    document.getElementById('prevPageBtn').onclick = () => { if (STATE.currentPage > 1) { STATE.currentPage--; renderTable(); } };
    document.getElementById('nextPageBtn').onclick = () => { if (STATE.currentPage < Math.ceil(STATE.filteredData.length / STATE.pageSize)) { STATE.currentPage++; renderTable(); } };
    
    // Listener para búsqueda instantánea en modo palabra
    document.getElementById('palabra')?.addEventListener('input', () => {
        if (STATE.searchMode === 'palabra') window.handleSearch();
    });
}

window.UI_PAGOS = {
    ...UI_PAGOS,
    setSearchModeManual(mode) {
        STATE.searchMode = mode;
        const pSec = document.getElementById('palabraSection');
        const cSec = document.getElementById('camposSection');
        const btnC = document.getElementById('btn-mode-campos');
        const btnP = document.getElementById('btn-mode-palabra');

        if (mode === 'palabra') {
            pSec?.classList.remove('hidden');
            cSec?.classList.add('hidden');
            if (btnP) btnP.className = "px-4 py-2 rounded-lg bg-primary-link text-white font-black text-[10px] uppercase shadow-md transition-all";
            if (btnC) btnC.className = "px-4 py-2 rounded-lg bg-white text-slate-400 font-black text-[10px] border uppercase transition-all";
            document.getElementById('palabra')?.focus();
        } else {
            pSec?.classList.add('hidden');
            cSec?.classList.remove('hidden');
            if (btnC) btnC.className = "px-4 py-2 rounded-lg bg-primary-link text-white font-black text-[10px] uppercase shadow-md transition-all";
            if (btnP) btnP.className = "px-4 py-2 rounded-lg bg-white text-slate-400 font-black text-[10px] border uppercase transition-all";
        }
        window.handleSearch();
    }
};

window.handleClearAllFilters = () => { 
    document.getElementById('searchForm')?.reset(); 
    const elPal = document.getElementById('palabra');
    if (elPal) elPal.value = ''; 
    window.handleSearch(); 
};

window.handleLogout = () => { localStorage.removeItem('token'); window.location.href = '/login'; };

document.addEventListener('DOMContentLoaded', initPagoTit);