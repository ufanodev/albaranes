package utils

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/xuri/excelize/v2" // ✅ RUTA OFICIAL
)

// NOTA: DocumentsDir, TitularData, y GetHeaders son accedidos desde 'export_common.go'
// dentro del mismo paquete 'utils'.

// GenerateTitularesXLSX genera un archivo Excel a partir de una matriz de datos genérica.
// reportName: Título del reporte (ej: Titulares / Licencias).
// data: La tabla de datos recibida desde el frontend (filtrada y ordenada).
func GenerateTitularesXLSX(reportName string, data []TitularData) (string, error) {
	if len(data) == 0 {
		return "", fmt.Errorf("no hay datos para generar el XLSX")
	}

	// 1. Crear el archivo y la hoja de cálculo
	f := excelize.NewFile()
	sheetName := "Listado Titulares"
	// Renombrar la hoja por defecto (Sheet1)
	f.SetSheetName("Sheet1", sheetName)

	// 2. Obtener las cabeceras (keys del primer map)
	headers := GetHeaders(data)

	// 3. Establecer estilos (Cabecera)
	headerStyle, err := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Color: "#FFFFFF"},                           // Texto blanco
		Fill:      excelize.Fill{Type: "pattern", Pattern: 1, Color: []string{"#FF8C00"}}, // Naranja (primary-link)
		Alignment: &excelize.Alignment{Horizontal: "center"},
	})
	if err != nil {
		return "", fmt.Errorf("error al definir estilo de cabecera: %w", err)
	}

	// Estilo de filas alternas (Gris Claro)
	rowAltStyle, err := f.NewStyle(&excelize.Style{
		Fill: excelize.Fill{Type: "pattern", Pattern: 1, Color: []string{"#F3F4F6"}}, // Gris claro (bg-gray-50)
	})
	if err != nil {
		return "", fmt.Errorf("error al definir estilo de fila: %w", err)
	}

	// 4. Generar la Cabecera (Fila 1) y anchos de columna
	for i, header := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(sheetName, cell, header)
		f.SetCellStyle(sheetName, cell, cell, headerStyle)

		// Ajustar ancho de columna genérico
		f.SetColWidth(sheetName, cell[:len(cell)-1], cell[:len(cell)-1], 18)
	}

	// 5. Generar las Filas de Datos (A partir de Fila 2)
	for rowNum, rowData := range data {

		currentStyle := rowAltStyle

		// Si rowNum es par (0, 2, 4...), la fila de datos es la Fila 2, 4, 6... (gris claro)
		if rowNum%2 == 0 {
			currentStyle = rowAltStyle
		} else {
			// Si rowNum es impar (1, 3, 5...), la fila de datos es la Fila 3, 5, 7... (blanco)
			currentStyle, _ = f.NewStyle(&excelize.Style{
				Fill: excelize.Fill{Type: "pattern", Pattern: 1, Color: []string{"#FFFFFF"}},
			})
		}

		// La fila de datos comienza en la fila 2 (rowNum + 2)
		for colIndex, header := range headers {
			cell, _ := excelize.CoordinatesToCellName(colIndex+1, rowNum+2)

			value := rowData[header]

			// Intentar convertir a número si aplica (mejor para Excel)
			if floatValue, err := tryConvertToFloat(value); err == nil {
				f.SetCellValue(sheetName, cell, floatValue)
			} else {
				f.SetCellValue(sheetName, cell, value)
			}

			f.SetCellStyle(sheetName, cell, cell, currentStyle)
		}
	}

	// 6. Generar la ruta del archivo
	reportClean := strings.ReplaceAll(reportName, " ", "")
	reportClean = strings.ReplaceAll(reportClean, "/", "_")
	reportClean = strings.ReplaceAll(reportClean, "🏢", "") // Limpiar emoji si no se hizo antes

	dateString := time.Now().Format("02012006")
	fileName := fmt.Sprintf("%s-%s.xlsx", strings.ToUpper(reportClean), dateString)

	// Crear el directorio ./documentos si no existe
	if err := os.MkdirAll(DocumentsDir, 0755); err != nil {
		return "", fmt.Errorf("error al crear directorio: %w", err)
	}

	filePath := filepath.Join(DocumentsDir, fileName)

	// 7. Guardar el archivo
	if err := f.SaveAs(filePath); err != nil {
		return "", fmt.Errorf("error al guardar archivo XLSX: %w", err)
	}

	// 8. Devolver la URL de descarga relativa al path estático
	downloadURL := "/" + filepath.Base(DocumentsDir) + "/" + filepath.Base(filePath)

	return downloadURL, nil
}

// Función auxiliar para intentar convertir valores a float.
func tryConvertToFloat(s string) (float64, error) {
	// Intentamos parsear el string como float
	if f, err := strconv.ParseFloat(s, 64); err == nil {
		return f, nil
	}
	// Si la cadena es "Sí" o "No" (booleanos) o texto nulo, no es un número real.
	if strings.EqualFold(s, "Sí") || strings.EqualFold(s, "No") || s == "-" || s == "N/A" {
		return 0, fmt.Errorf("no es un número booleano o texto")
	}
	return 0, fmt.Errorf("no es un número")
}
