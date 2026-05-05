/**
 * admin_backup.js - Gestión de Copias de Seguridad
 * Realiza peticiones al backend para generar archivos .sql y snapshots de tablas.
 */

document.addEventListener('DOMContentLoaded', function() {
    console.log("[JS LOG] Inicializando panel de Backup...");
    if (window.lucide) {
        window.lucide.createIcons();
    }
    // Cargar la lista de archivos existentes al entrar
    fetchBackupList();
    // Cargar combo de licencias para filtro de albaranes
    fetchLicenciasCombo();
});

const statusMessage = document.getElementById('statusMessage');
const backupListContainer = document.getElementById('backup-list');
const BASE_API_URL = '/api/v1/backup';

// Header de autenticación reutilizable (igual que el resto de módulos)
function authHeaders(withContentType = false) {
    const headers = { 'Authorization': `Bearer ${localStorage.getItem('token')}` };
    if (withContentType) headers['Content-Type'] = 'application/json';
    return headers;
}

/**
 * Muestra alertas visuales en la parte superior del panel.
 */
function displayMessage(text, type) {
    statusMessage.textContent = text;
    statusMessage.className = 'status-message block';

    if (type === 'success') statusMessage.classList.add('status-success');
    else if (type === 'error') statusMessage.classList.add('status-error');
    else statusMessage.classList.add('status-info');

    statusMessage.classList.remove('hidden');

    setTimeout(() => {
        statusMessage.classList.add('hidden');
    }, 8000);
}

/**
 * Controla el estado visual de los botones durante la carga.
 */
function setButtonLoading(button, isLoading) {
    if (isLoading) {
        button.dataset.originalHtml = button.innerHTML;
        button.disabled = true;
        button.classList.add('opacity-50', 'cursor-wait');
        button.innerHTML = `<span class="flex items-center gap-2"><svg class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>...</span>`;
    } else {
        button.disabled = false;
        button.classList.remove('opacity-50', 'cursor-wait');
        button.innerHTML = button.dataset.originalHtml;
    }
}

/**
 * Carga las licencias desde /api/v1/licencias (ruta liberada, igual que admin_albaran_nuevo.js)
 * y rellena el combo del filtro de albaranes.
 */
async function fetchLicenciasCombo() {
    const combo = document.getElementById('comboLicencias');
    if (!combo) return;
    try {
        const res = await fetch('/api/v1/licencias', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const result = await res.json();
        const list = result.data || result;
        if (!Array.isArray(list)) return;

        list
            .filter(l => l.estado !== 0) // solo activas
            .sort((a, b) => String(a.licencia).localeCompare(String(b.licencia), undefined, { numeric: true }))
            .forEach(l => {
                const opt = document.createElement('option');
                opt.value = l.id;
                opt.textContent = `Licencia ${l.licencia}`;
                combo.appendChild(opt);
            });
    } catch (err) {
        console.error('[fetchLicenciasCombo] Error:', err);
    }
}

/**
 * Ejecuta la acción de Backup (crear .sql o snapshot en DB).
 */
async function handleBackup(tipo, accion, button) {
    console.log(`[ACTION] Tipo: ${tipo} | Acción: ${accion}`);

    // Determinar si hay filtro de licencia activo (solo para albaranes/crear)
    let licenciaRef = '';
    let licenciaLabel = '';
    if (tipo === 'albaranes' && accion === 'crear') {
        const combo = document.getElementById('comboLicencias');
        if (combo && combo.value) {
            licenciaRef = combo.value;
            licenciaLabel = combo.options[combo.selectedIndex].text;
        }
    }

    const confirmMsgs = {
        'crear': licenciaRef
            ? `¿Crear backup de ALBARANES filtrado por "${licenciaLabel}"?`
            : `¿Confirmar la creación del archivo de BACKUP (.sql) para ${tipo.toUpperCase()}?`,
        'copia': `¿Desea crear un SNAPSHOT (tabla espejo) de ${tipo.toUpperCase()} en la base de datos?`,
        'cargar': `⚠️ ¡ATENCIÓN! ¿Desea RESTAURAR la tabla ${tipo.toUpperCase()}? Los datos actuales se perderán.`
    };

    if (!confirm(confirmMsgs[accion] || "¿Continuar?")) return;

    setButtonLoading(button, true);

    try {
        let url = `${BASE_API_URL}/${tipo}/${accion}`;
        if (licenciaRef) {
            url += `?licencia_ref=${encodeURIComponent(licenciaRef)}`;
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: authHeaders(true)
        });

        const data = await response.json();

        if (response.ok) {
            displayMessage(data.message, 'success');
            if (accion === 'crear') fetchBackupList();
        } else {
            displayMessage(`Error: ${data.error || 'No se pudo completar la acción'}`, 'error');
        }
    } catch (error) {
        console.error("Fetch error:", error);
        displayMessage("Error de conexión con el servidor", "error");
    } finally {
        setButtonLoading(button, false);
    }
}

/**
 * Obtiene y renderiza la lista de archivos .sql del servidor.
 */
async function fetchBackupList() {
    backupListContainer.innerHTML = '<div class="text-center p-4 text-gray-500 italic text-xs">Actualizando lista...</div>';

    try {
        const response = await fetch(`${BASE_API_URL}/list`, {
            headers: authHeaders()
        });
        const data = await response.json();

        backupListContainer.innerHTML = '';

        if (response.ok && Array.isArray(data) && data.length > 0) {
            data.forEach(item => {
                if (item.name && item.name.includes("No se encontraron")) {
                    backupListContainer.innerHTML = `<div class="text-center p-4 text-gray-400 text-xs italic">${item.name}</div>`;
                    return;
                }

                const icon = item.type === 'full' ? 'database' : 'file-text';
                const color = item.type === 'full' ? 'text-orange-600' : 'text-green-600';

                const itemHtml = `
                    <div class="flex items-center p-3 bg-white rounded-lg shadow-sm hover:bg-gray-50 border border-gray-100 transition-all duration-200 group">
                        <div class="mr-3 p-2 bg-gray-50 rounded-lg group-hover:bg-white">
                            <i data-lucide="${icon}" class="h-4 w-4 ${color}"></i>
                        </div>
                        <div class="flex-1 min-w-0">
                            <p class="font-bold text-[11px] text-gray-800 truncate uppercase tracking-tighter">${item.name}</p>
                            <p class="text-[10px] text-gray-400 font-medium">${item.date} • ${item.size}</p>
                        </div>
                        <div class="flex gap-1">
                            <a href="/backups/${item.name}" download 
                               class="p-1.5 bg-orange-100 text-orange-600 rounded-md hover:bg-orange-600 hover:text-white transition-colors" title="Descargar">
                                <i data-lucide="download" class="h-3.5 w-3.5"></i>
                            </a>
                        </div>
                    </div>
                `;
                backupListContainer.insertAdjacentHTML('beforeend', itemHtml);
            });
            if (window.lucide) window.lucide.createIcons();
        } else {
            backupListContainer.innerHTML = '<div class="text-center p-4 text-gray-400 text-xs italic">No hay archivos .sql disponibles</div>';
        }
    } catch (error) {
        console.error("List error:", error);
        backupListContainer.innerHTML = '<div class="text-center p-4 text-red-400 text-xs italic">Error al cargar listado</div>';
    }
}

/**
 * Gestión de botones de navegación.
 */
function handleAction(actionType) {
    if (actionType === 'volver') {
        window.location.href = '/admin';
    }
}

/**
 * Simulación/Placeholder para restaurar.
 */
function handleRestoreGeneric() {
    displayMessage('Para restaurar, seleccione el icono de flecha roja junto al archivo en la lista (Simulado).', 'info');
}