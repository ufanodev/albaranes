package utils

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/xuri/excelize/v2"
)

// GenerateTitularesXLSX genera un Excel con sumatorio en la última línea.
func GenerateTitularesXLSX(reportName string, data interface{}) (string, error) {
	var lista []TitularData

	switch v := data.(type) {
	case []TitularData:
		lista = v
	case []interface{}:
		for _, item := range v {
			if m, ok := item.(map[string]interface{}); ok {
				convertedMap := make(TitularData)
				for k, val := range m {
					convertedMap[k] = fmt.Sprintf("%v", val)
				}
				lista = append(lista, convertedMap)
			}
		}
	default:
		return "", fmt.Errorf("formato de datos no compatible para Excel: %T", data)
	}

	if len(lista) == 0 {
		return "", fmt.Errorf("no hay datos para generar el XLSX")
	}

	f := excelize.NewFile()
	sheetName := "Reporte"
	f.SetSheetName("Sheet1", sheetName)

	headers := GetHeaders(lista)

	// --- ESTILOS ---
	headerStyle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Color: "#FFFFFF"},
		Fill:      excelize.Fill{Type: "pattern", Pattern: 1, Color: []string{"#FF8C00"}},
		Alignment: &excelize.Alignment{Horizontal: "center"},
	})

	rowAltStyle, _ := f.NewStyle(&excelize.Style{
		Fill: excelize.Fill{Type: "pattern", Pattern: 1, Color: []string{"#F3F4F6"}},
	})

	totalStyle, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Bold: true},
		Fill: excelize.Fill{Type: "pattern", Pattern: 1, Color: []string{"#FFDAB9"}}, // Pastel
		Border: []excelize.Border{
			{Type: "top", Color: "000000", Style: 1},
		},
	})

	// --- LÓGICA DE SUMATORIO ---
	var granTotal float64
	totalColIndex := -1

	// 5. Renderizar Cabecera
	for i, header := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(sheetName, cell, header)
		f.SetCellStyle(sheetName, cell, cell, headerStyle)
		f.SetColWidth(sheetName, cell[:len(cell)-1], cell[:len(cell)-1], 20)

		// Identificar columna numérica
		upH := strings.ToUpper(header)
		if upH == "TOTAL" || upH == "IMPORTE" || upH == "TOTAL EUR" {
			totalColIndex = i + 1
		}
	}

	// 6. Renderizar Filas de Datos
	lastRowNum := 1
	for rowNum, rowData := range lista {
		currentRow := rowNum + 2
		for colIndex, header := range headers {
			cell, _ := excelize.CoordinatesToCellName(colIndex+1, currentRow)
			value := rowData[header]

			if floatValue, err := tryConvertToFloat(value); err == nil {
				f.SetCellValue(sheetName, cell, floatValue)
				// Si es la columna de importe, sumar al gran total
				if (colIndex + 1) == totalColIndex {
					granTotal += floatValue
				}
			} else {
				f.SetCellValue(sheetName, cell, value)
			}

			if rowNum%2 == 0 {
				f.SetCellStyle(sheetName, cell, cell, rowAltStyle)
			}
		}
		lastRowNum = currentRow
	}

	// --- 7. FILA DE TOTAL FINAL ---
	if totalColIndex != -1 {
		totalRow := lastRowNum + 1

		// Recorrer todas las columnas para aplicar el estilo a la fila final
		for i := 1; i <= len(headers); i++ {
			cell, _ := excelize.CoordinatesToCellName(i, totalRow)
			f.SetCellStyle(sheetName, cell, cell, totalStyle)

			if i == totalColIndex-1 {
				f.SetCellValue(sheetName, cell, "TOTAL:")
			} else if i == totalColIndex {
				f.SetCellValue(sheetName, cell, granTotal)
			}
		}
	}

	// 8. Guardar Archivo
	reportClean := strings.ReplaceAll(reportName, " ", "_")
	if err := os.MkdirAll(DocumentsDir, 0755); err != nil {
		return "", err
	}

	fileName := fmt.Sprintf("EXCEL_%s_%s.xlsx", strings.ToUpper(reportClean), time.Now().Format("20060102_150405"))
	filePath := filepath.Join(DocumentsDir, fileName)

	if err := f.SaveAs(filePath); err != nil {
		return "", err
	}

	return "/documentos/" + fileName, nil
}

// tryConvertToFloat intenta convertir strings a números para el Excel
func tryConvertToFloat(s string) (float64, error) {
	if strings.EqualFold(s, "Sí") || strings.EqualFold(s, "No") || s == "-" || s == "" {
		return 0, fmt.Errorf("no numérico")
	}
	cleanStr := strings.ReplaceAll(s, " €", "")
	cleanStr = strings.ReplaceAll(cleanStr, "€", "")
	cleanStr = strings.ReplaceAll(cleanStr, " ", "")
	cleanStr = strings.ReplaceAll(cleanStr, ",", ".")
	return strconv.ParseFloat(cleanStr, 64)
}
