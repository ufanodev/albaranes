/**
 * ARCHIVO: static/js/admin_albaran_view.js
 * DESCRIPCIÓN: Vista de detalle del Administrador.
 * ACTUALIZADO: 17/11/2026
 *   - La vista usa EXACTAMENTE el mismo formulario que la edición.
 *     Aquí solo se pone todo en solo lectura y se rellena con populateForm().
 *   - Eliminados badges y campos duplicados (_view): ya no hacen falta.
 */

document.addEventListener('DOMContentLoaded', async () => {
    const urlParts = window.location.pathname.split('/').filter(Boolean);
    const albaranId = urlParts[urlParts.length - 1];

    console.log(`🚀 [ADMIN VIEW] Iniciando vista para Albarán ID: ${albaranId}`);

    prepararModoLectura();

    if (!albaranId || isNaN(albaranId)) {
        mostrarNotificacion("ID de albarán no válido.", "error");
        return;
    }

    configurarBotones(albaranId);

    try {
        const response = await fetch(`/api/v1/albaranes/id/${albaranId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            credentials: 'include'
        });

        if (response.status === 401 || response.status === 403) {
            window.location.href = '/login';
            return;
        }

        if (!response.ok) {
            let msg = "Fallo al conectar con el servidor.";
            try { msg = (await response.json()).error || msg; } catch (_) {}
            throw new Error(msg);
        }

        const result = await response.json();
        if (!result.data) throw new Error("El servidor no devolvió información para este registro.");

        console.log("📥 [API DATA]", result.data);
        populateForm(result.data);

    } catch (error) {
        console.error("❌ [CRÍTICO]:", error.message);
        mostrarNotificacion(error.message, "error");
    } finally {
        if (window.lucide) lucide.createIcons();
    }
});

/**
 * Deja todo el formulario en solo lectura.
 * Fechas y horas pasan a texto para mostrarlas como dd/mm/yyyy y HH:mm
 * (populateForm detecta el tipo de input y formatea en consecuencia).
 */
function prepararModoLectura() {
    const form = document.getElementById('albaranForm');
    if (!form) return;

    form.querySelectorAll('input[type="date"], input[type="time"]').forEach(el => {
        el.type = 'text';
        el.placeholder = '—';
    });
    form.querySelectorAll('input[type="number"]').forEach(el => { el.type = 'text'; });

    form.querySelectorAll('input, select, textarea').forEach(el => {
        el.disabled = true;
        el.removeAttribute('onchange');
        el.removeAttribute('required');
    });

    form.addEventListener('submit', e => e.preventDefault());
}

function configurarBotones(id) {
    const btnEdit = document.getElementById('btn_edit_direct');
    if (btnEdit) {
        btnEdit.addEventListener('click', () => {
            window.location.href = `/admin/albaranes/update/${id}`;
        });
    }
}

function mostrarNotificacion(mensaje, tipo) {
    const errDiv = document.getElementById('errorMessage');
    if (!errDiv) { console.warn("Aviso al usuario:", mensaje); return; }
    errDiv.textContent = mensaje;
    errDiv.className = tipo === 'error'
        ? 'bg-red-100 text-red-700 p-4 rounded-xl font-bold text-sm'
        : 'bg-green-100 text-green-700 p-4 rounded-xl font-bold text-sm';
}