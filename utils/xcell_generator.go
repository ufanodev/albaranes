package utils

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/xuri/excelize/v2"
)

// ============================================================
// CONFIGURACIÓN
// ============================================================

// ExcelData permite pasar las cabeceras en un orden concreto.
type ExcelData struct {
	Headers []string
	Rows    []TitularData
}

// Columnas que nunca se exportan al Excel
var columnasExcluidas = map[string]bool{
	"licencia_ref": true,
	"empresa_ref":  true,
}

// Columnas que deben quedarse como texto (no perder ceros a la izquierda)
var columnasTexto = map[string]bool{
	"licencia": true,
	"cp":       true,
	"nif":      true,
	"dni":      true,
	"telefono": true,
}

// ============================================================
// CONSULTA DE ALBARANES
// ============================================================

// a.* trae todas las columnas de albaranes. Las dos columnas finales se llaman
// igual que licencia y empresa_nombre y, al escanear, sobrescriben a las originales.
// COALESCE mantiene el valor guardado en albaranes si la referencia no existe.
const queryAlbaranesExcel = `
SELECT a.*,
       COALESCE(l.licencia, a.licencia)       AS licencia,
       COALESCE(e.nombre,   a.empresa_nombre) AS empresa_nombre
FROM albaranes a
LEFT JOIN licencias l ON l.id = a.licencia_ref
LEFT JOIN empresas  e ON e.id = a.empresa_ref
`

// GetAlbaranesExcel devuelve los albaranes con licencia y empresa resueltas.
// where debe empezar por " WHERE ..." y/o " ORDER BY ..." (o ir vacío).
func GetAlbaranesExcel(db *sql.DB, where string, args ...interface{}) (ExcelData, error) {
	var out ExcelData

	rows, err := db.Query(queryAlbaranesExcel+where, args...)
	if err != nil {
		return out, err
	}
	defer rows.Close()

	cols, err := rows.Columns()
	if err != nil {
		return out, err
	}

	// Cabeceras en el orden del SELECT, sin duplicados
	seen := make(map[string]bool)
	for _, c := range cols {
		if !seen[c] {
			seen[c] = true
			out.Headers = append(out.Headers, c)
		}
	}

	for rows.Next() {
		vals := make([]sql.NullString, len(cols))
		ptrs := make([]interface{}, len(cols))
		for i := range vals {
			ptrs[i] = &vals[i]
		}
		if err := rows.Scan(ptrs...); err != nil {
			return out, err
		}

		row := make(TitularData, len(cols))
		for i, c := range cols {
			// Las columnas repetidas (licencia, empresa_nombre) llegan después
			// en el SELECT, así que se queda el valor del JOIN.
			row[c] = vals[i].String
		}
		out.Rows = append(out.Rows, row)
	}
	return out, rows.Err()
}

// GenerateAlbaranesXLSX consulta los albaranes y genera el Excel en un solo paso.
func GenerateAlbaranesXLSX(db *sql.DB, reportName string, where string, args ...interface{}) (string, error) {
	data, err := GetAlbaranesExcel(db, where, args...)
	if err != nil {
		return "", err
	}
	return GenerateTitularesXLSX(reportName, data)
}

// ============================================================
// GENERADOR DE EXCEL
// ============================================================

// GenerateTitularesXLSX genera un Excel con sumatorio en la última línea.
func GenerateTitularesXLSX(reportName string, data interface{}) (string, error) {
	var lista []TitularData
	var headers []string

	switch v := data.(type) {
	case ExcelData:
		lista, headers = v.Rows, v.Headers
	case *ExcelData:
		lista, headers = v.Rows, v.Headers
	case []TitularData:
		lista = v
	case []interface{}:
		for _, item := range v {
			if m, ok := item.(map[string]interface{}); ok {
				convertedMap := make(TitularData)
				for k, val := range m {
					if val == nil {
						convertedMap[k] = ""
					} else {
						convertedMap[k] = fmt.Sprintf("%v", val)
					}
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
	if len(headers) == 0 {
		headers = GetHeaders(lista)
	}

	// Quitar columnas excluidas
	var filtradas []string
	for _, h := range headers {
		if !columnasExcluidas[strings.ToLower(h)] {
			filtradas = append(filtradas, h)
		}
	}
	headers = filtradas
	if len(headers) == 0 {
		return "", fmt.Errorf("no quedan columnas para exportar")
	}

	f := excelize.NewFile()
	defer f.Close()
	sheetName := "Reporte"
	f.SetSheetName("Sheet1", sheetName)

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

	// Cabecera
	for i, header := range headers {
		colName, _ := excelize.ColumnNumberToName(i + 1)
		cell := colName + "1"
		f.SetCellValue(sheetName, cell, header)
		f.SetCellStyle(sheetName, cell, cell, headerStyle)
		f.SetColWidth(sheetName, colName, colName, 20)

		// Identificar columna numérica
		upH := strings.ToUpper(header)
		if upH == "TOTAL" || upH == "IMPORTE" || upH == "TOTAL EUR" {
			totalColIndex = i + 1
		}
	}

	// Filas de datos
	lastRowNum := 1
	for rowNum, rowData := range lista {
		currentRow := rowNum + 2
		for colIndex, header := range headers {
			cell, _ := excelize.CoordinatesToCellName(colIndex+1, currentRow)
			value := rowData[header]

			if columnasTexto[strings.ToLower(header)] {
				f.SetCellStr(sheetName, cell, value)
			} else if floatValue, err := tryConvertToFloat(value); err == nil {
				f.SetCellValue(sheetName, cell, floatValue)
				// Si es la columna de importe, sumar al gran total
				if colIndex+1 == totalColIndex {
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

	// Fila de total final
	if totalColIndex != -1 {
		totalRow := lastRowNum + 1
		labelCol := totalColIndex - 1
		if labelCol < 1 { // si el total es la primera columna
			labelCol = totalColIndex + 1
		}

		for i := 1; i <= len(headers); i++ {
			cell, _ := excelize.CoordinatesToCellName(i, totalRow)
			f.SetCellStyle(sheetName, cell, cell, totalStyle)

			switch i {
			case labelCol:
				f.SetCellValue(sheetName, cell, "TOTAL:")
			case totalColIndex:
				f.SetCellValue(sheetName, cell, granTotal)
			}
		}
	}

	// Congelar la cabecera y añadir autofiltro
	f.SetPanes(sheetName, &excelize.Panes{
		Freeze:      true,
		YSplit:      1,
		TopLeftCell: "A2",
		ActivePane:  "bottomLeft",
	})
	lastCol, _ := excelize.ColumnNumberToName(len(headers))
	f.AutoFilter(sheetName, fmt.Sprintf("A1:%s%d", lastCol, lastRowNum), nil)

	// Guardar archivo
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
	cleanStr := strings.ReplaceAll(s, "€", "")
	cleanStr = strings.ReplaceAll(cleanStr, " ", "")
	cleanStr = strings.ReplaceAll(cleanStr, ",", ".")
	return strconv.ParseFloat(cleanStr, 64)
}
