/**
 * albaran_enviado.js
 * Filtrado estricto: Solo registros con enviado = true (1 en MySQL)
 */
(function() {
    let localData = [];
    let page = 1;
    let size = 20;
    let licId = null;
    let sortCol = 'fecha';
    let sortDir = 'desc';

    async function start() {
        console.log('🚀 [ENVIADOS] Iniciando módulo aislado...');
        
        try {
            const resp = await fetch('/api/v1/user/licencia_info');
            const identity = await resp.json();
            licId = identity.licencia_id;
        } catch (e) { return; }

        // Eventos UI
        document.getElementById('recordsPerPage')?.addEventListener('change', (e) => {
            size = e.target.value === 'todos' ? localData.length : parseInt(e.target.value);
            page = 1;
            draw();
        });

        document.getElementById('prevPageBtn')?.addEventListener('click', () => {
            if (page > 1) { page--; draw(); }
        });

        document.getElementById('nextPageBtn')?.addEventListener('click', () => {
            if (page < Math.ceil(localData.length / size)) { page++; draw(); }
        });

        await load();
    }

    async function load() {
        const body = document.getElementById('albaranResults');
        if (!body) return;

        body.innerHTML = `<tr><td colspan="10" class="text-center py-10"><div class="animate-spin h-8 w-8 border-4 border-primary-link border-t-transparent rounded-full mx-auto"></div></td></tr>`;

        try {
            const response = await fetch(`/api/v1/albaranes/search-user?licencia_ref=${licId}&page=1&pageSize=2000`);
            const json = await response.json();
            const items = json.data || [];

            // 🎯 FILTRO ESTRICTO: Solo los que ya han sido enviados
            localData = items.filter(i => i.enviado === true);

            console.log(`📊 Encontrados ${localData.length} albaranes enviados.`);
            
            // Ordenación inicial
            sortData(sortCol, sortDir);
            draw();
        } catch (error) {
            body.innerHTML = `<tr><td colspan="10" class="text-center py-6 text-red-500 font-bold">Error de conexión</td></tr>`;
        }
    }

    function sortData(col, dir) {
        localData.sort((a, b) => {
            let valA = a[col] || '';
            let valB = b[col] || '';
            
            if (col === 'importe_total') {
                valA = parseFloat(valA); valB = parseFloat(valB);
            }
            
            if (valA < valB) return dir === 'asc' ? -1 : 1;
            if (valA > valB) return dir === 'asc' ? 1 : -1;
            return 0;
        });
    }

    function draw() {
        const body = document.getElementById('albaranResults');
        const foot = document.getElementById('albaranTotal');
        if (!body) return;

        body.innerHTML = '';
        const startIdx = (page - 1) * size;
        const pageItems = localData.slice(startIdx, startIdx + size);

        if (pageItems.length === 0) {
            body.innerHTML = `<tr><td colspan="10" class="text-center py-12 text-gray-400 font-bold italic">No hay albaranes enviados todavía.</td></tr>`;
            if(foot) foot.innerHTML = '';
            return;
        }

        let sumaTotal = 0;
        pageItems.forEach(item => {
            const imp = parseFloat(item.importe_total || 0);
            sumaTotal += imp;
            
            // Lógica de etiqueta de estado
            let statusBadge = '<span class="px-2 py-1 bg-blue-100 text-blue-800 rounded text-[10px] font-black uppercase">Enviado</span>';
            if (item.pagado || item.cobrado) {
                statusBadge = '<span class="px-2 py-1 bg-green-100 text-green-800 rounded text-[10px] font-black uppercase">Pagado</span>';
            }
            if (item.finalizado) {
                statusBadge = '<span class="px-2 py-1 bg-purple-100 text-purple-800 rounded text-[10px] font-black uppercase">Finalizado</span>';
            }

            body.insertAdjacentHTML('beforeend', `
                <tr class="hover:bg-primary-pastel/10 transition border-b border-gray-100">
                    <td class="px-4 py-3 font-black text-gray-900">${item.numero_albaran || '-'}</td>
                    <td class="px-4 py-3 text-gray-500 text-xs">${item.fecha ? item.fecha.substring(0, 10) : '-'}</td>
                    <td class="px-4 py-3 text-secondary-blue font-bold">${item.licencia || '-'}</td>
                    <td class="px-4 py-3 text-gray-700">${item.empresa_nombre || '-'}</td>
                    <td class="px-4 py-3 text-gray-500 italic text-xs">${item.referencia || '-'}</td>
                    <td class="px-4 py-3 text-gray-600">${item.asalariado || 'Titular'}</td>
                    <td class="px-4 py-3 text-right font-black">€${imp.toFixed(2)}</td>
                    <td class="px-4 py-3 text-center">${statusBadge}</td>
                    <td class="px-4 py-3 text-xs text-gray-400 truncate max-w-[150px] italic" title="${item.observaciones || ''}">${item.observaciones || '-'}</td>
                    <td class="px-4 py-3 text-center">
                        <div class="flex justify-center gap-3">
                            <a href="/titulares/view/${item.id}" class="text-secondary-blue hover:scale-125 transition-transform"><i data-lucide="eye" class="w-4 h-4"></i></a>
                        </div>
                    </td>
                </tr>`);
        });

        if (foot) {
            foot.innerHTML = `
                <tr class="bg-gray-50 font-black border-t-2 border-gray-200">
                    <td colspan="6" class="px-4 py-4 text-right text-gray-600 uppercase text-xs">Suma Página:</td>
                    <td class="px-4 py-4 text-right text-lg text-primary-link">€${sumaTotal.toFixed(2)}</td>
                    <td colspan="3"></td>
                </tr>`;
        }

        if (window.lucide) lucide.createIcons();
        
        // UI Paginación
        const totalP = Math.ceil(localData.length / size) || 1;
        document.getElementById('pageInfo').textContent = `Página ${page} de ${totalP}`;
        document.getElementById('totalLabel').textContent = `${localData.length} enviados encontrados`;
        document.getElementById('prevPageBtn').disabled = (page === 1);
        document.getElementById('nextPageBtn').disabled = (page === totalP);
    }

    // Ordenación desde el HTML
    window.sortTable = (col) => {
        if (sortCol === col) sortDir = (sortDir === 'asc' ? 'desc' : 'asc');
        else { sortCol = col; sortDir = 'asc'; }
        sortData(sortCol, sortDir);
        draw();
    };

    document.addEventListener('DOMContentLoaded', start);
})();

// Funciones globales (PDF, Excel, Logout)
window.handleGeneratePDF = () => window.print();
window.handleGenerateXLSX = () => alert("Exportando enviados a Excel...");
window.handleActionModal = (show) => document.getElementById('actionModal')?.classList.toggle('hidden', !show);