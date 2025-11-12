// ===== CONFIGURACIÓN DE FIREBASE =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, setLogLevel, getDocs, query, where, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Variables globales MANDATORIAS proporcionadas por el entorno
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

let db = null;
let auth = null;
let userId = 'anon_user'; // Valor por defecto

// ===== INICIALIZACIÓN DE FIREBASE =====
async function initFirebase() {
    if (!firebaseConfig) {
        console.error("Firebase config is missing. Cannot initialize Firestore.");
        return;
    }

    try {
        // Configurar logs de Firebase para depuración
        setLogLevel('debug');
        
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);

        // Autenticar: usar token personalizado si está disponible, sino anónimo
        if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
        } else {
            await signInAnonymously(auth);
        }

        userId = auth.currentUser?.uid || crypto.randomUUID();
        console.log(`Firebase inicializado. User ID: ${userId}`);

        // Exponer funciones/variables necesarias al ámbito global
        window.db = db;
        window.auth = auth;
        window.getAlbaranData = getAlbaranData;
        window.saveAlbaranToFirestore = saveAlbaranToFirestore;
        window.searchAlbaranes = searchAlbaranes;

    } catch (error) {
        console.error("Error al inicializar o autenticar Firebase:", error);
        showStatusMessage('❌ Error de conexión: No se pudo conectar al servidor de datos.', 'error');
    }
}

// ===== FUNCIONES PARA ALBARAN_NUEVO =====

// Función para guardar los datos en Firestore (Public data collection)
async function saveAlbaranToFirestore(albaranData) {
    if (!db || !userId) {
        console.error("Firestore no está inicializado o el usuario no está autenticado.");
        showStatusMessage('❌ Error de conexión. Firestore no está listo.', 'error');
        return;
    }

    try {
        // Ruta de la colección: /artifacts/{appId}/public/data/albaranes
        const collectionPath = `/artifacts/${appId}/public/data/albaranes`;
        const albaranCollection = collection(db, collectionPath);
        
        // Añadir el ID del usuario que crea el albarán
        albaranData.createdBy = userId;
        albaranData.createdAt = new Date().toISOString(); // Marca de tiempo

        const docRef = await addDoc(albaranCollection, albaranData);
        console.log("Albarán guardado con ID:", docRef.id);

        // Ocultar modal y mostrar mensaje de éxito
        hideSubmitModal();
        showStatusMessage(`✅ ¡Albarán guardado! ID del Documento: ${docRef.id}. Revisa la consola.`, 'success');

    } catch (e) {
        console.error("Error añadiendo el documento: ", e);
        // Ocultar modal y mostrar mensaje de error
        hideSubmitModal();
        showStatusMessage('❌ Error al guardar el albarán en la base de datos.', 'error');
    }
}

// Función para recolectar todos los datos del formulario de albarán
function getAlbaranData() {
    const form = document.getElementById('albaranForm');
    if (!form) return null;
    
    const data = {};

    // Recoger todos los datos del formulario
    new FormData(form).forEach((value, key) => {
        data[key] = value;
    });

    // Recoger el estado de los checkboxes
    const checkboxes = ['festivo', 'finalizado', 'urbano', 'diurno', 'noct_fest', 'enganche'];
    checkboxes.forEach(checkboxId => {
        const element = document.getElementById(checkboxId);
        if (element) {
            data[checkboxId] = element.checked ? 'Si' : 'No';
        }
    });

    return data;
}

// ===== FUNCIONES PARA BÚSQUEDA =====

// Función para buscar albaranes en Firestore
async function searchAlbaranes(searchCriteria) {
    if (!db) {
        console.error("Firestore no está inicializado.");
        showStatusMessage('❌ Error de conexión. Firestore no está listo.', 'error');
        return [];
    }

    try {
        const collectionPath = `/artifacts/${appId}/public/data/albaranes`;
        const albaranCollection = collection(db, collectionPath);
        
        // Construir consulta basada en los criterios de búsqueda
        let conditions = [];
        
        if (searchCriteria.searchNAlbaran) {
            conditions.push(where('n_albaran', '>=', searchCriteria.searchNAlbaran));
            conditions.push(where('n_albaran', '<=', searchCriteria.searchNAlbaran + '\uf8ff'));
        }
        
        if (searchCriteria.searchCliente) {
            conditions.push(where('cliente', '>=', searchCriteria.searchCliente));
            conditions.push(where('cliente', '<=', searchCriteria.searchCliente + '\uf8ff'));
        }
        
        if (searchCriteria.searchFecha) {
            conditions.push(where('fecha', '==', searchCriteria.searchFecha));
        }

        // Si no hay condiciones, obtener todos los documentos ordenados por fecha
        let q;
        if (conditions.length > 0) {
            q = query(albaranCollection, ...conditions, orderBy('createdAt', 'desc'));
        } else {
            q = query(albaranCollection, orderBy('createdAt', 'desc'));
        }

        const querySnapshot = await getDocs(q);
        const results = [];
        
        querySnapshot.forEach((doc) => {
            results.push({
                id: doc.id,
                ...doc.data()
            });
        });

        return results;

    } catch (error) {
        console.error("Error buscando albaranes:", error);
        showStatusMessage('❌ Error al buscar albaranes en la base de datos.', 'error');
        return [];
    }
}

// Función para mostrar resultados de búsqueda
function displaySearchResults(results) {
    const resultsContainer = document.getElementById('searchResults');
    if (!resultsContainer) return;

    if (results.length === 0) {
        resultsContainer.innerHTML = `
            <div class="text-center py-8 text-gray-500">
                <p>No se encontraron albaranes con los criterios especificados.</p>
            </div>
        `;
        return;
    }

    let html = `
        <div class="overflow-x-auto">
            <table class="w-full text-sm text-left text-gray-700">
                <thead class="text-xs text-gray-700 uppercase bg-gray-50">
                    <tr>
                        <th class="px-4 py-3">Nº Albarán</th>
                        <th class="px-4 py-3">Cliente</th>
                        <th class="px-4 py-3">Fecha</th>
                        <th class="px-4 py-3">Importe Total</th>
                        <th class="px-4 py-3">Acciones</th>
                    </tr>
                </thead>
                <tbody>
    `;

    results.forEach(albaran => {
        html += `
            <tr class="bg-white border-b hover:bg-gray-50">
                <td class="px-4 py-3 font-medium">${albaran.n_albaran || 'N/A'}</td>
                <td class="px-4 py-3">${albaran.cliente || 'N/A'}</td>
                <td class="px-4 py-3">${albaran.fecha || 'N/A'}</td>
                <td class="px-4 py-3 font-semibold text-green-600">${albaran.importe_total ? `€${parseFloat(albaran.importe_total).toFixed(2)}` : 'N/A'}</td>
                <td class="px-4 py-3">
                    <button onclick="viewAlbaranDetails('${albaran.id}')" class="btn bg-sky-600 text-white text-xs px-3 py-1">
                        Ver Detalles
                    </button>
                </td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
        </div>
        <div class="mt-4 text-sm text-gray-600">
            Se encontraron ${results.length} albarán(es)
        </div>
    `;

    resultsContainer.innerHTML = html;
}

// Función para ver detalles de un albarán
function viewAlbaranDetails(albaranId) {
    alert(`Funcionalidad de ver detalles en desarrollo para albarán: ${albaranId}`);
    // Aquí puedes implementar la lógica para mostrar un modal con todos los detalles
    console.log("Ver detalles del albarán:", albaranId);
}

// ===== FUNCIONES DE UTILIDAD Y UI =====

// Muestra u oculta el modal de confirmación
function showSubmitModal() {
    const modal = document.getElementById('submitModal');
    const content = document.getElementById('modalContent');
    if (!document.getElementById('albaranForm').checkValidity()) {
        document.getElementById('albaranForm').reportValidity();
        return;
    }
    modal.classList.remove('hidden', 'opacity-0', 'pointer-events-none');
    modal.classList.add('flex');
    // Animación
    setTimeout(() => {
        content.classList.remove('scale-95', 'opacity-0');
        content.classList.add('scale-100', 'opacity-100');
    }, 10);
}

function hideSubmitModal() {
    const modal = document.getElementById('submitModal');
    const content = document.getElementById('modalContent');
    
    // Animación inversa
    content.classList.remove('scale-100', 'opacity-100');
    content.classList.add('scale-95', 'opacity-0');

    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }, 300);
}

// Muestra el mensaje de estado (éxito o error)
function showStatusMessage(message, type) {
    let statusMessage = document.getElementById('statusMessage');
    if (!statusMessage) return;
    
    statusMessage.classList.remove('hidden', 'bg-red-100', 'text-red-800', 'bg-green-100', 'text-green-800');
    
    if (type === 'success') {
        statusMessage.classList.add('bg-green-100', 'text-green-800');
        statusMessage.textContent = message;
    } else if (type === 'error') {
        statusMessage.classList.add('bg-red-100', 'text-red-800');
        statusMessage.textContent = message;
    }
}

// Función principal de envío que se llama desde el modal
function handleFormSubmit() {
    const albaranData = getAlbaranData();
    if (!albaranData) return;
    
    console.log("--- DATOS DEL ALBARÁN A ENVIAR ---");
    console.log(JSON.stringify(albaranData, null, 2));

    // Llamar a la función de Firebase expuesta en el ámbito global
    if (window.saveAlbaranToFirestore) {
        window.saveAlbaranToFirestore(albaranData);
    } else {
        // Simulación si Firebase no está listo
        hideSubmitModal();
        showStatusMessage('⚠️ ¡Simulación de envío! El albarán se guardaría en la consola (Firestore no está disponible).', 'error');
    }
}

// Contador de palabras para Observaciones
function setupWordCounter() {
    const observaciones = document.getElementById('observaciones');
    if (!observaciones) return;
    
    observaciones.addEventListener('input', function() {
        const text = this.value.trim();
        // Filtrar palabras vacías después de dividir
        const wordCount = text ? text.split(/\s+/).filter(word => word.length > 0).length : 0;
        
        const wordCountElement = document.getElementById('wordCount');
        if (wordCountElement) {
            wordCountElement.textContent = `${wordCount} palabras`;
        }
    });
}

// Establecer la fecha actual como valor por defecto y la hora actual para Hora (hh:mm)
function setDefaultDateTime() {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    // Formatear hora (HH:MM)
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const currentTime = `${hours}:${minutes}`;

    const fechaInput = document.getElementById('fecha');
    const horaInput = document.getElementById('hora');
    
    if (fechaInput) fechaInput.value = today;
    if (horaInput) horaInput.value = currentTime;
}

// Manejar el formulario de búsqueda
function setupSearchForm() {
    const searchForm = document.getElementById('searchForm');
    if (!searchForm) return;

    searchForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const searchCriteria = {
            searchNAlbaran: document.getElementById('searchNAlbaran')?.value || '',
            searchCliente: document.getElementById('searchCliente')?.value || '',
            searchFecha: document.getElementById('searchFecha')?.value || ''
        };

        showStatusMessage('🔍 Buscando albaranes...', 'success');
        
        const results = await searchAlbaranes(searchCriteria);
        displaySearchResults(results);
    });
}

// ===== INICIALIZACIÓN =====

// Inicializar cuando se carga la ventana
window.addEventListener('load', function() {
    // Inicializar Firebase
    initFirebase();
    
    // Configurar funcionalidades específicas de cada página
    setupWordCounter();
    setDefaultDateTime();
    setupSearchForm();
    
    // Configurar evento para el botón de buscar todos (si existe)
    const searchAllBtn = document.getElementById('searchAllBtn');
    if (searchAllBtn) {
        searchAllBtn.addEventListener('click', async function() {
            showStatusMessage('🔍 Cargando todos los albaranes...', 'success');
            const results = await searchAlbaranes({});
            displaySearchResults(results);
        });
    }
});

// Exponer funciones globalmente para su uso en HTML
window.showSubmitModal = showSubmitModal;
window.hideSubmitModal = hideSubmitModal;
window.handleFormSubmit = handleFormSubmit;
window.viewAlbaranDetails = viewAlbaranDetails;
