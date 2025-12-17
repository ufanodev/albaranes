// Archivo: static/js/admin_usuarios.js
// ✅ CRUD Gestor Usuarios - Lógica de Búsqueda, Renderizado y EXPORTACIÓN
// =================================================================================

const APP = {
    elements: {
        userResults: document.getElementById('userResults'),
        searchForm: document.getElementById('searchForm'),
        usuarioFiltro: document.getElementById('usuario_filtro'),
        emailFiltro: document.getElementById('email_filtro'),
        roleFiltro: document.getElementById('role_filtro'),
        activoFiltro: document.getElementById('activo_filtro'),
        resultsCount: document.getElementById('resultsCount'),
        activeFiltersCount: document.getElementById('activeFiltersCount'),
        prevBtn: document.getElementById('prevPageBtn'),
        nextBtn: document.getElementById('nextPageBtn'),
    },
    state: {
        allUsers: [],
        filteredUsers: [],
        currentPage: 1,
        pageSize: 10,
        totalPages: 1,
        currentSort: { key: 'id', direction: 'asc' },
        licenciasMap: new Map()
    }
};

// =================================================================================
// 🎨 UI HELPERS
// =================================================================================
const UI = {
    formatDate(isoString) { return isoString ? isoString.substring(0, 10) : '-'; },
    getBooleanHtml(value) {
        const isTrue = (value === true || value === 'true' || value === 1);
        return isTrue
            ? `<span class="px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">ACTIVO</span>`
            : `<span class="px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">INACTIVO</span>`;
    },
    alertMessage(message, type = 'info') {
        const statusMessage = document.getElementById('statusMessage');
        if (!statusMessage) return;
        statusMessage.textContent = message;
        statusMessage.className = `status-message status-${type} p-3 rounded-md mb-4 text-center font-medium border`;
        statusMessage.classList.remove('hidden');
        setTimeout(() => statusMessage.classList.add('hidden'), 5000);
    },
    updatePageInfo() {
        const totalFiltered = APP.state.filteredUsers.length;
        APP.state.totalPages = Math.ceil(totalFiltered / APP.state.pageSize);
        APP.state.currentPage = Math.max(1, Math.min(APP.state.currentPage, APP.state.totalPages || 1));
        const pageInfo = document.getElementById('pageInfo');
        if (pageInfo) pageInfo.textContent = `Página ${APP.state.currentPage} de ${APP.state.totalPages || 1}`;
        if (APP.elements.resultsCount) APP.elements.resultsCount.textContent = `${totalFiltered} resultados`;
        UI.updatePaginationButtons();
    },
    updatePaginationButtons() {
        if (APP.elements.prevBtn) APP.elements.prevBtn.disabled = APP.state.currentPage <= 1;
        if (APP.elements.nextBtn) APP.elements.nextBtn.disabled = APP.state.currentPage >= APP.state.totalPages;
    },
    updateActiveFiltersCount() {
        const { searchForm, activeFiltersCount } = APP.elements;
        if (!searchForm || !activeFiltersCount) return;
        const formData = new FormData(searchForm);
        let count = 0;
        if (formData.get('usuario')) count++;
        if (formData.get('email')) count++;
        if (formData.get('role')) count++;
        if (formData.get('activo')) count++;
        activeFiltersCount.textContent = `${count} filtro(s) activo(s)`;
    }
};

// =================================================================================
// 🔍 FILTER & SORT LOGIC
// =================================================================================
const Filters = {
    getFiltersFromForm() {
        const form = APP.elements.searchForm;
        if (!form) return {};
        const formData = new FormData(form);
        const filters = {};
        ['usuario', 'email', 'role', 'activo'].forEach(field => {
            const value = formData.get(field);
            if (value) { filters[field] = value; }
        });
        return filters;
    },
    sortTable(key) {
        const { currentSort } = APP.state;
        let direction = 'asc';
        if (currentSort.key === key && currentSort.direction === 'asc') { direction = 'desc'; }
        APP.state.filteredUsers.sort((a, b) => {
            let valA = a[key] || '';
            let valB = b[key] || '';
            if (key.includes('created_at')) {
                valA = new Date(valA).getTime(); valB = new Date(valB).getTime();
            }
            if (valA > valB) return direction === 'asc' ? 1 : -1;
            if (valA < valB) return direction === 'asc' ? -1 : 1;
            return 0;
        });
        APP.state.currentSort = { key, direction };
        DOM.renderResults();
    }
};

// =================================================================================
// 📄 EXPORTATION LOGIC (PDF/XLSX)
// =================================================================================
const Exportation = {
    formatDataForExport() {
        return APP.state.filteredUsers.map(u => ({
            "ID": String(u.id),
            "Usuario": String(u.usuario || '-'),
            "Email": String(u.email || '-'),
            "Rol": String(u.role || '-').toUpperCase(),
            "Estado": u.activo ? 'ACTIVO' : 'INACTIVO',
            "Creado": UI.formatDate(u.created_at),
            "Licencia": String(APP.state.licenciasMap.get(u.licencia_ref) || u.licencia_ref || '-')
        }));
    },

    async handleExport(format) {
        if (!APP.state.filteredUsers.length) {
            UI.alertMessage("No hay datos para exportar", "info");
            return;
        }

        UI.alertMessage(`Generando ${format.toUpperCase()}...`, "info");
        const payload = {
            reportName: `Reporte_Usuarios_${format.toUpperCase()}`,
            data: this.formatDataForExport()
        };

        try {
            const response = await fetch(`/api/v1/users/export/${format}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            if (response.ok && result.success !== false) {
                UI.alertMessage("✅ Exportación lista", "success");
                window.open(result.downloadURL, '_blank');
            } else {
                throw new Error(result.message || "Error en servidor");
            }
        } catch (error) {
            UI.alertMessage("❌ Error al exportar", "error");
        }
    }
};

// =================================================================================
// 🌐 API SERVICES
// =================================================================================
const API = {
    async loadLicenciasMap() {
        try {
            const response = await fetch('/api/v1/licencias');
            const data = await response.json();
            const licencias = data.data || data || [];
            licencias.forEach(l => { APP.state.licenciasMap.set(l.id, l.licencia); });
        } catch (error) { console.error('Error licencias:', error); }
    },
    async searchUsers(filters) {
        const tbody = APP.elements.userResults;
        if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 italic">Buscando...</td></tr>';
        try {
            const response = await fetch('/api/v1/users'); 
            const data = await response.json();
            const users = data.data || [];
            APP.state.allUsers = users;
            
            APP.state.filteredUsers = users.filter(user => {
                let m = true;
                if (filters.usuario && !user.usuario?.toLowerCase().includes(filters.usuario.toLowerCase())) m = false;
                if (filters.email && !user.email?.toLowerCase().includes(filters.email.toLowerCase())) m = false;
                if (filters.role && user.role?.toLowerCase() !== filters.role.toLowerCase()) m = false;
                if (filters.activo !== undefined && String(user.activo) !== filters.activo) m = false;
                return m;
            });
            DOM.renderResults();
        } catch (error) { UI.alertMessage("Error de conexión", "error"); }
    }
};

// =================================================================================
// 🖼️ DOM RENDER
// =================================================================================
const DOM = {
    renderResults() {
        const tbody = APP.elements.userResults;
        if (!tbody) return;
        tbody.innerHTML = '';
        const start = (APP.state.currentPage - 1) * APP.state.pageSize;
        const pageData = APP.state.filteredUsers.slice(start, start + APP.state.pageSize);

        if (pageData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4">Sin resultados</td></tr>';
            UI.updatePageInfo(); return;
        }

        pageData.forEach(user => {
            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-50 border-b transition-colors';
            const lic = APP.state.licenciasMap.get(user.licencia_ref) || (user.licencia_ref || '-');
            row.innerHTML = `
                <td class="px-3 py-2 text-sm">${user.id}</td>
                <td class="px-3 py-2 text-sm font-medium">${user.usuario||'-'}</td>
                <td class="px-3 py-2 text-sm">${user.email||'-'}</td>
                <td class="px-3 py-2 text-sm uppercase">${user.role||'-'}</td>
                <td class="px-3 py-2 text-center">${UI.getBooleanHtml(user.activo)}</td>
                <td class="px-3 py-2 text-sm">${UI.formatDate(user.created_at)}</td>
                <td class="px-3 py-2 text-sm">${lic}</td>
                <td class="px-3 py-2 text-center whitespace-nowrap">
                    <button onclick="handleViewUser(${user.id})" class="text-blue-600 mx-1"><i data-lucide="eye" class="w-4 h-4"></i></button>
                    <button onclick="handleUpdateUser(${user.id})" class="text-yellow-600 mx-1"><i data-lucide="edit" class="w-4 h-4"></i></button>
                    <button onclick="handleDeleteUser(${user.id})" class="text-red-600 mx-1"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </td>
            `;
            tbody.appendChild(row);
        });
        UI.updatePageInfo();
        if (window.lucide) lucide.createIcons();
    }
};

// =================================================================================
// 🎯 EXPOSICIÓN GLOBAL PARA HTML
// =================================================================================
window.handleGeneratePDF = () => Exportation.handleExport('pdf');
window.handleGenerateXLSX = () => Exportation.handleExport('xlsx');
window.handleSearch = (e) => { e.preventDefault(); APP.state.currentPage = 1; API.searchUsers(Filters.getFiltersFromForm()); UI.updateActiveFiltersCount(); };
window.handleClearAllFilters = () => { APP.elements.searchForm.reset(); window.handleSearch({preventDefault:()=>{}}); };
window.handleUpdateUser = (id) => window.location.href = `/admin/usuarios/update/${id}`;
window.handleViewUser = (id) => window.location.href = `/admin/usuarios/view/${id}`;
window.handleDeleteUser = (id) => { if (confirm(`¿Desactivar ID ${id}?`)) window.location.href = `/admin/usuarios/delete/${id}`; };
window.sortTable = (key) => Filters.sortTable(key);

document.addEventListener('DOMContentLoaded', async () => {
    await API.loadLicenciasMap();
    API.searchUsers({});
    if (APP.elements.prevBtn) APP.elements.prevBtn.onclick = () => { if (APP.state.currentPage > 1) { APP.state.currentPage--; DOM.renderResults(); } };
    if (APP.elements.nextBtn) APP.elements.nextBtn.onclick = () => { if (APP.state.currentPage < APP.state.totalPages) { APP.state.currentPage++; DOM.renderResults(); } };
});