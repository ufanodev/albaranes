/**
 * admin_pago_emp.js - GESTIÓN DE COBROS A EMPRESAS
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
        if (!iso || iso.startsWith('0001') || iso === '-' || iso === 'null') return '';
        return iso.substring(0, 10); 
    },
    alertMessage(message, type = 'info') {
        const s = document.getElementById('statusMessage');
        if (!s) return;
        s.textContent = message;
        s.className = `p-4 rounded-xl font-bold text-center border-2 mb-4 bg-${type === 'success' ? 'green' : 'blue'}-100 text-${type === 'success' ? 'green' : 'blue'}-700`;
        s.classList.remove('hidden');
        setTimeout(() => s.classList.add('hidden'), 5000);
    }
};

// --- CARGA DE SELECTORES ---

async function loadCombos() {
    try {
        const headers = { 'Authorization': `Bearer ${localStorage.getItem('token')}` };
        const [resLic, resEmp] = await Promise.all([
            fetch('/api/v1/licencias', { headers }),
            fetch('/api/v1/empresas', { headers })
        ]);
        const licencias = await resLic.json();
        const empresas = await resEmp.json();

        const licSelect = document.getElementById('licenciaSelect');
        const empSelect = document.getElementById('empresa');

        if (licSelect) licSelect.innerHTML = '<option value="">-- Todas --</option>' + 
            (licencias.data || licencias).map(l => `<option value="${l.id}">${l.licencia}</option>`).join('');
        
        if (empSelect) empSelect.innerHTML = '<option value="">-- Todas --</option>' + 
            (empresas.data || empresas).map(e => `<option value="${e.id}">${e.nombre}</option>`).join('');
    } catch (e) { console.error("Error cargando combos:", e); }
}

// --- BÚSQUEDA ---

window.handleSearch = async function(event) {
    if (event) event.preventDefault();
    const tbody = document.getElementById('albaranResults');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="11" class="text-center py-20 italic">Buscando...</td></tr>';

    const form = document.getElementById('searchForm');
    const formData = new FormData(form);
    const params = new URLSearchParams();

    // Sincronización con backend Go
    const lic = formData.get('licencia_ref');
    const emp = formData.get('empresa_ref');
    const pal = formData.get('palabra');

    if (lic) params.append('licencia_ref', lic);
    if (emp) params.append('empresa_ref', emp);
    if (pal) params.append('palabra', pal.trim());
    
    if (formData.get('referencia')) params.append('referencia', formData.get('referencia'));
    if (formData.get('fecha_desde')) params.append('fecha_desde', formData.get('fecha_desde'));
    if (formData.get('fecha_hasta')) params.append('fecha_hasta', formData.get('fecha_hasta'));
    
    const cobVal = formData.get('cobrado');
    if (cobVal === 'si') params.append('cobrado', 'true');
    else if (cobVal === 'no') params.append('cobrado', 'false');

    params.append('enviado', 'true'); // Solo mostramos enviados (albaranes cerrados)
    params.append('pageSize', '5000');

    try {
        const res = await fetch(`/api/v1/albaranes/search?${params.toString()}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const json = await res.json();
        STATE.allData = json.data || [];
        STATE.currentPage = 1;
        renderTable();
    } catch (err) { 
        UI.alertMessage("Error al conectar con el servidor", "error");
        tbody.innerHTML = '<tr><td colspan="11" class="text-center py-20 text-red-500">Error en la carga</td></tr>';
    }
};

// --- RENDERIZADO ---

function renderTable() {
    const tbody = document.getElementById('albaranResults');
    const tableFooter = document.getElementById('tableFooter');
    if (!tbody) return;

    tbody.innerHTML = '';
    const start = (STATE.currentPage - 1) * STATE.pageSize;
    const pageData = STATE.allData.slice(start, start + STATE.pageSize);

    if (pageData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" class="text-center py-20 font-bold text-gray-400 uppercase">Sin resultados</td></tr>';
        if (tableFooter) tableFooter.classList.add('hidden');
        updateUI();
        return;
    }

    let sumaTotalPagina = 0;

    pageData.forEach(alb => {
        const importe = parseFloat(alb.importe_total || 0);
        sumaTotalPagina += importe;
        const isCob = (alb.cobrado === true || alb.cobrado === "true");
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-orange-50/50 border-b text-[11px]';
        tr.dataset.id = alb.id;

        tr.innerHTML = `
            <td class="text-center"><input type="checkbox" class="cobro-checkbox h-4 w-4" ${isCob ? 'checked' : ''} onchange="handleCobroUIUpdate(${alb.id})"></td>
            <td class="font-bold text-gray-400">#${alb.id}</td>
            <td class="font-black">${alb.numero_albaran}</td>
            <td class="font-bold text-blue-600">${alb.LicenciaData?.licencia || alb.licencia_ref}</td>
            <td>${UI.formatDate(alb.fecha)}</td>
            <td class="font-medium">${alb.EmpresaData?.nombre || alb.empresa_nombre || '-'}</td>
            <td class="text-right font-black text-primary-link bg-orange-50/20">€${importe.toFixed(2)}</td>
            <td class="text-center">${isCob ? '✅' : '❌'}</td>
            <td><input type="date" class="input-field text-[10px] py-1 ${isCob ? '' : 'hidden'}" value="${UI.formatDate(alb.fecha_cobro)}" onchange="updateSingleDate(${alb.id}, 'fecha_cobro', this.value)"></td>
            <td><input type="date" class="input-field text-[10px] py-1 ${isCob ? '' : 'hidden'}" value="${UI.formatDate(alb.fecha_pago)}" onchange="updateSingleDate(${alb.id}, 'fecha_pago', this.value)"></td>
            <td class="truncate max-w-[100px] text-gray-400 italic">${alb.observaciones_admin || '-'}</td>
        `;
        tbody.appendChild(tr);
    });

    const totalImpEl = document.getElementById('totalImporte');
    if (totalImpEl) {
        totalImpEl.textContent = `€${sumaTotalPagina.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
        if (tableFooter) tableFooter.classList.remove('hidden');
    }
    updateUI();
}

function updateUI() {
    const total = STATE.allData.length;
    const countEl = document.getElementById('resultsCount');
    const infoEl = document.getElementById('pageInfo');
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');

    if (countEl) countEl.textContent = total;
    if (infoEl) infoEl.textContent = `Página ${STATE.currentPage} de ${Math.ceil(total / STATE.pageSize) || 1}`;
    if (prevBtn) prevBtn.disabled = STATE.currentPage === 1;
    if (nextBtn) nextBtn.disabled = STATE.currentPage >= Math.ceil(total / STATE.pageSize);
    
    if (window.lucide) lucide.createIcons();
}

// --- ORDENACIÓN ---

window.handleSort = function(key, type = 'string') {
    STATE.sortDir = (STATE.sortKey === key && STATE.sortDir === 'asc') ? 'desc' : 'asc';
    STATE.sortKey = key;
    STATE.allData.sort((a, b) => {
        let vA = a[key] || '', vB = b[key] || '';
        if (type === 'number') { vA = parseFloat(vA); vB = parseFloat(vB); }
        if (STATE.sortDir === 'asc') return vA > vB ? 1 : -1;
        return vA < vB ? 1 : -1;
    });
    renderTable();
};

// --- EXPORTACIÓN ---

window.handleGeneratePDF = async () => {
    if (STATE.allData.length === 0) return;
    const payload = {
        reportName: "COBROS_EMPRESAS",
        data: STATE.allData.map(a => ({
            "ALBARÁN": a.numero_albaran,
            "FECHA": UI.formatDate(a.fecha),
            "LICENCIA": a.LicenciaData?.licencia || a.licencia_ref,
            "EMPRESA": a.EmpresaData?.nombre || a.empresa_nombre,
            "TOTAL": parseFloat(a.importe_total || 0).toFixed(2),
            "COBRADO": a.cobrado ? 'SÍ' : 'NO'
        }))
    };
    try {
        const res = await fetch('/api/v1/albaranes/export/pdf', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` }, 
            body: JSON.stringify(payload) 
        });
        const result = await res.json();
        if (result.success) window.open(result.downloadURL, '_blank');
    } catch (e) { console.error("Error PDF:", e); }
};

window.handleGenerateXLSX = async () => {
    if (STATE.allData.length === 0) return;
    const payload = {
        reportName: "EXCEL_COBROS_EMPRESAS",
        data: STATE.allData.map(a => ({
            "ID": a.id.toString(), "ALBARAN": a.numero_albaran, "FECHA": UI.formatDate(a.fecha),
            "LICENCIA": a.LicenciaData?.licencia, "TOTAL": parseFloat(a.importe_total || 0)
        }))
    };
    try {
        const res = await fetch('/api/v1/albaranes/export/xlsx', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` }, 
            body: JSON.stringify(payload) 
        });
        const result = await res.json();
        if (result.success) window.location.href = result.downloadURL;
    } catch (e) { console.error("Error XLSX:", e); }
};

// --- ACCIONES DE DB ---

async function updateSingleDate(id, field, value) {
    const payload = {}; 
    payload[field] = value;
    await fetch(`/api/v1/albaranes/${id}`, { 
        method: 'PUT', 
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` }, 
        body: JSON.stringify(payload) 
    });
    UI.alertMessage("Fecha actualizada", "success");
}

window.handleCobroUIUpdate = async (id) => {
    const row = document.querySelector(`tr[data-id="${id}"]`);
    const isChecked = row.querySelector('.cobro-checkbox').checked;
    const hoy = new Date().toISOString().split('T')[0];

    try {
        await fetch(`/api/v1/albaranes/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: JSON.stringify({ 
                cobrado: isChecked, 
                pagado: isChecked, 
                fecha_cobro: isChecked ? hoy : null, 
                fecha_pago: isChecked ? hoy : null 
            })
        });
        window.handleSearch();
    } catch (e) { console.error("Error cobro individual:", e); }
};

window.handleBulkPay = async () => {
    const checkedBoxes = document.querySelectorAll('.cobro-checkbox:checked');
    const ids = Array.from(checkedBoxes)
        .filter(cb => !cb.disabled) 
        .map(cb => parseInt(cb.closest('tr').dataset.id));

    if (ids.length === 0) return alert("Selecciona albaranes pendientes para cobrar");
    
    try {
        await fetch('/api/v1/albaranes/bulk-charge', { 
            method: 'PUT', 
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` }, 
            body: JSON.stringify({ ids }) 
        });
        UI.alertMessage(`${ids.length} albaranes cobrados correctamente`, "success");
        window.handleSearch();
    } catch (e) { console.error("Error bulk:", e); }
};

// --- INICIALIZACIÓN ---

document.addEventListener('DOMContentLoaded', async () => {
    await loadCombos();
    
    const recs = document.getElementById('recordsPerPage');
    if (recs) {
        recs.onchange = (e) => { 
            STATE.pageSize = parseInt(e.target.value); 
            STATE.currentPage = 1; 
            renderTable(); 
        };
    }
    
    const prevBtn = document.getElementById('prevPageBtn');
    if (prevBtn) prevBtn.onclick = () => { if (STATE.currentPage > 1) { STATE.currentPage--; renderTable(); } };
    
    const nextBtn = document.getElementById('nextPageBtn');
    if (nextBtn) nextBtn.onclick = () => { if (STATE.currentPage < Math.ceil(STATE.allData.length / STATE.pageSize)) { STATE.currentPage++; renderTable(); } };
    
    window.handleSearch();
});

window.handleClearAllFilters = () => { document.getElementById('searchForm').reset(); window.handleSearch(); };
window.handleLogout = () => { localStorage.removeItem('token'); window.location.href = '/login'; };