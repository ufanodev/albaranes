/**
 * ARCHIVO: static/js/admin.js
 */
const APP = {
    elements: {
        resultsBody: document.getElementById('albaranResults'),
        tableFooter: document.getElementById('tableFooter'),
        totalImporte: document.getElementById('totalImporte'),
        searchForm: document.getElementById('searchForm'),
        recordsSelect: document.getElementById('recordsPerPage'),
        statusMessage: document.getElementById('statusMessage'),
        pageInfo: document.getElementById('pageInfo'),
        totalLabel: document.getElementById('totalLabel'),
        resultsCount: document.getElementById('resultsCount'),
        palabraInput: document.getElementById('palabra'),
        prevBtn: document.getElementById('prevPageBtn'),
        nextBtn: document.getElementById('nextPageBtn'),
        historySelect: document.getElementById('searchHistory')
    },
    state: {
        rawAlbaranes: [],
        filteredAlbaranes: [],
        currentPage: 1,
        pageSize: 25,
        searchMode: 'campos',
        currentSort: { key: 'fecha', direction: 'desc' }
    },
    cacheKey: 'admin_search_cache',
    historyKey: 'admin_search_history_v1'
};

const UI_ADMIN = {
    alertMessage(message, type = 'info') {
        const s = APP.elements.statusMessage;
        if (!s) return;
        s.textContent = message;
        const bgClass = type === 'success' ? 'bg-green-100 border-green-500 text-green-700' : 'bg-red-100 border-red-500 text-red-700';
        s.className = `status-message ${bgClass} block p-4 rounded-xl shadow-2xl border-2 font-bold`;
        s.classList.remove('hidden');
        setTimeout(() => s.classList.add('hidden'), 5000);
    },
    updateSortIcons() {
        ['numero_albaran', 'fecha', 'licencia', 'empresa_nombre', 'referencia', 'num_factura', 'importe_total'].forEach(k => {
            const span = document.getElementById(`sort-icon-${k}`);
            if (!span) return;
            const isCurrent = k === APP.state.currentSort.key;
            span.innerHTML = isCurrent ? (APP.state.currentSort.direction === 'asc' ? '↑' : '↓') : '↕';
            span.className = `ml-1 transition-all ${isCurrent ? 'text-primary-link font-black opacity-100' : 'opacity-30 italic'}`;
        });
    }
};

// =================================================================================
// 💾 GESTIÓN DE HISTORIAL (LocalStorage) Y CACHÉ (SessionStorage)
// =================================================================================

function saveSearchState(params) {
    sessionStorage.setItem(APP.cacheKey, JSON.stringify(params));

    const hasFilters = Object.values(params).some(v => v !== "" && v !== null && v !== 'campos' && v !== 'palabra');
    if (!hasFilters) return;

    let history = JSON.parse(localStorage.getItem(APP.historyKey) || '[]');
    let label = params.mode === 'palabra' ? `Búsq: ${params.palabra}` : `Filtro: ${params.num_albaran || params.ref || 'Manual'}`;
    const newEntry = { label, params, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) };

    if (history.length > 0 && JSON.stringify(history[0].params) === JSON.stringify(params)) return;
    history.unshift(newEntry);
    history = history.slice(0, 10);
    localStorage.setItem(APP.historyKey, JSON.stringify(history));
    renderHistoryCombo();
}

function renderHistoryCombo() {
    const combo = APP.elements.historySelect;
    if (!combo) return;
    const history = JSON.parse(localStorage.getItem(APP.historyKey) || '[]');
    combo.innerHTML = '<option value="">BÚSQUEDAS RECIENTES</option>';
    history.forEach((item, index) => {
        const opt = document.createElement('option');
        opt.value = index;
        opt.textContent = `${item.time} - ${item.label}`;
        combo.appendChild(opt);
    });
}

window.handleLoadHistory = (index) => {
    if (index === "") return;
    const history = JSON.parse(localStorage.getItem(APP.historyKey) || '[]');
    const selected = history[index];
    if (selected && selected.params) {
        applyParamsToUI(selected.params);
        handleSearch();
    }
};

function applyParamsToUI(cache) {
    if (cache.mode) window.UI.setSearchModeManual(cache.mode);
    document.getElementById('licenciaSelect').value = cache.licencia || "";
    document.getElementById('empresaSelect').value = cache.empresa || "";
    document.getElementById('state').value = cache.estado || "";
    APP.elements.searchForm.querySelector('[name="referencia"]').value = cache.ref || "";
    APP.elements.searchForm.querySelector('[name="numero_albaran"]').value = cache.num_albaran || "";
    APP.elements.searchForm.querySelector('[name="fecha_desde"]').value = cache.desde || "";
    APP.elements.searchForm.querySelector('[name="fecha_hasta"]').value = cache.hasta || "";
    APP.elements.palabraInput.value = cache.palabra || "";

    // Filtros avanzados (llegan de /admin/busqueda_avanzada o de una búsqueda anterior con esos criterios)
    setFieldIfExists('matricula', cache.matricula);
    setFieldIfExists('num_factura', cache.num_factura);
    setFieldIfExists('pagado', cache.pagado);
    setFieldIfExists('cobrado', cache.cobrado);
    setFieldIfExists('fecha_pago_desde', cache.fecha_pago_desde);
    setFieldIfExists('fecha_pago_hasta', cache.fecha_pago_hasta);
    setFieldIfExists('fecha_cobro_desde', cache.fecha_cobro_desde);
    setFieldIfExists('fecha_cobro_hasta', cache.fecha_cobro_hasta);
}

function setFieldIfExists(name, value) {
    const el = APP.elements.searchForm.querySelector(`[name="${name}"]`);
    if (el) el.value = value || "";
}

function applySearchCache() {
    const data = sessionStorage.getItem(APP.cacheKey);
    if (!data) return false;
    applyParamsToUI(JSON.parse(data));
    return true;
}

// =================================================================================
// 🔗 FILTROS AVANZADOS RECIBIDOS POR URL (desde /admin/busqueda_avanzada)
// =================================================================================

function applyURLParamsToUI() {
    const qs = new URLSearchParams(window.location.search);
    if ([...qs.keys()].length === 0) return false;

    if (window.UI) window.UI.setSearchModeManual('campos');

    if (qs.has('licencia')) document.getElementById('licenciaSelect').value = qs.get('licencia');
    if (qs.has('empresa')) document.getElementById('empresaSelect').value = qs.get('empresa');
    if (qs.has('estado')) document.getElementById('state').value = qs.get('estado');

    const camposDirectos = [
        'referencia', 'numero_albaran', 'fecha_desde', 'fecha_hasta',
        'matricula', 'num_factura', 'pagado', 'cobrado',
        'fecha_pago_desde', 'fecha_pago_hasta', 'fecha_cobro_desde', 'fecha_cobro_hasta'
    ];
    camposDirectos.forEach(name => {
        if (!qs.has(name)) return;
        const el = APP.elements.searchForm.querySelector(`[name="${name}"]`);
        if (el) el.value = qs.get(name);
    });

    // Limpiamos la URL para que un refresco o "volver atrás" no repita la búsqueda por sorpresa.
    window.history.replaceState({}, '', window.location.pathname);
    return true;
}

// =================================================================================
// 🚀 INICIO Y CARGA
// =================================================================================

const DEFAULT_LATEST_COUNT = 100;

async function startAdmin() {
    try {
        await SearchEngine.initCatalog(true);
        renderHistoryCombo();
        const vieneDeURL = applyURLParamsToUI();
        const tieneCache = !vieneDeURL && applySearchCache();
        // Si no llega con filtros por URL (busqueda avanzada) ni con caché de una
        // búsqueda anterior, la vista por defecto son los últimos 100 registros.
        await loadData((vieneDeURL || tieneCache) ? handleSearch : showLatestDefault);
        setupEventListeners();
    } catch (e) { console.error(e); }
}

async function loadData(afterLoad) {
    APP.elements.resultsBody.innerHTML = '<tr><td colspan="12" class="p-20 text-center italic text-slate-400">Consultando base de datos...</td></tr>';
    try {
        const res = await fetch('/api/v1/albaranes/search?pageSize=10000', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const json = await res.json();
        APP.state.rawAlbaranes = json.data || json || [];
        if (typeof afterLoad === 'function') afterLoad();
        else showLatestDefault();
    } catch (e) { console.error(e); }
}

// Vista por defecto: los N registros más recientes (por fecha), sin ningún filtro
// aplicado. Se usa al entrar limpio en /admin/ y al pulsar "Limpiar Filtros".
function showLatestDefault(n = DEFAULT_LATEST_COUNT) {
    const ordenados = [...APP.state.rawAlbaranes].sort(
        (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
    );
    APP.state.filteredAlbaranes = ordenados.slice(0, n);
    APP.state.currentSort = { key: 'fecha', direction: 'desc' };
    APP.state.currentPage = 1;
    sessionStorage.removeItem(APP.cacheKey);
    render();
    if (window.refreshAdvancedFiltersBanner) window.refreshAdvancedFiltersBanner();
}
window.showLatestDefault = showLatestDefault;

function handleSearch(e) {
    if (e) e.preventDefault();
    const params = {
        mode: APP.state.searchMode,
        licencia: document.getElementById('licenciaSelect').value,
        empresa: document.getElementById('empresaSelect').value,
        estado: document.getElementById('state').value,
        ref: APP.elements.searchForm.querySelector('[name="referencia"]').value,
        num_albaran: APP.elements.searchForm.querySelector('[name="numero_albaran"]').value,
        desde: APP.elements.searchForm.querySelector('[name="fecha_desde"]').value,
        hasta: APP.elements.searchForm.querySelector('[name="fecha_hasta"]').value,
        palabra: APP.elements.palabraInput.value,

        // Filtros avanzados
        matricula: getFieldValue('matricula'),
        num_factura: getFieldValue('num_factura'),
        pagado: getFieldValue('pagado'),
        cobrado: getFieldValue('cobrado'),
        fecha_pago_desde: getFieldValue('fecha_pago_desde'),
        fecha_pago_hasta: getFieldValue('fecha_pago_hasta'),
        fecha_cobro_desde: getFieldValue('fecha_cobro_desde'),
        fecha_cobro_hasta: getFieldValue('fecha_cobro_hasta')
    };

    APP.state.filteredAlbaranes = SearchEngine.applyFilters(APP.state.rawAlbaranes, params);
    saveSearchState(params);
    handleSort(APP.state.currentSort.key, true);
    APP.state.currentPage = 1;
    render();
}

function getFieldValue(name) {
    const el = APP.elements.searchForm.querySelector(`[name="${name}"]`);
    return el ? el.value : "";
}

function render() {
    const { resultsBody, tableFooter, totalImporte, pageInfo, resultsCount, totalLabel } = APP.elements;
    resultsBody.innerHTML = '';
    const start = (APP.state.currentPage - 1) * APP.state.pageSize;
    const pageItems = APP.state.filteredAlbaranes.slice(start, start + APP.state.pageSize);

    if (pageItems.length === 0) {
        resultsBody.innerHTML = '<tr><td colspan="12" class="p-20 text-center text-orange-500 font-bold uppercase">Sin registros coincidentes</td></tr>';
        if (tableFooter) tableFooter.classList.add('hidden');
        resultsCount.textContent = "0";
        return;
    }

    let sum = 0;
    pageItems.forEach(a => {
        const imp = parseFloat(a.importe_total || 0);
        sum += imp;
        const row = `
            <tr class="hover:bg-orange-50/40 transition-colors group">
                <td class="px-3 py-3 font-bold">${a.numero_albaran || 'N/A'}</td>
                <td class="px-3 py-3 font-bold text-slate-500">${a.fecha ? a.fecha.substring(0,10) : '-'}</td>
                <td class="px-3 py-3 font-black text-blue-600 uppercase tracking-tighter">${SearchEngine.getLicenciaNumero(a)}</td>
                <td class="px-3 py-3 font-bold uppercase truncate">${SearchEngine.getEmpresaNombre(a)}</td>
                <td class="px-3 py-3 text-slate-400 italic font-black uppercase text-[9px]">${a.referencia || '-'}</td>
                <td class="px-3 py-3">${a.num_factura || '-'}</td>
                <td class="px-3 py-3 text-right font-black text-primary-link bg-orange-50/30">€${imp.toFixed(2)}</td>
                <td class="text-center">${a.enviado ? '✅' : '⚪'}</td>
                <td class="text-center">${a.cobrado ? '✅' : '⚪'}</td>
                <td class="text-center">${a.pagado ? '✅' : '⚪'}</td>
                <td class="px-3 py-3 truncate max-w-[120px] text-gray-400">${a.observaciones || '-'}</td>
                <td class="px-3 py-3 text-center">
                    <div class="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onclick="window.location.href='/admin/albaranes/view/${a.id}'" class="p-1 text-blue-500 hover:bg-blue-100 rounded" title="Ver"><i data-lucide="eye" class="w-3.5 h-3.5"></i></button>
                        <button onclick="window.location.href='/admin/albaranes/update/${a.id}'" class="p-1 text-orange-500 hover:bg-orange-100 rounded" title="Editar"><i data-lucide="pencil" class="w-3.5 h-3.5"></i></button>
                        <button onclick="handleDeleteAction(${a.id})" class="p-1 text-red-500 hover:bg-red-100 rounded" title="Borrar"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                    </div>
                </td>
            </tr>`;
        resultsBody.insertAdjacentHTML('beforeend', row);
    });

    totalImporte.textContent = `€${sum.toFixed(2)}`;
    tableFooter.classList.remove('hidden');
    resultsCount.textContent = APP.state.filteredAlbaranes.length;
    const totalPages = Math.ceil(APP.state.filteredAlbaranes.length / APP.state.pageSize) || 1;
    pageInfo.textContent = `${APP.state.currentPage} / ${totalPages}`;
    totalLabel.textContent = `${APP.state.filteredAlbaranes.length} REGISTROS TOTALES`;
    if (window.lucide) lucide.createIcons();
    UI_ADMIN.updateSortIcons();
}

function handleSort(key, isInitial = false) {
    if (!isInitial) {
        APP.state.currentSort.direction = (APP.state.currentSort.key === key && APP.state.currentSort.direction === 'asc') ? 'desc' : 'asc';
        APP.state.currentSort.key = key;
    }
    APP.state.filteredAlbaranes.sort((a, b) => {
        let vA = a[key], vB = b[key];
        if (key === 'empresa_nombre') { vA = SearchEngine.getEmpresaNombre(a); vB = SearchEngine.getEmpresaNombre(b); }
        if (key === 'licencia') { vA = SearchEngine.getLicenciaNumero(a); vB = SearchEngine.getLicenciaNumero(b); }
        if (key === 'importe_total') { vA = parseFloat(vA || 0); vB = parseFloat(vB || 0); }
        if (key === 'fecha') { vA = new Date(vA).getTime(); vB = new Date(vB).getTime(); }
        return (vA < vB ? -1 : 1) * (APP.state.currentSort.direction === 'asc' ? 1 : -1);
    });
    if (!isInitial) render();
}

// =================================================================================
// 📡 PUENTE: fuente única de verdad para exportaciones.
// admin_busqueda.js rellena 'currentData' (búsqueda real por API).
// admin.js rellena 'APP.state.filteredAlbaranes' (búsqueda local con SearchEngine).
// La exportación usa el que tenga datos, priorizando el local (ya filtrado y ordenado).
// =================================================================================
function getActiveData() {
    if (APP.state.filteredAlbaranes.length > 0) return APP.state.filteredAlbaranes;
    if (typeof currentData !== 'undefined' && Array.isArray(currentData) && currentData.length > 0) return currentData;
    return [];
}

// =================================================================================
// 🖨️ EXPORTACIONES
// =================================================================================

window.handleGeneratePDF = () => {
    const datos = getActiveData();
    if (datos.length === 0) return;
    const dataClean = datos.map(a => ({
        "Nº ALBARAN": a.numero_albaran,
        "FECHA":      a.fecha ? a.fecha.substring(0,10) : "-",
        "LICENCIA":   SearchEngine.getLicenciaNumero(a),
        "EMPRESA":    SearchEngine.getEmpresaNombre(a),
        "EXPEDIENTE": a.referencia || "-",
        "TOTAL":      `€${parseFloat(a.importe_total || 0).toFixed(2)}`
    }));
    Oficina.generarPDF("LISTADO_ALBARANES_REGISTRADOS", dataClean);
};

window.handleGenerateXLSX = () => {
    const datos = getActiveData();
    if (datos.length === 0) return;

    const fmtHora  = (v) => { if (!v) return '-'; const d = new Date(v); return isNaN(d) ? '-' : d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }); };
    const fmtFecha = (v) => v ? String(v).substring(0, 10) : '-';
    const fmtBool  = (v) => v ? 'Sí' : 'No';
    const fmtNum   = (v) => parseFloat(v || 0);

    const dataClean = datos.map(a => ({
        // --- IDENTIFICACIÓN ---
        "Nº ALBARÁN":           a.numero_albaran || '-',
        "FECHA":                fmtFecha(a.fecha),
        "LICENCIA":             SearchEngine.getLicenciaNumero(a),
        "EMPRESA":              SearchEngine.getEmpresaNombre(a),
        "REFERENCIA":           a.referencia || '-',
        "ASALARIADO":           a.asalariado || '-',
        // --- PASAJERO Y VEHÍCULO ---
        "CLIENTE":              a.cliente || '-',
        "DNI PASAJERO":         a.dni_pasajero || '-',
        "TLF PASAJERO":         a.tlf_pasajero || '-',
        "MATRÍCULA":            a.matricula || '-',
        // --- RUTA ---
        "ORIGEN":               a.origen || '-',
        "PARADA":               a.parada || '-',
        "DESTINO":              a.destino || '-',
        // --- TIEMPOS ---
        "HORA":                 fmtHora(a.hora),
        "HORA INI":             fmtHora(a.hora_ini),
        "HORA FIN":             fmtHora(a.hora_fin),
        "HORA TOTAL (h)":       fmtNum(a.hora_total),
        "ESPERA INI":           fmtHora(a.espera_ini),
        "ESPERA FIN":           fmtHora(a.espera_fin),
        // --- KILÓMETROS ---
        "KM TOTALES":           fmtNum(a.km_totales),
        "KM NACIONALES":        fmtNum(a.km_nacionales),
        "KM INTERNACIONALES":   fmtNum(a.km_internacionales),
        // --- IMPORTES ---
        "IMPORTE ESPERA":       fmtNum(a.importe_espera),
        "IMPORTE SUPLIDOS":     fmtNum(a.importe_suplidos),
        "IMPORTE TOTAL":        fmtNum(a.importe_total),
        // --- ESTADOS SERVICIO ---
        "URBANO":               fmtBool(a.urbano),
        "DIURNO":               fmtBool(a.diurno),
        "NOCT/FEST":            fmtBool(a.noct_fest),
        "FESTIVO":              fmtBool(a.festivo),
        "REMOLQUE":             fmtBool(a.remolque),
        "Nº PLAZAS":            a.num_plazas || 4,
        // --- GESTIÓN ADMIN ---
        "Nº FACTURA":           a.num_factura || '-',
        "ENVIADO":              fmtBool(a.enviado),
        "COBRADO":              fmtBool(a.cobrado),
        "FECHA COBRO":          fmtFecha(a.fecha_cobro),
        "PAGADO":               fmtBool(a.pagado),
        "FECHA PAGO":           fmtFecha(a.fecha_pago),
        "FINALIZADO":           fmtBool(a.finalizado),
        "AUTORIZADO POR":       a.autorizado_por || '-',
        // --- OBSERVACIONES ---
        "OBSERVACIONES":        a.observaciones || '-',
        "OBS. ADMIN":           a.observaciones_admin || '-',
        // --- AUDITORÍA ---
        "CREADO":               fmtFecha(a.created_at),
        "ACTUALIZADO":          fmtFecha(a.updated_at),
    }));

    Oficina.generarExcel("LISTADO_ALBARANES_COMPLETO", dataClean);
};

window.handleDeleteAction = async (id) => {
    if (!confirm("¿Eliminar?")) return;
    try {
        const res = await fetch(`/api/v1/albaranes/${id}`, {
            method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (res.ok) { UI_ADMIN.alertMessage("Eliminado", "success"); loadData(); }
    } catch (e) { console.error(e); }
};

function setupEventListeners() {
    APP.elements.searchForm.onsubmit = handleSearch;
    APP.elements.recordsSelect.onchange = (e) => {
        APP.state.pageSize = e.target.value === 'todos' ? 99999 : parseInt(e.target.value);
        APP.state.currentPage = 1;
        render();
    };
    APP.elements.prevBtn.onclick = () => { if(APP.state.currentPage > 1) { APP.state.currentPage--; render(); } };
    APP.elements.nextBtn.onclick = () => {
        if(APP.state.currentPage < Math.ceil(APP.state.filteredAlbaranes.length/APP.state.pageSize)) {
            APP.state.currentPage++; render();
        }
    };
}

window.handleSearch = handleSearch;
window.handleSort = handleSort;
window.handleClearAllFilters = () => {
    sessionStorage.removeItem(APP.cacheKey);
    APP.elements.searchForm.reset();
    document.getElementById('palabra').value = '';
    showLatestDefault();
};

window.UI = {
    setSearchModeManual(mode) {
        APP.state.searchMode = mode;
        const palabraSection = document.getElementById('palabraSection');
        const searchForm = document.getElementById('searchForm');
        if (palabraSection) palabraSection.classList.toggle('hidden', mode === 'campos');
        if (searchForm) searchForm.classList.toggle('hidden', mode === 'palabra');

        const btnCampos  = document.getElementById('btn-mode-campos');
        const btnPalabra = document.getElementById('btn-mode-palabra');
        if (btnCampos && btnPalabra) {
            const ON  = "px-4 py-2 rounded-lg bg-primary-link text-white font-black text-[10px] uppercase shadow-md transition-all";
            const OFF = "px-4 py-2 rounded-lg bg-white text-slate-400 font-black text-[10px] uppercase border transition-all";
            btnCampos.className  = mode === 'campos'  ? ON : OFF;
            btnPalabra.className = mode === 'palabra' ? ON : OFF;
        }
    }
};

document.addEventListener('DOMContentLoaded', startAdmin);