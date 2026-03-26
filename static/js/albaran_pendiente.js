/**
 * ARCHIVO: static/js/albaran_pendiente.js
 * FUNCIÓN: Controlador de Pendientes con FIX definitivo en envío masivo.
 * ACTUALIZADO: 26/03/2026 - FIX: Envío quirúrgico para preservar horas y fechas.
 */

const APP_PENDIENTES = {
    elements: {
        resultsBody: document.getElementById('albaranResults'),
        totalFooter: document.getElementById('albaranTotal'),
        pageInfo: document.getElementById('pageInfo'),
        activeCount: document.getElementById('activeFiltersCount'),
        recordsPerPage: document.getElementById('recordsPerPage'),
        selectAll: document.getElementById('selectAll')
    },
    state: {
        rawAlbaranes: [],
        filteredAlbaranes: [],
        currentPage: 1,
        pageSize: 20,
        searchMode: 'campos',
        licId: null,
        currentSort: { key: 'fecha', direction: 'desc' }
    }
};

async function startApp() {
    try {
        const resp = await fetch('/api/v1/user/licencia_info', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const identity = await resp.json();
        APP_PENDIENTES.state.licId = identity.licencia_id;

        await SearchEngine.initCatalog();
        await loadData();
        setupEvents();

        window.APP_STATE = APP_PENDIENTES.state;
    } catch (e) { console.error("Error al iniciar App:", e); }
}

async function loadData() {
    APP_PENDIENTES.elements.resultsBody.innerHTML = '<tr><td colspan="11" class="text-center py-20 italic text-slate-400 font-medium">Sincronizando con el servidor...</td></tr>';
    
    try {
        const response = await fetch(`/api/v1/albaranes/search-user?licencia_ref=${APP_PENDIENTES.state.licId}&pageSize=5000`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const json = await response.json();
        const items = json.data || json || [];

        // Filtro: Solo pendientes (No enviados, No cobrados, No pagados)
        APP_PENDIENTES.state.rawAlbaranes = items.filter(i => !i.enviado && !i.cobrado && !i.pagado);
        handleSearch(); 
    } catch (e) {
        APP_PENDIENTES.elements.resultsBody.innerHTML = '<tr><td colspan="11" class="text-center py-20 text-red-500 font-bold">Error de conexión</td></tr>';
    }
}

function handleSearch(e) {
    if (e) e.preventDefault();
    const params = {
        mode: APP_PENDIENTES.state.searchMode,
        empresa: document.getElementById('empresa').value,
        ref: document.getElementById('referencia_input').value,
        desde: document.getElementById('fecha_desde').value,
        hasta: document.getElementById('fecha_hasta').value,
        palabra: document.getElementById('palabra').value
    };
    APP_PENDIENTES.state.filteredAlbaranes = SearchEngine.applyFilters(APP_PENDIENTES.state.rawAlbaranes, params);
    sortTable(APP_PENDIENTES.state.currentSort.key, true);
    APP_PENDIENTES.state.currentPage = 1;
    render();
}

function render() {
    const { resultsBody, totalFooter, pageInfo, activeCount } = APP_PENDIENTES.elements;
    if (!resultsBody) return;
    resultsBody.innerHTML = '';
    
    const start = (APP_PENDIENTES.state.currentPage - 1) * APP_PENDIENTES.state.pageSize;
    const pageItems = APP_PENDIENTES.state.filteredAlbaranes.slice(start, start + APP_PENDIENTES.state.pageSize);

    if (pageItems.length === 0) {
        resultsBody.innerHTML = '<tr><td colspan="11" class="text-center py-20 text-slate-400 italic">No hay registros pendientes.</td></tr>';
        if (totalFooter) totalFooter.innerHTML = '';
        return;
    }

    let sumaTotal = 0;
    pageItems.forEach(i => {
        const imp = parseFloat(i.importe_total || 0);
        sumaTotal += imp;
        
        const row = `
            <tr class="hover:bg-orange-50/30 border-b border-slate-100 transition-colors group">
                <td class="px-4 py-3 text-center">
                    <input type="checkbox" value="${i.id}" class="select-albaran w-4 h-4 rounded accent-orange-500 cursor-pointer">
                </td>
                <td class="px-4 py-3 font-black text-slate-900">${i.numero_albaran || "N/A"}</td>
                <td class="px-4 py-3 text-slate-500 font-bold">${i.fecha ? i.fecha.substring(0, 10) : "-"}</td>
                <td class="px-4 py-3 text-secondary-blue font-black">${SearchEngine.getLicenciaNumero(i)}</td>
                <td class="px-4 py-4 font-bold text-slate-700 uppercase truncate max-w-[150px]">${SearchEngine.getEmpresaNombre(i)}</td>
                <td class="px-4 py-3 text-gray-400 italic">${i.referencia || "-"}</td>
                <td class="px-4 py-3 text-slate-600 font-semibold uppercase">${i.asalariado || "TITULAR"}</td>
                <td class="px-4 py-3 text-right font-black text-primary-link text-sm">€${imp.toFixed(2)}</td>
                <td class="px-4 py-3 text-center">
                    <span class="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[9px] font-black uppercase border border-blue-100">Pendiente</span>
                </td>
                <td class="px-4 py-3 text-center">
                    <div class="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onclick="window.location.href='/titulares/view/${i.id}'" class="p-1.5 border rounded-lg hover:bg-blue-50 text-blue-600 transition"><i data-lucide="eye" class="w-4 h-4"></i></button>
                        <button onclick="window.location.href='/titulares/update/${i.id}'" class="p-1.5 border rounded-lg hover:bg-orange-50 text-orange-600 transition"><i data-lucide="pencil" class="w-4 h-4"></i></button>
                    </div>
                </td>
            </tr>`;
        resultsBody.insertAdjacentHTML('beforeend', row);
    });

    if (totalFooter) {
        totalFooter.innerHTML = `<tr><td colspan="7" class="px-4 py-4 text-right text-slate-400 text-[10px] font-black uppercase tracking-tighter">Subtotal Página:</td><td class="px-4 py-4 text-right text-base text-primary-link font-black bg-orange-50 border-l border-slate-200">€${sumaTotal.toFixed(2)}</td><td colspan="3"></td></tr>`;
    }

    if (activeCount) activeCount.textContent = `${APP_PENDIENTES.state.filteredAlbaranes.length} REGISTROS`;
    if (pageInfo) {
        const totalP = Math.ceil(APP_PENDIENTES.state.filteredAlbaranes.length / APP_PENDIENTES.state.pageSize) || 1;
        pageInfo.textContent = `${APP_PENDIENTES.state.currentPage} / ${totalP}`;
    }
    if (window.lucide) lucide.createIcons();
    updateSortIcons();
}

/**
 * ✅ FUNCIÓN CORREGIDA: ENVÍO QUIRÚRGICO
 * Se envía un payload minimalista. El controlador de Go (albaran.go) 
 * detectará que solo viene 'enviado' y no tocará el resto de columnas (fechas/horas).
 */
window.handleEnviarSeleccionados = async () => {
    const checkboxes = document.querySelectorAll('.select-albaran:checked');
    const ids = Array.from(checkboxes).map(cb => cb.value);
    
    if (ids.length === 0) return alert("Por favor, selecciona al menos un albarán.");
    
    if (!confirm(`¿Confirmas el envío de ${ids.length} albaranes?`)) return;

    const btn = document.getElementById('btnEnviarMasivo');
    const originalText = btn.innerHTML;
    btn.disabled = true; 
    btn.innerHTML = '<span class="animate-pulse">Enviando...</span>';

    try {
        const token = localStorage.getItem('token');
        
        for (const id of ids) {
            // NOTA CRÍTICA: NO enviamos el objeto 'item'. 
            // Enviamos solo llaves de estado para que el Update de GORM sea parcial.
            const patchPayload = { 
                enviado: true,
                finalizado: true 
            };

            await fetch(`/api/v1/albaranes/user/${id}`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json', 
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify(patchPayload)
            });
        }

        alert(`✅ ${ids.length} albaranes enviados correctamente.`);
        await loadData(); 
    } catch (error) {
        console.error("Error en envío masivo:", error);
        alert("Hubo un error al procesar el envío.");
    } finally {
        btn.disabled = false; 
        btn.innerHTML = originalText;
        if (window.lucide) lucide.createIcons();
    }
};

/**
 * EXPORTACIÓN
 */
window.handleGeneratePDF = () => {
    const data = APP_PENDIENTES.state.filteredAlbaranes;
    if (data.length === 0) return alert("Sin datos");
    const clean = data.map(i => ({
        "Nº ALBARAN": i.numero_albaran,
        "FECHA": i.fecha ? i.fecha.substring(0,10) : "-",
        "EMPRESA": SearchEngine.getEmpresaNombre(i),
        "EXPEDIENTE": i.referencia || "-",
        "CONDUCTOR": i.asalariado || "TITULAR",
        "TOTAL": `€${parseFloat(i.importe_total || 0).toFixed(2)}`
    }));
    Oficina.generarPDF("ALBARANES_PENDIENTES", clean);
};

window.handleGenerateXLSX = () => {
    const data = APP_PENDIENTES.state.filteredAlbaranes;
    if (data.length === 0) return alert("Sin datos");
    const clean = data.map(i => ({
        "Nº ALBARAN": i.numero_albaran,
        "FECHA": i.fecha ? i.fecha.substring(0,10) : "-",
        "EMPRESA": SearchEngine.getEmpresaNombre(i),
        "EXPEDIENTE": i.referencia || "-",
        "TOTAL": parseFloat(i.importe_total || 0)
    }));
    Oficina.generarExcel("ALBARANES_PENDIENTES", clean);
};

function sortTable(key, isInitial = false) {
    if (!isInitial) {
        APP_PENDIENTES.state.currentSort.direction = (APP_PENDIENTES.state.currentSort.key === key && APP_PENDIENTES.state.currentSort.direction === 'asc') ? 'desc' : 'asc';
        APP_PENDIENTES.state.currentSort.key = key;
    }
    APP_PENDIENTES.state.filteredAlbaranes.sort((a, b) => {
        let vA = a[key], vB = b[key];
        if (key === 'empresa') { vA = SearchEngine.getEmpresaNombre(a); vB = SearchEngine.getEmpresaNombre(b); }
        if (key === 'importe_total') { vA = parseFloat(vA || 0); vB = parseFloat(vB || 0); }
        if (key === 'fecha') { vA = new Date(vA).getTime(); vB = new Date(vB).getTime(); }
        return (vA < vB ? -1 : 1) * (APP_PENDIENTES.state.currentSort.direction === 'asc' ? 1 : -1);
    });
    if (!isInitial) render();
}

function updateSortIcons() {
    ['numero_albaran', 'fecha', 'empresa', 'referencia', 'importe_total'].forEach(k => {
        const icon = document.getElementById(`sort-${k}`);
        if (!icon) return;
        const isCurrent = k === APP_PENDIENTES.state.currentSort.key;
        icon.setAttribute('data-lucide', isCurrent ? (APP_PENDIENTES.state.currentSort.direction === 'asc' ? 'chevron-up' : 'chevron-down') : 'chevrons-up-down');
        icon.className = `w-3 h-3 ml-1 transition-all ${isCurrent ? 'text-primary-link opacity-100' : 'text-gray-400 opacity-30'}`;
    });
    if (window.lucide) lucide.createIcons();
}

function setupEvents() {
    document.getElementById('searchForm').onsubmit = handleSearch;
    APP_PENDIENTES.elements.recordsPerPage.onchange = (e) => {
        const val = e.target.value;
        APP_PENDIENTES.state.pageSize = val === 'todos' ? 9999 : parseInt(val);
        APP_PENDIENTES.state.currentPage = 1;
        render();
    };
    document.getElementById('prevPageBtn').onclick = () => { if(APP_PENDIENTES.state.currentPage > 1) { APP_PENDIENTES.state.currentPage--; render(); } };
    document.getElementById('nextPageBtn').onclick = () => { 
        if(APP_PENDIENTES.state.currentPage < Math.ceil(APP_PENDIENTES.state.filteredAlbaranes.length/APP_PENDIENTES.state.pageSize)) { 
            APP_PENDIENTES.state.currentPage++; render(); 
        } 
    };
    APP_PENDIENTES.elements.selectAll.onchange = (e) => {
        document.querySelectorAll('.select-albaran').forEach(cb => cb.checked = e.target.checked);
    };
}

window.UI = {
    setSearchModeManual(mode) {
        APP_PENDIENTES.state.searchMode = mode;
        document.getElementById('palabraSection').classList.toggle('hidden', mode === 'campos');
        document.getElementById('searchForm').classList.toggle('hidden', mode === 'palabra');
        const btnC = document.getElementById('btn-mode-campos'), btnP = document.getElementById('btn-mode-palabra');
        btnC.className = mode === 'campos' ? "px-4 py-2 rounded-lg bg-secondary-blue text-white font-black text-[10px] uppercase shadow-md" : "px-4 py-2 rounded-lg bg-white text-slate-400 font-black text-[10px] uppercase border";
        btnP.className = mode === 'palabra' ? "px-4 py-2 rounded-lg bg-primary-pastel text-black-pure font-bold text-[10px] uppercase shadow-md" : "px-4 py-2 rounded-lg bg-white text-slate-400 font-black text-[10px] uppercase border";
    },
    handleClearAllFilters() {
        document.getElementById('searchForm').reset();
        document.getElementById('palabra').value = '';
        handleSearch();
    },
    closeModal() { document.getElementById('actionModal').classList.replace('flex', 'hidden'); }
};

window.sortTable = sortTable;
window.handleSearch = handleSearch;
window.handleLogout = () => { localStorage.removeItem('token'); window.location.href = '/login'; };

document.addEventListener('DOMContentLoaded', startApp);