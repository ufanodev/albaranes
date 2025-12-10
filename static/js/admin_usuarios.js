// Archivo: static/js/admin_usuarios.js
// ✅ CRUD Gestor Usuarios - Lógica de Búsqueda y Renderizado de TABLA
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
        const isTrue = (value === true || value === 'true');
        return isTrue
            ? `<span class="px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">ACTIVO</span>`
            : `<span class="px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">INACTIVO</span>`;
    },
    alertMessage(message, type = 'info') {
        console.log(`[${type.toUpperCase()}] ${message}`);
        const statusMessage = document.getElementById('statusMessage');
        if (!statusMessage) return;
        statusMessage.textContent = message;
        statusMessage.className = `status-message status-${type}`;
        statusMessage.classList.remove('hidden');
        setTimeout(() => statusMessage.classList.add('hidden'), 5000);
    },
    updatePageInfo() {
        const totalFiltered = APP.state.filteredUsers.length;
        APP.state.totalPages = Math.ceil(totalFiltered / APP.state.pageSize);
        APP.state.currentPage = Math.max(1, Math.min(APP.state.currentPage, APP.state.totalPages || 1));
        const start = (APP.state.currentPage - 1) * APP.state.pageSize + 1;
        const end = Math.min(APP.state.currentPage * APP.state.pageSize, totalFiltered);
        const pageInfo = document.getElementById('pageInfo');
        const resultsCount = APP.elements.resultsCount;
        if (pageInfo) pageInfo.textContent = `Página ${APP.state.currentPage} de ${APP.state.totalPages || 1}`;
        if (resultsCount) resultsCount.textContent = totalFiltered === 0 ? '0 resultados' : `${totalFiltered} resultados`;
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
        const fields = ['usuario', 'email', 'role', 'activo'];
        fields.forEach(field => {
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
            if (key.includes('created_at') || key.includes('updated_at')) {
                valA = new Date(valA).getTime(); valB = new Date(valB).getTime();
            }
            if (valA > valB) return direction === 'asc' ? 1 : -1;
            if (valA < valB) return direction === 'asc' ? -1 : 1;
            return 0;
        });
        APP.state.currentSort = { key, direction };
        APP.state.currentPage = 1;
        DOM.renderResults();
    },
    handleClearAllFilters() {
        const { usuarioFiltro, emailFiltro, roleFiltro, activoFiltro } = APP.elements;
        if (usuarioFiltro) usuarioFiltro.value = '';
        if (emailFiltro) emailFiltro.value = '';
        if (roleFiltro) roleFiltro.value = '';
        if (activoFiltro) activoFiltro.value = '';
        API.searchUsers(Filters.getFiltersFromForm());
        UI.alertMessage('✅ Filtros limpiados', 'info');
    }
};

// =================================================================================
// 🌐 API SERVICES
// =================================================================================
const API = {
    async loadLicenciasMap() {
        try {
            const response = await fetch('/api/v1/licencias');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            const licencias = Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : []);
            const map = new Map();
            licencias.forEach(l => { map.set(l.id, l.licencia); });
            APP.state.licenciasMap = map;
            console.log(`✅ Licencias cargadas: ${map.size}`);
        } catch (error) {
            console.error('❌ Error cargando el mapa de licencias:', error);
            UI.alertMessage(`❌ Error al cargar licencias.`, 'error');
        }
    },
    async searchUsers(filters) {
        const tbody = APP.elements.userResults;
        if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-gray-500 italic text-sm">Buscando usuarios...</td></tr>';
        UI.updateActiveFiltersCount();
        try {
            const params = new URLSearchParams({});
            Object.entries(filters).forEach(([k, v]) => {
                if (v !== undefined && v !== null && v !== '') { params.append(k, v); }
            });

            // NOTA: Usamos la ruta GET /api/v1/users y filtramos en el frontend si la API no soporta /search,
            // pero si tu backend sí soporta /api/v1/users/search, deberías usar esa URL.
            const fetchUrl = `/api/v1/users`; // Ruta base (cambiar a /search si es necesario)
            
            const response = await fetch(fetchUrl); 
            if (!response.ok) throw new Error(`Error ${response.status} al cargar usuarios.`);
            
            const data = await response.json();
            const users = data.data || [];
            APP.state.allUsers = users;
            
            // FILTRADO EN EL FRONTEND (si la API no filtra)
            APP.state.filteredUsers = users.filter(user => {
                let matches = true;
                if (filters.usuario && user.usuario && !user.usuario.toLowerCase().includes(filters.usuario.toLowerCase())) matches = false;
                if (filters.email && user.email && !user.email.toLowerCase().includes(filters.email.toLowerCase())) matches = false;
                if (filters.role && user.role && user.role.toLowerCase() !== filters.role.toLowerCase()) matches = false;
                if (filters.activo !== undefined && String(user.activo) !== filters.activo) matches = false;
                return matches;
            });

            Filters.sortTable('id', 'number'); 
            DOM.renderResults();
            UI.updatePageInfo();
        } catch (error) {
            console.error('Error cargando usuarios:', error);
            UI.alertMessage(`❌ Error de red al cargar usuarios: ${error.message}`, 'error');
            if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-red-500">❌ Error al cargar.</td></tr>';
        }
    }
};

// =================================================================================
// 🖼️ DOM RENDER
// =================================================================================
const DOM = {
    getCurrentPageData() {
        const filtered = APP.state.filteredUsers || [];
        const start = (APP.state.currentPage - 1) * APP.state.pageSize;
        return filtered.slice(start, start + APP.state.pageSize);
    },

    renderResults() {
        const tbody = APP.elements.userResults;
        if (!tbody) return;
        tbody.innerHTML = '';

        const pageData = DOM.getCurrentPageData();

        if (pageData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-gray-500 italic text-sm">No se encontraron usuarios.</td></tr>';
            UI.updatePageInfo();
            return;
        }

        pageData.forEach(user => {
            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-50';
            const isActive = user.activo === true;
            const licenciaNum = APP.state.licenciasMap.get(user.licencia_ref) || (user.licencia_ref ? user.licencia_ref : '-');

            row.innerHTML = `
                <td class="px-3 py-2 text-sm text-gray-800">${user.id}</td>
                <td class="px-3 py-2 text-sm text-gray-800">${user.usuario || '-'}</td>
                <td class="px-3 py-2 text-sm text-gray-600">${user.email || '-'}</td>
                <td class="px-3 py-2 text-sm text-gray-600 uppercase">${user.role || '-'}</td>
                <td class="px-3 py-2 text-center text-sm">${UI.getBooleanHtml(isActive)}</td>
                <td class="px-3 py-2 text-sm text-gray-600">${UI.formatDate(user.created_at)}</td>
                <td class="px-3 py-2 text-sm text-gray-600">${licenciaNum}</td>
                <td class="px-3 py-2 whitespace-nowrap text-center text-sm font-medium">
                    <button onclick="handleViewUser(${user.id})" class="text-blue-600 hover:text-blue-900 mx-1" title="Ver">
                        <i data-lucide="eye" class="h-4 w-4 inline"></i>
                    </button>
                    <button onclick="handleUpdateUser(${user.id})" class="text-yellow-600 hover:text-yellow-900 mx-1" title="Editar">
                        <i data-lucide="edit" class="h-4 w-4 inline"></i>
                    </button>
                    <button onclick="handleDeleteUser(${user.id})" class="text-red-600 hover:text-red-900 mx-1" title="Desactivar">
                        <i data-lucide="trash-2" class="h-4 w-4 inline"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });

        UI.updatePageInfo();
        if (window.lucide) window.lucide.createIcons();
    }
};

// =================================================================================
// 🎯 EVENTOS GLOBALES (Mapeo de Rutas)
// =================================================================================

function handleCreateUser() {
    window.location.href = '/admin/usuarios/crear';
}
function handleUpdateUser(id) {
    window.location.href = `/admin/usuarios/update/${id}`;
}
function handleViewUser(id) {
    window.location.href = `/admin/usuarios/view/${id}`;
}
function handleDeleteUser(id) {
    if (confirm(`¿Está seguro de DESACTIVAR al usuario con ID: ${id}?`)) {
        window.location.href = `/admin/usuarios/delete/${id}`;
    }
}


// =================================================================================
// 🚀 INICIALIZACIÓN
// =================================================================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Iniciando Gestor de Usuarios...');

    // Carga las licencias (para mapeo visual)
    await API.loadLicenciasMap();
    
    // Exposición de funciones de filtros
    window.handleSearch = (e) => {
        if (e) e.preventDefault();
        API.searchUsers(Filters.getFiltersFromForm());
        UI.updateActiveFiltersCount();
    };
    window.handleClearAllFilters = Filters.handleClearAllFilters;
    
    // Exposición de funciones CRUD
    window.handleCreateUser = handleCreateUser;
    window.handleUpdateUser = handleUpdateUser;
    window.handleViewUser = handleViewUser;
    window.handleDeleteUser = handleDeleteUser;

    // Paginación
    if (APP.elements.prevBtn) APP.elements.prevBtn.addEventListener('click', () => {
        if (APP.state.currentPage > 1) { APP.state.currentPage--; DOM.renderResults(); }
    });
    if (APP.elements.nextBtn) APP.elements.nextBtn.addEventListener('click', () => {
        if (APP.state.currentPage < APP.state.totalPages) { APP.state.currentPage++; DOM.renderResults(); }
    });
    
    // Carga inicial de usuarios
    API.searchUsers(Filters.getFiltersFromForm());
    UI.updateActiveFiltersCount();
    
    console.log('✅ Gestor de Usuarios listo.');
});