/**
 * albaran_pendiente.js
 * Filtrado: enviado=0, cobrado=0, pagado=0
 * Incluye: PDF, Excel, Selección masiva y Actualización a Enviado
 */

(function() {
    let localData = []; // Aquí se guardan los 24 registros
    let page = 1;
    let size = 10;
    let licId = null;

    async function startApp() {
        console.log('🚀 [PENDIENTES] Iniciando lógica completa...');
        try {
            const resp = await fetch('/api/v1/user/licencia_info');
            const identity = await resp.json();
            licId = identity.licencia_id;
        } catch (e) { return; }

        // Eventos UI
        document.getElementById('recordsPerPage')?.addEventListener('change', (e) => {
            size = e.target.value === 'todos' ? localData.length : parseInt(e.target.value);
            page = 1;
            render();
        });

        document.getElementById('prevPageBtn')?.addEventListener('click', () => {
            if (page > 1) { page--; render(); }
        });

        document.getElementById('nextPageBtn')?.addEventListener('click', () => {
            if (page < Math.ceil(localData.length / (size || 1))) { page++; render(); }
        });

        document.getElementById('selectAll')?.addEventListener('change', (e) => {
            const checkboxes = document.querySelectorAll('.select-albaran');
            checkboxes.forEach(cb => cb.checked = e.target.checked);
        });

        await fetchData();
    }

    async function fetchData() {
        const body = document.getElementById('albaranResults');
        if (!body) return;
        try {
            const response = await fetch(`/api/v1/albaranes/search-user?licencia_ref=${licId}&page=1&pageSize=2000`);
            const json = await response.json();
            const items = json.data || [];

            // FILTRO MYSQL: enviado=0, cobrado=0, pagado=0
            localData = items.filter(i => i.enviado === false && i.cobrado === false && i.pagado === false);
            render();
        } catch (error) {
            body.innerHTML = `<tr><td colspan="11" class="text-center py-6 text-red-500 font-bold">Error de conexión</td></tr>`;
        }
    }

    function render() {
        const body = document.getElementById('albaranResults');
        const foot = document.getElementById('albaranTotal');
        if (!body) return;

        if (document.getElementById('selectAll')) document.getElementById('selectAll').checked = false;

        body.innerHTML = '';
        const startIdx = (page - 1) * size;
        const pageItems = localData.slice(startIdx, startIdx + size);

        if (pageItems.length === 0) {
            body.innerHTML = `<tr><td colspan="11" class="text-center py-12 text-gray-500 italic">No hay registros pendientes.</td></tr>`;
            if (foot) foot.innerHTML = '';
            return;
        }

        let sumaTotal = 0;
        pageItems.forEach(item => {
            const imp = parseFloat(item.importe_total || 0);
            sumaTotal += imp;
            body.insertAdjacentHTML('beforeend', `
                <tr class="hover:bg-primary-pastel/10 transition border-b border-gray-100">
                    <td class="px-4 py-3 text-center"><input type="checkbox" value="${item.id}" class="select-albaran w-4 h-4 rounded"></td>
                    <td class="px-4 py-3 font-black text-gray-900">${item.numero_albaran || '-'}</td>
                    <td class="px-4 py-3 text-gray-500 text-xs">${item.fecha ? item.fecha.substring(0, 10) : '-'}</td>
                    <td class="px-4 py-3 text-secondary-blue font-bold">${item.licencia || '-'}</td>
                    <td class="px-4 py-3 font-medium text-gray-700">${item.empresa_nombre || '-'}</td>
                    <td class="px-4 py-3 text-gray-500 italic text-xs">${item.referencia || '-'}</td>
                    <td class="px-4 py-3 text-gray-600">${item.asalariado || 'Titular'}</td>
                    <td class="px-4 py-3 text-right font-black">€${imp.toFixed(2)}</td>
                    <td class="px-4 py-3 text-xs"><span class="px-2 py-1 bg-blue-100 text-blue-800 text-[10px] font-black rounded uppercase">Pendiente</span></td>
                    <td class="px-4 py-3 text-[11px] text-gray-400 truncate max-w-[150px] italic">${item.observaciones || '-'}</td>
                    <td class="px-4 py-3 text-center">
                        <div class="flex justify-center gap-3">
                            <a href="/titulares/view/${item.id}" class="text-secondary-blue hover:scale-125 transition-transform"><i data-lucide="eye" class="w-4 h-4"></i></a>
                            <a href="/titulares/update/${item.id}" class="text-primary-link hover:scale-125 transition-transform"><i data-lucide="pencil" class="w-4 h-4"></i></a>
                        </div>
                    </td>
                </tr>`);
        });

        if (foot) {
            foot.innerHTML = `<tr class="bg-gray-50 font-black border-t-2 border-gray-200">
                <td colspan="7" class="px-4 py-4 text-right text-gray-600 text-xs uppercase tracking-widest">Suma Página:</td>
                <td class="px-4 py-4 text-right text-lg text-primary-link font-black">€${sumaTotal.toFixed(2)}</td>
                <td colspan="3"></td></tr>`;
        }

        if (window.lucide) lucide.createIcons();
        document.getElementById('pageInfo').textContent = `Página ${page} de ${Math.ceil(localData.length / size) || 1}`;
        document.getElementById('totalLabel').textContent = `${localData.length} albaranes encontrados`;
        document.getElementById('prevPageBtn').disabled = (page === 1);
        document.getElementById('nextPageBtn').disabled = (page === Math.ceil(localData.length / size));
    }

    document.addEventListener('DOMContentLoaded', startApp);

    // =================================================================================
    // 📥 EXPORTACIONES REALES
    // =================================================================================

    window.handleGeneratePDF = () => {
        if (localData.length === 0) return;
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('l', 'pt', 'a4');
        const rows = localData.map(i => [i.numero_albaran, i.fecha.substring(0,10), i.licencia, i.empresa_nombre, i.referencia, i.asalariado || 'Titular', parseFloat(i.importe_total).toFixed(2) + '€']);
        doc.setFontSize(16); doc.text("Albaranes Pendientes", 40, 30);
        doc.autoTable({ head: [['Albarán', 'Fecha', 'Licencia', 'Empresa', 'Referencia', 'Conductor', 'Total']], body: rows, startY: 50, headStyles: { fillColor: [255, 140, 0] }, styles: { fontSize: 8 }});
        doc.save("Listado_Pendientes.pdf");
    };

    window.handleGenerateXLSX = () => {
        if (localData.length === 0) return;
        const ws = XLSX.utils.json_to_sheet(localData.map(i => ({ Albaran: i.numero_albaran, Fecha: i.fecha.substring(0,10), Empresa: i.empresa_nombre, Referencia: i.referencia, Importe: i.importe_total })));
        const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Albaranes");
        XLSX.writeFile(wb, "Listado_Pendientes.xlsx");
    };

    window.handleEnviarSeleccionados = async () => {
        const ids = Array.from(document.querySelectorAll('.select-albaran:checked')).map(cb => cb.value);
        if (ids.length === 0) return window.handleAction('Aviso', 'Selecciona al menos un albarán.');
        if (!confirm(`¿Enviar ${ids.length} albaranes?`)) return;

        window.handleAction('Procesando', `Actualizando albaranes...`);
        for (const id of ids) {
            await fetch(`/api/v1/albaranes/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enviado: true }) });
        }
        window.location.reload();
    };

    window.handleAction = (a, m) => {
        const modal = document.getElementById('actionModal');
        document.getElementById('modalTitle').textContent = a;
        document.getElementById('modalBody').textContent = m;
        modal.classList.remove('hidden'); modal.classList.add('flex');
    };
    window.handleActionModal = () => document.getElementById('actionModal').classList.add('hidden');

})();