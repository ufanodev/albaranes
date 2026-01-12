/**
 * admin_usuarios.js - Gestión del Listado de Usuarios (Panel Admin)
 * Autenticación: HttpOnly Cookie (backend Go/Gin) | Combos dinámicos + UX robusta
 */

const APP = {
    elements: {
        userResults: document.getElementById('userResults'),
        searchForm: document.getElementById('searchForm'),
        resultsCount: document.getElementById('resultsCount'),
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
        licenciasMap: new Map() // Mapea ID de licencia -> Número visual
    }
};

// =================================================================================
// 🎨 UI HELPERS (MEJORADOS)
// =================================================================================
const UI = {
    formatDate(isoString) { 
        return isoString ? isoString.substring(0, 10) : '-'; 
    },
    
    getBooleanHtml(value) {
        const isTrue = (value === true || value === 'true' || value === 1);
        return isTrue
            ? `<span class="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-black rounded-full border border-green-200">ACTIVO</span>`
            : `<span class="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-black rounded-full border border-red-200">INACTIVO</span>`;
    },

    alertMessage(message, type = 'info') {
        const statusMessage = document.getElementById('statusMessage');
        if (!statusMessage) return;
        statusMessage.textContent = message;
        statusMessage.className = `p-4 rounded-xl font-bold text-center border-2 mb-4 ${
            type === 'success' 
                ? 'bg-green-50 text-green-700 border-green-200' 
                : 'bg-red-50 text-red-700 border-red-200'
        }`;
        statusMessage.classList.remove('hidden');
        setTimeout(() => statusMessage.classList.add('hidden'), 5000);
    },

    updatePageInfo() {
        const totalFiltered = APP.state.filteredUsers.length;
        APP.state.totalPages = Math.ceil(totalFiltered / APP.state.pageSize) || 1;
        APP.state.currentPage = Math.max(1, Math.min(APP.state.currentPage, APP.state.totalPages));
        
        const pageInfo = document.getElementById('pageInfo');
        if (pageInfo) pageInfo.textContent = `Página ${APP.state.currentPage} de ${APP.state.totalPages}`;
        if (APP.elements.resultsCount) APP.elements.resultsCount.textContent = totalFiltered;
        
        UI.updatePaginationButtons();
    },

    updatePaginationButtons() {
        if (APP.elements.prevBtn) APP.elements.prevBtn.disabled = APP.state.currentPage <= 1;
        if (APP.elements.nextBtn) APP.elements.nextBtn.disabled = APP.state.currentPage >= APP.state.totalPages;
    }
};

// =================================================================================
// 🔍 FILTROS Y ORDENACIÓN (ROBUSTO)
// =================================================================================
const Filters = {
    getFiltersFromForm() {
        const form = APP.elements.searchForm;
        if (!form) return {};
        const formData = new FormData(form);
        const filters = {};
        ['usuario', 'email', 'role', 'activo'].forEach(field => {
            const value = formData.get(field);
            if (value && value.trim() !== '') filters[field] = value.trim();
        });
        return filters;
    },

    sortTable(key) {
        const { currentSort } = APP.state;
        const direction = currentSort.key === key && currentSort.direction === 'asc' ? 'desc' : 'asc';

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
// 📄 EXPORTACIÓN (HttpOnly Cookie - SIN Bearer Token)
// =================================================================================
const Exportation = {
    formatDataForExport() {
        return APP.state.filteredUsers.map(u => ({
            "ID": u.id,
            "Usuario": u.usuario || '-',
            "Email": u.email || '-',
            "Rol": String(u.role || '-').toUpperCase(),
            "Estado": u.activo ? 'ACTIVO' : 'INACTIVO',
            "Creado": UI.formatDate(u.created_at),
            "Licencia": APP.state.licenciasMap.get(u.licencia_ref) || (u.licencia_ref === 0 ? 'Admin' : '-')
        }));
    },

    async handleExport(format) {
        if (!APP.state.filteredUsers.length) {
            UI.alertMessage("No hay datos para exportar", "error");
            return;
        }

        UI.alertMessage(`Generando reporte ${format.toUpperCase()}...`, "success");
        const payload = {
            reportName: `Reporte_Usuarios_${Date.now()}`,
            data: this.formatDataForExport()
        };

        try {
            const response = await fetch(`/api/v1/users/export/${format}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }, // ✅ Cookie HttpOnly se envía automáticamente
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Error ${response.status}`);
            }

            const result = await response.json();
            if (result.downloadURL) {
                UI.alertMessage("✅ Exportación completada", "success");
                window.open(result.downloadURL, '_blank');
            } else {
                throw new Error("No se generó URL de descarga");
            }
        } catch (error) {
            UI.alertMessage(`❌ Error: ${error.message}`, "error");
        }
    }
};

// =================================================================================
// 🌐 API SERVICES (HttpOnly Cookie + Manejo 401)
// =================================================================================
const API = {
    async loadLicenciasMap() {
        try {
            const response = await fetch('/api/v1/licencias');
            
            if (response.status === 401) {
                UI.alertMessage("Sesión caducada", "error");
                window.location.href = '/login';
                return;
            }
            
            if (!response.ok) return;

            const result = await response.json();
            const licencias = result.data || [];
            licencias.forEach(l => { 
                APP.state.licenciasMap.set(l.id, l.licencia); 
            });
            console.log(`✅ Licencias cargadas: ${licencias.length}`);
        } catch (error) { 
            console.error('Error licencias:', error); 
        }
    },

    async fetchAndFilterUsers() {
        const tbody = APP.elements.userResults;
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center py-10 italic animate-pulse">🔄 Sincronizando usuarios...</td></tr>';
        }

        try {
            const response = await fetch('/api/v1/users'); // ✅ Cookie HttpOnly automática

            if (response.status === 401) {
                UI.alertMessage("❌ Sesión caducada. Redirigiendo...", "error");
                setTimeout(() => window.location.href = '/login', 1500);
                return;
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const result = await response.json();
            APP.state.allUsers = result.data || result || [];
            
            console.log(`✅ Usuarios cargados: ${APP.state.allUsers.length}`);
            API.applyFilters();
        } catch (error) {
            console.error('Error usuarios:', error);
            UI.alertMessage("❌ Error de conexión con servidor", "error");
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="8" class="text-center py-10 text-red-600 font-bold">⚠️ SERVIDOR NO DISPONIBLE</td></tr>';
            }
        }
    },

    applyFilters() {
        const filters = Filters.getFiltersFromForm();
        APP.state.filteredUsers = APP.state.allUsers.filter(u => {
            if (filters.usuario && !u.usuario?.toLowerCase().includes(filters.usuario.toLowerCase())) return false;
            if (filters.email && !u.email?.toLowerCase().includes(filters.email.toLowerCase())) return false;
            if (filters.role && u.role !== filters.role) return false;
            if (filters.activo && filters.activo !== '' && String(u.activo) !== filters.activo) return false;
            return true;
        });
        
        APP.state.currentPage = 1;
        DOM.renderResults();
    }
};

// =================================================================================
// 🖼️ RENDER DOM (UI MEJORADA)
// =================================================================================
const DOM = {
    renderResults() {
        const tbody = APP.elements.userResults;
        if (!tbody) return;
        tbody.innerHTML = '';

        const start = (APP.state.currentPage - 1) * APP.state.pageSize;
        const pageData = APP.state.filteredUsers.slice(start, start + APP.state.pageSize);

        if (pageData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center py-12 text-gray-400 font-bold uppercase italic">📭 Sin usuarios encontrados</td></tr>';
            UI.updatePageInfo();
            return;
        }

        pageData.forEach(u => {
            const row = document.createElement('tr');
            row.className = 'hover:bg-orange-50/50 transition-all border-b border-gray-100';
            
            const licenciaVisual = APP.state.licenciasMap.get(u.licencia_ref) || 
                                 (u.licencia_ref === 0 ? 'Admin' : '---');

            row.innerHTML = `
                <td class="px-4 py-3 text-gray-400 font-bold text-xs">#${u.id}</td>
                <td class="px-4 py-3 font-black text-slate-800 uppercase text-xs">${u.usuario || '-'}</td>
                <td class="px-4 py-3 text-gray-600 text-xs">${u.email || '-'}</td>
                <td class="px-4 py-3"><span class="px-2 py-1 bg-slate-100 text-slate-700 text-[9px] font-black rounded uppercase">${u.role || '-'}</span></td>
                <td class="px-4 py-3 text-center">${UI.getBooleanHtml(u.activo)}</td>
                <td class="px-4 py-3 text-gray-500 text-xs">${UI.formatDate(u.created_at)}</td>
                <td class="px-4 py-3 font-bold text-blue-600 text-xs">${licenciaVisual}</td>
                <td class="px-4 py-3 text-center">
                    <div class="flex justify-center space-x-1">
                        <button onclick="handleUpdateUser(${u.id})" class="p-1.5 text-primary-link hover:bg-orange-100 rounded transition active:scale-90" title="Editar">
                            <i data-lucide="edit-3" class="w-4 h-4"></i>
                        </button>
                        <button onclick="handleDeleteUser(${u.id})" class="p-1.5 text-red-500 hover:bg-red-50 rounded transition active:scale-95" title="Desactivar">
                            <i data-lucide="user-minus" class="w-4 h-4"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });

        UI.updatePageInfo();
        if (window.lucide) lucide.createIcons();
    }
};

// =================================================================================
// 🎯 FUNCIONES GLOBALES
// =================================================================================
window.handleCreateUser = () => window.location.href = '/admin/usuarios/crear';
window.handleUpdateUser = (id) => window.location.href = `/admin/usuarios/update/${id}`;
window.handleDeleteUser = async (id) => {
    if (!confirm(`¿Desactivar usuario ID: ${id}?`)) return;
    try {
        const response = await fetch(`/api/v1/users/${id}`, { 
            method: 'DELETE'
            // ✅ Cookie HttpOnly automática
        });
        if (response.ok) {
            UI.alertMessage("✅ Usuario desactivado", "success");
            API.fetchAndFilterUsers();
        } else {
            throw new Error('Error del servidor');
        }
    } catch (e) {
        UI.alertMessage("❌ Error al desactivar", "error");
    }
};

window.handleSearch = (e) => { 
    if (e) e.preventDefault(); 
    API.applyFilters(); 
};

window.handleClearAllFilters = () => { 
    if (APP.elements.searchForm) APP.elements.searchForm.reset(); 
    window.handleSearch(); 
};

window.handleGeneratePDF = () => Exportation.handleExport('pdf');
window.handleGenerateXLSX = () => Exportation.handleExport('xlsx');
window.sortTable = (key) => Filters.sortTable(key);

// =================================================================================
// 🚀 INICIALIZACIÓN
// =================================================================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 admin_usuarios.js inicializando...');
    
    await Promise.all([
        API.loadLicenciasMap(),
        API.fetchAndFilterUsers()
    ]);

    // Pagination events
    if (APP.elements.prevBtn) {
        APP.elements.prevBtn.onclick = () => { 
            if (APP.state.currentPage > 1) { 
                APP.state.currentPage--; 
                DOM.renderResults(); 
            } 
        };
    }
    if (APP.elements.nextBtn) {
        APP.elements.nextBtn.onclick = () => { 
            if (APP.state.currentPage < APP.state.totalPages) { 
                APP.state.currentPage++; 
                DOM.renderResults(); 
            } 
        };
    }

    // Form events
    if (APP.elements.searchForm) {
        APP.elements.searchForm.onsubmit = window.handleSearch;
    }
    
    console.log('✅ admin_usuarios.js listo');
});
