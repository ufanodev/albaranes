package utils

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/jung-kurt/gofpdf"
)

// Orden preferido de columnas (las que no estén aquí se colocan justo antes de TOTAL)
var ordenColumnas = []string{
	"Nº ALBARÁN", "FECHA", "LIC", "EMPRESA", "EXPEDIENTE",
	"Nº FACTURA", "OBSERVACIONES", "TOTAL",
}

// Peso relativo del ancho de cada columna (por defecto 1.0)
var pesoColumnas = map[string]float64{
	"Nº ALBARÁN":    1.7,
	"FECHA":         0.9,
	"LIC":           0.5,
	"EMPRESA":       1.6,
	"EXPEDIENTE":    1.1,
	"Nº FACTURA":    1.2,
	"OBSERVACIONES": 3.2,
	"TOTAL":         0.9,
}

const maxLineasCelda = 6

// GenerateGenericPDF genera un PDF con tabla multilínea y sumatorio final
func GenerateGenericPDF(reportName string, data interface{}) (string, error) {
	var lista []TitularData

	switch v := data.(type) {
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
		return "", fmt.Errorf("formato no compatible: %T", data)
	}

	if len(lista) == 0 {
		return "", fmt.Errorf("no hay datos")
	}

	headers := ordenarHeaders(GetHeaders(lista))
	reportClean := strings.ReplaceAll(reportName, " ", "")
	filePath, err := getPDFFilePath(reportClean)
	if err != nil {
		return "", err
	}

	pdf := gofpdf.New("L", "mm", "A4", "")
	pdf.SetMargins(10, 12, 10)
	pdf.SetAutoPageBreak(false, 12) // los saltos se controlan a mano para repetir cabecera
	pdf.AliasNbPages("")
	tr := pdf.UnicodeTranslatorFromDescriptor("") // UTF-8 -> cp1252 (€, tildes, ñ, º)

	pdf.SetFooterFunc(func() {
		pdf.SetY(-10)
		pdf.SetFont("Arial", "", 7)
		pdf.SetTextColor(150, 150, 150)
		pdf.CellFormat(0, 5, tr(fmt.Sprintf("Página %d/{nb}", pdf.PageNo())), "", 0, "R", false, 0, "")
	})

	pdf.AddPage()
	renderPDFHeader(pdf, tr, reportName, len(lista))
	renderPDFTable(pdf, tr, headers, lista)

	if err := pdf.OutputFileAndClose(filePath); err != nil {
		return "", fmt.Errorf("error al guardar: %w", err)
	}

	return "/" + filepath.Base(DocumentsDir) + "/" + filepath.Base(filePath), nil
}

func getPDFFilePath(reportName string) (string, error) {
	if err := os.MkdirAll(DocumentsDir, 0755); err != nil {
		return "", err
	}
	dateString := time.Now().Format("02012006_150405")
	fileName := fmt.Sprintf("%s-%s.pdf", strings.ToUpper(reportName), dateString)
	return filepath.Join(DocumentsDir, fileName), nil
}

func renderPDFHeader(pdf *gofpdf.Fpdf, tr func(string) string, title string, registros int) {
	pdf.SetFont("Arial", "", 18)
	pdf.SetTextColor(40, 40, 40)
	pdf.CellFormat(0, 10, tr(strings.ToUpper(title)), "", 1, "L", false, 0, "")
	pdf.SetFont("Arial", "", 9)
	pdf.SetTextColor(110, 110, 110)
	pdf.CellFormat(0, 6, tr(fmt.Sprintf("Fecha: %s | Registros: %d",
		time.Now().Format("02/01/2006 15:04"), registros)), "", 1, "L", false, 0, "")
	pdf.Ln(4)
}

func renderPDFTable(pdf *gofpdf.Fpdf, tr func(string) string, headers []string, data []TitularData) {
	const lineHt = 4.0
	const padV = 1.5

	left, _, right, bottom := pdf.GetMargins()
	pageW, pageH := pdf.GetPageSize()
	widths := calcularAnchos(headers, pageW-left-right)
	limiteY := pageH - bottom

	totalCol := -1
	for i, h := range headers {
		if esColumnaTotal(h) {
			totalCol = i
		}
	}

	cabecera := func() {
		pdf.SetFont("Arial", "B", 8)
		pdf.SetFillColor(30, 41, 59)
		pdf.SetDrawColor(30, 41, 59)
		pdf.SetTextColor(255, 255, 255)
		for i, h := range headers {
			pdf.CellFormat(widths[i], 8, tr(strings.ToUpper(h)), "1", 0, "C", true, 0, "")
		}
		pdf.Ln(-1)
	}
	cabecera()

	var granTotal float64

	for r, row := range data {
		// 1) Partir el texto de cada celda en líneas y calcular la altura de la fila
		lineas := make([][]string, len(headers))
		maxL := 1
		for j, h := range headers {
			val := strings.TrimSpace(strings.ReplaceAll(row[h], "\r", ""))
			if j == totalCol {
				granTotal += parseImporte(val)
			}
			setFuenteCelda(pdf, j, totalCol)
			partes := pdf.SplitLines([]byte(tr(val)), widths[j])
			ls := make([]string, 0, len(partes))
			for _, p := range partes {
				ls = append(ls, string(p))
			}
			if len(ls) == 0 {
				ls = []string{""}
			}
			if len(ls) > maxLineasCelda {
				ls = ls[:maxLineasCelda]
				ls[maxLineasCelda-1] += "..."
			}
			lineas[j] = ls
			if len(ls) > maxL {
				maxL = len(ls)
			}
		}
		rowH := float64(maxL)*lineHt + 2*padV

		// 2) Salto de página si la fila no cabe (repite cabecera)
		if pdf.GetY()+rowH > limiteY {
			pdf.AddPage()
			cabecera()
		}

		// 3) Dibujar la fila
		if r%2 == 0 {
			pdf.SetFillColor(245, 247, 250)
		} else {
			pdf.SetFillColor(255, 255, 255)
		}
		pdf.SetDrawColor(226, 232, 240)
		pdf.SetTextColor(30, 30, 30)

		x, y := left, pdf.GetY()
		for j := range headers {
			pdf.Rect(x, y, widths[j], rowH, "FD")
			setFuenteCelda(pdf, j, totalCol)
			align := "L"
			if j == totalCol {
				align = "R"
			}
			for k, l := range lineas[j] {
				pdf.SetXY(x, y+padV+float64(k)*lineHt)
				pdf.CellFormat(widths[j], lineHt, l, "", 0, align, false, 0, "")
			}
			x += widths[j]
		}
		pdf.SetXY(left, y+rowH)
	}

	// 4) Fila final de TOTAL
	if totalCol == -1 {
		return
	}
	if pdf.GetY()+9 > limiteY {
		pdf.AddPage()
		cabecera()
	}

	pdf.SetFont("Arial", "B", 9)
	pdf.SetFillColor(226, 232, 240)
	pdf.SetDrawColor(30, 41, 59)
	pdf.SetTextColor(30, 41, 59)

	labelW := 0.0
	for j := 0; j < totalCol; j++ {
		labelW += widths[j]
	}
	if labelW > 0 {
		pdf.CellFormat(labelW, 9, tr(fmt.Sprintf("TOTAL (%d registros):  ", len(data))), "1", 0, "R", true, 0, "")
	}
	pdf.CellFormat(widths[totalCol], 9, tr(formatEUR(granTotal)), "1", 0, "R", true, 0, "")
	for j := totalCol + 1; j < len(headers); j++ {
		pdf.CellFormat(widths[j], 9, "", "1", 0, "L", true, 0, "")
	}
	pdf.Ln(-1)
}

// ---------- helpers ----------

func setFuenteCelda(pdf *gofpdf.Fpdf, col, totalCol int) {
	if col == 0 || col == totalCol {
		pdf.SetFont("Arial", "B", 7.5)
	} else {
		pdf.SetFont("Arial", "", 7.5)
	}
}

func normHeader(h string) string {
	return strings.ToUpper(strings.TrimSpace(h))
}

func esColumnaTotal(h string) bool {
	switch normHeader(h) {
	case "TOTAL", "IMPORTE", "TOTAL EUR":
		return true
	}
	return false
}

func ordenarHeaders(headers []string) []string {
	pos := make(map[string]int, len(ordenColumnas))
	for i, h := range ordenColumnas {
		pos[h] = i * 2
	}
	desconocida := pos["TOTAL"] - 1
	p := func(h string) int {
		if v, ok := pos[normHeader(h)]; ok {
			return v
		}
		return desconocida
	}
	out := append([]string(nil), headers...)
	sort.SliceStable(out, func(a, b int) bool { return p(out[a]) < p(out[b]) })
	return out
}

func calcularAnchos(headers []string, total float64) []float64 {
	w := make([]float64, len(headers))
	suma := 0.0
	for i, h := range headers {
		peso, ok := pesoColumnas[normHeader(h)]
		if !ok {
			peso = 1.0
		}
		w[i] = peso
		suma += peso
	}
	for i := range w {
		w[i] = w[i] / suma * total
	}
	return w
}

// parseImporte acepta "€1,234.56", "1.234,56 €", "36.00", "36,00"...
func parseImporte(s string) float64 {
	var b strings.Builder
	for _, c := range s {
		if (c >= '0' && c <= '9') || c == ',' || c == '.' || c == '-' {
			b.WriteRune(c)
		}
	}
	v := b.String()
	lc, ld := strings.LastIndex(v, ","), strings.LastIndex(v, ".")
	switch {
	case lc > ld: // coma decimal
		v = strings.ReplaceAll(v, ".", "")
		v = strings.ReplaceAll(v, ",", ".")
	case ld > lc && lc != -1: // punto decimal con comas de miles
		v = strings.ReplaceAll(v, ",", "")
	}
	n, _ := strconv.ParseFloat(v, 64)
	return n
}

// formatEUR devuelve "€1,234.56" (mismo estilo que la tabla)
func formatEUR(n float64) string {
	s := strconv.FormatFloat(n, 'f', 2, 64)
	neg := strings.HasPrefix(s, "-")
	if neg {
		s = s[1:]
	}
	ent, dec := s[:len(s)-3], s[len(s)-2:]
	var out []byte
	for i := 0; i < len(ent); i++ {
		if i > 0 && (len(ent)-i)%3 == 0 {
			out = append(out, ',')
		}
		out = append(out, ent[i])
	}
	res := "€" + string(out) + "." + dec
	if neg {
		res = "-" + res
	}
	return res
}
