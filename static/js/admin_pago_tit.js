/**
 * admin_pago_tit.js - Gestión de Pagos a Titulares
 * Carga de combos dinámicos, filtros avanzados y pagos masivos.
 */

// Estado global de la vista
const STATE = {
    filteredData: [],
    currentPage: 1,
    pageSize: 25
};

document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 Cargando Panel de Pagos Administrativo...");
    
    // 1. Cargar Combos Maestros (IDs coinciden con el HTML)
    await Promise.all([
        loadLicenciasCombo(),
        loadEmpresasCombo()
    ]);
    
    // 2. Configurar select de registros por página
    const recs = document.getElementById('recordsPerPage');
    if (recs) {
        recs.innerHTML = `
            <option value="10">10 registros</option>
            <option value="25" selected>25 registros</option>
            <option value="50">50 registros</option>
            <option value="9999">Ver todos</option>
        `;
        recs.onchange = (e) => {
            STATE.pageSize = e.target.value === '9999' ? 99999 : parseInt(e.target.value);
            STATE.currentPage = 1;
            renderTable();
        };
    }

    // 3. Configurar navegación
    document.getElementById('prevPageBtn').onclick = () => { if (STATE.currentPage > 1) { STATE.currentPage--; renderTable(); } };
    document.getElementById('nextPageBtn').onclick = () => { 
        if (STATE.currentPage < Math.ceil(STATE.filteredData.length / STATE.pageSize)) { STATE.currentPage++; renderTable(); } 
    };

    // 4. Búsqueda inicial automática
    window.handleSearch();
});

/** 🆔 Carga Licencias en id="licencia" */
async function loadLicenciasCombo() {
    const select = document.getElementById('licencia');
    if (!select) return;
    try {
        const res = await fetch('/api/v1/licencias', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const json = await res.json();
        const list = json.data || json;
        select.innerHTML = '<option value="">-- Todas las Licencias --</option>';
        list.forEach(l => {
            select.innerHTML += `<option value="${l.id}">${l.licencia}</option>`;
        });
    } catch (e) { console.error("Error licencias:", e); }
}

/** 📋 Carga Empresas en id="empresa" */
async function loadEmpresasCombo() {
    const select = document.getElementById('empresa');
    if (!select) return;
    try {
        const res = await fetch('/api/v1/empresas', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const json = await res.json();
        const list = json.data || json;
        select.innerHTML = '<option value="">-- Todas las Empresas --</option>';
        list.forEach(e => {
            select.innerHTML += `<option value="${e.id}">${e.nombre}</option>`;
        });
    } catch (e) { console.error("Error empresas:", e); }
}

/** 🔍 BÚSQUEDA PRINCIPAL (Campos + Palabra) */
window.handleSearch = async function(event) {
    if (event) event.preventDefault();
    
    const resultsBody = document.getElementById('albaranResults');
    resultsBody.innerHTML = `<tr><td colspan="11" class="text-center py-20 italic">Buscando datos...</td></tr>`;

    const form = document.getElementById('searchForm');
    const formData = new FormData(form);
    const params = new URLSearchParams();

    // Mapeo para el Backend Go
    if (formData.get('licencia')) params.append('licencia_ref', formData.get('licencia'));
    if (formData.get('empresa')) params.append('empresa_ref', formData.get('empresa'));
    if (formData.get('referencia')) params.append('referencia', formData.get('referencia'));
    if (formData.get('fecha_desde')) params.append('fecha_desde', formData.get('fecha_desde'));
    if (formData.get('fecha_hasta')) params.append('fecha_hasta', formData.get('fecha_hasta'));
    
    const pagado = formData.get('pagado');
    if (pagado === 'si') params.append('pagado', 'true');
    else if (pagado === 'no') params.append('pagado', 'false');

    // Palabra Global
    const palabra = document.getElementById('palabra').value.trim();
    if (palabra) params.append('palabra', palabra);

    // Reglas fijas para este panel
    params.append('enviado', 'true'); 
    params.append('pageSize', '5000'); 

    try {
        const res = await fetch(`/api/v1/albaranes/search?${params.toString()}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const json = await res.json();
        STATE.filteredData = json.data || [];
        STATE.currentPage = 1;
        renderTable();
    } catch (err) {
        resultsBody.innerHTML = `<tr><td colspan="11" class="text-center py-20 text-red-500 font-bold">Error de conexión con el servidor</td></tr>`;
    }
};

/** 🧹 LIMPIAR TODO */
window.handleClearAllFilters = function() {
    document.getElementById('searchForm').reset();
    document.getElementById('palabra').value = '';
    STATE.currentPage = 1;
    window.handleSearch();
};

/** 🖼️ RENDERIZADO DE TABLA (11 Columnas) */
function renderTable() {
    const resultsBody = document.getElementById('albaranResults');
    resultsBody.innerHTML = '';
    
    const start = (STATE.currentPage - 1) * STATE.pageSize;
    const end = start + STATE.pageSize;
    const pageData = STATE.filteredData.slice(start, end);

    if (pageData.length === 0) {
        resultsBody.innerHTML = `<tr><td colspan="11" class="text-center py-20 font-bold text-slate-400">Sin resultados</td></tr>`;
        updateUI();
        return;
    }

    pageData.forEach(alb => {
        const isPaid = alb.pagado === true || alb.pagado === 1;
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-orange-50/50 border-b border-gray-100 text-xs transition-colors';
        tr.dataset.id = alb.id;

        tr.innerHTML = `
            <td class="px-4 py-3 text-center">
                <input type="checkbox" class="pago-checkbox h-5 w-5 text-green-600 rounded cursor-pointer" 
                       ${isPaid ? 'checked' : ''} onchange="handlePagoUIUpdate(${alb.id})">
            </td>
            <td class="px-4 py-3 font-bold text-gray-400">#${alb.id}</td>
            <td class="px-4 py-3 font-black text-slate-700">${alb.numero_albaran}</td>
            <td class="px-4 py-3 font-bold text-blue-600">${alb.LicenciaData?.licencia || alb.licencia_ref}</td>
            <td class="px-4 py-3">${alb.fecha ? alb.fecha.substring(0, 10) : '-'}</td>
            <td class="px-4 py-3 text-gray-600">${alb.EmpresaData?.nombre || alb.empresa_nombre}</td>
            <td class="px-4 py-3 italic text-gray-400">${alb.referencia || '-'}</td>
            <td class="px-4 py-3 text-right font-black text-primary-link">€${parseFloat(alb.importe_total || 0).toFixed(2)}</td>
            <td class="px-4 py-3 text-center pagado-status">
                ${isPaid ? '<span class="bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-black uppercase text-[9px]">SÍ</span>' 
                        : '<span class="bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-black uppercase text-[9px]">NO</span>'}
            </td>
            <td class="px-4 py-3">
                <input type="date" class="fecha-pago-input input-field text-[10px] py-1 ${isPaid ? '' : 'hidden'}" 
                       value="${alb.fecha_pago ? alb.fecha_pago.substring(0, 10) : ''}">
            </td>
            <td class="px-4 py-3 text-gray-400 truncate max-w-[150px]">${alb.observaciones_admin || '-'}</td>
        `;
        resultsBody.appendChild(tr);
    });

    updateUI();
}

function updateUI() {
    const total = STATE.filteredData.length;
    const totalPages = Math.ceil(total / STATE.pageSize) || 1;
    document.getElementById('resultsCount').textContent = total;
    document.getElementById('pageInfo').textContent = `Página ${STATE.currentPage} de ${totalPages}`;
    document.getElementById('totalLabel').textContent = `REGISTROS ENCONTRADOS: ${total}`;
    document.getElementById('prevPageBtn').disabled = STATE.currentPage === 1;
    document.getElementById('nextPageBtn').disabled = STATE.currentPage >= totalPages;
    if (window.lucide) lucide.createIcons();
}

/** Actualización visual inmediata de los checkboxes */
window.handlePagoUIUpdate = (id) => {
    const row = document.querySelector(`tr[data-id="${id}"]`);
    const cb = row.querySelector('.pago-checkbox');
    const fInput = row.querySelector('.fecha-pago-input');
    const status = row.querySelector('.pagado-status');
    if (cb.checked) {
        fInput.classList.remove('hidden');
        fInput.value = new Date().toISOString().split('T')[0];
        status.innerHTML = '<span class="bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-black uppercase text-[9px]">SÍ</span>';
    } else {
        fInput.classList.add('hidden');
        status.innerHTML = '<span class="bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-black uppercase text-[9px]">NO</span>';
    }
};

/** Lógica de Pago Masivo */
window.handleBulkPay = async () => {
    const checked = document.querySelectorAll('.pago-checkbox:checked');
    const ids = Array.from(checked).map(cb => parseInt(cb.closest('tr').dataset.id));
    if (ids.length === 0) return alert("Selecciona al menos un albarán");
    if (!confirm(`¿Confirmar pago masivo para ${ids.length} albaranes?`)) return;

    try {
        const res = await fetch('/api/v1/albaranes/bulk-pay', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: JSON.stringify({ ids: ids })
        });
        if (res.ok) window.handleSearch();
    } catch (e) { alert("Error en el servidor al procesar el pago masivo."); }
};

window.handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
};