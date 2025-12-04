// Archivo: static/js/albaran_enviado.js
// Listado de albaranes ENVIADOS/PAGADOS con paginación y ordenación

const RESULTS_BODY = document.getElementById('albaranResults');
const ALBARAN_TOTAL = document.getElementById('albaranTotal');
const RECORDS_PER_PAGE_SELECT = document.getElementById('recordsPerPage');
const STATUS_MESSAGE = document.getElementById('statusMessage');
const PAGE_INFO = document.getElementById('pageInfo');
const TOTAL_LABEL = document.getElementById('totalLabel');
const PREV_BTN = document.getElementById('prevPageBtn');
const NEXT_BTN = document.getElementById('nextPageBtn');

// Estado local
let currentData = [];
let currentLicenciaRef = 0;
let currentPage = 1;
let pageSize = 20;
let totalPages = 1;
let currentSortColumn = 'fecha';
let currentSortDirection = 'desc';

// ===========================
// Utilidades de UI
// ===========================
function formatDate(isoString) {
  return isoString ? isoString.substring(0, 10) : '-';
}

function getStateHtml(albaran) {
  if (albaran.finalizado) {
    return '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-200 text-purple-800">Finalizado</span>';
  }
  if (albaran.cobrado || albaran.pagado) {
    return '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-200 text-green-800">Pagado</span>';
  }
  if (albaran.enviado) {
    return '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-200 text-blue-800">Enviado</span>';
  }
  return '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-200 text-gray-700">Creado</span>';
}

function alertMessage(message, type) {
  if (!STATUS_MESSAGE) return;
  STATUS_MESSAGE.textContent = message;
  STATUS_MESSAGE.className = 'status-message';
  const alertClasses = {
    success: 'status-success',
    error: 'status-error',
    info: 'status-info',
  };
  STATUS_MESSAGE.classList.add(alertClasses[type] || alertClasses.info);
  STATUS_MESSAGE.classList.remove('hidden');
  setTimeout(() => STATUS_MESSAGE.classList.add('hidden'), 4000);
}

function updateSortIcons() {
  document.querySelectorAll('th i').forEach((icon) => {
    icon.setAttribute('data-lucide', 'chevrons-up-down');
    icon.classList.remove('text-blue-600');
    icon.classList.add('text-gray-400');
  });

  const icon = document.getElementById(`sort-${currentSortColumn}`);
  if (icon) {
    const newIcon = currentSortDirection === 'asc' ? 'chevron-up' : 'chevron-down';
    icon.setAttribute('data-lucide', newIcon);
    icon.classList.remove('text-gray-400');
    icon.classList.add('text-blue-600');
    if (window.lucide && window.lucide.createIcons) {
      window.lucide.createIcons();
    }
  }
}

function updatePaginationUI() {
  pageSize = parseInt(RECORDS_PER_PAGE_SELECT.value, 10);
  if (RECORDS_PER_PAGE_SELECT.value === 'todos') {
    pageSize = currentData.length || 1;
  }

  totalPages = Math.ceil(currentData.length / pageSize) || 1;

  if (PAGE_INFO) {
    PAGE_INFO.textContent = `Página ${currentPage} de ${totalPages}`;
  }

  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, currentData.length);
  const showing = endIndex - startIndex;

  if (TOTAL_LABEL) {
    TOTAL_LABEL.textContent = `(${showing} de ${currentData.length} registros)`;
  }

  if (PREV_BTN) PREV_BTN.disabled = currentPage <= 1;
  if (NEXT_BTN) NEXT_BTN.disabled = currentPage >= totalPages;
}

// ===========================
// Ordenación y carga
// ===========================
function sortTable(column) {
  let newDirection = 'asc';

  if (currentSortColumn === column) {
    newDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
  }

  currentData.sort((a, b) => {
    const getVal = (item, key) => {
      if (key === 'importe_total') {
        return parseFloat(item.importe_total || item.ImporteTotal || 0);
      }
      if (key === 'fecha') {
        return new Date(item.fecha || item.Fecha || 0).getTime();
      }
      if (key === 'licencia') {
        return parseInt(item.LicenciaData?.licencia || item.licencia_ref || 0, 10);
      }
      if (key === 'conductor') {
        const base =
          item.asalariado ||
          item.Asalariado ||
          item.LicenciaData?.nombre ||
          '';
        return base.toString().toLowerCase();
      }
      return (item[key] || '').toString().toLowerCase();
    };

    const valA = getVal(a, column);
    const valB = getVal(b, column);

    let comparison = 0;
    if (valA > valB) comparison = 1;
    else if (valA < valB) comparison = -1;

    return newDirection === 'asc' ? comparison : -comparison;
  });

  currentSortColumn = column;
  currentSortDirection = newDirection;
  currentPage = 1;

  DOM.renderResults();
  updateSortIcons();
}

async function fetchUserLicense() {
  try {
    const userRes = await fetch('/api/v1/user/licencia_ref');
    if (!userRes.ok) throw new Error('Sesión inválida');
    const userData = await userRes.json();
    currentLicenciaRef = userData.licencia_ref;
    return currentLicenciaRef > 0;
  } catch (e) {
    console.error('Error al obtener licencia:', e);
    return false;
  }
}

async function loadAlbaranes(filters = {}) {
  if (currentLicenciaRef === 0) return;

  DOM.showLoading();

  const states = ['enviado', 'pagado', 'finalizado'];
  let allPromises = [];

  try {
    allPromises = states.map((state) => {
      let apiPath = `/api/v1/albaranes/search?licencia_ref=${currentLicenciaRef}&state=${state}&pageSize=5000`;

      if (filters.referencia) apiPath += `&referencia=${encodeURIComponent(filters.referencia)}`;
      if (filters.palabra) apiPath += `&palabra=${encodeURIComponent(filters.palabra)}`;

      return fetch(apiPath)
        .then((res) => {
          if (res.status === 401) throw new Error('Unauthorized');
          if (!res.ok) return { data: [] };
          return res.json();
        })
        .then((resJson) => resJson.data || []);
    });

    const results = await Promise.all(allPromises);

    const albaranes = results.flatMap((data) => data);
    const uniqueAlbaranes = Array.from(
      new Map(albaranes.map((item) => [item.ID || item.id, item])).values(),
    );

    currentData = uniqueAlbaranes;

    sortTable(currentSortColumn);

    if (currentData.length > 0) {
      alertMessage(`Cargados ${currentData.length} albaranes enviados/pagados.`, 'success');
    } else {
      alertMessage('🔎 No se encontraron albaranes enviados.', 'info');
    }

    DOM.renderResults();
  } catch (error) {
    console.error('Error al cargar enviados:', error);
    if (error.message === 'Unauthorized') {
      window.location.href = '/login';
    }
    alertMessage(`Error cargando: ${error.message}`, 'error');
    DOM.showNoResults();
  }
}

// ===========================
// DOM render & events
// ===========================
const DOM = {
  showLoading() {
    if (RESULTS_BODY) {
      RESULTS_BODY.innerHTML = `
        <tr>
          <td colspan="10" class="text-center py-12">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
            Buscando albaranes enviados...
          </td>
        </tr>`;
    }
  },

  showNoResults() {
    if (RESULTS_BODY) {
      RESULTS_BODY.innerHTML = `
        <tr>
          <td colspan="10" class="text-center py-12 text-orange-500 font-semibold">
            🔎 No se encontraron albaranes en estado Enviado o Pagado.
          </td>
        </tr>`;
    }
    if (ALBARAN_TOTAL) ALBARAN_TOTAL.innerHTML = '';
    updatePaginationUI();
  },

  renderResults() {
    if (!RESULTS_BODY) return;

    RESULTS_BODY.innerHTML = '';

    updatePaginationUI();

    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const pageData = currentData.slice(startIndex, endIndex);

    if (pageData.length === 0) {
      this.showNoResults();
      return;
    }

    let totalImporte = 0;

    pageData.forEach((albaran) => {
      const importe = parseFloat(albaran.importe_total || albaran.ImporteTotal || 0);
      totalImporte += importe;

      const id = albaran.ID || albaran.id;
      const num = albaran.numero_albaran || albaran.NumeroAlbaran || id;
      const fecha = albaran.fecha || albaran.Fecha;
      const ref = albaran.referencia || albaran.Referencia || '-';
      const obs = albaran.observaciones || albaran.Observaciones || '-';

      const licCode = albaran.LicenciaData?.licencia || albaran.licencia_ref || 'N/A';
      const empName = albaran.EmpresaData?.nombre || 'N/A';

      let conductor = albaran.asalariado || albaran.Asalariado || 'Titular';
      if (!albaran.asalariado && !albaran.Asalariado && albaran.LicenciaData?.nombre) {
        conductor = albaran.LicenciaData.nombre;
      }

      const row = `
        <tr class="hover:bg-gray-50 transition duration-150">
          <td class="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900">${num}</td>
          <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${formatDate(fecha)}</td>
          <td class="px-4 py-3 whitespace-nowrap text-sm text-blue-600 font-medium">${licCode}</td>
          <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-800">${empName}</td>
          <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${ref}</td>
          <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">${conductor}</td>
          <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-semibold text-right">€${importe.toFixed(
            2,
          )}</td>
          <td class="px-4 py-3 whitespace-nowrap text-sm">${getStateHtml(albaran)}</td>
          <td class="px-4 py-3 text-sm text-gray-500 max-w-xs truncate" title="${obs}">${obs}</td>
          <td class="px-4 py-3 whitespace-nowrap text-center text-sm font-medium">
            <div class="flex justify-center items-center space-x-4">
              <a href="/titulares/view/${id}" title="Ver detalle"
                 class="text-blue-500 hover:text-blue-700 p-1 transition transform hover:scale-110">
                <i data-lucide="eye" class="h-4 w-4"></i>
              </a>
              <a href="/titulares/update/${id}" title="Editar"
                 class="text-orange-500 hover:text-orange-700 p-1 transition transform hover:scale-110">
                <i data-lucide="pencil" class="h-4 w-4"></i>
              </a>
            </div>
          </td>
        </tr>`;

      RESULTS_BODY.insertAdjacentHTML('beforeend', row);
    });

    if (ALBARAN_TOTAL) {
      ALBARAN_TOTAL.innerHTML = `
        <tr class="bg-gray-50 font-bold">
          <td colspan="7" class="px-4 py-3 text-right text-gray-700">
            TOTAL ENVIADO/PAGADO (${currentData.length} registros)
          </td>
          <td class="px-4 py-3 text-right text-xl font-black text-emerald-600">
            €${totalImporte.toFixed(2)}
          </td>
          <td colspan="2" class="px-4 py-3"></td>
        </tr>`;
    }

    updateSortIcons();
    if (window.lucide) window.lucide.createIcons();
  },
};

// ===========================
// Eventos
// ===========================
const Events = {
  handlePageChange(delta) {
    const next = currentPage + delta;
    if (next >= 1 && next <= totalPages) {
      currentPage = next;
      DOM.renderResults();
    }
  },

  handleRecordsChange() {
    const value = RECORDS_PER_PAGE_SELECT.value;
    if (value === 'todos') {
      pageSize = currentData.length || 10;
    } else {
      pageSize = parseInt(value, 10);
    }
    currentPage = 1;
    DOM.renderResults();
  },

  handleBusquedaAcotada(e) {
    if (e) e.preventDefault();
    const filters = {};
    // aquí podrías leer inputs concretos, ej:
    // const searchInput = document.getElementById('simpleSearch');
    // if (searchInput && searchInput.value) filters.palabra = searchInput.value;
    loadAlbaranes(filters);
  },

  init() {
    if (RECORDS_PER_PAGE_SELECT) {
      RECORDS_PER_PAGE_SELECT.addEventListener('change', this.handleRecordsChange);
    }
    if (PREV_BTN) {
      PREV_BTN.addEventListener('click', () => this.handlePageChange(-1));
    }
    if (NEXT_BTN) {
      NEXT_BTN.addEventListener('click', () => this.handlePageChange(1));
    }

    // Si el select no tiene opciones, las rellenamos
    if (RECORDS_PER_PAGE_SELECT && RECORDS_PER_PAGE_SELECT.options.length === 0) {
      ['10', '20', '50', '100', 'todos'].forEach((value) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        if (value === '20') option.selected = true;
        RECORDS_PER_PAGE_SELECT.appendChild(option);
      });
      pageSize = 20;
    }
  },
};

// ===========================
// Inicialización global
// ===========================
window.loadAlbaranes = loadAlbaranes;
window.sortTable = sortTable;
window.handleBusquedaAcotada = Events.handleBusquedaAcotada;

document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Iniciando aplicación de albaranes enviados...');

  Events.init();

  const hasSession = await fetchUserLicense();
  if (!hasSession) {
    DOM.showNoResults();
    alertMessage('No se pudo cargar la sesión del usuario.', 'error');
    return;
  }

  await loadAlbaranes();

  console.log('✅ Aplicación lista');
});
