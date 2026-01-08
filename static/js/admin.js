/**
 * admin.js - Gestión Maestra de Albaranes (Panel de Administrador)
 * Versión: FINAL consolidada con sumatorio de importes y 12 columnas.
 * Incluye acciones: VER, EDITAR, COPIAR y BORRAR.
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
        empresaSelect: document.getElementById('empresa'),
        stateSelect: document.getElementById('state'),
        palabraInput: document.getElementById('palabra'),
        activeFiltersCount: document.getElementById('activeFiltersCount')
    },
    state: {
        filteredAlbaranes: [],
        currentPage: 1,
        pageSize: 25,
        totalPages: 1,
        currentSort: { key: 'fecha', direction: 'desc' },
        searchMode: 'todos'
    }
};

// =================================================================================
// 🎨 UI HELPERS
// =================================================================================
const UI = {
    formatDate(isoString) { return isoString ? isoString.substring(0, 10) : '-'; },

    alertMessage(message, type = 'info') {
        const s = APP.elements.statusMessage;
        if (!s) return;
        s.textContent = message;
        s.className = `status-message status-${type} block`;
        s.classList.remove('hidden');
        setTimeout(() => s.classList.add('hidden'), 5000);
    },

    setSearchModeManual(mode) {
        APP.state.searchMode = mode;
        const btnC = document.getElementById('btn-mode-campos');
        const btnP = document.getElementById('btn-mode-palabra');
        
        if (mode === 'campos') {
            btnC?.classList.add('bg-blue-600', 'text-white');
            btnP?.classList.remove('bg-primary-pastel', 'text-black-pure');
        } else {
            btnP?.classList.add('bg-primary-pastel', 'text-black-pure');
            btnC?.classList.remove('bg-blue-600', 'text-white');
        }
        API.searchAlbaranes();
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
        this.updatePaginationButtons();
    },

    updatePaginationButtons() {
        const { prevBtn, nextBtn } = APP.elements;
        if(prevBtn) prevBtn.disabled = APP.state.currentPage <= 1;
        if(nextBtn) nextBtn.disabled = APP.state.currentPage >= APP.state.totalPages;
    }
};

// =================================================================================
// 🌐 API SERVICES
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
            const data = await r.json();
            const list = Array.isArray(data) ? data : (data.data || []);
            
            if (APP.elements.licenciaSelect) {
                APP.elements.licenciaSelect.innerHTML = '<option value="">🆔 TODAS LAS LICENCIAS</option>' + 
                    list.map(l => `<option value="${l.id}">${l.licencia}</option>`).join('');
            }
        } catch (e) { console.error("Error cargando licencias:", e); }
    },

    async loadEmpresas() {
        try {
            const r = await fetch('/api/v1/empresas', { headers: this.getHeaders() });
            const d = await r.json();
            const list = d.data || d;
            if (APP.elements.empresaSelect) {
                APP.elements.empresaSelect.innerHTML = '<option value="">📋 TODAS LAS EMPRESAS</option>' + 
                    list.map(e => `<option value="${e.id}">${e.nombre}</option>`).join('');
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
            const response = await fetch(`/api/v1/albaranes/search?${params.toString()}`, { headers: this.getHeaders() });
            const data = await response.json();
            APP.state.filteredAlbaranes = data.data || [];
            APP.state.currentPage = 1;
            DOM.renderResults();
        } catch (e) { DOM.showNoResults(); }
    }
};

// =================================================================================
// 🖼️ DOM RENDER (Alineado con las 12 columnas del HTML)
// =================================================================================
const DOM = {
    showLoading() { 
        APP.elements.resultsBody.innerHTML = '<tr><td colspan="12" class="text-center py-20 italic text-gray-400">Consultando base de datos...</td></tr>';
        APP.elements.tableFooter?.classList.add('hidden');
    },
    showNoResults() { 
        APP.elements.resultsBody.innerHTML = '<tr><td colspan="12" class="text-center py-20 text-orange-500 font-bold">No se encontraron albaranes con los filtros aplicados</td></tr>';
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

            const txtLicencia = a.LicenciaData?.licencia || a.licencia || (a.licencia_ref ? `Ref: ${a.licencia_ref}` : 'N/A');
            const txtEmpresa = a.EmpresaData?.nombre || a.empresa_nombre || 'N/A';

            const tr = document.createElement('tr');
            tr.className = 'hover:bg-orange-50/30 border-b border-gray-100 transition-colors text-[11px]';
            
            tr.innerHTML = `
                <td class="px-3 py-3 font-bold text-gray-900">${a.numero_albaran || 'N/A'}</td>
                <td class="px-3 py-3 text-gray-500">${UI.formatDate(a.fecha)}</td>
                <td class="px-3 py-3 font-bold text-blue-600">${txtLicencia}</td>
                <td class="px-3 py-3 text-gray-700 font-medium">${txtEmpresa}</td>
                <td class="px-3 py-3 text-gray-400 italic">${a.referencia || '-'}</td>
                <td class="px-3 py-3 text-gray-500">${a.num_factura || '-'}</td>
                <td class="px-3 py-3 font-black text-right text-primary-link bg-orange-50/20">€${importe.toFixed(2)}</td>
                <td class="px-3 py-3 text-center">${a.enviado ? '✅' : '❌'}</td>
                <td class="px-3 py-3 text-center">${a.cobrado ? '✅' : '❌'}</td>
                <td class="px-3 py-3 text-center">${a.pagado ? '✅' : '❌'}</td>
                <td class="px-3 py-3 text-gray-500 truncate max-w-[120px]" title="${a.observaciones || ''}">${a.observaciones || '-'}</td>
                <td class="px-3 py-3 text-center">
                    <div class="flex justify-center gap-1">
                        <button onclick="window.location.href='/admin/albaranes/view/${a.id}'" class="p-1.5 text-blue-600 hover:bg-blue-100 rounded-md transition" title="Ver"><i data-lucide="eye" class="w-3.5 h-3.5"></i></button>
                        <button onclick="window.location.href='/admin/albaranes/update/${a.id}'" class="p-1.5 text-orange-600 hover:bg-orange-100 rounded-md transition" title="Editar"><i data-lucide="pencil" class="w-3.5 h-3.5"></i></button>
                        <button onclick="window.location.href='/admin/albaranes/copiar/${a.id}'" class="p-1.5 text-emerald-600 hover:bg-emerald-100 rounded-md transition" title="Copiar"><i data-lucide="copy" class="w-3.5 h-3.5"></i></button>
                        <button onclick="handleDeleteAction(${a.id})" class="p-1.5 text-red-600 hover:bg-red-100 rounded-md transition" title="Borrar"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                    </div>
                </td>`;
            resultsBody.appendChild(tr);
        });

        if (totalImporte) {
            totalImporte.textContent = `€${sumatorioVista.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
            tableFooter?.classList.remove('hidden');
        }

        UI.updatePageInfo();
        if (window.lucide) lucide.createIcons();
    }
};

// =================================================================================
// 🌍 GLOBAL ACTIONS
// =================================================================================
window.handleSearch = (e) => { if(e) e.preventDefault(); API.searchAlbaranes(); };

window.handleClearAllFilters = () => {
    APP.elements.searchForm?.reset();
    if (APP.elements.palabraInput) APP.elements.palabraInput.value = '';
    API.searchAlbaranes();
};

window.handleDeleteAction = async (id) => {
    if (!confirm(`¿Confirmar eliminación permanente del registro ID: ${id}?`)) return;
    try {
        const res = await fetch(`/api/v1/albaranes/${id}`, { method: 'DELETE', headers: API.getHeaders() });
        if (res.ok) {
            APP.state.filteredAlbaranes = APP.state.filteredAlbaranes.filter(a => a.id !== id);
            DOM.renderResults();
            UI.alertMessage("Albarán eliminado", "success");
        }
    } catch (e) { console.error(e); }
};

window.handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
};

// =================================================================================
// 🚀 INITIALIZATION
// =================================================================================
document.addEventListener('DOMContentLoaded', async () => {
    await Promise.all([API.loadLicencias(), API.loadEmpresas()]);

    if (APP.elements.recordsSelect) {
        APP.elements.recordsSelect.onchange = (e) => {
            const val = e.target.value;
            APP.state.pageSize = val === 'todos' ? 99999 : parseInt(val);
            APP.state.currentPage = 1;
            DOM.renderResults();
        };
    }
    
    APP.elements.prevBtn.onclick = () => { if (APP.state.currentPage > 1) { APP.state.currentPage--; DOM.renderResults(); } };
    APP.elements.nextBtn.onclick = () => { if (APP.state.currentPage < APP.state.totalPages) { APP.state.currentPage++; DOM.renderResults(); } };

    [APP.elements.licenciaSelect, APP.elements.empresaSelect, APP.elements.stateSelect].forEach(el => {
        if(el) el.onchange = () => API.searchAlbaranes();
    });

    let timeout;
    if (APP.elements.palabraInput) {
        APP.elements.palabraInput.oninput = () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => API.searchAlbaranes(), 600);
        };
    }

    API.searchAlbaranes();
});