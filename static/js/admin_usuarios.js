/**
 * admin_usuarios.js - Gestión del Listado de Usuarios (Panel Admin)
 * DESCRIPCIÓN: Maneja la lógica de filtrado, paginación dinámica y exportación.
 */

const APP = {
    elements: {
        userResults: document.getElementById('userResults'),
        searchForm: document.getElementById('searchForm'),
        resultsCount: document.getElementById('resultsCount'),
        prevBtn: document.getElementById('prevPageBtn'),
        nextBtn: document.getElementById('nextPageBtn'),
        statusMessage: document.getElementById('statusMessage'),
        pageSizeSelector: document.getElementById('pageSizeSelector'),
    },
    state: {
        allUsers: [],       // Datos originales del servidor
        filteredUsers: [], // Datos tras aplicar filtros
        currentPage: 1,
        pageSize: 10,
        totalPages: 1,
        currentSort: { key: 'id', direction: 'asc' },
        licenciasMap: new Map() // Mapeo ID -> Nombre de Licencia
    }
};

// =================================================================================
// 🎨 UI HELPERS
// =================================================================================
const UI = {
    formatDate: (iso) => iso ? iso.substring(0, 10) : '-',

    getBooleanHtml(value) {
        const isTrue = (value === true || value === 'true' || value === 1);
        return isTrue
            ? `<span class="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-black rounded-full border border-green-200">ACTIVO</span>`
            : `<span class="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-black rounded-full border border-red-200">INACTIVO</span>`;
    },

    alertMessage(message, type = 'info') {
        const sm = APP.elements.statusMessage;
        if (!sm) return;
        sm.textContent = message;
        sm.className = `fixed bottom-4 right-4 p-4 rounded-xl font-bold border-2 shadow-2xl z-50 transition-all ${
            type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
        }`;
        sm.classList.remove('hidden');
        setTimeout(() => sm.classList.add('hidden'), 4000);
    },

    updatePaginationUI() {
        const total = APP.state.filteredUsers.length;
        APP.state.totalPages = Math.ceil(total / APP.state.pageSize) || 1;
        
        // Ajuste de seguridad si la página actual excede el nuevo total
        if (APP.state.currentPage > APP.state.totalPages) APP.state.currentPage = APP.state.totalPages;
        if (APP.state.currentPage < 1) APP.state.currentPage = 1;

        const pageInfo = document.getElementById('pageInfo');
        if (pageInfo) pageInfo.textContent = `Página ${APP.state.currentPage} de ${APP.state.totalPages}`;
        if (APP.elements.resultsCount) APP.elements.resultsCount.textContent = total;
        
        APP.elements.prevBtn.disabled = APP.state.currentPage <= 1;
        APP.elements.nextBtn.disabled = APP.state.currentPage >= APP.state.totalPages;
    }
};

// =================================================================================
// 🌐 API SERVICES
// =================================================================================
const API = {
    async loadInitialData() {
        try {
            // 1. Cargar Licencias para el mapeo visual
            const resL = await fetch('/api/v1/licencias');
            if (resL.ok) {
                const data = await resL.json();
                (data.data || []).forEach(l => APP.state.licenciasMap.set(l.id, l.licencia));
            }

            // 2. Cargar Usuarios
            const resU = await fetch('/api/v1/users');
            if (!resU.ok) throw new Error("No se pudo obtener la lista de usuarios");

            const resultU = await resU.json();
            APP.state.allUsers = resultU.data || resultU || [];
            this.applyFilters();

        } catch (error) {
            console.error('❌ Error API:', error);
            APP.elements.userResults.innerHTML = `<tr><td colspan="7" class="text-center py-10 text-red-500 font-bold uppercase">Error de conexión con el servidor</td></tr>`;
        }
    },

    applyFilters() {
        const form = APP.elements.searchForm;
        if (!form) return;
        const formData = new FormData(form);
        
        const fUsu = formData.get('usuario')?.toLowerCase();
        const fRol = formData.get('role');

        APP.state.filteredUsers = APP.state.allUsers.filter(u => {
            if (fUsu && !u.usuario?.toLowerCase().includes(fUsu)) return false;
            if (fRol && u.role !== fRol) return false;
            return true;
        });
        
        APP.state.currentPage = 1; // Resetear a la primera página tras filtrar
        DOM.renderResults();
    }
};

// =================================================================================
// 🖼️ RENDER DOM
// =================================================================================
const DOM = {
    renderResults() {
        const tbody = APP.elements.userResults;
        if (!tbody) return;
        tbody.innerHTML = '';

        // Cálculo de paginación
        const start = (APP.state.currentPage - 1) * APP.state.pageSize;
        const end = start + APP.state.pageSize;
        const pageData = APP.state.filteredUsers.slice(start, end);

        if (pageData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center py-12 text-gray-400 font-bold italic uppercase">No se encontraron registros</td></tr>';
            UI.updatePaginationUI();
            return;
        }

        pageData.forEach(u => {
            const row = document.createElement('tr');
            row.className = 'hover:bg-orange-50/50 transition-all border-b border-gray-100';
            
            const licNombre = APP.state.licenciasMap.get(u.licencia_ref) || (u.licencia_ref === 0 ? 'Admin' : '---');

            row.innerHTML = `
                <td class="px-4 py-3 text-gray-400 font-mono text-xs">#${u.id}</td>
                <td class="px-4 py-3 font-black text-slate-800 uppercase text-xs">${u.usuario || '-'}</td>
                <td class="px-4 py-3 text-gray-600 text-xs">${u.email || '-'}</td>
                <td class="px-4 py-3"><span class="px-2 py-1 bg-slate-100 text-slate-700 text-[9px] font-black rounded uppercase">${u.role || '-'}</span></td>
                <td class="px-4 py-3 text-center">${UI.getBooleanHtml(u.activo)}</td>
                <td class="px-4 py-3 font-bold text-blue-600 text-xs">${licNombre}</td>
                <td class="px-4 py-3 text-center">
                    <div class="flex justify-center space-x-2">
                        <button onclick="handleUpdateUser(${u.id})" class="p-1.5 text-primary-link hover:bg-orange-100 rounded-lg transition" title="Editar">
                            <i data-lucide="edit-3" class="w-4 h-4"></i>
                        </button>
                        <button onclick="handleDeleteUser(${u.id})" class="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition" title="Borrar">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });

        UI.updatePaginationUI();
        if (window.lucide) lucide.createIcons();
    }
};

// =================================================================================
// 🎯 FUNCIONES GLOBALES Y EXPORTACIÓN
// =================================================================================

window.handlePageSizeChange = (size) => {
    APP.state.pageSize = parseInt(size);
    APP.state.currentPage = 1;
    DOM.renderResults();
};

window.handleSearch = (e) => { 
    if (e) e.preventDefault(); 
    API.applyFilters(); 
};

window.handleClearAllFilters = () => { 
    if (APP.elements.searchForm) APP.elements.searchForm.reset(); 
    API.applyFilters(); 
};

window.handleCreateUser = () => window.location.href = '/admin/usuarios/crear';
window.handleUpdateUser = (id) => window.location.href = `/admin/usuarios/update/${id}`;

window.handleDeleteUser = async (id) => {
    if (!confirm(`¿Desea eliminar el usuario ID: ${id}?`)) return;
    try {
        const res = await fetch(`/api/v1/users/${id}`, { method: 'DELETE' });
        if (res.ok) {
            UI.alertMessage("✅ Usuario procesado con éxito", "success");
            API.loadInitialData();
        }
    } catch (e) {
        UI.alertMessage("❌ Error en la operación", "error");
    }
};

window.sortTable = (key) => {
    const dir = APP.state.currentSort.direction === 'asc' ? 'desc' : 'asc';
    APP.state.currentSort = { key, direction: dir };
    APP.state.filteredUsers.sort((a, b) => {
        let vA = a[key] ?? '', vB = b[key] ?? '';
        if (typeof vA === 'string') vA = vA.toLowerCase();
        if (typeof vB === 'string') vB = vB.toLowerCase();
        return dir === 'asc' ? (vA > vB ? 1 : -1) : (vA < vB ? 1 : -1);
    });
    DOM.renderResults();
};

// --- EXPORTACIÓN CON OFICINA.JS ---

function getExportData() {
    return APP.state.filteredUsers.map(u => ({
        "ID": u.id,
        "Usuario": u.usuario || '-',
        "Email": u.email || '-',
        "Rol": (u.role || '').toUpperCase(),
        "Activo": u.activo ? 'SI' : 'NO',
        "Licencia": APP.state.licenciasMap.get(u.licencia_ref) || 'Admin'
    }));
}

window.handleGeneratePDF = () => {
    if (typeof Oficina !== 'undefined') {
        UI.alertMessage("Generando PDF...", "success");
        Oficina.generarPDF("USUARIOS_SISTEMA", getExportData());
    } else {
        UI.alertMessage("Error: Servicio de exportación no disponible", "error");
    }
};

window.handleGenerateXLSX = () => {
    if (typeof Oficina !== 'undefined') {
        UI.alertMessage("Generando Excel...", "success");
        Oficina.generarExcel("USUARIOS_SISTEMA", getExportData());
    } else {
        UI.alertMessage("Error: Servicio de exportación no disponible", "error");
    }
};

window.handleLogout = () => {
    fetch('/api/v1/logout', { method: 'POST' }).finally(() => {
        window.location.href = '/login';
    });
};

// =================================================================================
// 🚀 INICIALIZACIÓN
// =================================================================================
document.addEventListener('DOMContentLoaded', () => {
    API.loadInitialData();

    APP.elements.prevBtn.onclick = () => {
        if (APP.state.currentPage > 1) {
            APP.state.currentPage--;
            DOM.renderResults();
        }
    };

    APP.elements.nextBtn.onclick = () => {
        if (APP.state.currentPage < APP.state.totalPages) {
            APP.state.currentPage++;
            DOM.renderResults();
        }
    };
});