/**
 * ARCHIVO: static/js/admin.js
 * DESCRIPCIÓN: Gestión maestra de albaranes para el Administrador (admin.html).
 * ACTUALIZADO: 21/03/2026 - FIX: Mapeo avanzado de Nombres de Empresa y Licencia.
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
        currentSort: { key: 'fecha', direction: 'desc' },
        // Diccionarios para traducción de IDs a Nombres
        catalogos: {
            empresas: {},
            licencias: {}
        }
    }
};

// =================================================================================
// 🎨 UI HELPERS
// =================================================================================
const UI = {
    formatDate(iso) { 
        if (!iso || iso.startsWith('0001')) return '-';
        const d = new Date(iso);
        return isNaN(d.getTime()) ? iso.substring(0, 10) : d.toLocaleDateString('es-ES'); 
    },

    alertMessage(message, type = 'info') {
        const s = APP.elements.statusMessage;
        if (!s) return;
        s.textContent = message;
        const bgClass = type === 'success' ? 'bg-green-100 border-green-500 text-green-700' : 
                        type === 'error' ? 'bg-red-100 border-red-500 text-red-700' : 
                        'bg-blue-100 border-blue-500 text-blue-700';
        s.className = `status-message ${bgClass} block p-4 rounded-xl shadow-2xl border-2 font-bold fixed bottom-5 right-5 z-[2000]`;
        s.classList.remove('hidden');
        setTimeout(() => s.classList.add('hidden'), 5000);
    },

    updatePageInfo() {
        const total = APP.state.filteredAlbaranes.length;
        APP.state.totalPages = Math.ceil(total / APP.state.pageSize) || 1;
        if (APP.elements.pageInfo) APP.elements.pageInfo.textContent = `${APP.state.currentPage} / ${APP.state.totalPages}`;
        if (APP.elements.resultsCount) APP.elements.resultsCount.textContent = total;
        if (APP.elements.prevBtn) APP.elements.prevBtn.disabled = APP.state.currentPage <= 1;
        if (APP.elements.nextBtn) APP.elements.nextBtn.disabled = APP.state.currentPage >= APP.state.totalPages;
    },

    updateSortIcons() {
        document.querySelectorAll('[id^="sort-icon-"]').forEach(span => {
            span.innerHTML = '↕';
            span.className = 'ml-1 opacity-30 italic';
        });
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
            const list = Array.isArray(result) ? result : (result.data || []);
            list.forEach(l => APP.state.catalogos.licencias[l.id] = l.licencia);
            
            if (APP.elements.licenciaSelect) {
                let html = '<option value="">🆔 TODAS LAS LICENCIAS</option>';
                html += list.sort((a,b) => String(a.licencia).localeCompare(String(b.licencia), undefined, {numeric:true}))
                            .map(l => `<option value="${l.id}">${String(l.licencia).toUpperCase()}</option>`).join('');
                APP.elements.licenciaSelect.innerHTML = html;
            }
        } catch (e) { console.error("Error licencias:", e); }
    },

    async loadEmpresas() {
        try {
            const r = await fetch('/api/v1/empresas', { headers: this.getHeaders() });
            const result = await r.json();
            const list = Array.isArray(result) ? result : (result.data || []);
            // Guardar en el diccionario local para traducción rápida
            list.forEach(e => APP.state.catalogos.empresas[e.id] = e.nombre);

            if (APP.elements.empresaSelect) {
                let html = '<option value="">📋 TODAS LAS EMPRESAS</option>';
                html += list.sort((a,b) => String(a.nombre).localeCompare(String(b.nombre)))
                            .map(e => `<option value="${e.id}">${String(e.nombre).toUpperCase()}</option>`).join('');
                APP.elements.empresaSelect.innerHTML = html;
            }
        } catch (e) { console.error("Error empresas:", e); }
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
            switch(key) {
                case 'licencia':
                    vA = a.LicenciaData?.licencia || APP.state.catalogos.licencias[a.licencia_ref] || "";
                    vB = b.LicenciaData?.licencia || APP.state.catalogos.licencias[b.licencia_ref] || "";
                    break;
                case 'empresa_nombre':
                    vA = a.EmpresaData?.nombre || a.empresa_nombre || APP.state.catalogos.empresas[a.empresa_ref] || "";
                    vB = b.EmpresaData?.nombre || b.empresa_nombre || APP.state.catalogos.empresas[b.empresa_ref] || "";
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
                    vA = String(a[key] || "").toLowerCase();
                    vB = String(b[key] || "").toLowerCase();
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

            // --- LÓGICA DE TRADUCCIÓN DE IDs A NOMBRES ---
            
            // 1. Empresa: Prioridad 1: Objeto anidado | Prioridad 2: Nombre guardado | Prioridad 3: Buscar ID en catálogo local
            let txtEmpresa = a.EmpresaData?.nombre || a.empresa_nombre || "-";
            // Si el nombre guardado es un número (ID), intentamos traducirlo con nuestro catálogo local
            if (!isNaN(txtEmpresa) || txtEmpresa === "-" || txtEmpresa.includes("ID:")) {
                txtEmpresa = APP.state.catalogos.empresas[a.empresa_ref] || txtEmpresa;
            }

            // 2. Licencia: Lo mismo para la licencia
            let txtLicencia = a.LicenciaData?.licencia || a.licencia || "-";
            if (!isNaN(txtLicencia) || txtLicencia === "-") {
                txtLicencia = APP.state.catalogos.licencias[a.licencia_ref] || txtLicencia;
            }

            const txtExpediente = a.referencia || "-";
            const txtFactura = a.num_factura || "-";

            const tr = document.createElement('tr');
            tr.className = 'hover:bg-orange-50/40 transition-colors text-[11px] group';
            
            tr.innerHTML = `
                <td class="px-4 py-3 font-bold text-slate-900">${a.numero_albaran || 'N/A'}</td>
                <td class="px-4 py-3 font-bold text-slate-500">${UI.formatDate(a.fecha)}</td>
                <td class="px-4 py-3 font-black text-blue-600 uppercase tracking-tighter">${txtLicencia}</td>
                <td class="px-4 py-3 text-slate-700 font-bold uppercase truncate" title="${txtEmpresa}">${txtEmpresa}</td>
                <td class="px-4 py-3 text-slate-400 italic uppercase text-[9px] font-black">${txtExpediente}</td>
                <td class="px-4 py-3 text-gray-500 font-medium">${txtFactura}</td>
                <td class="px-4 py-3 font-black text-right text-primary-link bg-orange-50/30">€${importe.toFixed(2)}</td>
                <td class="px-4 py-3 text-center">
                    ${a.enviado ? '<i data-lucide="check-circle" class="w-3.5 h-3.5 text-green-500 mx-auto"></i>' : '<i data-lucide="circle" class="w-3.5 h-3.5 text-slate-200 mx-auto"></i>'}
                </td>
                <td class="px-4 py-3 text-center">
                    ${a.cobrado ? '<i data-lucide="check-circle" class="w-3.5 h-3.5 text-green-500 mx-auto"></i>' : '<i data-lucide="circle" class="w-3.5 h-3.5 text-slate-200 mx-auto"></i>'}
                </td>
                <td class="px-4 py-3 text-center">
                    ${a.pagado ? '<i data-lucide="check-circle" class="w-3.5 h-3.5 text-green-500 mx-auto"></i>' : '<i data-lucide="circle" class="w-3.5 h-3.5 text-slate-200 mx-auto"></i>'}
                </td>
                <td class="px-4 py-3 text-gray-500 truncate" title="${a.observaciones || ''}">${a.observaciones || '-'}</td>
                <td class="px-4 py-3 text-center">
                    <div class="flex justify-center gap-1">
                        <button onclick="window.location.href='/admin/albaranes/view/${a.id}'" class="p-1.5 text-blue-500 hover:bg-blue-100 rounded transition" title="Ver Detalle"><i data-lucide="eye" class="w-3.5 h-3.5"></i></button>
                        <button onclick="window.location.href='/admin/albaranes/update/${a.id}'" class="p-1.5 text-orange-500 hover:bg-orange-100 rounded transition" title="Editar"><i data-lucide="pencil" class="w-3.5 h-3.5"></i></button>
                        <button onclick="window.location.href='/admin/albaranes/copiar/${a.id}'" class="p-1.5 text-purple-600 hover:bg-purple-100 rounded transition" title="Clonar"><i data-lucide="copy" class="w-3.5 h-3.5"></i></button>
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
    if (!confirm("¿Eliminar este albarán permanentemente del sistema?")) return;
    try {
        const res = await fetch(`/api/v1/albaranes/${id}`, { method: 'DELETE', headers: API.getHeaders() });
        if (res.ok) {
            UI.alertMessage("✅ Albarán eliminado correctamente", "success");
            API.searchAlbaranes();
        } else {
            UI.alertMessage("❌ Error al eliminar", "error");
        }
    } catch (e) { console.error(e); }
};

window.handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
};

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Cargar diccionarios (Crucial para traducir IDs a Nombres)
    await Promise.all([API.loadLicencias(), API.loadEmpresas()]);

    if (APP.elements.recordsSelect) {
        APP.elements.recordsSelect.onchange = (e) => {
            APP.state.pageSize = e.target.value === 'todos' ? 99999 : parseInt(e.target.value);
            APP.state.currentPage = 1;
            DOM.renderResults();
        };
    }
    
    if(APP.elements.prevBtn) APP.elements.prevBtn.onclick = () => { if (APP.state.currentPage > 1) { APP.state.currentPage--; DOM.renderResults(); } };
    if(APP.elements.nextBtn) APP.elements.nextBtn.onclick = () => { if (APP.state.currentPage < APP.state.totalPages) { APP.state.currentPage++; DOM.renderResults(); } };

    API.searchAlbaranes();
});