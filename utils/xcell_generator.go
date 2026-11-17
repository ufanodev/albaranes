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
	"estado":       true, // borrado lógico: siempre 0 en lo exportado
}

// Columnas de hora que se guardan en UTC (ver formatDateTimeWithOffset en el
// controlador). En el Excel se muestran en hora de Madrid, como en pantalla.
var columnasHora = map[string]bool{
	"hora":          true,
	"hora_ini":      true,
	"hora_fin":      true,
	"espera_ini":    true,
	"espera_fin":    true,
	"tiempo_espera": true,
}

// Columnas que suman en la fila TOTAL (en mayúsculas)
var columnasSuma = map[string]bool{
	"TOTAL":         true,
	"IMPORTE":       true,
	"TOTAL EUR":     true,
	"IMPORTE_TOTAL": true,
	"IMPORTE TOTAL": true,
}

var zonaMadrid, _ = time.LoadLocation("Europe/Madrid")

// horaLocal convierte "2026-11-12 09:30:00" (UTC) en "10:30" (Madrid).
// Si no reconoce el formato, devuelve el valor tal cual.
func horaLocal(v string) string {
	if v == "" || zonaMadrid == nil {
		return v
	}
	for _, layout := range []string{"2006-01-02 15:04:05", time.RFC3339Nano} {
		if t, err := time.ParseInLocation(layout, v, time.UTC); err == nil {
			return t.In(zonaMadrid).Format("15:04")
		}
	}
	return v
}

// fechaLegible acorta "2026-11-12T00:00:00Z" (driver con parseTime=true) a
// "2026-11-12", o a "2026-11-12 10:30" si lleva hora. Otros valores, tal cual.
func fechaLegible(v string) string {
	if !strings.Contains(v, "T") || zonaMadrid == nil {
		return v
	}
	t, err := time.Parse(time.RFC3339Nano, v)
	if err != nil {
		return v
	}
	if t.Hour() == 0 && t.Minute() == 0 && t.Second() == 0 {
		return t.Format("2006-01-02")
	}
	return t.In(zonaMadrid).Format("2006-01-02 15:04")
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
			v := vals[i].String
			if columnasHora[c] {
				v = horaLocal(v)
			} else {
				v = fechaLegible(v)
			}
			row[c] = v
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

	altFill := excelize.Fill{Type: "pattern", Pattern: 1, Color: []string{"#F3F4F6"}}
	rowAltStyle, _ := f.NewStyle(&excelize.Style{Fill: altFill})

	// Fechas reales de Excel mostradas como dd/mm/yyyy (se pueden ordenar y filtrar)
	fmtFecha, fmtFechaHora := "dd/mm/yyyy", "dd/mm/yyyy hh:mm"
	fechaStyle, _ := f.NewStyle(&excelize.Style{CustomNumFmt: &fmtFecha})
	fechaAltStyle, _ := f.NewStyle(&excelize.Style{CustomNumFmt: &fmtFecha, Fill: altFill})
	fechaHoraStyle, _ := f.NewStyle(&excelize.Style{CustomNumFmt: &fmtFechaHora})
	fechaHoraAltStyle, _ := f.NewStyle(&excelize.Style{CustomNumFmt: &fmtFechaHora, Fill: altFill})

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
		if columnasSuma[strings.ToUpper(strings.TrimSpace(header))] {
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
			alt := rowNum%2 == 0
			estilo := 0
			if alt {
				estilo = rowAltStyle
			}

			if t, conHora, ok := parseFechaExcel(value); ok && esColumnaFecha(header) {
				f.SetCellValue(sheetName, cell, t)
				switch {
				case conHora && alt:
					estilo = fechaHoraAltStyle
				case conHora:
					estilo = fechaHoraStyle
				case alt:
					estilo = fechaAltStyle
				default:
					estilo = fechaStyle
				}
			} else if columnasTexto[strings.ToLower(header)] {
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

			if estilo != 0 {
				f.SetCellStyle(sheetName, cell, cell, estilo)
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

// esColumnaFecha: columnas que se escriben como fecha real de Excel.
func esColumnaFecha(h string) bool {
	h = strings.ToLower(strings.TrimSpace(h))
	return strings.Contains(h, "fecha") || h == "created_at" || h == "updated_at"
}

// parseFechaExcel reconoce "2026-11-12", "2026-11-12 10:30" y "2026-11-12 10:30:00".
// conHora indica si la hora no es 00:00 (para usar el formato dd/mm/yyyy hh:mm).
func parseFechaExcel(v string) (time.Time, bool, bool) {
	v = strings.TrimSpace(v)
	for _, layout := range []string{"2006-01-02 15:04:05", "2006-01-02 15:04"} {
		if t, err := time.Parse(layout, v); err == nil {
			return t, t.Hour() != 0 || t.Minute() != 0 || t.Second() != 0, true
		}
	}
	if len(v) >= 10 {
		if t, err := time.Parse("2006-01-02", v[:10]); err == nil {
			return t, false, true
		}
	}
	return time.Time{}, false, false
}

// tryConvertToFloat convierte importes y números a float ("€1,234.56", "1.234,56 €", "0.35").
// Devuelve error (=> se guarda como texto) si hay letras, fechas, horas
// o ceros a la izquierda tipo "000123".
func tryConvertToFloat(s string) (float64, error) {
	limpio := strings.NewReplacer("€", "", " ", "", " ", "").Replace(strings.TrimSpace(s))
	if limpio == "" || limpio == "-" {
		return 0, fmt.Errorf("no numérico")
	}
	for _, c := range limpio {
		if !((c >= '0' && c <= '9') || c == ',' || c == '.' || c == '-') {
			return 0, fmt.Errorf("no numérico")
		}
	}
	// Códigos con ceros a la izquierda: se mantienen como texto
	if len(limpio) > 1 && limpio[0] == '0' && limpio[1] >= '0' && limpio[1] <= '9' {
		return 0, fmt.Errorf("código con ceros")
	}
	return strconv.ParseFloat(normalizarDecimal(limpio), 64)
}
