/**
 * admin_pago_emp.js - GESTIÓN DE COBROS A EMPRESAS
 * Características: Búsqueda por ID/Texto, Ordenación Multicolumna, Sumatorio y Guardado Individual.
 */

const STATE = {
    allData: [],
    currentPage: 1,
    pageSize: 25,
    sortKey: 'fecha',
    sortDir: 'desc'
};

const UI = {
    // Formatea fecha ISO a YYYY-MM-DD para inputs, evita errores "yyyy-MM-dd"
    formatDate(iso) { 
        if (!iso || iso.startsWith('0001') || iso === '-') return '';
        return iso.substring(0, 10); 
    },

    // Mensajes de estado visuales
    alertMessage(message, type = 'info') {
        const s = document.getElementById('statusMessage');
        if (!s) return;
        s.textContent = message;
        s.className = `status-message block p-4 rounded-xl font-bold text-center border-2 mb-4 ${
            type === 'success' ? 'bg-green-100 text-green-700 border-green-300' : 
            type === 'error' ? 'bg-red-100 text-red-700 border-red-300' : 'bg-blue-100 text-blue-700 border-blue-300'
        }`;
        s.classList.remove('hidden');
        setTimeout(() => s.classList.add('hidden'), 5000);
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 Iniciando Panel de Cobros Administrativo...");
    
    // 1. Cargar Combos Maestros
    await Promise.all([loadLicenciasCombo(), loadEmpresasCombo()]);
    
    // 2. Configurar select de registros por página
    const recs = document.getElementById('recordsPerPage');
    if (recs) {
        recs.innerHTML = `<option value="10">10</option><option value="25" selected>25</option><option value="50">50</option><option value="9999">Todos</option>`;
        recs.onchange = (e) => {
            STATE.pageSize = e.target.value === '9999' ? 99999 : parseInt(e.target.value);
            STATE.currentPage = 1;
            renderTable();
        };
    }

    // 3. Configurar navegación
    document.getElementById('prevPageBtn').onclick = () => { if (STATE.currentPage > 1) { STATE.currentPage--; renderTable(); } };
    document.getElementById('nextPageBtn').onclick = () => { 
        if (STATE.currentPage < Math.ceil(STATE.allData.length / STATE.pageSize)) { STATE.currentPage++; renderTable(); } 
    };

    // 4. Búsqueda inicial automática
    window.handleSearch();
});

// --- CARGA DE DATOS MAESTROS ---

async function loadLicenciasCombo() {
    const select = document.getElementById('licenciaSelect');
    if (!select) return;
    try {
        const res = await fetch('/api/v1/licencias', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
        const json = await res.json();
        const list = json.data || json;
        select.innerHTML = '<option value="">-- Licencia --</option>' + 
            list.map(l => `<option value="${l.id}">${l.licencia}</option>`).join('');
    } catch (e) { console.error("❌ Error cargando licencias", e); }
}

async function loadEmpresasCombo() {
    const select = document.getElementById('empresa');
    if (!select) return;
    try {
        const res = await fetch('/api/v1/empresas', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
        const json = await res.json();
        const list = json.data || json;
        select.innerHTML = '<option value="">-- Empresa --</option>' + 
            list.map(e => `<option value="${e.id}">${e.nombre}</option>`).join('');
    } catch (e) { console.error("❌ Error cargando empresas", e); }
}

// --- LÓGICA DE BÚSQUEDA ---

window.handleSearch = async function(event) {
    if (event) event.preventDefault();
    
    const tbody = document.getElementById('albaranResults');
    tbody.innerHTML = `<tr><td colspan="12" class="text-center py-20 italic text-slate-400 font-bold uppercase tracking-widest">Filtrando registros...</td></tr>`;

    const form = document.getElementById('searchForm');
    const formData = new FormData(form);
    const params = new URLSearchParams();

    console.log("🔍 --- INICIANDO DEPURE DE BÚSQUEDA ---");

    if (formData.get('licencia')) params.append('licencia_ref', formData.get('licencia'));
    if (formData.get('empresa')) params.append('empresa_ref', formData.get('empresa'));
    if (formData.get('referencia')) params.append('referencia', formData.get('referencia'));
    if (formData.get('fecha_desde')) params.append('fecha_desde', formData.get('fecha_desde'));
    if (formData.get('fecha_hasta')) params.append('fecha_hasta', formData.get('fecha_hasta'));
    
    const cobVal = formData.get('cobrado');
    if (cobVal === 'si') params.append('cobrado', 'true');
    else if (cobVal === 'no') params.append('cobrado', 'false');

    const palabra = document.getElementById('palabra').value.trim();
    if (palabra) {
        params.append('palabra', palabra);
        console.log("🔤 Buscando por texto:", palabra);
    }

    params.append('enviado', 'true');
    params.append('pageSize', '5000'); 

    const finalURL = `/api/v1/albaranes/search?${params.toString()}`;
    console.log("📡 URL GENERADA PARA BACKEND:", finalURL);

    try {
        const res = await fetch(finalURL, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const json = await res.json();
        STATE.allData = json.data || [];
        STATE.currentPage = 1;
        
        console.log("📦 Respuesta del servidor (registros):", STATE.allData.length);
        
        applySort(STATE.sortKey, 'string'); 
        renderTable();
        UI.alertMessage(`${STATE.allData.length} registros cargados`, 'success');
    } catch (err) {
        console.error("❌ Error en fetch:", err);
        tbody.innerHTML = `<tr><td colspan="12" class="text-center py-20 text-red-500 font-bold">Error de conexión</td></tr>`;
    }
};

window.handleClearAllFilters = function() {
    document.getElementById('searchForm').reset();
    document.getElementById('palabra').value = '';
    window.handleSearch();
};

// --- ORDENACIÓN (ASC / DESC) ---

window.handleSort = function(key, type = 'string') {
    if (STATE.sortKey === key) {
        STATE.sortDir = STATE.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
        STATE.sortKey = key;
        STATE.sortDir = 'asc';
    }
    console.log(`⚖️ Ordenando por ${key} en modo ${STATE.sortDir}`);
    applySort(key, type);
    renderTable();
};

function applySort(key, type) {
    STATE.allData.sort((a, b) => {
        let valA = a[key] || '', valB = b[key] || '';
        if (type === 'number') { valA = parseFloat(valA) || 0; valB = parseFloat(valB) || 0; }
        else if (type === 'date') { valA = new Date(valA).getTime() || 0; valB = new Date(valB).getTime() || 0; }
        else { valA = String(valA).toLowerCase(); valB = String(valB).toLowerCase(); }

        if (STATE.sortDir === 'asc') return valA > valB ? 1 : -1;
        return valA < valB ? 1 : -1;
    });
}

// --- RENDERIZADO Y SUMATORIO ---

function renderTable() {
    const tbody = document.getElementById('albaranResults');
    tbody.innerHTML = '';
    const start = (STATE.currentPage - 1) * STATE.pageSize;
    const pageData = STATE.allData.slice(start, start + STATE.pageSize);

    if (pageData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="12" class="text-center py-20 font-bold text-slate-400">Sin resultados</td></tr>`;
        updateUI();
        updateTotalSum(0);
        return;
    }

    let sumaTotalPagina = 0;

    pageData.forEach(alb => {
        const importe = parseFloat(alb.importe_total || 0);
        sumaTotalPagina += importe;
        const isCob = alb.cobrado === true || alb.cobrado === 1;
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-orange-50/50 border-b border-gray-100 text-[11px] transition-colors';
        tr.dataset.id = alb.id;

        tr.innerHTML = `
            <td class="px-4 py-3 text-center">
                <input type="checkbox" class="cobro-checkbox h-4 w-4 text-green-600 rounded cursor-pointer" 
                       ${isCob ? 'checked' : ''} onchange="handleCobroUIUpdate(${alb.id})">
            </td>
            <td class="px-4 py-3 font-bold text-gray-400">#${alb.id}</td>
            <td class="px-4 py-3 font-black">${alb.numero_albaran}</td>
            <td class="px-4 py-3 font-bold text-blue-600">${alb.LicenciaData?.licencia || alb.licencia_ref}</td>
            <td class="px-4 py-3">${UI.formatDate(alb.fecha)}</td>
            <td class="px-4 py-3 font-medium text-gray-600">${alb.EmpresaData?.nombre || alb.empresa_nombre || '-'}</td>
            <td class="px-4 py-3 italic text-gray-400">${alb.referencia || '-'}</td>
            <td class="px-4 py-3 text-right font-black text-green-600">€${importe.toFixed(2)}</td>
            <td class="px-4 py-3 text-center status-cell">
                ${isCob ? '<span class="bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-black text-[9px] uppercase">SÍ</span>' 
                        : '<span class="bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-black text-[9px] uppercase">NO</span>'}
            </td>
            <td class="px-4 py-3">
                <input type="date" class="fecha-cobro-input input-field text-[10px] py-1 ${isCob ? '' : 'hidden'}" 
                       value="${UI.formatDate(alb.fecha_cobro)}" onchange="updateSingleDate(${alb.id}, 'fecha_cobro', this.value)">
            </td>
            <td class="px-4 py-3">
                <input type="date" class="fecha-pago-input input-field text-[10px] py-1 ${isCob ? '' : 'hidden'}" 
                       value="${UI.formatDate(alb.fecha_pago)}" onchange="updateSingleDate(${alb.id}, 'fecha_pago', this.value)">
            </td>
            <td class="px-4 py-3 text-gray-400 truncate max-w-[150px]" title="${alb.observaciones_admin || ''}">${alb.observaciones_admin || '-'}</td>
        `;
        tbody.appendChild(tr);
    });

    updateUI();
    updateHeaderIcons();
    updateTotalSum(sumaTotalPagina);
}

function updateTotalSum(total) {
    const el = document.getElementById('totalLabel');
    if (el) {
        el.innerHTML = `SUMATORIO PÁGINA ACTUAL: <span class="text-primary-link text-lg ml-2 font-black tracking-tighter">€${total.toLocaleString('es-ES', {minimumFractionDigits: 2})}</span>`;
    }
}

function updateHeaderIcons() {
    document.querySelectorAll('th[onclick]').forEach(th => {
        const text = th.innerText.replace(/[▲▼↕]/g, '').trim();
        let icon = ' ↕';
        if (th.getAttribute('onclick').includes(`'${STATE.sortKey}'`)) {
            icon = STATE.sortDir === 'asc' ? ' ▲' : ' ▼';
        }
        th.innerText = text + icon;
    });
}

function updateUI() {
    const total = STATE.allData.length;
    document.getElementById('resultsCount').textContent = total;
    document.getElementById('pageInfo').textContent = `Página ${STATE.currentPage} de ${Math.ceil(total / STATE.pageSize) || 1}`;
    document.getElementById('prevPageBtn').disabled = STATE.currentPage === 1;
    const maxPage = Math.ceil(total / STATE.pageSize);
    document.getElementById('nextPageBtn').disabled = STATE.currentPage >= (maxPage || 1);
    if (window.lucide) lucide.createIcons();
}

// --- ACCIONES DE GUARDADO INDIVIDUAL ---

async function updateSingleDate(id, field, value) {
    try {
        const payload = {};
        payload[field] = value;
        
        const res = await fetch(`/api/v1/albaranes/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: JSON.stringify(payload)
        });
        
        if (res.ok) UI.alertMessage(`Fecha actualizada en albarán #${id}`, 'success');
    } catch (e) { console.error("Error actualizando fecha", e); }
}

window.handleCobroUIUpdate = async (id) => {
    const row = document.querySelector(`tr[data-id="${id}"]`);
    const cb = row.querySelector('.cobro-checkbox');
    const fCobro = row.querySelector('.fecha-cobro-input');
    const fPago = row.querySelector('.fecha-pago-input');
    const status = row.querySelector('.status-cell');
    
    const isChecked = cb.checked;
    const hoy = new Date().toISOString().split('T')[0];

    if (isChecked) {
        fCobro.classList.remove('hidden'); fPago.classList.remove('hidden');
        fCobro.value = hoy; fPago.value = hoy;
        status.innerHTML = '<span class="bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-black text-[9px] uppercase">SÍ</span>';
    } else {
        fCobro.classList.add('hidden'); fPago.classList.add('hidden');
        status.innerHTML = '<span class="bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-black text-[9px] uppercase">NO</span>';
    }

    // Guardar estado de cobro/pago inmediatamente
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
    } catch (e) { console.error(e); }
};

window.handleBulkPay = async () => {
    const checked = document.querySelectorAll('.cobro-checkbox:checked');
    const ids = Array.from(checked).map(cb => parseInt(cb.closest('tr').dataset.id));
    if (ids.length === 0) return alert("Selecciona al menos un registro");
    if (!confirm(`¿Confirmar cobro masivo de ${ids.length} albaranes?`)) return;

    try {
        const res = await fetch('/api/v1/albaranes/bulk-charge', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: JSON.stringify({ ids: ids })
        });
        if (res.ok) window.handleSearch();
    } catch (e) { alert("Error en el proceso de cobro masivo"); }
};

window.handleLogout = () => { localStorage.removeItem('token'); window.location.href = '/login'; };
window.toggleDropdown = (btn) => {
    const dropdown = btn.closest('.dropdown');
    document.querySelectorAll('.dropdown').forEach(d => { if (d !== dropdown) d.classList.remove('active'); });
    dropdown.classList.toggle('active');
};