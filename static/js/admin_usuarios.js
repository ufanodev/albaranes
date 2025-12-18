/**
 * admin_usuarios.js - Gestión del Listado de Usuarios (Panel Admin)
 * Incluye búsqueda, paginación, renderizado y exportación.
 */

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
        licenciasMap: new Map() // Mapea ID de licencia -> Número visual (ej: 1 -> "001")
    }
};

// =================================================================================
// 🎨 UI HELPERS
// =================================================================================
const UI = {
    formatDate(isoString) { 
        return isoString ? isoString.substring(0, 10) : '-'; 
    },
    
    getBooleanHtml(value) {
        const isTrue = (value === true || value === 'true' || value === 1);
        return isTrue
            ? `<span class="px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full border border-green-300">ACTIVO</span>`
            : `<span class="px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full border border-red-300">INACTIVO</span>`;
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
        if (APP.elements.resultsCount) APP.elements.resultsCount.textContent = `${totalFiltered} usuarios`;
        
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
// 🔍 LÓGICA DE FILTROS Y ORDENACIÓN
// =================================================================================
const Filters = {
    getFiltersFromForm() {
        const form = APP.elements.searchForm;
        if (!form) return {};
        const formData = new FormData(form);
        const filters = {};
        ['usuario', 'email', 'role', 'activo'].forEach(field => {
            const value = formData.get(field);
            if (value) filters[field] = value;
        });
        return filters;
    },

    sortTable(key) {
        const { currentSort } = APP.state;
        let direction = 'asc';
        if (currentSort.key === key && currentSort.direction === 'asc') direction = 'desc';

        APP.state.filteredUsers.sort((a, b) => {
            let valA = a[key] ?? '';
            let valB = b[key] ?? '';
            
            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();

            if (valA > valB) return direction === 'asc' ? 1 : -1;
            if (valA < valB) return direction === 'asc' ? -1 : 1;
            return 0;
        });

        APP.state.currentSort = { key, direction };
        DOM.renderResults();
    }
};

// =================================================================================
// 📄 LÓGICA DE EXPORTACIÓN
// =================================================================================
const Exportation = {
    formatDataForExport() {
        return APP.state.filteredUsers.map(u => ({
            "ID": String(u.id),
            "Usuario": u.usuario || '-',
            "Email": u.email || '-',
            "Rol": String(u.role || '-').toUpperCase(),
            "Estado": u.activo ? 'ACTIVO' : 'INACTIVO',
            "Creado": UI.formatDate(u.created_at),
            "Licencia": APP.state.licenciasMap.get(u.licencia_ref) || 'Admin/Sin Ref'
        }));
    },

    async handleExport(format) {
        if (!APP.state.filteredUsers.length) {
            UI.alertMessage("No hay datos para exportar", "info");
            return;
        }

        UI.alertMessage(`Generando ${format.toUpperCase()}...`, "info");
        const payload = {
            reportName: `Reporte_Usuarios_${new Date().getTime()}`,
            data: this.formatDataForExport()
        };

        try {
            const response = await fetch(`/api/v1/users/export/${format}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            if (response.ok && result.downloadURL) {
                UI.alertMessage("✅ Exportación completada", "success");
                window.open(result.downloadURL, '_blank');
            } else {
                throw new Error(result.error || "Error al generar archivo");
            }
        } catch (error) {
            UI.alertMessage(`❌ Error: ${error.message}`, "error");
        }
    }
};

// =================================================================================
// 🌐 SERVICIOS API
// =================================================================================
const API = {
    async loadLicenciasMap() {
        try {
            const response = await fetch('/api/v1/licencias');
            const result = await response.json();
            const licencias = result.data || [];
            licencias.forEach(l => { 
                APP.state.licenciasMap.set(l.id, l.licencia); 
            });
        } catch (error) { console.error('Error cargando licencias:', error); }
    },

    async fetchAndFilterUsers() {
        const tbody = APP.elements.userResults;
        if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="text-center py-10 italic">Buscando usuarios...</td></tr>';
        
        try {
            const response = await fetch('/api/v1/users');
            const result = await response.json();
            const users = result.data || [];
            
            APP.state.allUsers = users;
            this.applyFilters();
        } catch (error) { 
            UI.alertMessage("Error al conectar con el servidor", "error"); 
        }
    },

    applyFilters() {
        const filters = Filters.getFiltersFromForm();
        APP.state.filteredUsers = APP.state.allUsers.filter(u => {
            if (filters.usuario && !u.usuario?.toLowerCase().includes(filters.usuario.toLowerCase())) return false;
            if (filters.email && !u.email?.toLowerCase().includes(filters.email.toLowerCase())) return false;
            if (filters.role && u.role !== filters.role) return false;
            if (filters.activo !== undefined) {
                const isActive = String(u.activo) === filters.activo;
                if (!isActive) return false;
            }
            return true;
        });
        
        DOM.renderResults();
    }
};

// =================================================================================
// 🖼️ RENDERIZADO DOM
// =================================================================================
const DOM = {
    renderResults() {
        const tbody = APP.elements.userResults;
        if (!tbody) return;
        tbody.innerHTML = '';
        
        const start = (APP.state.currentPage - 1) * APP.state.pageSize;
        const pageData = APP.state.filteredUsers.slice(start, start + APP.state.pageSize);

        if (pageData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center py-10 text-gray-400">No se encontraron usuarios</td></tr>';
            UI.updatePageInfo();
            return;
        }

        pageData.forEach(u => {
            const row = document.createElement('tr');
            row.className = 'hover:bg-violet-50 transition-colors border-b';
            
            const licenciaVisual = APP.state.licenciasMap.get(u.licencia_ref) || (u.licencia_ref === 0 ? 'Admin' : '-');

            row.innerHTML = `
                <td class="px-3 py-3 text-xs font-bold text-gray-700">${u.id}</td>
                <td class="px-3 py-3 text-xs font-semibold text-violet-700">${u.usuario || '-'}</td>
                <td class="px-3 py-3 text-xs">${u.email || '-'}</td>
                <td class="px-3 py-3 text-xs uppercase font-medium">${u.role || '-'}</td>
                <td class="px-3 py-3 text-center">${UI.getBooleanHtml(u.activo)}</td>
                <td class="px-3 py-3 text-xs">${UI.formatDate(u.created_at)}</td>
                <td class="px-3 py-3 text-xs font-bold text-indigo-600">${licenciaVisual}</td>
                <td class="px-3 py-3 text-center space-x-2">
                    <button onclick="handleUpdateUser(${u.id})" class="text-indigo-600 hover:text-indigo-900 transition"><i data-lucide="edit-3" class="w-4 h-4"></i></button>
                    <button onclick="handleDeleteUser(${u.id})" class="text-red-600 hover:text-red-900 transition"><i data-lucide="user-minus" class="w-4 h-4"></i></button>
                </td>
            `;
            tbody.appendChild(row);
        });

        UI.updatePageInfo();
        if (window.lucide) lucide.createIcons();
    }
};

// =================================================================================
// 🎯 EXPOSICIÓN GLOBAL
// =================================================================================
window.handleCreateUser = () => window.location.href = '/admin/usuarios/crear';
window.handleUpdateUser = (id) => window.location.href = `/admin/usuarios/update/${id}`;
window.handleDeleteUser = async (id) => {
    if (!confirm(`¿Está seguro de desactivar al usuario ID: ${id}?`)) return;
    try {
        const response = await fetch(`/api/v1/users/${id}`, { method: 'DELETE' });
        if (response.ok) {
            UI.alertMessage("✅ Usuario desactivado correctamente", "success");
            API.fetchAndFilterUsers();
        }
    } catch (e) { UI.alertMessage("Error al desactivar", "error"); }
};

window.handleSearch = (e) => { 
    if(e) e.preventDefault(); 
    APP.state.currentPage = 1; 
    API.applyFilters(); 
    UI.updateActiveFiltersCount(); 
};

window.handleClearAllFilters = () => { 
    APP.elements.searchForm.reset(); 
    window.handleSearch(); 
};

window.handleGeneratePDF = () => Exportation.handleExport('pdf');
window.handleGenerateXLSX = () => Exportation.handleExport('xlsx');
window.sortTable = (key) => Filters.sortTable(key);

// =================================================================================
// 🚀 ARRANQUE
// =================================================================================
document.addEventListener('DOMContentLoaded', async () => {
    await API.loadLicenciasMap();
    await API.fetchAndFilterUsers();

    if (APP.elements.prevBtn) APP.elements.prevBtn.onclick = () => { 
        if (APP.state.currentPage > 1) { APP.state.currentPage--; DOM.renderResults(); } 
    };
    if (APP.elements.nextBtn) APP.elements.nextBtn.onclick = () => { 
        if (APP.state.currentPage < APP.state.totalPages) { APP.state.currentPage++; DOM.renderResults(); } 
    };
});