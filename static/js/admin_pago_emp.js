/**
 * ARCHIVO: static/js/admin_pago_emp.js
 * DESCRIPCIÓN: Gestión Maestra de Cobros a Empresas.
 * ACTUALIZADO: 13/05/2026
 *   - FIX: handleBulkPay ahora cambia campo 'cobrado' (antes enviado)
 *   - NEW: Checkbox "Seleccionar Todo" en cabecera de tabla
 *   - NEW: Contador de filas seleccionadas junto al botón
 *   - FIX: Los checkboxes ya cobrados quedan disabled (no se procesan ni cuentan)
 */

const STATE = {
    allData: [],
    currentPage: 1,
    pageSize: 25,
    sortKey: 'fecha',
    sortDir: 'desc',
    searchMode: 'campos' // 'campos' o 'palabra'
};

const UI_EMP = {
    formatDate(iso) { 
        if (!iso || iso.startsWith('0001')) return '-';
        return iso.substring(0, 10); 
    },
    
    alertMessage(message, type = 'info') {
        const s = document.getElementById('statusMessage');
        if (!s) return;
        s.textContent = message;
        const border = type === 'success' ? 'border-green-500 text-green-600' : 
                       type === 'error'   ? 'border-red-500 text-red-600' 
                                          : 'border-blue-400 text-blue-600';
        s.className = `fixed bottom-5 right-5 z-[2000] p-4 rounded-xl shadow-2xl border-2 bg-white font-black text-xs uppercase tracking-widest transition-all duration-300 ${border}`;
        s.classList.remove('hidden');
        setTimeout(() => s.classList.add('hidden'), 4000);
    },

    setSearchModeManual(mode) {
        STATE.searchMode = mode;
        const btnCampos  = document.getElementById('btn-mode-campos');
        const btnPalabra = document.getElementById('btn-mode-palabra');
        const sectionCampos  = document.getElementById('camposSection');
        const sectionPalabra = document.getElementById('palabraSection');

        if (mode === 'campos') {
            btnCampos.className  = "px-5 py-2 rounded-lg bg-primary-link text-white font-black text-[10px] uppercase shadow-lg flex items-center gap-2";
            btnPalabra.className = "px-5 py-2 rounded-lg bg-slate-50 text-slate-400 font-black text-[10px] border border-slate-200 uppercase flex items-center gap-2 hover:bg-white transition-all";
            sectionCampos.classList.remove('hidden');
            sectionPalabra.classList.add('hidden');
        } else {
            btnPalabra.className = "px-5 py-2 rounded-lg bg-primary-link text-white font-black text-[10px] uppercase shadow-lg flex items-center gap-2";
            btnCampos.className  = "px-5 py-2 rounded-lg bg-slate-50 text-slate-400 font-black text-[10px] border border-slate-200 uppercase flex items-center gap-2 hover:bg-white transition-all";
            sectionCampos.classList.add('hidden');
            sectionPalabra.classList.remove('hidden');
            document.getElementById('palabra').focus();
        }
    },

    /** Actualiza el contador de seleccionados y el estado del cb-select-all */
    updateSelectionUI() {
        const all      = Array.from(document.querySelectorAll('.cb-seleccion:not(:disabled)'));
        const checked  = all.filter(cb => cb.checked);
        const counter  = document.getElementById('selectedCount');
        const cbAll    = document.getElementById('cb-select-all');

        if (checked.length > 0) {
            counter.textContent = `${checked.length} seleccionado${checked.length > 1 ? 's' : ''}`;
            counter.classList.remove('hidden');
        } else {
            counter.classList.add('hidden');
        }

        // Estado indeterminado si solo algunos están marcados
        if (cbAll) {
            cbAll.checked       = all.length > 0 && checked.length === all.length;
            cbAll.indeterminate = checked.length > 0 && checked.length < all.length;
        }
    }
};

// =================================================================================
// ☑️ SELECCIONAR TODO / DESMARCAR TODO
// =================================================================================

window.handleSelectAll = (masterCb, event) => {
    if (event) event.stopPropagation();
    document.querySelectorAll('.cb-seleccion:not(:disabled)').forEach(cb => {
        cb.checked = masterCb.checked;
    });
    UI_EMP.updateSelectionUI();
};

// =================================================================================
// 🔍 CARGA Y BÚSQUEDA
// =================================================================================

async function loadCombos() {
    if (window.SearchEngine) {
        await SearchEngine.initCatalog(true); 
    }
}

window.handleSearch = async (e) => {
    if (e) e.preventDefault();

    const tbody       = document.getElementById('albaranResults');
    const tableFooter = document.getElementById('tableFooter');
    const cbAll       = document.getElementById('cb-select-all');

    tbody.innerHTML = '<tr><td colspan="11" class="p-10 text-center italic text-slate-400 animate-pulse">Sincronizando cobros...</td></tr>';
    tableFooter.classList.add('hidden');
    if (cbAll) { cbAll.checked = false; cbAll.indeterminate = false; }
    document.getElementById('selectedCount').classList.add('hidden');

    const form     = document.getElementById('searchForm');
    const formData = new FormData(form);
    
    // 'true' | 'false' | '' (todos)
    const cobradoVal = formData.get('cobrado');

    const searchParams = {
        mode    : STATE.searchMode,
        licencia: formData.get('licencia_ref'),
        empresa : formData.get('empresa_ref'),
        ref     : formData.get('referencia'),
        desde   : formData.get('fecha_desde'),
        hasta   : formData.get('fecha_hasta'),
        palabra : document.getElementById('palabra').value,
        enviado : true
    };

    try {
        const token = localStorage.getItem('token');
        const res   = await fetch(`/api/v1/albaranes/search?enviado=true`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const json    = await res.json();
        const rawData = Array.isArray(json.data) ? json.data : (json || []);

        let filtered = SearchEngine.applyFilters(rawData, searchParams);

        // Filtrado por cobrado aquí, robusto a boolean/int/string de la API
        if (cobradoVal !== '') {
            const quiereCobrado = cobradoVal === 'true';
            filtered = filtered.filter(alb => {
                const c = alb.cobrado;
                const esCobrado = c === true || c === 1 || c === '1';
                return quiereCobrado ? esCobrado : !esCobrado;
            });
        }

        STATE.allData     = filtered;
        STATE.currentPage = 1;
        renderTable();
    } catch (err) { 
        UI_EMP.alertMessage("Error de conexión", "error");
    }
};

// =================================================================================
// 📊 RENDERIZADO
// =================================================================================

function renderTable() {
    const tbody       = document.getElementById('albaranResults');
    const tableFooter = document.getElementById('tableFooter');
    if (!tbody) return;
    tbody.innerHTML = '';

    // Reset selección y cb-all al renderizar nueva página
    const cbAll = document.getElementById('cb-select-all');
    if (cbAll) { cbAll.checked = false; cbAll.indeterminate = false; }
    document.getElementById('selectedCount').classList.add('hidden');
    
    const start    = (STATE.currentPage - 1) * STATE.pageSize;
    const pageData = STATE.allData.slice(start, start + STATE.pageSize);

    if (pageData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" class="p-20 text-center font-black text-slate-300 uppercase tracking-widest">Sin registros encontrados</td></tr>';
        tableFooter.classList.add('hidden');
        updatePaginationUI();
        return;
    }

    let sumaTotalPagina = 0;

    pageData.forEach(alb => {
        const importe   = parseFloat(alb.importe_total || 0);
        sumaTotalPagina += importe;
        // cobrado puede llegar como boolean true, número 1 o string "1"
        const isCobrado = alb.cobrado === true || alb.cobrado === 1 || alb.cobrado === '1';

        const tr = document.createElement('tr');
        tr.className = `hover:bg-orange-50/30 transition-colors border-b border-slate-50 group`;
        
        tr.innerHTML = `
            <td class="p-4 text-center">
                <input 
                    type="checkbox" 
                    value="${alb.id}" 
                    data-licencia="${alb.licencia_ref}"
                    class="cb-seleccion h-4 w-4 rounded border-slate-300 cursor-pointer accent-orange-500"
                    ${isCobrado ? 'disabled checked' : ''}
                    onchange="UI_EMP.updateSelectionUI()"
                >
            </td>
            <td class="p-4 text-slate-400 font-mono">#${alb.id}</td>
            <td class="p-4 font-black text-slate-800">${alb.numero_albaran}</td>
            <td class="p-4 font-bold text-blue-600 uppercase">${SearchEngine.getLicenciaNumero(alb)}</td>
            <td class="p-4 font-medium text-slate-500">${UI_EMP.formatDate(alb.fecha)}</td>
            <td class="p-4 font-bold text-slate-700 uppercase truncate max-w-[200px]">${SearchEngine.getEmpresaNombre(alb)}</td>
            <td class="p-4 text-right font-black text-primary-link text-sm bg-orange-50/20">€${importe.toFixed(2)}</td>
            <td class="p-4 text-center text-lg">${isCobrado ? '✅' : '❌'}</td>
            <td class="p-4 text-slate-400 italic">${UI_EMP.formatDate(alb.fecha_cobro)}</td>
            <td class="p-4 text-slate-500 text-[10px] truncate max-w-[150px]" title="${alb.observaciones_admin || ''}">${alb.observaciones_admin || '-'}</td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('totalImporte').textContent = `€${sumaTotalPagina.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
    tableFooter.classList.remove('hidden');
    updatePaginationUI();
    if (window.lucide) lucide.createIcons();
}

// =================================================================================
// 💰 COBRO MASIVO
// =================================================================================

window.handleBulkPay = async () => {
    // Solo los habilitados y marcados (los cobrados ya están disabled)
    const checkedBoxes = Array.from(document.querySelectorAll('.cb-seleccion:checked:not(:disabled)'));

    if (checkedBoxes.length === 0) {
        return UI_EMP.alertMessage("Selecciona al menos un registro pendiente", "error");
    }

    if (!confirm(`¿Confirmas marcar como COBRADOS ${checkedBoxes.length} albarán(es)?`)) return;

    UI_EMP.alertMessage(`Procesando ${checkedBoxes.length} cobro(s)...`, "info");
    const token     = localStorage.getItem('token');
    const fechaHoy  = new Date().toISOString().substring(0, 10); // 'YYYY-MM-DD' para MySQL DATE
    let errores = 0;

    for (const cb of checkedBoxes) {
        try {
            const licenciaRef = parseInt(cb.dataset.licencia) || 0;
            const res = await fetch(`/api/v1/albaranes/id/${cb.value}`, {
                method : 'PUT',
                headers: { 
                    'Content-Type' : 'application/json', 
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({ 
                    cobrado     : true,
                    fecha_cobro : fechaHoy,
                    licencia_ref: licenciaRef
                })
            });
            if (!res.ok) errores++;
        } catch {
            errores++;
        }
    }

    if (errores === 0) {
        UI_EMP.alertMessage(`✅ ${checkedBoxes.length} albarán(es) marcado(s) como cobrados`, "success");
    } else {
        UI_EMP.alertMessage(`⚠️ Completado con ${errores} error(es)`, "error");
    }

    window.handleSearch(); 
};

// =================================================================================
// ⚖️ ORDENACIÓN Y PAGINACIÓN
// =================================================================================

function updatePaginationUI() {
    const total      = STATE.allData.length;
    const totalPages = Math.ceil(total / STATE.pageSize) || 1;
    document.getElementById('resultsCount').textContent = total;
    document.getElementById('pageInfo').textContent     = `Página ${STATE.currentPage} / ${totalPages}`;
    document.getElementById('prevPageBtn').disabled     = STATE.currentPage === 1;
    document.getElementById('nextPageBtn').disabled     = STATE.currentPage >= totalPages;
    if (window.lucide) lucide.createIcons();
}

window.handleSort = (key, type) => {
    STATE.sortDir = (STATE.sortKey === key && STATE.sortDir === 'asc') ? 'desc' : 'asc';
    STATE.sortKey = key;
    STATE.allData.sort((a, b) => {
        let vA = a[key] || '', vB = b[key] || '';
        if (type === 'number') { vA = parseFloat(vA); vB = parseFloat(vB); }
        if (type === 'date')   { vA = new Date(vA).getTime(); vB = new Date(vB).getTime(); }
        const result = vA < vB ? -1 : (vA > vB ? 1 : 0);
        return STATE.sortDir === 'asc' ? result : -result;
    });
    renderTable();
};

// =================================================================================
// 🏁 INICIALIZACIÓN
// =================================================================================

document.addEventListener('DOMContentLoaded', async () => {
    await loadCombos();
    
    document.getElementById('recordsPerPage').onchange = (e) => { 
        STATE.pageSize    = parseInt(e.target.value); 
        STATE.currentPage = 1; 
        renderTable(); 
    };
    
    document.getElementById('prevPageBtn').onclick = () => { 
        if (STATE.currentPage > 1) { STATE.currentPage--; renderTable(); } 
    };
    document.getElementById('nextPageBtn').onclick = () => { 
        if (STATE.currentPage < Math.ceil(STATE.allData.length / STATE.pageSize)) { 
            STATE.currentPage++; renderTable(); 
        } 
    };
    
    window.handleSearch();
});

window.handleClearAllFilters = () => { 
    document.getElementById('searchForm').reset(); 
    document.getElementById('palabra').value = '';
    window.handleSearch(); 
};