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
        console.log("🚀 [XLSX] Generando Excel completo...");
        try {
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(datos);

            // --- Anchos de columna automáticos según contenido ---
            const headers = Object.keys(datos[0] || {});
            ws['!cols'] = headers.map(h => {
                // Ancho máximo entre cabecera y el valor más largo de la columna
                const maxLen = datos.reduce((acc, row) => {
                    const val = String(row[h] || '');
                    return Math.max(acc, val.length);
                }, h.length);
                return { wch: Math.min(maxLen + 2, 40) }; // máx 40 chars
            });

            // --- Estilos de cabecera (naranja corporativo) ---
            const headerRange = XLSX.utils.decode_range(ws['!ref']);
            for (let C = headerRange.s.c; C <= headerRange.e.c; C++) {
                const cellAddr = XLSX.utils.encode_cell({ r: 0, c: C });
                if (!ws[cellAddr]) continue;
                ws[cellAddr].s = {
                    font:      { bold: true, color: { rgb: "FFFFFF" } },
                    fill:      { fgColor: { rgb: "FF8C00" } },
                    alignment: { horizontal: "center" },
                    border: {
                        bottom: { style: "medium", color: { rgb: "000000" } }
                    }
                };
            }

            // --- Estilos de filas alternadas ---
            for (let R = 1; R <= headerRange.e.r; R++) {
                const isAlt = R % 2 === 0;
                for (let C = headerRange.s.c; C <= headerRange.e.c; C++) {
                    const cellAddr = XLSX.utils.encode_cell({ r: R, c: C });
                    if (!ws[cellAddr]) ws[cellAddr] = { v: '', t: 's' };
                    ws[cellAddr].s = {
                        fill: isAlt ? { fgColor: { rgb: "F3F4F6" } } : {},
                        alignment: { vertical: "center" }
                    };
                }
            }

            // --- Fila de TOTALES para columnas numéricas ---
            const colasNumericas = ["HORA TOTAL (h)", "KM TOTALES", "KM NACIONALES",
                "KM INTERNACIONALES", "IMPORTE ESPERA", "IMPORTE SUPLIDOS", "IMPORTE TOTAL"];
            const totalRow = {};
            headers.forEach(h => {
                if (colasNumericas.includes(h)) {
                    totalRow[h] = datos.reduce((sum, row) => sum + (parseFloat(row[h]) || 0), 0);
                } else if (h === headers[0]) {
                    totalRow[h] = `TOTAL (${datos.length} registros)`;
                } else {
                    totalRow[h] = '';
                }
            });
            XLSX.utils.sheet_add_json(ws, [totalRow], { skipHeader: true, origin: -1 });

            // Estilo fila total (fondo pastel naranja + negrita)
            const totalRowIdx = headerRange.e.r + 1;
            for (let C = headerRange.s.c; C <= headerRange.e.c; C++) {
                const cellAddr = XLSX.utils.encode_cell({ r: totalRowIdx, c: C });
                if (!ws[cellAddr]) ws[cellAddr] = { v: '', t: 's' };
                ws[cellAddr].s = {
                    font: { bold: true },
                    fill: { fgColor: { rgb: "FFDAB9" } },
                    border: { top: { style: "medium", color: { rgb: "000000" } } }
                };
            }

            // --- Congelar fila de cabecera ---
            ws['!freeze'] = { xSplit: 0, ySplit: 1 };

            XLSX.utils.book_append_sheet(wb, ws, "Albaranes");

            // Nombre con fecha
            const ts = new Date().toISOString().slice(0,10).replace(/-/g,'');
            XLSX.writeFile(wb, `${nombreReporte}_${ts}.xlsx`, { cellStyles: true });
            console.log("✅ [XLSX] Excel generado con éxito.");
        } catch (e) {
            console.error("❌ [XLSX] Error:", e);
            alert("Error al generar el Excel.");
        }
    },

    logout() {
        localStorage.removeItem('token');
        window.location.href = '/login';
    }
};