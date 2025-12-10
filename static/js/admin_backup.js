// admin_backup.js

document.addEventListener('DOMContentLoaded', function() {
    console.log("[JS LOG 1] DOMContentLoaded: Inicializando script de Backup.");
    if (window.lucide) {
        window.lucide.createIcons();
    }
    // Cargar la lista de backups al iniciar
    fetchBackupList(); 
});

const statusMessage = document.getElementById('statusMessage');
const backupListContainer = document.getElementById('backup-list');
const BASE_API_URL = '/api/v1/backup'; 

// --- Funciones de Utilidad (sin cambios significativos en lógica, pero importantes para el contexto) ---

/**
 * Muestra un mensaje de estado en la interfaz.
 */
function displayMessage(text, type) {
    statusMessage.textContent = text;
    statusMessage.classList.remove('hidden', 'status-success', 'status-info', 'status-error');
    
    // Limpiar clases
    statusMessage.classList.remove('status-success', 'status-info', 'status-error');

    if (type === 'success') {
        statusMessage.classList.add('status-success');
    } else if (type === 'info') {
        statusMessage.classList.add('status-info');
    } else if (type === 'error') {
        statusMessage.classList.add('status-error');
    }
    
    statusMessage.classList.remove('hidden');

    setTimeout(() => {
        statusMessage.classList.add('hidden');
    }, 8000);
}

/**
 * Inhabilita/habilita el botón durante la petición.
 */
function setButtonLoading(button, isLoading) {
    if (isLoading) {
        button.originalText = button.innerHTML;
        button.disabled = true;
        button.classList.add('opacity-70', 'cursor-not-allowed');
        button.innerHTML = `<span class="mr-2 animate-spin"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-loader-2"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg></span> Procesando...`;
    } else {
        button.disabled = false;
        button.classList.remove('opacity-70', 'cursor-not-allowed');
        button.innerHTML = button.originalText;
    }
}

// --- Lógica Principal del Backup (Con Logging Detallado) ---

/**
 * Maneja la acción de backup, copia de tabla o carga.
 */
async function handleBackup(tipo, accion, button) {
    console.log(`[JS LOG 2] handleBackup llamado. Tipo: ${tipo}, Acción: ${accion}`);

    const actionLabels = {
        'crear': 'Copia de Seguridad (archivo .sql)',
        'copia': 'Copia de Tabla Espejo (en DB)',
        'cargar': 'Restauración de Tabla'
    };
    
    // Bloques de confirmación de seguridad
    if (accion === 'cargar') {
         if (!confirm(`⚠️ ¿Desea continuar con la acción de RESTAURAR la tabla **${tipo.toUpperCase()}**?\n¡Esta acción es irreversible y sobrescribirá los datos actuales de la tabla!`)) {
            console.log(`[JS LOG 3] Acción de Restauración CANCELADA por el usuario.`);
            displayMessage(`Cancelado: Restauración de **${tipo.toUpperCase()}** abortada.`, 'info');
            return;
        }
    } else if (accion === 'copia') {
         if (!confirm(`❓ ¿Desea crear una COPIA DE TABLA (Snapshot) de **${tipo.toUpperCase()}**?\nEsto creará una tabla nueva en la DB, ej: ${tipo}_copia_timestamp.`)) {
            console.log(`[JS LOG 3] Acción de Copia de Tabla CANCELADA por el usuario.`);
            displayMessage(`Cancelación: Creación de copia de tabla de **${tipo.toUpperCase()}** abortada.`, 'info');
            return;
        }
    } else if (accion === 'crear') {
         if (!confirm(`💾 ¿Confirmar la creación del archivo de BACKUP (.sql) para **${tipo.toUpperCase()}**?`)) {
            console.log(`[JS LOG 3] Acción de Creación de Backup CANCELADA por el usuario.`);
            displayMessage(`Cancelación: Creación de backup de **${tipo.toUpperCase()}** abortada.`, 'info');
            return;
        }
    }
    
    setButtonLoading(button, true);

    const apiURL = `${BASE_API_URL}/${tipo}/${accion}`;
    const jwtToken = window.getJWTToken ? getJWTToken() : 'TOKEN_NO_ENCONTRADO';
    
    console.log(`[JS LOG 4] Iniciando FETCH a la API.`);
    console.log(`[JS LOG 5] URL: POST ${apiURL}`);
    console.log(`[JS LOG 6] Token JWT (Parcial): ${jwtToken.substring(0, 30)}...`);

    try {
        const response = await fetch(apiURL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + jwtToken, 
            },
        });

        const data = await response.json();
        
        console.log(`[JS LOG 7] Respuesta recibida. Estado HTTP: ${response.status}`);
        console.log('[JS LOG 8] Datos del Servidor:', data);
        
        if (response.ok || response.status === 206) { 
            if (response.status === 206) {
                displayMessage(`⚠️ Éxito parcial: ${data.message}`, 'error');
            } else {
                displayMessage(data.message, 'success');
            }

            if (accion === 'crear') {
                console.log("[JS LOG 9] Backup .sql exitoso. Recargando lista de archivos.");
                fetchBackupList();
            }

        } else {
            // Manejo de errores de la API (4xx o 5xx)
            console.error(`[JS ERROR 1] Fallo de API: ${response.status} - ${data.error || 'Respuesta desconocida'}`);
            displayMessage(`❌ Error en ${actionLabels[accion]} de **${tipo.toUpperCase()}**: ${data.error || 'Respuesta desconocida del servidor'}`, 'error');
        }
        
    } catch (error) {
        console.error(`[JS ERROR 2] Error de red (No se pudo conectar):`, error);
        displayMessage(`❌ Error de red o servidor: No se pudo conectar a la API.`, 'error');
    } finally {
        setButtonLoading(button, false);
    }
}

/**
 * Maneja la acción genérica de Volver.
 */
function handleAction(actionType) {
    if (actionType === 'volver') {
        console.log(`[JS LOG 10] Acción 'Volver' ejecutada. Redirigiendo a /admin.`);
        window.location.href = '/admin';
    }
}

/**
 * Simulación de restauración genérica.
 */
function handleRestoreGeneric() {
    console.log(`[JS LOG 11] Botón 'Restaurar...' pulsado (Simulación).`);
    displayMessage('⚠️ La restauración desde un archivo (.sql) requiere que subas y selecciones el archivo. Esta función está simulada.', 'info');
}

/**
 * Función para cargar la lista de archivos de backup recientes del servidor.
 */
async function fetchBackupList() {
    // ... (El código de fetchBackupList es extenso, mantenlo sin cambios por ahora)
    // Asegúrate de que esta función también tiene acceso a getJWTToken()
    backupListContainer.innerHTML = '<div class="text-center p-4 text-gray-500 italic"><div class="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-500 inline-block mr-2"></div> Cargando lista de backups...</div>';
    
    try {
        const response = await fetch(`${BASE_API_URL}/list`, {
            headers: {
                'Authorization': 'Bearer ' + (window.getJWTToken ? getJWTToken() : 'TOKEN_NO_ENCONTRADO'), 
            },
        });
        const data = await response.json();
        
        // Si el listado se carga, el resto está funcionando.
        // ... (Tu lógica de renderizado de lista)
        backupListContainer.innerHTML = '';
        if (response.ok && Array.isArray(data)) {
            data.forEach(item => {
                if (item.name && item.name.startsWith('No')) {
                    backupListContainer.innerHTML = `<div class="text-center p-4 text-gray-500 italic">${item.name}</div>`;
                    return;
                }
                
                let iconHtml = item.type === 'full' ? '<i data-lucide="database" class="h-4 w-4 text-orange-600"></i>' : '<i data-lucide="archive" class="h-4 w-4 text-green-600"></i>';
                let tableRef = item.tableRef || item.name.split('_')[0];
                
                const itemHtml = `
                    <div class="flex items-center p-3 bg-white rounded-lg shadow-sm hover:bg-gray-50 border border-gray-100 transition duration-200">
                        <div class="mr-3">${iconHtml}</div>
                        <div class="flex-1 min-w-0">
                            <p class="font-semibold text-xs truncate">${item.name}</p>
                            <p class="text-xs text-gray-500">${item.date} | ${item.size}</p>
                        </div>
                        <button onclick="handleBackup('${tableRef}', 'cargar', this)"
                                class="ml-2 p-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition duration-200" title="Restaurar a la tabla: ${tableRef}">
                             <i data-lucide="rotate-ccw" class="h-4 w-4"></i>
                        </button>
                        <a href="/backups/${item.name}" download 
                           class="ml-2 p-1.5 bg-primary-link text-white rounded-lg hover:bg-orange-600 transition duration-200" title="Descargar archivo">
                            <i data-lucide="download" class="h-4 w-4"></i>
                        </a>
                    </div>
                `;
                backupListContainer.innerHTML += itemHtml;
            });
             if (window.lucide) { window.lucide.createIcons(); }
        } else {
            console.error("[JS ERROR 3] Error al listar backups:", data.error || 'Respuesta no válida.');
            backupListContainer.innerHTML = '<div class="text-center p-4 text-red-500 italic">Error al cargar la lista de archivos.</div>';
        }

    } catch (error) {
        console.error(`[JS ERROR 4] Fallo de red al cargar la lista:`, error);
        backupListContainer.innerHTML = `<div class="text-center p-4 text-red-500 italic">Error de conexión con la API al cargar la lista.</div>`;
    }
}