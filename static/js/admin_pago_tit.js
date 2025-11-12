// =================================================================================
// 📚 FUNCIONES PRINCIPALES
// =================================================================================

function cargarDatosTabla() {
    const dummyData = [
        { id: 1, num_pago: 'PAGO-001', num_albaran: 'ALB-2025-801', licencia: '77', fecha: '2025-01-02', empresa: 'RACE', referencia: 'REF-001', importe: '150.00', cobrado: 'No', fecha_cobro: '', observaciones: '' },
        { id: 2, num_pago: 'PAGO-002', num_albaran: 'ALB-2025-802', licencia: '15', fecha: '2025-01-03', empresa: 'Mapfre', referencia: 'REF-002', importe: '180.50', cobrado: 'No', fecha_cobro: '', observaciones: '' },
        { id: 3, num_pago: 'PAGO-003', num_albaran: 'ALB-2025-803', licencia: '21', fecha: '2025-01-05', empresa: 'Mutua Madrileña', referencia: 'REF-003', importe: '220.00', cobrado: 'No', fecha_cobro: '', observaciones: '' },
        { id: 4, num_pago: 'PAGO-004', num_albaran: 'ALB-2025-804', licencia: '45', fecha: '2025-01-06', empresa: 'RACE', referencia: 'REF-004', importe: '195.25', cobrado: 'No', fecha_cobro: '', observaciones: '' },
        { id: 5, num_pago: 'PAGO-005', num_albaran: 'ALB-2025-805', licencia: '88', fecha: '2025-01-08', empresa: 'Mapfre', referencia: 'REF-005', importe: '210.75', cobrado: 'No', fecha_cobro: '', observaciones: '' },
    ];

    const tableBody = document.getElementById('albaranResults');
    tableBody.innerHTML = '';

    dummyData.forEach(item => {
        const cobradoClase = item.cobrado === 'Sí' ? 'bg-green-100 text-green-800' : 'bg-red-400 text-white';
        const row = document.createElement('tr');
        row.dataset.rowId = item.id;
        row.dataset.editing = false;
        row.classList.add('hover:bg-primary-pastel/30', 'transition-all', 'duration-300');

        row.innerHTML = `
            <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-center flex flex-col items-center gap-2">
                <button title="Editar / Guardar" onclick="toggleRowEdit(${item.id})" class="toggle-edit-btn p-1 rounded-full text-gray-500 hover:text-primary-link transition duration-150">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                    </svg>
                </button>
                <button title="Guardar Cambios" onclick="saveRow(${item.id})" class="save-btn-${item.id} p-1 rounded-full text-green-600 hover:text-green-800 hidden">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                    </svg>
                </button>
                <button title="Cancelar Edición" onclick="cancelRowEdit(${item.id})" class="cancel-btn-${item.id} p-1 rounded-full text-red-600 hover:text-red-800 hidden">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </td>
            <td class="px-4 py-3 text-sm text-gray-700">${item.num_pago}</td>
            <td class="px-4 py-3 text-sm text-gray-700">${item.num_albaran}</td>
            <td class="px-4 py-3 text-sm text-gray-700">${item.licencia}</td>
            <td class="px-4 py-3 text-sm text-gray-700 fecha-col">${item.fecha}</td>
            <td class="px-4 py-3 text-sm text-gray-700">${item.empresa}</td>
            <td class="px-4 py-3 text-sm text-gray-700">${item.referencia}</td>
            <td class="px-4 py-3 text-sm font-bold text-primary-link text-right">€${item.importe}</td>
            <td class="px-4 py-3 text-sm text-center">
                <span class="cobrado-display-${item.id} inline-flex leading-5 font-semibold rounded-full ${cobradoClase}">${item.cobrado}</span>
                <select class="cobrado-input-${item.id} input-field hidden w-16 mx-auto text-sm">
                    <option value="No">No</option>
                    <option value="Sí" ${item.cobrado === 'Sí' ? 'selected' : ''}>Sí</option>
                </select>
            </td>
            <td class="px-4 py-3 text-sm fecha-cobro-col">
                <span class="fecha-cobro-display-${item.id} text-gray-500">${item.fecha_cobro || '-'}</span>
                <input type="date" class="fecha-cobro-input-${item.id} input-field hidden w-32 text-sm" value="${item.fecha_cobro}">
            </td>
            <td class="px-4 py-3 text-sm observaciones-col">
                <span class="obs-display-${item.id} text-gray-500 truncate max-w-xs block">${item.observaciones || '-'}</span>
                <textarea class="obs-input-${item.id} input-field hidden text-sm" maxlength="100" rows="2">${item.observaciones}</textarea>
            </td>
        `;

        tableBody.appendChild(row);
    });
}

// =================================================================================
// ⚙️ EDICIÓN / GUARDADO / CANCELAR CON AJUSTE DE ANCHO
// =================================================================================

function toggleRowEdit(rowId) {
    const row = document.querySelector(`tr[data-row-id="${rowId}"]`);
    const isEditing = row.dataset.editing === 'true';
    row.dataset.editing = !isEditing;

    // Botones
    const btnEdit = row.querySelector('.toggle-edit-btn');
    const btnSave = row.querySelector(`.save-btn-${rowId}`);
    const btnCancel = row.querySelector(`.cancel-btn-${rowId}`);

    // Campos a mostrar / ocultar
    const fields = ['cobrado', 'fecha-cobro', 'obs'];
    fields.forEach(f => {
        const display = row.querySelector(`.${f}-display-${rowId}`);
        const input = row.querySelector(`.${f}-input-${rowId}`);
        display.classList.toggle('hidden', !isEditing);
        input.classList.toggle('hidden', isEditing);
    });

    btnEdit.classList.toggle('hidden', !isEditing);
    btnSave.classList.toggle('hidden', isEditing);
    btnCancel.classList.toggle('hidden', isEditing);

    // 🔧 Ajuste de anchos
    const fechaCol = row.querySelector('.fecha-col');
    const fechaCobroCol = row.querySelector('.fecha-cobro-col');
    const obsCol = row.querySelector('.observaciones-col');

    if (!isEditing) {
        // Reducir Fecha y Fecha Cobro al 70%
        fechaCol.style.width = '70%';
        fechaCobroCol.style.width = '70%';
        // Ampliar Observaciones al 150%
        obsCol.style.width = '150%';
    } else {
        // Volver a ancho normal
        fechaCol.style.width = '';
        fechaCobroCol.style.width = '';
        obsCol.style.width = '';
    }
}

function saveRow(rowId) {
    const row = document.querySelector(`tr[data-row-id="${rowId}"]`);
    const cobradoVal = row.querySelector(`.cobrado-input-${rowId}`).value;
    const fechaVal = row.querySelector(`.fecha-cobro-input-${rowId}`).value;
    const obsVal = row.querySelector(`.obs-input-${rowId}`).value;

    const cobradoDisplay = row.querySelector(`.cobrado-display-${rowId}`);
    cobradoDisplay.textContent = cobradoVal;
    cobradoDisplay.className = `cobrado-display-${rowId} inline-flex leading-5 font-semibold rounded-full ${
        cobradoVal === 'Sí' ? 'bg-green-100 text-green-800' : 'bg-red-400 text-white'
    }`;

    row.querySelector(`.fecha-cobro-display-${rowId}`).textContent = fechaVal || '-';
    row.querySelector(`.obs-display-${rowId}`).textContent = obsVal || '-';

    toggleRowEdit(rowId);
    alertMessage(`Fila ${rowId} guardada con éxito.`, 'success');
}

function cancelRowEdit(rowId) {
    toggleRowEdit(rowId);
    alertMessage(`Edición de fila ${rowId} cancelada.`, 'info');
}

// =================================================================================
// 💬 ALERTAS
// =================================================================================
function alertMessage(message, type = 'info') {
    const statusMessage = document.getElementById('statusMessage');
    statusMessage.className = `status-message status-${type}`;
    statusMessage.textContent = message;
    statusMessage.classList.remove('hidden');
    setTimeout(() => statusMessage.classList.add('hidden'), 4000);
}

// =================================================================================
// 🚀 INICIALIZACIÓN
// =================================================================================
document.addEventListener('DOMContentLoaded', cargarDatosTabla);
