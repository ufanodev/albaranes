/**
 * admin_pago_tit.js - Gestión Maestra de Pagos a Titulares
 */

const STATE = {
    allData: [],
    currentPage: 1,
    pageSize: 25,
    sortKey: 'fecha',
    sortDir: 'desc'
};

const UI = {
    formatDate(iso) { 
        if (!iso || iso.startsWith('0001')) return '-';
        return iso.substring(0, 10); 
    },
    alertMessage(message, type = 'info') {
        const s = document.getElementById('statusMessage');
        if (!s) return;
        s.textContent = message;
        s.className = `p-4 rounded-xl font-bold text-center border-2 mb-4 bg-${type === 'success' ? 'green' : 'blue'}-100 text-${type === 'success' ? 'green' : 'blue'}-700 border-${type === 'success' ? 'green' : 'blue'}-200`;
        s.classList.remove('hidden');
        setTimeout(() => s.classList.add('hidden'), 5000);
    }
};

// =================================================================================
// 🔍 CARGA Y BÚSQUEDA
// =================================================================================

async function loadCombos() {
    try {
        const headers = { 'Authorization': `Bearer ${localStorage.getItem('token')}` };
        const [resLic, resEmp] = await Promise.all([
            fetch('/api/v1/licencias', { headers }),
            fetch('/api/v1/empresas', { headers })
        ]);
        const licencias = await resLic.json();
        const empresas = await resEmp.json();

        document.getElementById('licenciaSelect').innerHTML = '<option value="">-- Todas --</option>' + 
            (licencias.data || licencias).map(l => `<option value="${l.id}">${l.licencia}</option>`).join('');
        document.getElementById('empresa').innerHTML = '<option value="">-- Todas --</option>' + 
            (empresas.data || empresas).map(e => `<option value="${e.id}">${e.nombre}</option>`).join('');
    } catch (e) { console.error("Error combos:", e); }
}

window.handleSearch = async (e) => {
    if (e) e.preventDefault();
    const tbody = document.getElementById('albaranResults');
    tbody.innerHTML = '<tr><td colspan="10" class="text-center py-10 italic text-gray-400">Buscando albaranes...</td></tr>';

    const params = new URLSearchParams(new FormData(document.getElementById('searchForm')));
    const pal = document.getElementById('palabra').value;
    if (pal) params.append('palabra', pal);
    params.append('enviado', 'true');

    try {
        const res = await fetch(`/api/v1/albaranes/search?${params.toString()}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const json = await res.json();
        STATE.allData = json.data || [];
        STATE.currentPage = 1;
        renderTable();
    } catch (err) { UI.alertMessage("Error de conexión", "error"); }
};

// =================================================================================
// 📊 RENDERIZADO
// =================================================================================

function renderTable() {
    const tbody = document.getElementById('albaranResults');
    const tableFooter = document.getElementById('tableFooter');
    tbody.innerHTML = '';
    
    const start = (STATE.currentPage - 1) * STATE.pageSize;
    const end = start + STATE.pageSize;
    const pageData = STATE.allData.slice(start, end);

    if (pageData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="text-center py-10 font-bold text-gray-400 uppercase">Sin resultados</td></tr>';
        tableFooter.classList.add('hidden');
        return;
    }

    let sumaTotalPagina = 0;

    pageData.forEach(alb => {
        const importe = parseFloat(alb.importe_total || 0);
        sumaTotalPagina += importe;
        const isPag = alb.pagado === true;

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-orange-50/50 transition-colors text-[11px] border-b border-gray-100';
        
        tr.innerHTML = `
            <td class="px-4 py-3 text-center">
                <input type="checkbox" value="${alb.id}" class="cb-seleccion h-4 w-4 rounded border-gray-300 text-primary-link" ${isPag ? 'disabled checked' : ''}>
            </td>
            <td class="px-4 py-3 text-gray-400 font-bold">#${alb.id}</td>
            <td class="px-4 py-3 font-black">${alb.numero_albaran}</td>
            <td class="px-4 py-3 font-bold text-blue-600">${alb.LicenciaData?.licencia || alb.licencia_ref}</td>
            <td class="px-4 py-3">${UI.formatDate(alb.fecha)}</td>
            <td class="px-4 py-3 font-medium">${alb.EmpresaData?.nombre || alb.empresa_nombre || '-'}</td>
            <td class="px-4 py-3 text-right font-black text-primary-link bg-orange-50/20">€${importe.toFixed(2)}</td>
            <td class="px-4 py-3 text-center">${isPag ? '✅' : '❌'}</td>
            <td class="px-4 py-3">${UI.formatDate(alb.fecha_pago)}</td>
            <td class="px-4 py-3 truncate max-w-[120px]" title="${alb.observaciones_admin || ''}">${alb.observaciones_admin || '-'}</td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('totalImporte').textContent = `€${sumaTotalPagina.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
    tableFooter.classList.remove('hidden');
    updatePaginationUI();
}

// =================================================================================
// 💰 PAGO MASIVO (BOTÓN) - Confirmación con Datos
// =================================================================================

window.handleBulkPay = async () => {
    const checkedBoxes = Array.from(document.querySelectorAll('.cb-seleccion:checked:not(:disabled)'));
    
    if (checkedBoxes.length === 0) {
        return UI.alertMessage("Selecciona al menos un albarán pendiente", "error");
    }

    let resumen = "Vas a marcar como PAGADOS los siguientes albaranes:\n\n";
    const ids = [];

    checkedBoxes.forEach(cb => {
        const row = cb.closest('tr');
        const id = cb.value;
        const nAlbaran = row.cells[2].textContent.trim();
        const licencia = row.cells[3].textContent.trim();
        resumen += `• ID: ${id} | Nº: ${nAlbaran} | Lic: ${licencia}\n`;
        ids.push(id);
    });

    resumen += `\n¿Confirmas el pago de estos ${ids.length} registros?`;

    if (!confirm(resumen)) return;

    UI.alertMessage(`Procesando ${ids.length} pagos...`, "info");
    const token = localStorage.getItem('token');
    const now = new Date().toISOString();

    try {
        for (const id of ids) {
            await fetch(`/api/v1/albaranes/id/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ pagado: true, fecha_pago: now })
            });
        }
        UI.alertMessage("✅ Pagos registrados con éxito", "success");
        window.handleSearch();
    } catch (err) { UI.alertMessage("Error en la operación", "error"); }
};

// ... Resto de funciones (handleSort, updatePaginationUI, loadCombos, etc.) idénticas al archivo de empresas ...

window.handleSort = (key, type) => {
    STATE.sortDir = (STATE.sortKey === key && STATE.sortDir === 'asc') ? 'desc' : 'asc';
    STATE.sortKey = key;
    STATE.allData.sort((a, b) => {
        let vA = a[key] || '', vB = b[key] || '';
        if (type === 'number') { vA = parseFloat(vA); vB = parseFloat(vB); }
        if (type === 'date') { vA = new Date(vA).getTime(); vB = new Date(vB).getTime(); }
        return STATE.sortDir === 'asc' ? (vA > vB ? 1 : -1) : (vA < vB ? 1 : -1);
    });
    renderTable();
};

function updatePaginationUI() {
    const total = STATE.allData.length;
    const totalPages = Math.ceil(total / STATE.pageSize) || 1;
    document.getElementById('resultsCount').textContent = total;
    document.getElementById('pageInfo').textContent = `Página ${STATE.currentPage} / ${totalPages}`;
    document.getElementById('prevPageBtn').disabled = STATE.currentPage === 1;
    document.getElementById('nextPageBtn').disabled = STATE.currentPage >= totalPages;
    if (window.lucide) lucide.createIcons();
}

document.addEventListener('DOMContentLoaded', async () => {
    await loadCombos();
    const recs = document.getElementById('recordsPerPage');
    if (recs) {
        recs.innerHTML = '<option value="10">10 filas</option><option value="25" selected>25 filas</option><option value="50">50 filas</option><option value="99999">Todos</option>';
        recs.onchange = (e) => { STATE.pageSize = parseInt(e.target.value); STATE.currentPage = 1; renderTable(); };
    }
    document.getElementById('prevPageBtn').onclick = () => { if (STATE.currentPage > 1) { STATE.currentPage--; renderTable(); } };
    document.getElementById('nextPageBtn').onclick = () => { if (STATE.currentPage < Math.ceil(STATE.allData.length / STATE.pageSize)) { STATE.currentPage++; renderTable(); } };
    window.handleSearch();
});

window.handleClearAllFilters = () => { document.getElementById('searchForm').reset(); window.handleSearch(); };
window.handleLogout = () => { localStorage.removeItem('token'); window.location.href = '/login'; };