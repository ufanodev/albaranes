/**
 * ARCHIVO: static/js/admin_empresas.js
 * DESCRIPCIÓN: Gestión completa de Empresas con función de borrado sin restricciones.
 * ACTUALIZADO: 26/03/2026
 */

const APP = {
    elements: {
        resultsBody: document.getElementById('empresaResults'),
        recordsSelect: document.getElementById('recordsPerPage'),
        statusMessage: document.getElementById('statusMessage'),
        pageInfo: document.getElementById('pageInfo'),
        totalLabel: document.getElementById('totalLabel'),
        dynamicTitle: document.getElementById('dynamicTitle'),
        prevBtn: document.getElementById('prevPageBtn'),
        nextBtn: document.getElementById('nextPageBtn'),
        searchForm: document.getElementById('searchForm'),
    },
    state: {
        allEmpresas: [],      
        filteredEmpresas: [], 
        currentPage: 1,
        pageSize: 20,          
        totalPages: 1,
        currentSort: { key: 'nombre', direction: 'asc' }
    }
};

const UI = {
    alertMessage(message, type = 'info') {
        const { statusMessage } = APP.elements;
        if (!statusMessage) return;
        statusMessage.textContent = message;
        statusMessage.className = `status-message fixed bottom-5 right-5 z-[2000] p-4 rounded-xl shadow-2xl border-2 bg-white font-black text-xs uppercase tracking-widest transition-all duration-300 ${type === 'success' ? 'border-green-500 text-green-600' : type === 'error' ? 'border-red-500 text-red-600' : 'border-blue-500 text-blue-600'}`;
        statusMessage.classList.remove('hidden');
        setTimeout(() => statusMessage.classList.add('hidden'), 4000);
    },

    updatePageControls() {
        const totalFiltered = APP.state.filteredEmpresas.length;
        APP.state.totalPages = Math.ceil(totalFiltered / APP.state.pageSize) || 1;
        const startIndex = (APP.state.currentPage - 1) * APP.state.pageSize;
        const showingCount = Math.min(startIndex + APP.state.pageSize, totalFiltered) - startIndex;

        if (APP.elements.dynamicTitle) APP.elements.dynamicTitle.textContent = `(${showingCount} de ${totalFiltered} registros)`;
        if (APP.elements.pageInfo) APP.elements.pageInfo.textContent = `Página ${APP.state.currentPage} / ${APP.state.totalPages}`;
        APP.elements.prevBtn.disabled = APP.state.currentPage <= 1;
        APP.elements.nextBtn.disabled = APP.state.currentPage >= APP.state.totalPages;
    },

    updateSortIcons() {
        const { key, direction } = APP.state.currentSort;
        document.querySelectorAll('.sort-icon').forEach(icon => {
            const field = icon.id.replace('sort-', '');
            if (field === key) {
                icon.innerHTML = `<i data-lucide="chevron-${direction === 'asc' ? 'up' : 'down'}" class="w-4 h-4 text-primary-link opacity-100"></i>`;
            } else {
                icon.innerHTML = `<i data-lucide="chevrons-up-down" class="w-4 h-4 text-slate-300 opacity-30"></i>`;
            }
        });
        if (window.lucide) lucide.createIcons();
    }
};

const API = {
    async loadAllEmpresas() {
        DOM.showLoading();
        try {
            // GET sin Authorization para evitar 401 por token caducado
            const response = await fetch('/api/v1/empresas');
            const json = await response.json();
            const data = json.data || json;
            APP.state.allEmpresas = Array.isArray(data) ? data : [];
            APP.state.filteredEmpresas = [...APP.state.allEmpresas];
            Filters.sortTable(APP.state.currentSort.key, true); 
        } catch (error) {
            DOM.showNoResults();
        }
    }
};

const DOM = {
    showLoading() {
        APP.elements.resultsBody.innerHTML = '<tr><td colspan="8" class="p-20 text-center italic text-slate-400 font-bold uppercase animate-pulse">Sincronizando...</td></tr>';
    },

    showNoResults() {
        APP.elements.resultsBody.innerHTML = '<tr><td colspan="8" class="p-20 text-center text-orange-500 font-bold uppercase">Sin registros</td></tr>';
        UI.updatePageControls();
    },

    renderResults() {
        const { resultsBody } = APP.elements;
        if (!resultsBody) return;
        resultsBody.innerHTML = '';
        const start = (APP.state.currentPage - 1) * APP.state.pageSize;
        const pageData = APP.state.filteredEmpresas.slice(start, start + APP.state.pageSize);

        if (pageData.length === 0) { this.showNoResults(); return; }

        pageData.forEach(e => {
            const tr = document.createElement('tr');
            const rowClass = e.estado !== false ? 'hover:bg-orange-50/30' : 'bg-red-50/20 opacity-80';
            tr.className = `${rowClass} transition-colors border-b border-slate-50 text-[11px] group`;
            const estadoColor = e.estado !== false ? 'text-green-500' : 'text-red-500';

            tr.innerHTML = `
                <td class="p-4 font-mono text-slate-400">#${e.id}</td>
                <td class="p-4 font-bold text-slate-600 uppercase">${e.nif || '-'}</td>
                <td class="p-4 font-black text-primary-link uppercase truncate">${e.nombre || 'S/N'}</td>
                <td class="p-4 text-slate-500 truncate italic">${e.direccion || '-'}</td>
                <td class="p-4 text-slate-600 font-bold">${e.telefono || '-'}</td>
                <td class="p-4 text-blue-500 truncate italic">${e.email || '-'}</td>
                <td class="p-4 text-center"><span class="${estadoColor} font-black text-lg">●</span></td>
                <td class="p-4 text-center">
                    <div class="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onclick="handleViewActionEmpresa('${e.id}')" class="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition" title="Ver"><i data-lucide="eye" class="w-4 h-4"></i></button>
                        <button onclick="handleEditActionEmpresa('${e.id}')" class="p-1.5 text-orange-500 hover:bg-orange-50 rounded-lg transition" title="Editar"><i data-lucide="pencil" class="w-4 h-4"></i></button>
                        <button onclick="handleDeleteActionEmpresa('${e.id}', '${e.nombre.replace(/'/g, "\\'")}')" class="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition" title="Borrar"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                    </div>
                </td>`;
            resultsBody.appendChild(tr);
        });

        UI.updatePageControls();
        UI.updateSortIcons();
    }
};

const Filters = {
    sortTable(key, initial = false) {
        if (!initial) {
            const dir = (APP.state.currentSort.key === key && APP.state.currentSort.direction === 'asc') ? 'desc' : 'asc';
            APP.state.currentSort = { key, direction: dir };
        }
        APP.state.filteredEmpresas.sort((a, b) => {
            let vA = a[APP.state.currentSort.key] || "";
            let vB = b[APP.state.currentSort.key] || "";
            const comp = vA.toString().localeCompare(vB.toString(), undefined, { numeric: true });
            return APP.state.currentSort.direction === 'asc' ? comp : -comp;
        });
        DOM.renderResults();
    }
};

const Events = {
    handleSearch(e) {
        if (e) e.preventDefault();
        const formData = new FormData(APP.elements.searchForm);
        const fNif = formData.get('nif').toLowerCase();
        const fNombre = formData.get('nombre').toLowerCase();
        const fTel = formData.get('telefono').toLowerCase();
        const fEstado = formData.get('estado');

        APP.state.filteredEmpresas = APP.state.allEmpresas.filter(emp => {
            const mNif = !fNif || (emp.nif && emp.nif.toLowerCase().includes(fNif));
            const mNom = !fNombre || (emp.nombre && emp.nombre.toLowerCase().includes(fNombre));
            const mTel = !fTel || (emp.telefono && emp.telefono.toLowerCase().includes(fTel));
            const mEst = fEstado === "" || String(emp.estado === true || emp.estado === 1 ? "1" : "0") === fEstado;
            return mNif && mNom && mTel && mEst;
        });
        APP.state.currentPage = 1;
        DOM.renderResults();
    },
    init() {
        APP.elements.recordsSelect.onchange = (e) => {
            APP.state.pageSize = e.target.value === 'todos' ? 99999 : parseInt(e.target.value);
            APP.state.currentPage = 1;
            DOM.renderResults();
        };
        APP.elements.prevBtn.onclick = () => { if (APP.state.currentPage > 1) { APP.state.currentPage--; DOM.renderResults(); } };
        APP.elements.nextBtn.onclick = () => { if (APP.state.currentPage < APP.state.totalPages) { APP.state.currentPage++; DOM.renderResults(); } };
    }
};

window.handleDeleteActionEmpresa = async (id, nombre) => {
    if (!confirm(`⚠️ ¿Desea borrar permanentemente la empresa "${nombre}"?`)) return;
    try {
        const response = await fetch(`/api/v1/empresas/${id}`, { method: 'DELETE' });
        if (response.ok) {
            UI.alertMessage(`"${nombre}" eliminada`, 'success');
            await API.loadAllEmpresas();
        } else {
            const err = await response.json();
            UI.alertMessage(err.error || 'Fallo al borrar', 'error');
        }
    } catch (e) { UI.alertMessage('Error de red', 'error'); }
};

window.handleCreateActionEmpresa = () => window.location.href = `/admin/empresas/crear`;
window.handleViewActionEmpresa = (id) => window.location.href = `/admin/empresas/view/${id}`;
window.handleEditActionEmpresa = (id) => window.location.href = `/admin/empresas/update/${id}`;
window.handleLogout = () => { localStorage.removeItem('token'); window.location.href = '/login'; };
window.sortTable = (key) => Filters.sortTable(key);
window.handleClearAllFilters = () => { APP.elements.searchForm.reset(); API.loadAllEmpresas(); };
window.Events = Events;

document.addEventListener('DOMContentLoaded', async () => { Events.init(); await API.loadAllEmpresas(); });