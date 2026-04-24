/**
 * ARCHIVO: static/js/admin_busqueda.js
 * DESCRIPCIÓN: Motor de búsqueda real (API) con Historial de 10 últimas y Caché de Sesión.
 * ACTUALIZADO: 24/04/2026 - Conexión directa a base de datos (Sin Mocks).
 */

const SEARCH_CACHE_KEY = 'admin_search_cache';
const HISTORY_KEY = 'admin_search_history';

// Estado global local para ordenación y paginación rápida
let currentData = [];
let sortState = { column: 'fecha', direction: 'desc' };

// =================================================================================
// 💾 GESTIÓN DE HISTORIAL Y CACHÉ
// =================================================================================

function guardarEnHistorial(params) {
    // 1. Guardar en Caché de Sesión (Rápida para navegación atrás/adelante)
    sessionStorage.setItem(SEARCH_CACHE_KEY, JSON.stringify(params));

    // 2. Guardar en Historial Persistente (LocalStorage - Últimas 10)
    // No guardamos si la búsqueda está totalmente vacía de criterios
    const values = Object.values(params).filter(v => v !== "" && v !== null && v !== "campos" && v !== "palabra");
    if (values.length === 0) return;

    let history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    
    // Etiqueta descriptiva para el combo
    let label = params.mode === 'palabra' ? `Palabra: ${params.palabra}` : `Filtro: ${params.numero_albaran || params.referencia || 'Criterios varios'}`;
    const newEntry = { label, params, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };

    // Evitar duplicados idénticos seguidos
    if (history.length > 0 && JSON.stringify(history[0].params) === JSON.stringify(params)) return;

    history.unshift(newEntry);
    history = history.slice(0, 10); // Limitar a 10 registros

    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    renderHistoryCombo();
}

function renderHistoryCombo() {
    const combo = document.getElementById('searchHistory');
    if (!combo) return;
    const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    combo.innerHTML = '<option value="">Búsquedas Recientes</option>';
    history.forEach((item, index) => {
        const opt = document.createElement('option');
        opt.value = index;
        opt.textContent = `${item.timestamp} - ${item.label}`;
        combo.appendChild(opt);
    });
}

window.handleLoadHistory = (index) => {
    if (index === "") return;
    const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    const selected = history[index];
    if (selected) {
        aplicarParametrosAlDOM(selected.params);
        handleSearch(null);
    }
};

function aplicarParametrosAlDOM(cache) {
    const form = document.getElementById('searchForm');
    if (cache.mode && window.UI) window.UI.setSearchModeManual(cache.mode);
    
    Object.keys(cache).forEach(key => {
        const input = form.querySelector(`[name="${key}"]`);
        if (input) input.value = cache[key];
    });
    if (document.getElementById('palabra') && cache.palabra) {
        document.getElementById('palabra').value = cache.palabra;
    }
}

function recuperarCacheSesion() {
    const data = sessionStorage.getItem(SEARCH_CACHE_KEY);
    if (!data) return false;
    aplicarParametrosAlDOM(JSON.parse(data));
    return true;
}

// =================================================================================
// 🔍 MOTOR DE BÚSQUEDA REAL (API)
// =================================================================================

async function handleSearch(event) {
    if (event) event.preventDefault();
    
    const form = document.getElementById('searchForm');
    const formData = new FormData(form);
    const params = Object.fromEntries(formData.entries());
    const isPalabraMode = !document.getElementById('palabraSection').classList.contains('hidden');
    
    params.mode = isPalabraMode ? 'palabra' : 'campos';
    params.palabra = document.getElementById('palabra')?.value || "";

    // Guardar para el historial y caché
    guardarEnHistorial(params);

    const resultsBody = document.getElementById('albaranResults');
    resultsBody.innerHTML = '<tr><td colspan="12" class="text-center py-10 italic">Consultando base de datos...</td></tr>';

    try {
        const query = new URLSearchParams(params).toString();
        const response = await fetch(`/api/v1/albaranes/search?${query}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });

        if (!response.ok) throw new Error("Error en la consulta");

        const result = await response.json();
        currentData = result.data || result || [];
        
        renderAlbaranes(currentData);
        
    } catch (err) {
        console.error("❌ Error API:", err);
        alertMessage("Error al conectar con la base de datos", "error");
        resultsBody.innerHTML = '<tr><td colspan="12" class="text-center py-10 text-red-500 font-bold uppercase">Error de conexión con el servidor</td></tr>';
    }
}

// =================================================================================
// 📊 RENDERIZADO DE TABLA
// =================================================================================

function renderAlbaranes(data) {
    const resultsBody = document.getElementById('albaranResults');
    const totalEl = document.getElementById('totalImporte');
    const tableFooter = document.getElementById('tableFooter');
    if (!resultsBody) return;
    
    resultsBody.innerHTML = '';
    let sum = 0;

    if (!data || data.length === 0) {
        resultsBody.innerHTML = `<tr><td colspan="12" class="p-20 text-center text-orange-500 font-bold uppercase italic">Sin registros coincidentes</td></tr>`;
        if (tableFooter) tableFooter.classList.add('hidden');
    } else {
        data.forEach(a => {
            const imp = parseFloat(a.importe_total || 0);
            sum += imp;
            const row = `
                <tr class="hover:bg-orange-50/50 transition-colors group">
                    <td class="px-3 py-3 font-bold">${a.numero_albaran || 'N/A'}</td>
                    <td class="px-3 py-3 font-bold text-slate-500">${a.fecha ? a.fecha.substring(0,10) : '-'}</td>
                    <td class="px-3 py-3 font-black text-primary-link uppercase tracking-tighter">${a.licencia || '-'}</td>
                    <td class="px-3 py-3 font-bold uppercase truncate max-w-[150px]">${a.empresa_nombre || '-'}</td>
                    <td class="px-3 py-3 text-slate-400 font-black italic uppercase text-[9px]">${a.referencia || '-'}</td>
                    <td class="px-3 py-3">${a.num_factura || '-'}</td>
                    <td class="px-3 py-3 text-right font-black text-primary-link bg-orange-50/30">€${imp.toFixed(2)}</td>
                    <td class="text-center">${a.enviado ? '✅' : '⚪'}</td>
                    <td class="text-center">${a.cobrado ? '✅' : '⚪'}</td>
                    <td class="text-center">${a.pagado ? '✅' : '⚪'}</td>
                    <td class="px-3 py-3 truncate max-w-[100px] text-[10px] text-slate-400">${a.observaciones || ''}</td>
                    <td class="px-3 py-3 text-center">
                        <div class="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onclick="handleAction('Ver', '${a.id}')" class="p-1 text-blue-500 hover:bg-blue-100 rounded" title="Ver"><i data-lucide="eye" class="w-3.5 h-3.5"></i></button>
                            <button onclick="handleAction('Editar', '${a.id}')" class="p-1 text-orange-500 hover:bg-orange-100 rounded" title="Editar"><i data-lucide="pencil" class="w-3.5 h-3.5"></i></button>
                        </div>
                    </td>
                </tr>`;
            resultsBody.insertAdjacentHTML('beforeend', row);
        });
        if (totalEl) totalEl.textContent = `€${sum.toFixed(2)}`;
        if (tableFooter) tableFooter.classList.remove('hidden');
    }
    
    document.getElementById('resultsCount').textContent = data.length;
    if (window.lucide) lucide.createIcons();
    updateSortIcons();
}

// =================================================================================
// 🏗️ UTILIDADES Y EVENTOS
// =================================================================================

function handleSort(key) {
    sortState.direction = (sortState.column === key && sortState.direction === 'asc') ? 'desc' : 'asc';
    sortState.column = key;

    currentData.sort((a, b) => {
        let vA = a[key] || '', vB = b[key] || '';
        if (key === 'importe_total') { vA = parseFloat(vA); vB = parseFloat(vB); }
        let res = (vA < vB ? -1 : 1);
        return sortState.direction === 'asc' ? res : res * -1;
    });
    renderAlbaranes(currentData);
}

function updateSortIcons() {
    ['numero_albaran', 'fecha', 'licencia', 'empresa_nombre', 'referencia', 'num_factura', 'importe_total'].forEach(k => {
        const el = document.getElementById(`sort-icon-${k}`);
        if (el) {
            const isCur = k === sortState.column;
            el.innerHTML = isCur ? (sortState.direction === 'asc' ? '↑' : '↓') : '↕';
            el.className = `ml-1 transition-all ${isCur ? 'text-primary-link font-black opacity-100' : 'opacity-30 italic'}`;
        }
    });
}

function handleClearAllFilters() {
    sessionStorage.removeItem(SEARCH_CACHE_KEY);
    document.getElementById('searchForm').reset();
    if (document.getElementById('palabra')) document.getElementById('palabra').value = "";
    alertMessage("Filtros limpiados y caché borrada", "neutral");
    handleSearch();
}

function handleAction(action, id) {
    if (action === 'Editar') window.location.href = `/admin/albaranes/update/${id}`;
    if (action === 'Ver') window.location.href = `/admin/albaranes/view/${id}`;
}

function alertMessage(message, type) {
    const s = document.getElementById('statusMessage');
    if (!s) return;
    s.textContent = message;
    const bg = type === 'success' ? 'bg-green-100 border-green-500 text-green-700' : 'bg-red-100 border-red-500 text-red-700';
    s.className = `status-message ${bg} block p-4 rounded-xl fixed bottom-5 right-5 shadow-2xl border-2 font-bold z-[2000]`;
    s.classList.remove('hidden');
    setTimeout(() => s.classList.add('hidden'), 4000);
}

// =================================================================================
// 🚀 INICIALIZACIÓN
// =================================================================================

window.handleSearch = handleSearch;
window.handleSort = handleSort;
window.handleClearAllFilters = handleClearAllFilters;
window.handleAction = handleAction;

document.addEventListener('DOMContentLoaded', () => {
    // 1. Renderizar el historial guardado en LocalStorage
    renderHistoryCombo();
    
    // 2. Intentar recuperar la caché de sesión (memoria rápida)
    const teniaCache = recuperarCacheSesion();
    
    // 3. Ejecutar búsqueda inicial
    handleSearch();

    if (window.lucide) lucide.createIcons();
});