/**
 * ARCHIVO: static/js/oficina.js
 * FUNCIÓN: Exportación profesional con jsPDF-AutoTable.
 */

window.Oficina = {
    async generarPDF(nombreReporte, datos) {
        console.log("🚀 [PDF] Generando reporte visual mejorado...");
        
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('p', 'mm', 'a4');
            
            // 1. Título del Reporte
            doc.setFontSize(18);
            doc.setTextColor(40);
            doc.text("REPORTE DE ALBARANES REGISTRADOS", 14, 22);
            
            // 2. Fecha de generación
            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text(`Fecha: ${new Date().toLocaleDateString()} | Registros: ${datos.length}`, 14, 30);

            // 3. Definición de Columnas para AutoTable
            const columns = [
                { header: 'Nº ALBARÁN', dataKey: 'n' },
                { header: 'FECHA', dataKey: 'fecha' },
                { header: 'LIC', dataKey: 'lic' },
                { header: 'EMPRESA', dataKey: 'emp' },
                { header: 'EXPEDIENTE', dataKey: 'exp' },
                { header: 'TOTAL', dataKey: 'total' }
            ];

            // 4. Formateo de filas
            const rows = datos.map(d => ({
                n: d["Nº ALBARAN"],
                fecha: d["FECHA"],
                lic: d["LICENCIA"],
                emp: d["EMPRESA"],
                exp: d["EXPEDIENTE"] || "-",
                total: d["TOTAL"]
            }));

            // 5. Generar Tabla con Estilo
            doc.autoTable({
                columns: columns,
                body: rows,
                startY: 35,
                theme: 'striped',
                headStyles: { 
                    fillColor: [30, 41, 59], // Slate-800 (Como tu tabla)
                    textColor: [255, 255, 255],
                    fontSize: 9,
                    fontStyle: 'bold',
                    halign: 'center'
                },
                bodyStyles: { fontSize: 8, textColor: [50, 50, 50] },
                columnStyles: {
                    total: { halign: 'right', fontStyle: 'bold' },
                    lic: { halign: 'center' },
                    n: { fontStyle: 'bold' }
                },
                alternateRowStyles: { fillColor: [250, 250, 250] },
                margin: { top: 35 }
            });

            // 6. Guardar
            doc.save(`${nombreReporte}_${new Date().getTime()}.pdf`);
            console.log("✅ [PDF] Reporte visual generado con éxito.");

        } catch (e) {
            console.error("❌ [PDF] Error en generación visual:", e);
            alert("Error al generar el PDF visual. Asegúrate de tener cargada la librería autotable.");
        }
    },

    async generarExcel(nombreReporte, datos) {
        console.log("🚀 [XLSX] Generando Excel...");
        try {
            const ws = XLSX.utils.json_to_sheet(datos);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Albaranes");
            XLSX.writeFile(wb, `${nombreReporte}.xlsx`);
        } catch (e) {
            console.error("❌ [XLSX] Error:", e);
        }
    },

    logout() {
        localStorage.removeItem('token');
        window.location.href = '/login';
    }
};