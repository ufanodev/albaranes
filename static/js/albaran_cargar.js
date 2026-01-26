/**
 * albaran_cargar.js
 * Función: Obtener datos del servidor y llenar el formulario.
 */

async function cargarCatálogos() {
    console.log("📦 Cargando catálogos de empresas y conductores...");
    await Promise.all([cargarEmpresas(), cargarAsalariados()]);
}

async function cargarEmpresas() {
    const select = document.getElementById('empresa');
    if (!select) return;
    const res = await fetch('/api/v1/empresas');
    const result = await res.json();
    select.innerHTML = '<option value="">-- Seleccionar Empresa --</option>';
    result.data.forEach(emp => {
        const opt = document.createElement('option');
        opt.value = emp.id;
        opt.textContent = emp.nombre;
        select.appendChild(opt);
    });
}

async function cargarAsalariados() {
    const select = document.getElementById('asalariado_select');
    if (!select) return;
    const res = await fetch('/api/v1/conductores/mis-conductores');
    const result = await res.json();
    select.innerHTML = '<option value="">-- Conductor Titular --</option>';
    result.data.forEach(con => {
        const opt = document.createElement('option');
        opt.value = con.nombre;
        opt.textContent = con.nombre;
        select.appendChild(opt);
    });
}

async function loadAlbaranToEdit(id) {
    try {
        const res = await fetch(`/api/v1/albaranes/${id}`);
        if (!res.ok) throw new Error("Albarán no encontrado");
        const { data } = await res.json();

        // Mapeo manual a los IDs del HTML Master
        document.getElementById('albaran_id').value = data.id;
        document.getElementById('licencia').value = data.licencia;
        document.getElementById('n_albaran').value = data.numero_albaran;
        document.getElementById('header_num').textContent = `#${data.numero_albaran}`;
        document.getElementById('fecha').value = data.fecha.split('T')[0];
        
        // Datos Personales
        document.getElementById('nombre_pasajero').value = data.cliente || '';
        document.getElementById('tlf_pasajero').value = data.tlf_pasajero || '';
        document.getElementById('dni_pasajero').value = data.dni_pasajero || '';
        document.getElementById('matricula').value = data.matricula || '';

        // Ruta
        document.getElementById('origen').value = data.origen || '';
        document.getElementById('destino').value = data.destino || '';
        document.getElementById('parada').value = data.parada || '';

        // Tiempos (Formato HH:mm)
        const fTime = (iso) => iso ? new Date(iso).toLocaleTimeString('es-ES', {hour:'2-digit', minute:'2-digit', hour12:false}) : '';
        document.getElementById('hora_ini').value = fTime(data.hora_ini);
        document.getElementById('hora_fin').value = fTime(data.hora_fin);
        document.getElementById('espera_ini').value = fTime(data.espera_ini);
        document.getElementById('espera_fin').value = fTime(data.espera_fin);

        // Selects (Empresa y Conductor)
        document.getElementById('empresa').value = data.empresa_ref;
        document.getElementById('asalariado_select').value = data.asalariado;

        // Numéricos
        document.getElementById('km_nacionales').value = data.km_nacionales;
        document.getElementById('km_internacionales').value = data.km_internacionales;
        document.getElementById('km_totales').value = data.km_totales;
        document.getElementById('importe_espera').value = data.importe_espera;
        document.getElementById('importe_suplidos').value = data.importe_suplidos;
        document.getElementById('importe_total').value = data.importe_total;

        // Checks
        document.getElementById('urbano').checked = data.urbano;
        document.getElementById('remolque').checked = data.remolque;
        document.getElementById('noct_fest').checked = data.noct_fest;
        document.getElementById('adjuntos').checked = data.adjuntos;
        
        document.getElementById('observaciones').value = data.observaciones || '';

    } catch (err) {
        console.error("❌ Error en cargar_albaran:", err);
    }
}