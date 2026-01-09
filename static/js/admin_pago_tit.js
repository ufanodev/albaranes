/**
 * admin_pago_tit.js - Gestión de Pagos a Titulares
 */

// Estado global de la aplicación
const STATE = {
    allData: [],
    currentPage: 1,
    pageSize: 25
};

document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 Inicializando Panel de Pagos...");

    // 1. Cargar selectores de los filtros
    await Promise.all([
        loadLicenciasCombo(),
        loadEmpresasCombo()
    ]);

    // 2. Configurar el selector de registros por página
    const recordsSelect = document.getElementById('recordsPerPage');
    if (recordsSelect) {
        recordsSelect.innerHTML = `
            <option value="10">10 registros</option>
            <option value="25" selected>25 registros</option>
            <option value="50">50 registros</option>
            <option value="100">100 registros</option>
        `;
        recordsSelect.onchange = (e) => {
            STATE.pageSize = parseInt(e.target.value);
            STATE.currentPage = 1;
            renderTable();
        };
    }

    // 3. Botones de paginación
    document.getElementById('prevPageBtn').onclick = () => {
        if (STATE.currentPage > 1) {
            STATE.currentPage--;
            renderTable();
        }
    };
    document.getElementById('nextPageBtn').onclick = () => {
        const maxPage = Math.ceil(STATE.allData.length / STATE.pageSize);
        if (STATE.currentPage < maxPage) {
            STATE.currentPage++;
            renderTable();
        }
    };

    // 4. Búsqueda inicial
    window.handleSearch();
});

/** CARGA DE COMBOS */

async function loadLicenciasCombo() {
    const select = document.getElementById('licencia');
    if (!select) return;
    try {
        const res = await fetch('/api/v1/licencias', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await res.json();
        const list = data.data || data;
        select.innerHTML = '<option value="">-- Todas las Licencias --</option>';
        list.forEach(l => {
            const opt = document.createElement('option');
            opt.value = l.id;
            opt.textContent = l.licencia;
            select.appendChild(opt);
        });
    } catch (e) { console.error("Error cargando licencias", e); }
}

async function loadEmpresasCombo() {
    const select = document.getElementById('empresa');
    if (!select) return;
    try {
        const res = await fetch('/api/v1/empresas', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await res.json();
        const list = data.data || data;
        select.innerHTML = '<option value="">-- Todas las Empresas --</option>';
        list.forEach(e => {
            const opt = document.createElement('option');
            opt.value = e.id;
            opt.textContent = e.nombre;
            select.appendChild(opt);
        });
    } catch (e) { console.error("Error cargando empresas", e); }
}

/** LÓGICA DE BÚSQUEDA */

window.handleSearch = async function(event) {
    if (event) event.preventDefault();

    const tbody = document.getElementById('albaranResults');
    tbody.innerHTML = '<tr><td colspan="11" class="text-center py-10 italic">Buscando datos...</td></tr>';

    const form = document.getElementById('searchForm');
    const formData = new FormData(form);
    const params = new URLSearchParams();

    // Filtros de campos
    if (formData.get('licencia')) params.append('licencia_ref', formData.get('licencia'));
    if (formData.get('empresa')) params.append('empresa_ref', formData.get('empresa'));
    if (formData.get('referencia')) params.append('referencia', formData.get('referencia'));
    if (formData.get('fecha_desde')) params.append('fecha_desde', formData.get('fecha_desde'));
    if (formData.get('fecha_hasta')) params.append('fecha_hasta', formData.get('fecha_hasta'));
    
    // Estado de pago
    const pagado = formData.get('pagado');
    if (pagado === 'si') params.append('pagado', 'true');
    else if (pagado === 'no') params.append('pagado', 'false');

    // Búsqueda global por palabra
    const palabra = document.getElementById('palabra').value.trim();
    if (palabra) params.append('palabra', palabra);

    // Obligatorio: solo albaranes enviados
    params.append('enviado', 'true');

    try {
        const response = await fetch(`/api/v1/albaranes/search?${params.toString()}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const json = await response.json();
        STATE.allData = json.data || [];
        STATE.currentPage = 1;
        renderTable();
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="11" class="text-center py-10 text-red-500">Error al conectar con el servidor.</td></tr>';
    }
};

window.handleClearAllFilters = function() {
    document.getElementById('searchForm').reset();
    document.getElementById('palabra').value = '';
    window.handleSearch();
};

/** RENDERIZADO */

function renderTable() {
    const tbody = document.getElementById('albaranResults');
    tbody.innerHTML = '';

    const start = (STATE.currentPage - 1) * STATE.pageSize;
    const end = start + STATE.pageSize;
    const pageData = STATE.allData.slice(start, end);

    if (pageData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" class="text-center py-10 font-bold text-gray-400">No se encontraron albaranes con estos filtros.</td></tr>';
        updatePaginationUI();
        return;
    }

    pageData.forEach(item => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 transition-colors border-b";
        tr.dataset.id = item.id;

        const isPaid = item.pagado === true || item.pagado === 1;

        tr.innerHTML = `
            <td class="px-4 py-3 text-center">
                <input type="checkbox" class="pago-checkbox w-5 h-5 accent-green-600" 
                    ${isPaid ? 'checked' : ''} onchange="togglePagoLocal(${item.id})">
            </td>
            <td class="px-4 py-3 text-gray-400 font-mono">#${item.id}</td>
            <td class="px-4 py-3 font-black">${item.numero_albaran}</td>
            <td class="px-4 py-3 font-bold text-blue-600">${item.LicenciaData?.licencia || item.licencia_ref}</td>
            <td class="px-4 py-3">${item.fecha ? item.fecha.split('T')[0] : '-'}</td>
            <td class="px-4 py-3 font-medium">${item.EmpresaData?.nombre || item.empresa_nombre || '-'}</td>
            <td class="px-4 py-3 text-gray-500 italic">${item.referencia || '-'}</td>
            <td class="px-4 py-3 text-right font-black text-orange-600">€${parseFloat(item.importe_total || 0).toFixed(2)}</td>
            <td class="px-4 py-3 text-center status-cell">
                ${isPaid ? '<span class="px-2 py-1 bg-green-100 text-green-700 rounded-full text-[9px] font-black">PAGADO</span>' 
                         : '<span class="px-2 py-1 bg-red-100 text-red-700 rounded-full text-[9px] font-black">PENDIENTE</span>'}
            </td>
            <td class="px-4 py-3">
                <input type="date" class="date-pago-input input-field text-[10px] py-1 ${isPaid ? '' : 'hidden'}" 
                    value="${item.fecha_pago ? item.fecha_pago.split('T')[0] : ''}">
            </td>
            <td class="px-4 py-3 text-gray-400 text-[10px] truncate max-w-[120px]" title="${item.observaciones_admin || ''}">
                ${item.observaciones_admin || '-'}
            </td>
        `;
        tbody.appendChild(tr);
    });

    updatePaginationUI();
}

function updatePaginationUI() {
    const total = STATE.allData.length;
    const totalPages = Math.ceil(total / STATE.pageSize) || 1;
    
    document.getElementById('resultsCount').textContent = total;
    document.getElementById('pageInfo').textContent = `Página ${STATE.currentPage} de ${totalPages}`;
    document.getElementById('totalLabel').textContent = `Total registros: ${total} | Mostrando página ${STATE.currentPage}`;
    
    document.getElementById('prevPageBtn').disabled = (STATE.currentPage === 1);
    document.getElementById('nextPageBtn').disabled = (STATE.currentPage === totalPages);

    if (window.lucide) lucide.createIcons();
}

/** ACCIONES DE PAGO */

window.togglePagoLocal = function(id) {
    const row = document.querySelector(`tr[data-id="${id}"]`);
    const cb = row.querySelector('.pago-checkbox');
    const status = row.querySelector('.status-cell');
    const dateInput = row.querySelector('.date-pago-input');

    if (cb.checked) {
        status.innerHTML = '<span class="px-2 py-1 bg-green-100 text-green-700 rounded-full text-[9px] font-black">PAGADO</span>';
        dateInput.classList.remove('hidden');
        dateInput.value = new Date().toISOString().split('T')[0];
    } else {
        status.innerHTML = '<span class="px-2 py-1 bg-red-100 text-red-700 rounded-full text-[9px] font-black">PENDIENTE</span>';
        dateInput.classList.add('hidden');
        dateInput.value = '';
    }
};

window.handleBulkPay = async function() {
    const checkboxes = document.querySelectorAll('.pago-checkbox:checked');
    const ids = Array.from(checkboxes).map(cb => parseInt(cb.closest('tr').dataset.id));

    if (ids.length === 0) {
        alert("Por favor, selecciona al menos un albarán para pagar.");
        return;
    }

    if (!confirm(`¿Confirmar el pago de ${ids.length} albaranes seleccionados?`)) return;

    try {
        const response = await fetch('/api/v1/albaranes/bulk-pay', {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ ids: ids })
        });

        if (response.ok) {
            alert("Pagos registrados correctamente.");
            window.handleSearch();
        } else {
            alert("Error al procesar los pagos masivos.");
        }
    } catch (e) {
        console.error(e);
        alert("Error de conexión.");
    }
};

window.handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
};