/**
 * ARCHIVO: static/js/admin_titular.js
 * DESCRIPCIÓN: Gestión completa de Titulares con Borrado Lógico (Status).
 * ACTUALIZADO: 26/03/2026 - FIX: Soporte para Activar/Desactivar.
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
        currentSort: { key: 'licencia', direction: 'asc' }
    }
};

// =================================================================================
// 🎨 UI HELPERS
// =================================================================================
const UI_TIT = {
    alertMessage(message, type = 'info') {
        const { statusMessage } = APP.elements;
        if (!statusMessage) return;
        statusMessage.textContent = message;
        const border = type === 'success' ? 'border-green-500 text-green-600' : type === 'error' ? 'border-red-500 text-red-600' : 'border-blue-500 text-blue-600';
        statusMessage.className = `fixed bottom-5 right-5 z-[2000] p-4 rounded-xl shadow-2xl border-2 bg-white font-black text-xs uppercase tracking-widest transition-all duration-300 ${border}`;
        statusMessage.classList.remove('hidden');
        setTimeout(() => statusMessage.classList.add('hidden'), 4000);
    },

    updatePageControls() {
        const totalFiltered = APP.state.filteredTitulares.length;
        APP.state.totalPages = Math.ceil(totalFiltered / APP.state.pageSize) || 1;
        
        if (APP.elements.dynamicTitle) {
            APP.elements.dynamicTitle.textContent = `(${totalFiltered} titulares registrados)`;
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
                icon.innerHTML = `<i data-lucide="chevron-${direction === 'asc' ? 'up' : 'down'}" class="w-3 h-3 text-primary-link"></i>`;
            } else {
                icon.innerHTML = `<i data-lucide="chevrons-up-down" class="w-3 h-3 text-slate-300 opacity-30"></i>`;
            }
        });
        if (window.lucide) lucide.createIcons();
    }
};

// =================================================================================
// 📡 API ACTIONS
// =================================================================================
const API = {
    async loadAllTitulares() {
        APP.elements.resultsBody.innerHTML = '<tr><td colspan="10" class="p-20 text-center italic text-slate-400 font-bold uppercase animate-pulse">Sincronizando base de datos...</td></tr>';
        try {
            const token = localStorage.getItem('token');
            // Nota: El endpoint ahora está desprotegido en routes.go
            const response = await fetch('/api/v1/licencias', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const json = await response.json();
            const data = Array.isArray(json.data) ? json.data : (json || []);
            
            APP.state.allTitulares = data;
            APP.state.filteredTitulares = [...data];
            
            window.sortTable('licencia', true);
        } catch (error) {
            console.error(error);
            APP.elements.resultsBody.innerHTML = '<tr><td colspan="10" class="p-20 text-center text-red-500 font-bold uppercase">Error de conexión con el servidor</td></tr>';
        }
    }
};

// =================================================================================
// 🖼️ DOM RENDER
// =================================================================================
const DOM = {
    renderResults() {
        const { resultsBody } = APP.elements;
        if (!resultsBody) return;
        resultsBody.innerHTML = '';

        const start = (APP.state.currentPage - 1) * APP.state.pageSize;
        const pageData = APP.state.filteredTitulares.slice(start, start + APP.state.pageSize);

        if (pageData.length === 0) {
            resultsBody.innerHTML = '<tr><td colspan="10" class="p-20 text-center text-orange-500 font-bold uppercase">Sin registros que mostrar</td></tr>';
            UI_TIT.updatePageControls();
            return;
        }

        pageData.forEach(t => {
            const tr = document.createElement('tr');
            const isActive = t.estado === true || t.estado === 1;
            
            tr.className = `${isActive ? 'hover:bg-orange-50/30' : 'bg-red-50/20 grayscale-[0.5] opacity-80'} transition-colors border-b border-slate-50 text-[11px] group`;
            
            // Lógica del botón de borrado lógico / reactivación
            const statusBtn = isActive 
                ? `<button onclick="handleStatusActionTitular('${t.id}', '${t.nombre}', false)" class="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition" title="Desactivar"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>`
                : `<button onclick="handleStatusActionTitular('${t.id}', '${t.nombre}', true)" class="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition" title="Reactivar"><i data-lucide="check-circle" class="w-3.5 h-3.5"></i></button>`;

            tr.innerHTML = `
                <td class="p-4 font-black text-primary-link uppercase">${t.licencia || 'S/N'}</td>
                <td class="p-4 text-slate-500 font-bold">${t.dni || '-'}</td>
                <td class="p-4 text-slate-800 font-bold uppercase truncate">${t.nombre || '-'}</td>
                <td class="p-4 text-slate-500 italic truncate text-[10px]">${t.direccion || '-'}</td>
                <td class="p-4 text-slate-400 font-mono">${t.cp || '-'}</td>
                <td class="p-4 text-slate-600 font-bold">${t.telefono || '-'}</td>
                <td class="p-4 text-blue-500 truncate italic">${t.email || '-'}</td>
                <td class="p-4 text-center"><span class="${t.chofer ? 'text-green-500' : 'text-red-500'} font-black text-lg">●</span></td>
                <td class="p-4 text-center"><span class="${isActive ? 'text-green-500' : 'text-red-500'} font-black text-lg">●</span></td>
                <td class="p-4 text-center">
                    <div class="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onclick="handleViewActionTitular('${t.id}')" class="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition" title="Ver"><i data-lucide="eye" class="w-3.5 h-3.5"></i></button>
                        <button onclick="handleEditActionTitular('${t.id}')" class="p-1.5 text-orange-500 hover:bg-orange-50 rounded-lg transition" title="Editar"><i data-lucide="pencil" class="w-3.5 h-3.5"></i></button>
                        ${statusBtn}
                    </div>
                </td>`;
            resultsBody.appendChild(tr);
        });

        UI_TIT.updatePageControls();
        if (window.lucide) lucide.createIcons();
    }
};

// =================================================================================
// 🎯 ACTIONS & EVENTS
// =================================================================================

// --- CAMBIO DE STATUS (BORRADO LÓGICO / REACTIVACIÓN) ---
window.handleStatusActionTitular = async (id, nombre, nuevoEstado) => {
    const accion = nuevoEstado ? 'reactivar' : 'desactivar';
    if (!confirm(`¿Deseas ${accion} al titular: ${nombre}?`)) return;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/v1/licencias/status/${id}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ estado: nuevoEstado })
        });

        if (response.ok) {
            UI_TIT.alertMessage(`✅ Titular ${accion}ado con éxito`, 'success');
            await API.loadAllTitulares(); 
        } else {
            const err = await response.json();
            UI_TIT.alertMessage(`❌ Error: ${err.error || 'No autorizado'}`, 'error');
        }
    } catch (e) {
        UI_TIT.alertMessage('❌ Error de comunicación', 'error');
    }
};

// --- ORDENACIÓN ---
window.sortTable = (key, isInitial = false) => {
    if (!isInitial) {
        const dir = (APP.state.currentSort.key === key && APP.state.currentSort.direction === 'asc') ? 'desc' : 'asc';
        APP.state.currentSort = { key, direction: dir };
    }

    APP.state.filteredTitulares.sort((a, b) => {
        let vA = a[key] || "";
        let vB = b[key] || "";
        const comparison = vA.toString().localeCompare(vB.toString(), undefined, { numeric: true, sensitivity: 'base' });
        return APP.state.currentSort.direction === 'asc' ? comparison : -comparison;
    });

    APP.state.currentPage = 1;
    DOM.renderResults();
    UI_TIT.updateSortIcons();
};

// --- BÚSQUEDA ---
const Events = {
    handleSearch(e) {
        if (e) e.preventDefault();
        const formData = new FormData(APP.elements.searchForm);
        const fLicencia = (formData.get('licencia') || "").toLowerCase();
        const fDni = (formData.get('dni') || "").toLowerCase();
        const fNombre = (formData.get('nombre') || "").toLowerCase();
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
    }
};

// --- EXPORTACIONES ---
window.handleGeneratePDF = () => {
    const cleanData = APP.state.filteredTitulares.map(t => ({
        "Nº ALBARAN": t.licencia,
        "FECHA": new Date().toLocaleDateString(),
        "LICENCIA": t.licencia,
        "EMPRESA": t.nombre,
        "EXPEDIENTE": t.dni,
        "TOTAL": t.estado ? "ACTIVO" : "INACTIVO"
    }));
    Oficina.generarPDF("GESTION_TITULARES", cleanData);
};

window.handleGenerateXLSX = () => {
    const cleanData = APP.state.filteredTitulares.map(t => ({
        "LICENCIA": t.licencia,
        "DNI/CIF": t.dni,
        "NOMBRE": t.nombre,
        "ESTADO": t.estado ? "ACTIVO" : "INACTIVO",
        "TELÉFONO": t.telefono,
        "EMAIL": t.email
    }));
    Oficina.generarExcel("TITULARES", cleanData);
};

window.handleClearAllFilters = () => {
    APP.elements.searchForm.reset();
    APP.state.filteredTitulares = [...APP.state.allTitulares];
    window.sortTable('licencia', true);
};

// --- NAVEGACIÓN ---
window.handleViewActionTitular = (id) => window.location.href = `/admin/titulares/view/${id}`;
window.handleEditActionTitular = (id) => window.location.href = `/admin/titulares/update/${id}`;
window.handleCreateActionTitular = () => window.location.href = `/admin/titulares/crear`;
window.handleLogout = () => Oficina.logout();
window.Events = Events;

document.addEventListener('DOMContentLoaded', async () => {
    if (APP.elements.recordsSelect) {
        APP.elements.recordsSelect.onchange = (e) => {
            APP.state.pageSize = e.target.value === 'todos' ? 99999 : parseInt(e.target.value);
            APP.state.currentPage = 1;
            DOM.renderResults();
        };
    }
    APP.elements.prevBtn.onclick = () => { if (APP.state.currentPage > 1) { APP.state.currentPage--; DOM.renderResults(); } };
    APP.elements.nextBtn.onclick = () => { if (APP.state.currentPage < APP.state.totalPages) { APP.state.currentPage++; DOM.renderResults(); } };
    
    await API.loadAllTitulares();
});