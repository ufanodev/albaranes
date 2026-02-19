/**
 * ARCHIVO: static/js/admin.js
 * DESCRIPCIÓN: Gestión maestra de albaranes para el Administrador.
 * ACTUALIZADO: 19/02/2026 - FIX: Carga robusta de licencias y ordenación visual.
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
        prevBtn: document.getElementById('prevPageBtn'),
        nextBtn: document.getElementById('nextPageBtn'),
        licenciaSelect: document.getElementById('licenciaSelect'),
        empresaSelect: document.getElementById('empresaSelect'),
        palabraInput: document.getElementById('palabra')
    },
    state: {
        filteredAlbaranes: [],
        currentPage: 1,
        pageSize: 25,
        totalPages: 1,
        currentSort: { key: 'fecha', direction: 'desc' }
    }
};

// =================================================================================
// 🎨 UI HELPERS
// =================================================================================
const UI = {
    formatDate(iso) { 
        if (!iso || iso.startsWith('0001')) return '-';
        return iso.substring(0, 10); 
    },

    alertMessage(message, type = 'info') {
        const s = APP.elements.statusMessage;
        if (!s) return;
        s.textContent = message;
        s.className = `status-message status-${type} block`;
        s.classList.remove('hidden');
        setTimeout(() => s.classList.add('hidden'), 5000);
    },

    updatePageInfo() {
        const total = APP.state.filteredAlbaranes.length;
        APP.state.totalPages = Math.ceil(total / APP.state.pageSize) || 1;
        
        if (APP.elements.pageInfo) APP.elements.pageInfo.textContent = `${APP.state.currentPage} / ${APP.state.totalPages}`;
        if (APP.elements.resultsCount) APP.elements.resultsCount.textContent = total;
        
        if (APP.elements.totalLabel) {
            const start = total === 0 ? 0 : (APP.state.currentPage - 1) * APP.state.pageSize + 1;
            const end = Math.min(start + APP.state.pageSize - 1, total);
            APP.elements.totalLabel.textContent = total > 0 ? `MOSTRANDO ${start} - ${end} DE ${total} REGISTROS` : "";
        }

        if (APP.elements.prevBtn) APP.elements.prevBtn.disabled = APP.state.currentPage <= 1;
        if (APP.elements.nextBtn) APP.elements.nextBtn.disabled = APP.state.currentPage >= APP.state.totalPages;
    },

    updateSortIcons() {
        // Limpiar iconos de todas las cabeceras
        document.querySelectorAll('[id^="sort-icon-"]').forEach(span => {
            span.innerHTML = '↕';
            span.className = 'ml-1 opacity-30 italic';
        });

        // Activar el icono de la columna activa en el state
        const active = document.getElementById(`sort-icon-${APP.state.currentSort.key}`);
        if (active) {
            active.innerHTML = APP.state.currentSort.direction === 'asc' ? '↑' : '↓';
            active.className = 'ml-1 opacity-100 text-primary-link font-black not-italic';
        }
    }
};

// =================================================================================
// 📡 API SERVICES
// =================================================================================
const API = {
    getHeaders() {
        return { 
            'Authorization': `Bearer ${localStorage.getItem('token')}`, 
            'Content-Type': 'application/json' 
        };
    },

    async loadLicencias() {
        try {
            const r = await fetch('/api/v1/licencias', { headers: this.getHeaders() });
            const result = await r.json();
            // Soporta tanto { data: [] } como []
            const list = Array.isArray(result) ? result : result.data;

            if (APP.elements.licenciaSelect && Array.isArray(list)) {
                const ordenadas = list.sort((a, b) => String(a.licencia).localeCompare(String(b.licencia), undefined, { numeric: true }));
                let html = '<option value="">🆔 TODAS LAS LICENCIAS</option>';
                html += ordenadas.map(l => `<option value="${l.id}">${String(l.licencia).toUpperCase()}</option>`).join('');
                APP.elements.licenciaSelect.innerHTML = html;
            }
        } catch (e) { console.error("Error cargando licencias:", e); }
    },

    async loadEmpresas() {
        try {
            const r = await fetch('/api/v1/empresas', { headers: this.getHeaders() });
            const result = await r.json();
            const list = Array.isArray(result) ? result : result.data;

            if (APP.elements.empresaSelect && Array.isArray(list)) {
                const ordenadas = list.sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)));
                let html = '<option value="">📋 TODAS LAS EMPRESAS</option>';
                html += ordenadas.map(e => `<option value="${e.id}">${String(e.nombre).toUpperCase()}</option>`).join('');
                APP.elements.empresaSelect.innerHTML = html;
            }
        } catch (e) { console.error("Error cargando empresas:", e); }
    },

    async searchAlbaranes() {
        DOM.showLoading();
        const params = new URLSearchParams();
        const formData = new FormData(APP.elements.searchForm);
        
        formData.forEach((val, key) => { if(val) params.append(key, val); });
        if (APP.elements.palabraInput?.value) params.append('palabra', APP.elements.palabraInput.value);
        params.append('pageSize', '10000'); 

        try {
            const res = await fetch(`/api/v1/albaranes/search?${params.toString()}`, { headers: this.getHeaders() });
            const result = await res.json();
            APP.state.filteredAlbaranes = result.data || result || [];
            APP.state.currentPage = 1;
            
            this.applyLocalSort();
            DOM.renderResults();
        } catch (e) { DOM.showNoResults(); }
    },

    applyLocalSort() {
        const { key, direction } = APP.state.currentSort;
        
        APP.state.filteredAlbaranes.sort((a, b) => {
            let vA, vB;

            // Lógica de extracción de valor según la columna
            switch(key) {
                case 'licencia':
                    vA = a.LicenciaData?.licencia || a.licencia || "";
                    vB = b.LicenciaData?.licencia || b.licencia || "";
                    break;
                case 'empresa_nombre':
                    vA = a.EmpresaData?.nombre || a.empresa_nombre || "";
                    vB = b.EmpresaData?.nombre || b.empresa_nombre || "";
                    break;
                case 'fecha':
                    vA = new Date(a.fecha || 0).getTime();
                    vB = new Date(b.fecha || 0).getTime();
                    break;
                case 'importe_total':
                    vA = parseFloat(a.importe_total || 0);
                    vB = parseFloat(b.importe_total || 0);
                    break;
                default:
                    vA = (a[key] === null || a[key] === undefined) ? "" : String(a[key]).toLowerCase();
                    vB = (b[key] === null || b[key] === undefined) ? "" : String(b[key]).toLowerCase();
            }

            if (vA < vB) return direction === 'asc' ? -1 : 1;
            if (vA > vB) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    }
};

// =================================================================================
// 🖼️ DOM RENDER
// =================================================================================
const DOM = {
    showLoading() { 
        APP.elements.resultsBody.innerHTML = '<tr><td colspan="12" class="text-center py-20 italic text-gray-400">Consultando base de datos...</td></tr>';
        APP.elements.tableFooter?.classList.add('hidden');
    },
    showNoResults() { 
        APP.elements.resultsBody.innerHTML = '<tr><td colspan="12" class="text-center py-20 text-orange-500 font-bold uppercase tracking-widest">Sin registros coincidentes</td></tr>';
        APP.elements.tableFooter?.classList.add('hidden');
    },

    renderResults() {
        const { resultsBody, tableFooter, totalImporte } = APP.elements;
        if (!resultsBody) return;
        resultsBody.innerHTML = '';

        const start = (APP.state.currentPage - 1) * APP.state.pageSize;
        const pageData = APP.state.filteredAlbaranes.slice(start, start + APP.state.pageSize);

        if (pageData.length === 0) { this.showNoResults(); return; }

        let sumatorioVista = 0;

        pageData.forEach(a => {
            const importe = parseFloat(a.importe_total || 0);
            sumatorioVista += importe;

            const txtLicencia = a.LicenciaData?.licencia || a.licencia || "-";
            const txtEmpresa = a.EmpresaData?.nombre || a.empresa_nombre || "-";

            const tr = document.createElement('tr');
            tr.className = 'hover:bg-orange-50/40 transition-colors text-[11px] group';
            
            tr.innerHTML = `
                <td class="px-4 py-3 font-bold text-slate-900">${a.numero_albaran || 'N/A'}</td>
                <td class="px-4 py-3 font-bold text-slate-500">${UI.formatDate(a.fecha)}</td>
                <td class="px-4 py-3 font-black text-blue-600 uppercase tracking-tighter">${txtLicencia}</td>
                <td class="px-4 py-3 text-slate-700 font-bold uppercase truncate" title="${txtEmpresa}">${txtEmpresa}</td>
                <td class="px-4 py-3 text-slate-400 italic uppercase text-[9px] font-black">${a.referencia || '-'}</td>
                <td class="px-4 py-3 text-gray-500 font-medium">${a.num_factura || '-'}</td>
                <td class="px-4 py-3 font-black text-right text-primary-link bg-orange-50/30">€${importe.toFixed(2)}</td>
                <td class="px-4 py-3 text-center text-xs">${a.enviado ? '●' : '○'}</td>
                <td class="px-4 py-3 text-center text-xs">${a.cobrado ? '●' : '○'}</td>
                <td class="px-4 py-3 text-center text-xs">${a.pagado ? '●' : '○'}</td>
                <td class="px-4 py-3 text-gray-500 truncate" title="${a.observaciones || ''}">${a.observaciones || '-'}</td>
                <td class="px-4 py-3 text-center">
                    <div class="flex justify-center gap-1">
                        <button onclick="window.location.href='/admin/albaranes/view/${a.id}'" class="p-1.5 text-blue-500 hover:bg-blue-100 rounded transition" title="Ver"><i data-lucide="eye" class="w-3.5 h-3.5"></i></button>
                        <button onclick="window.location.href='/admin/albaranes/update/${a.id}'" class="p-1.5 text-orange-500 hover:bg-orange-100 rounded transition" title="Editar"><i data-lucide="pencil" class="w-3.5 h-3.5"></i></button>
                        <button onclick="window.location.href='/admin/albaranes/copiar/${a.id}'" class="p-1.5 text-purple-600 hover:bg-purple-100 rounded transition" title="Copiar / Clonar"><i data-lucide="copy" class="w-3.5 h-3.5"></i></button>
                        <button onclick="handleDeleteAction(${a.id})" class="p-1.5 text-red-500 hover:bg-red-100 rounded transition" title="Borrar"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                    </div>
                </td>`;
            resultsBody.appendChild(tr);
        });

        if (totalImporte) {
            totalImporte.textContent = `€${sumatorioVista.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
            tableFooter?.classList.remove('hidden');
        }
        UI.updatePageInfo();
        UI.updateSortIcons(); 
        if (window.lucide) lucide.createIcons();
    }
};

// =================================================================================
// 🌍 ACCIONES GLOBALES
// =================================================================================

window.handleSearch = (e) => { if(e) e.preventDefault(); APP.state.currentPage = 1; API.searchAlbaranes(); };

window.handleClearAllFilters = () => {
    APP.elements.searchForm?.reset();
    if (APP.elements.palabraInput) APP.elements.palabraInput.value = '';
    APP.state.currentPage = 1;
    APP.state.currentSort = { key: 'fecha', direction: 'desc' };
    API.searchAlbaranes();
};

window.handleSort = (key) => {
    const dir = (APP.state.currentSort.key === key && APP.state.currentSort.direction === 'asc') ? 'desc' : 'asc';
    APP.state.currentSort = { key, direction: dir };
    API.applyLocalSort();
    DOM.renderResults();
};

window.handleDeleteAction = async (id) => {
    if (!confirm("¿Eliminar este albarán permanentemente?")) return;
    try {
        const res = await fetch(`/api/v1/albaranes/${id}`, { method: 'DELETE', headers: API.getHeaders() });
        if (res.ok) {
            UI.alertMessage("✅ Albarán eliminado", "success");
            API.searchAlbaranes();
        } else {
            UI.alertMessage("❌ No se pudo eliminar", "error");
        }
    } catch (e) { console.error(e); }
};

window.handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
};

// =================================================================================
// 🚀 INICIALIZACIÓN
// =================================================================================
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Cargar diccionarios (Soportando {data:[]} o [])
    await Promise.all([API.loadLicencias(), API.loadEmpresas()]);

    // 2. Listener filas por página
    if (APP.elements.recordsSelect) {
        APP.elements.recordsSelect.onchange = (e) => {
            const val = e.target.value;
            APP.state.pageSize = val === 'todos' ? 99999 : parseInt(val);
            APP.state.currentPage = 1;
            DOM.renderResults();
        };
    }
    
    // 3. Listeners paginación
    if(APP.elements.prevBtn) {
        APP.elements.prevBtn.onclick = () => { 
            if (APP.state.currentPage > 1) { 
                APP.state.currentPage--; 
                DOM.renderResults(); 
            } 
        };
    }
    if(APP.elements.nextBtn) {
        APP.elements.nextBtn.onclick = () => { 
            if (APP.state.currentPage < APP.state.totalPages) { 
                APP.state.currentPage++; 
                DOM.renderResults(); 
            } 
        };
    }

    // 4. Carga inicial
    API.searchAlbaranes();
});