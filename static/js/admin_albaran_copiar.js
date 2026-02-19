/**
 * ARCHIVO: static/js/admin_albaran_copiar.js
 * DESCRIPCIÓN: Clonación de albaranes. Conductor es INPUT, no SELECT.
 * ACTUALIZADO: 19/02/2026
 */

document.addEventListener('DOMContentLoaded', async () => {
    const urlParts = window.location.pathname.split('/').filter(p => p !== "");
    const albaranOrigenId = urlParts[urlParts.length - 1];

    if (!albaranOrigenId || isNaN(albaranOrigenId)) {
        showPopup("ID de origen no válido.", "error");
        return;
    }

    console.log(`📂 [CLONACIÓN] Cargando base desde ID: ${albaranOrigenId}`);

    try {
        // 1. Cargar solo catálogos necesarios (Licencias y Empresas)
        await Promise.all([
            loadSelectData('/api/v1/licencias', 'licencia_ref', 'licencia'),
            loadSelectData('/api/v1/empresas', 'empresa_ref', 'nombre')
        ]);

        // 2. Recuperar datos del albarán origen
        const response = await fetch(`/api/v1/albaranes/id/${albaranOrigenId}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        
        if (!response.ok) throw new Error("No se pudo leer el albarán original");
        const result = await response.json();

        // 3. Poblar el formulario usando admin_albaran_cargar.js
        if (window.populateForm) {
            // El segundo parámetro 'true' indica modo CLONACIÓN
            window.populateForm(result.data, true);
        }
        
        const headerId = document.getElementById('header_id');
        if (headerId) headerId.textContent = `(BASADO EN #${result.data.numero_albaran})`;

    } catch (err) {
        console.error("❌ [ERROR]:", err.message);
        showPopup(err.message, "error");
    }

    // 4. MANEJO DEL ENVÍO (POST)
    const form = document.getElementById('albaranForm');
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            
            const formData = new FormData(form);
            const payload = Object.fromEntries(formData.entries());

            // Gestión de Checkboxes
            const checkboxes = ['urbano', 'diurno', 'noct_fest', 'festivo', 'finalizado', 'cobrado', 'pagado'];
            checkboxes.forEach(id => {
                const el = document.getElementById(id);
                if (el) payload[id] = el.checked;
            });

            // Limpieza y conversión
            delete payload.id;
            payload.licencia_ref = parseInt(payload.licencia_ref);
            payload.empresa_ref = parseInt(payload.empresa_ref);
            payload.importe_total = parseFloat(payload.importe_total) || 0;

            try {
                // 🚀 PETICIÓN POST PARA CREAR NUEVO
                const res = await fetch(`/api/v1/albaranes`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    showPopup("✅ ¡Albarán creado con éxito!", "success");
                    setTimeout(() => { window.location.href = '/admin'; }, 1500);
                } else {
                    const errRes = await res.json();
                    throw new Error(errRes.error || "Fallo al crear copia");
                }
            } catch (err) {
                showPopup(err.message, "error");
            }
        };
    }
});

/**
 * Muestra una notificación flotante en la pantalla
 */
function showPopup(message, type) {
    const old = document.getElementById('floating-popup');
    if (old) old.remove();

    const popup = document.createElement('div');
    popup.id = 'floating-popup';
    const bgColor = type === 'success' ? 'bg-emerald-600' : 'bg-red-600';
    
    // Z-INDEX muy alto para que sea visible
    popup.className = `fixed top-10 left-1/2 -translate-x-1/2 z-[9999] 
                       ${bgColor} text-white px-10 py-5 rounded-3xl shadow-2xl 
                       font-black uppercase tracking-widest flex items-center gap-4 
                       animate-bounce border-4 border-white/20 min-w-[300px] justify-center`;
    
    popup.innerHTML = `<span>${message}</span>`;
    document.body.appendChild(popup);

    if (type === 'error') {
        setTimeout(() => popup.remove(), 4000);
    }
}

async function loadSelectData(url, elementId, textField) {
    const select = document.getElementById(elementId);
    if (!select) return;
    try {
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
        const json = await res.json();
        const list = json.data || json;
        if (Array.isArray(list)) {
            select.innerHTML = list.map(i => `<option value="${i.id}">${String(i[textField]).toUpperCase()}</option>`).join('');
        }
    } catch (e) { console.error("Error loading select:", elementId); }
}