/**
 * ARCHIVO: static/js/admin_titular.js
 * DESCRIPCIÓN: Gestión completa de Titulares para el Administrador.
 * ACTUALIZADO: 28/01/2026 - Fix permanencia inactivos, orden natural 001 y remoción de borrado físico.
 */

const APP = {
    elements: {
        resultsBody: document.getElementById('titularResults'),
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
        allTitulares: [],      
        filteredTitulares: [], 
        currentPage: 1,
        pageSize: 20,          
        totalPages: 1,
        currentSort: { key: 'licencia', direction: 'asc' } // ✅ Orden inicial 001
    }
};

// =================================================================================
// 🎨 UI HELPERS
// =================================================================================
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
        const totalFiltered = APP.state.filteredTitulares.length;
        APP.state.totalPages = Math.ceil(totalFiltered / APP.state.pageSize) || 1;
        
        const startIndex = (APP.state.currentPage - 1) * APP.state.pageSize;
        const endIndex = Math.min(startIndex + APP.state.pageSize, totalFiltered);
        const showingCount = totalFiltered === 0 ? 0 : (endIndex - startIndex);

        // ✅ Título dinámico: (10 de 22 registros)
        if (APP.elements.dynamicTitle) {
            const countText = APP.state.pageSize >= 99999 ? totalFiltered : showingCount;
            APP.elements.dynamicTitle.textContent = `(${countText} de ${totalFiltered} registros)`;
        }

        if (APP.elements.pageInfo) {
            APP.elements.pageInfo.textContent = `Página ${APP.state.currentPage} / ${APP.state.totalPages}`;
        }

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

// =================================================================================
// 🔍 FILTERS & SORT
// =================================================================================
const Filters = {
    sortTable(key) {
        const dir = (APP.state.currentSort.key === key && APP.state.currentSort.direction === 'asc') ? 'desc' : 'asc';
        APP.state.currentSort = { key, direction: dir };

        APP.state.filteredTitulares.sort((a, b) => {
            let vA = a[key] || "";
            let vB = b[key] || "";
            const comparison = vA.toString().localeCompare(vB.toString(), undefined, { numeric: true, sensitivity: 'base' });
            return dir === 'asc' ? comparison : -comparison;
        });

        APP.state.currentPage = 1;
        DOM.renderResults();
        UI.updateSortIcons();
    }
};

// =================================================================================
// 📡 API & RENDER
// =================================================================================
const API = {
    async loadAllTitulares() {
        DOM.showLoading();
        try {
            const response = await fetch('/api/v1/licencias');
            const json = await response.json();
            const data = Array.isArray(json.data) ? json.data : json;
            
            APP.state.allTitulares = data;
            APP.state.filteredTitulares = [...data];
            
            Filters.sortTable('licencia');
        } catch (error) {
            console.error('Error:', error);
            DOM.showNoResults();
        }
    }
};

const DOM = {
    showLoading() {
        APP.elements.resultsBody.innerHTML = '<tr><td colspan="10" class="p-20 text-center italic text-slate-400 font-bold uppercase animate-pulse">Sincronizando base de datos...</td></tr>';
    },

    showNoResults() {
        APP.elements.resultsBody.innerHTML = '<tr><td colspan="10" class="p-20 text-center text-orange-500 font-bold uppercase">No se han encontrado registros</td></tr>';
        UI.updatePageControls();
    },

    renderResults() {
        const { resultsBody } = APP.elements;
        if (!resultsBody) return;
        resultsBody.innerHTML = '';

        const start = (APP.state.currentPage - 1) * APP.state.pageSize;
        const pageData = APP.state.filteredTitulares.slice(start, start + APP.state.pageSize);

        pageData.forEach(t => {
            const tr = document.createElement('tr');
            // ✅ Estilo visual para inactivos (Rojo suave)
            const rowClass = t.estado ? 'hover:bg-orange-50/30' : 'bg-red-50/20 grayscale-[0.5] opacity-80 hover:bg-red-50/40';
            tr.className = `${rowClass} transition-colors border-b border-slate-50 text-[11px] group`;
            
            const choferColor = t.chofer ? 'text-green-500' : 'text-red-500';
            const estadoColor = t.estado ? 'text-green-500' : 'text-red-500';

            tr.innerHTML = `
                <td class="p-4 font-black text-primary-link uppercase">${t.licencia || 'S/N'}</td>
                <td class="p-4 text-slate-500 font-bold">${t.dni || '-'}</td>
                <td class="p-4 text-slate-800 font-bold uppercase truncate" title="${t.nombre}">${t.nombre || '-'}</td>
                <td class="p-4 text-slate-500 italic truncate text-[10px]" title="${t.direccion}">${t.direccion || '-'}</td>
                <td class="p-4 text-slate-400 font-mono">${t.cp || '-'}</td>
                <td class="p-4 text-slate-600 font-bold">${t.telefono || '-'}</td>
                <td class="p-4 text-blue-500 truncate italic" title="${t.email}">${t.email || '-'}</td>
                <td class="p-4 text-center">
                    <span class="${choferColor} font-black text-lg" title="${t.chofer ? 'Con chofer' : 'Sin chofer'}">●</span>
                </td>
                <td class="p-4 text-center">
                    <span class="${estadoColor} font-black text-lg" title="${t.estado ? 'Activo' : 'Inactivo'}">●</span>
                </td>
                <td class="p-4 text-center">
                    <div class="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onclick="handleViewActionTitular('${t.id}')" class="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition" title="Ver"><i data-lucide="eye" class="w-3.5 h-3.5"></i></button>
                        <button onclick="handleEditActionTitular('${t.id}')" class="p-1.5 text-orange-500 hover:bg-orange-50 rounded-lg transition" title="Editar"><i data-lucide="pencil" class="w-3.5 h-3.5"></i></button>
                    </div>
                </td>`;
            resultsBody.appendChild(tr);
        });

        UI.updatePageControls();
        if (window.lucide) lucide.createIcons();
    }
};

// =================================================================================
// 🎯 EVENTS & ACTIONS
// =================================================================================
const Events = {
    handleSearch(e) {
        if (e) e.preventDefault();
        const formData = new FormData(APP.elements.searchForm);
        const fLicencia = formData.get('licencia').toLowerCase();
        const fDni = formData.get('dni').toLowerCase();
        const fNombre = formData.get('nombre').toLowerCase();
        const fSocio = formData.get('socio');

        APP.state.filteredTitulares = APP.state.allTitulares.filter(t => {
            const mLicencia = !fLicencia || (t.licencia && t.licencia.toLowerCase().includes(fLicencia));
            const mDni = !fDni || (t.dni && t.dni.toLowerCase().includes(fDni));
            const mNombre = !fNombre || (t.nombre && t.nombre.toLowerCase().includes(fNombre));
            const mSocio = fSocio === "" || String(t.socio) === (fSocio === "1" ? "true" : "false");
            return mLicencia && mDni && mNombre && mSocio;
        });

        APP.state.currentPage = 1;
        DOM.renderResults();
    },

    init() {
        APP.elements.recordsSelect.onchange = (e) => {
            const val = e.target.value;
            APP.state.pageSize = val === 'todos' ? 99999 : parseInt(val);
            APP.state.currentPage = 1;
            DOM.renderResults();
        };

        APP.elements.prevBtn.onclick = () => { if (APP.state.currentPage > 1) { APP.state.currentPage--; DOM.renderResults(); } };
        APP.elements.nextBtn.onclick = () => { if (APP.state.currentPage < APP.state.totalPages) { APP.state.currentPage++; DOM.renderResults(); } };

        window.handleClearAllFilters = () => {
            APP.elements.searchForm.reset();
            APP.state.filteredTitulares = [...APP.state.allTitulares];
            APP.state.currentPage = 1;
            Filters.sortTable('licencia');
            UI.alertMessage('Filtros reiniciados', 'info');
        };
    }
};

// GLOBAL ACTIONS
window.handleViewActionTitular = (id) => window.location.href = `/admin/titulares/view/${id}`;
window.handleEditActionTitular = (id) => window.location.href = `/admin/titulares/update/${id}`;
window.handleCreateActionTitular = () => window.location.href = `/admin/titulares/crear`;
window.handleLogout = () => { localStorage.removeItem('token'); window.location.href = '/login'; };
window.sortTable = (key) => Filters.sortTable(key);
window.Events = Events;

document.addEventListener('DOMContentLoaded', async () => {
    Events.init();
    await API.loadAllTitulares();
});