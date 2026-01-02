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

// GenerateTitularesXLSX genera un Excel aceptando interface{} para ser universal.
func GenerateTitularesXLSX(reportName string, data interface{}) (string, error) {
	// 1. Convertir la interfaz genérica a []TitularData (Type Assertion robusto)
	var lista []TitularData

	switch v := data.(type) {
	case []TitularData:
		lista = v
	case []interface{}:
		// Caso cuando Gin decodifica JSON genérico
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

	// 2. Crear el archivo Excel
	f := excelize.NewFile()
	sheetName := "Reporte"
	f.SetSheetName("Sheet1", sheetName)

	// 3. Obtener cabeceras (desde export_common.go)
	headers := GetHeaders(lista)

	// 4. Estilos (Cabecera Naranja)
	headerStyle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Color: "#FFFFFF"},
		Fill:      excelize.Fill{Type: "pattern", Pattern: 1, Color: []string{"#FF8C00"}},
		Alignment: &excelize.Alignment{Horizontal: "center"},
	})

	// Estilo Filas Alternas (Gris claro)
	rowAltStyle, _ := f.NewStyle(&excelize.Style{
		Fill: excelize.Fill{Type: "pattern", Pattern: 1, Color: []string{"#F3F4F6"}},
	})

	// 5. Renderizar Cabecera
	for i, header := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(sheetName, cell, header)
		f.SetCellStyle(sheetName, cell, cell, headerStyle)
		f.SetColWidth(sheetName, cell[:len(cell)-1], cell[:len(cell)-1], 20)
	}

	// 6. Renderizar Filas de Datos
	for rowNum, rowData := range lista {
		for colIndex, header := range headers {
			cell, _ := excelize.CoordinatesToCellName(colIndex+1, rowNum+2)
			value := rowData[header]

			// Intentar conversión numérica para que Excel pueda sumar/operar
			if floatValue, err := tryConvertToFloat(value); err == nil {
				f.SetCellValue(sheetName, cell, floatValue)
			} else {
				f.SetCellValue(sheetName, cell, value)
			}

			// Aplicar estilo de cebra
			if rowNum%2 == 0 {
				f.SetCellStyle(sheetName, cell, cell, rowAltStyle)
			}
		}
	}

	// 7. Guardar Archivo
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
	// Limpiar posibles símbolos de moneda o espacios antes de intentar convertir
	cleanStr := strings.ReplaceAll(s, " €", "")
	cleanStr = strings.ReplaceAll(cleanStr, ",", ".")
	return strconv.ParseFloat(cleanStr, 64)
}
