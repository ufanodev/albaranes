/**
 * busqueda.js - Panel de Usuario (Titular)
 */

const APP = {
    elements: {
        resultsBody: document.getElementById('albaranResults'),
        resultsCount: document.getElementById('resultsCount'),
        statusMessage: document.getElementById('statusMessage'),
        numLicenciaHeader: document.getElementById('num_licencia_header'),
        licenciaDisplay: document.getElementById('licencia_display'),
        licenciaInput: document.getElementById('licencia_ref'), 
        searchForm: document.getElementById('searchForm'),
        recordsSelect: document.getElementById('recordsPerPage'),
        pageInfo: document.getElementById('pageInfo'),
        prevBtn: document.getElementById('prevPageBtn'),
        nextBtn: document.getElementById('nextPageBtn'),
        activeFiltersCount: document.getElementById('activeFiltersCount'),
        empresaSelect: document.getElementById('empresa'),
        palabraInput: document.getElementById('palabra')
    },
    state: {
        filteredAlbaranes: [],
        currentPage: 1,
        pageSize: 10,
        totalPages: 1,
        userLicenciaId: null,
        userLicenciaNumero: null,
        currentSort: { key: 'fecha', direction: 'desc' }
    }
};

const UI = {
    formatDate(isoString) { return isoString ? isoString.substring(0, 10) : '-'; },
    alertMessage(message, type = 'info') {
        const s = APP.elements.statusMessage;
        if (!s) return;
        s.textContent = message;
        s.className = `status-message status-${type} block p-3 rounded mb-4 text-center border font-bold`;
        s.classList.remove('hidden');
        if (type !== 'error') setTimeout(() => s.classList.add('hidden'), 5000);
    },
    updatePageInfo() {
        const total = APP.state.filteredAlbaranes.length;
        APP.state.totalPages = Math.ceil(total / APP.state.pageSize) || 1;
        if (APP.elements.pageInfo) APP.elements.pageInfo.textContent = `Pág ${APP.state.currentPage} de ${APP.state.totalPages}`;
        if (APP.elements.resultsCount) APP.elements.resultsCount.textContent = total;
        this.updatePaginationButtons();
    },
    updatePaginationButtons() {
        const { prevBtn, nextBtn } = APP.elements;
        if(prevBtn) prevBtn.disabled = APP.state.currentPage <= 1;
        if(nextBtn) nextBtn.disabled = APP.state.currentPage >= APP.state.totalPages;
    }
};

// =================================================================================
// 📄 EXPORTATION LOGIC (Corregida para evitar Error 400)
// =================================================================================
const Exportation = {
    formatData() {
        // Importante: No enviar objetos complejos, solo strings/números planos
        return APP.state.filteredAlbaranes.map(a => ({
            "N_Albaran": String(a.numero_albaran || 'N/A'),
            "Fecha": UI.formatDate(a.fecha),
            "Empresa": String(a.EmpresaData?.nombre || 'N/A'),
            "Referencia": String(a.referencia || '-'),
            "Asalariado": String(a.asalariado || '-'),
            "Importe": String(parseFloat(a.importe_total || 0).toFixed(2)) + "€",
            "Estado": a.pagado ? 'PAGADO' : (a.enviado ? 'ENVIADO' : 'CREADO')
        }));
    },
    async handle(fmt) {
        if (!APP.state.filteredAlbaranes.length) {
            return UI.alertMessage("No hay datos para exportar", "info");
        }

        const payload = {
            reportName: `Reporte_Albaranes_${APP.state.userLicenciaNumero || 'User'}`,
            data: this.formatData()
        };

        UI.alertMessage(`Generando ${fmt.toUpperCase()}...`, "info");

        try {
            const response = await fetch(`/api/v1/albaranes/export/${fmt}`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(payload) 
            });

            const result = await response.json();

            if (response.ok && result.success) {
                UI.alertMessage("✅ Documento listo", "success");
                window.open(result.downloadURL, '_blank');
            } else {
                // Imprimimos el error exacto del servidor para corregir el 400
                console.error("Server Error Details:", result);
                throw new Error(result.error || result.message || "Fallo en formato");
            }
        } catch (error) {
            console.error("❌ EXPORT ERROR:", error);
            UI.alertMessage(`Error: ${error.message}`, "error");
        }
    }
};

const API = {
    async fetchMyLicencia() {
        try {
            const response = await fetch('/api/v1/user/licencia_info');
            const data = await response.json();
            if (data && data.licencia_id !== undefined) {
                APP.state.userLicenciaId = data.licencia_id;
                APP.state.userLicenciaNumero = data.licencia_numero || "S/N";
                if (APP.elements.numLicenciaHeader) APP.elements.numLicenciaHeader.textContent = APP.state.userLicenciaNumero;
                if (APP.elements.licenciaDisplay) APP.elements.licenciaDisplay.value = APP.state.userLicenciaNumero;
                if (APP.elements.licenciaInput) APP.elements.licenciaInput.value = data.licencia_id;
                return true;
            }
            return false;
        } catch (e) { return false; }
    },
    async loadEmpresas() {
        try {
            const r = await fetch('/api/v1/empresas');
            const d = await r.json();
            const list = d.data || d;
            if(APP.elements.empresaSelect) {
                APP.elements.empresaSelect.innerHTML = '<option value="">Todas las empresas</option>' + 
                    list.map(e => `<option value="${e.id}">${e.nombre}</option>`).join('');
            }
        } catch (e) { console.error(e); }
    },
    async searchAlbaranes() {
        if (APP.state.userLicenciaId === null) return;
        DOM.showLoading();
        const params = new URLSearchParams();
        params.append('licencia_ref', APP.state.userLicenciaId);
        const formData = new FormData(APP.elements.searchForm);
        for (let [key, value] of formData.entries()) {
            if (value && key !== 'licencia_ref') params.append(key, value);
        }
        try {
            const response = await fetch(`/api/v1/albaranes/search-user?${params.toString()}`);
            const data = await response.json();
            APP.state.filteredAlbaranes = data.data || [];
            APP.state.currentPage = 1;
            DOM.renderResults();
        } catch (e) { DOM.showNoResults(); }
    }
};

const DOM = {
    showLoading() { APP.elements.resultsBody.innerHTML = '<tr><td colspan="8" class="text-center py-10 italic">Buscando...</td></tr>'; },
    showNoResults() { APP.elements.resultsBody.innerHTML = '<tr><td colspan="8" class="text-center py-10 text-orange-500 font-bold">No se encontraron albaranes.</td></tr>'; },
    renderResults() {
        const { resultsBody } = APP.elements;
        if (!resultsBody) return;
        resultsBody.innerHTML = '';
        const start = (APP.state.currentPage - 1) * APP.state.pageSize;
        const pageData = APP.state.filteredAlbaranes.slice(start, start + APP.state.pageSize);
        if (pageData.length === 0) { this.showNoResults(); return; }
        pageData.forEach(a => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50 border-b border-gray-100 text-sm';
            tr.innerHTML = `
                <td class="px-4 py-3 font-bold">${a.numero_albaran || 'N/A'}</td>
                <td class="px-4 py-3">${UI.formatDate(a.fecha)}</td>
                <td class="px-4 py-3">${a.EmpresaData?.nombre || 'N/A'}</td>
                <td class="px-4 py-3">${a.referencia || '-'}</td>
                <td class="px-4 py-3">${a.asalariado || '-'}</td>
                <td class="px-4 py-3 text-right">${parseFloat(a.importe_total || 0).toFixed(2)}€</td>
                <td class="px-4 py-3 text-center">${this.getBadge(a)}</td>
                <td class="px-4 py-3 text-center">
                    <div class="flex justify-center space-x-2">
                        <button onclick="window.location.href='/titulares/view/${a.id}'" class="text-blue-600"><i data-lucide="eye" class="w-4 h-4"></i></button>
                        <button onclick="window.location.href='/titulares/update/${a.id}'" class="text-orange-600"><i data-lucide="pencil" class="w-4 h-4"></i></button>
                    </div>
                </td>`;
            resultsBody.appendChild(tr);
        });
        UI.updatePageInfo();
        if (window.lucide) lucide.createIcons();
    },
    getBadge(a) {
        if (a.pagado) return '<span class="text-green-700 font-bold">PAGADO</span>';
        if (a.enviado) return '<span class="text-blue-700 font-bold">ENVIADO</span>';
        return '<span class="text-gray-600 font-bold">CREADO</span>';
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    const hasLicense = await API.fetchMyLicencia();
    if (!hasLicense) return;
    await API.loadEmpresas();
    API.searchAlbaranes();
    if (APP.elements.prevBtn) APP.elements.prevBtn.onclick = () => { if (APP.state.currentPage > 1) { APP.state.currentPage--; DOM.renderResults(); } };
    if (APP.elements.nextBtn) APP.elements.nextBtn.onclick = () => { if (APP.state.currentPage < APP.state.totalPages) { APP.state.currentPage++; DOM.renderResults(); } };
});

window.handleSearch = (e) => { e.preventDefault(); API.searchAlbaranes(); };
window.handleGeneratePDF = () => Exportation.handle('pdf');
window.handleGenerateXLSX = () => Exportation.handle('xlsx');
window.handleAction = () => { UI.alertMessage("Documento a Word", "success"); setTimeout(() => { window.location.href = '/titulares'; }, 2000); };
window.handleLogout = async () => { await fetch('/api/v1/logout', { method: 'POST' }); window.location.href = '/login'; };