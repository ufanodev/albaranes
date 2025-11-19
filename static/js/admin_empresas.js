/**
 * js/admin_empresas.js
 * Lógica de frontend para el CRUD y búsqueda de Empresas.
 * Depende de js/security.js y js/utils.js.
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Cargar la lista de empresas al cargar la página
    loadEmpresas();

    // 2. Manejar el formulario de creación/edición
    const form = document.getElementById('empresaForm');
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    }
    
    // 3. Limpiar el formulario y el modo de edición al presionar 'Cancelar'
    const cancelButton = document.getElementById('cancelEdit');
    if (cancelButton) {
        cancelButton.addEventListener('click', resetForm);
    }
});

// --- Funciones de Utilidad y Renderizado ---

function resetForm() {
    const form = document.getElementById('empresaForm');
    form.reset();
    form.removeAttribute('data-id');
    document.getElementById('formTitle').textContent = 'Crear Nueva Empresa';
    document.getElementById('submitButton').textContent = 'Crear Empresa';
    document.getElementById('nif').disabled = false; // El NIF solo es editable al crear, no al actualizar
}

function renderEmpresasTable(empresas) {
    const tableBody = document.getElementById('empresasTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = ''; 

    if (empresas.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-gray-500">No hay empresas registradas.</td></tr>';
        return;
    }

    empresas.forEach(empresa => {
        const row = tableBody.insertRow();
        row.className = 'bg-white border-b hover:bg-gray-50';
        row.innerHTML = `
            <td class="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">${empresa.id}</td>
            <td class="px-6 py-4 whitespace-nowrap">${empresa.nif}</td>
            <td class="px-6 py-4">${empresa.nombre}</td>
            <td class="px-6 py-4">${empresa.telefono}</td>
            <td class="px-6 py-4">${empresa.email}</td>
            <td class="px-6 py-4 text-sm font-medium">
                <button onclick="editEmpresa(${empresa.id})" class="text-indigo-600 hover:text-indigo-900 mr-3 font-semibold transition duration-150">
                    Editar
                </button>
                <button onclick="deleteEmpresa(${empresa.id}, '${empresa.nombre}')" class="text-red-600 hover:text-red-900 font-semibold transition duration-150">
                    Eliminar
                </button>
            </td>
        `;
    });
}

// --- Operaciones CRUD ---

async function loadEmpresas() {
    const tableBody = document.getElementById('empresasTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-gray-500">Cargando empresas...</td></tr>';

    try {
        const response = await fetchProtected('/api/v1/empresas');
        const data = await response.json();

        if (response.ok) {
            renderEmpresasTable(data.data || []);
        } else {
            tableBody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-red-600">Error ${response.status}: ${data.error || response.statusText}</td></tr>`;
        }
    } catch (error) {
        console.error('Fetch error:', error);
        // Si el error viene de fetchProtected (ej: 401), ya habrá redirigido.
        tableBody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-red-600">Error de conexión con el servidor.</td></tr>';
    }
}

async function handleFormSubmit(event) {
    event.preventDefault();
    
    const form = event.target;
    const submitButton = document.getElementById('submitButton');
    
    submitButton.disabled = true;

    const empresaId = form.dataset.id;
    const method = empresaId ? 'PUT' : 'POST';
    const url = empresaId ? `/api/v1/empresas/${empresaId}` : '/api/v1/empresas';
    
    // Recolectar datos del formulario
    const formData = new FormData(form);
    const body = Object.fromEntries(formData.entries());

    try {
        const response = await fetchProtected(url, {
            method: method,
            body: JSON.stringify(body)
        });

        const data = await response.json();

        if (response.ok) {
            alert(`✅ Empresa ${empresaId ? 'actualizada' : 'creada'} con éxito: ${data.data?.nombre || data.message}`);
            resetForm(); 
            loadEmpresas();
        } else {
            alert(`❌ Error al ${method === 'POST' ? 'crear' : 'actualizar'} la empresa: ${data.error || response.statusText}`);
        }
    } catch (error) {
        console.error('Submit error:', error);
        alert('❌ Error de conexión o token inválido.');
    } finally {
        submitButton.disabled = false;
    }
}

async function editEmpresa(id) {
    try {
        const response = await fetchProtected(`/api/v1/empresas/${id}`);
        const data = await response.json();

        if (response.ok && data.data) {
            const empresa = data.data;
            const form = document.getElementById('empresaForm');
            
            // Llenar el formulario
            document.getElementById('nif').value = empresa.nif;
            document.getElementById('nombre').value = empresa.nombre;
            document.getElementById('direccion').value = empresa.direccion;
            document.getElementById('cp').value = empresa.cp;
            document.getElementById('telefono').value = empresa.telefono;
            document.getElementById('email').value = empresa.email;
            document.getElementById('observaciones').value = empresa.observaciones;
            
            // Configurar modo edición
            form.dataset.id = empresa.id; 
            document.getElementById('formTitle').textContent = `Editar Empresa ID: ${empresa.id}`;
            document.getElementById('submitButton').textContent = 'Guardar Cambios';
            document.getElementById('nif').disabled = true; // No permitir cambiar el NIF/CIF al editar
            
            // Opcional: Hacer scroll al formulario para que el usuario vea los datos
            form.scrollIntoView({ behavior: 'smooth' });
        } else {
            alert(`❌ Error al obtener los datos de la empresa: ${data.error || response.statusText}`);
        }
    } catch (error) {
        console.error('Fetch error:', error);
    }
}

async function deleteEmpresa(id, nombre) {
    if (!confirm(`¿Estás seguro de que quieres eliminar la empresa "${nombre}" (ID: ${id})? Esta acción no se puede deshacer.`)) {
        return;
    }

    try {
        const response = await fetchProtected(`/api/v1/empresas/${id}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (response.ok) {
            alert(`✅ Empresa ${nombre} eliminada con éxito.`);
            loadEmpresas();
        } else {
            alert(`❌ Error al eliminar la empresa: ${data.error || response.statusText}`);
        }
    } catch (error) {
        console.error('Delete error:', error);
    }
}