package utils

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/jung-kurt/gofpdf"
)

// GenerateGenericPDF genera un archivo PDF con sumatorio automático al final
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
					convertedMap[k] = fmt.Sprintf("%v", val)
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

	headers := GetHeaders(lista)
	reportClean := strings.ReplaceAll(reportName, " ", "")
	filePath, err := getPDFFilePath(reportClean)
	if err != nil {
		return "", err
	}

	pdf := gofpdf.New("L", "mm", "A4", "")
	pdf.AddPage()

	renderPDFHeader(pdf, reportName)
	renderPDFTable(pdf, headers, lista)

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

func renderPDFHeader(pdf *gofpdf.Fpdf, title string) {
	pdf.SetFont("Arial", "B", 16)
	pdf.SetTextColor(255, 140, 0)
	pdf.Cell(0, 10, strings.ToUpper(title))
	pdf.Ln(8)
	pdf.SetFont("Arial", "", 10)
	pdf.SetTextColor(100, 100, 100)
	pdf.Cell(0, 5, fmt.Sprintf("Generado el: %s", time.Now().Format("02/01/2006 15:04:05")))
	pdf.Ln(10)
}

func renderPDFTable(pdf *gofpdf.Fpdf, headers []string, data []TitularData) {
	lineHt := 7.0
	pageWidth := 277.0
	colWidth := pageWidth / float64(len(headers))

	// --- LÓGICA DE SUMATORIO ---
	var granTotal float64
	totalColIndex := -1

	// Identificar la columna de importe (en JS pusimos "TOTAL" o "Importe")
	for i, h := range headers {
		upperH := strings.ToUpper(h)
		if upperH == "TOTAL" || upperH == "IMPORTE" || upperH == "TOTAL EUR" {
			totalColIndex = i
		}
	}

	// CABECERA
	pdf.SetFont("Arial", "B", 8)
	pdf.SetFillColor(255, 140, 0)
	pdf.SetTextColor(255, 255, 255)
	for _, str := range headers {
		pdf.CellFormat(colWidth, lineHt, str, "1", 0, "C", true, 0, "")
	}
	pdf.Ln(lineHt)

	// CUERPO
	pdf.SetFont("Arial", "", 7)
	pdf.SetTextColor(0, 0, 0)
	for i, row := range data {
		if i%2 == 0 {
			pdf.SetFillColor(245, 245, 245)
		} else {
			pdf.SetFillColor(255, 255, 255)
		}

		for j, header := range headers {
			val := row[header]

			// Si es la columna de total, acumulamos el valor numérico
			if j == totalColIndex {
				cleanVal := strings.ReplaceAll(val, "€", "")
				cleanVal = strings.ReplaceAll(cleanVal, " ", "")
				cleanVal = strings.ReplaceAll(cleanVal, ",", ".")
				num, _ := strconv.ParseFloat(cleanVal, 64)
				granTotal += num
			}

			if len(val) > 30 {
				val = val[:27] + "..."
			}

			align := "L"
			if j == totalColIndex {
				align = "R"
			} // Importes a la derecha
			pdf.CellFormat(colWidth, lineHt, val, "1", 0, align, true, 0, "")
		}
		pdf.Ln(lineHt)
	}

	// --- FILA FINAL DE TOTALES ---
	if totalColIndex != -1 {
		pdf.SetFont("Arial", "B", 8)
		pdf.SetFillColor(255, 240, 210) // Naranja pastel muy suave
		pdf.SetTextColor(0, 0, 0)

		for j := 0; j < len(headers); j++ {
			if j == totalColIndex-1 {
				// Escribimos la etiqueta "TOTAL:" justo antes de la cifra
				pdf.CellFormat(colWidth, lineHt, "TOTAL:", "1", 0, "R", true, 0, "")
			} else if j == totalColIndex {
				// Escribimos la suma
				pdf.CellFormat(colWidth, lineHt, fmt.Sprintf("%.2f EUR", granTotal), "1", 0, "R", true, 0, "")
			} else {
				// Celdas vacías para el resto
				pdf.CellFormat(colWidth, lineHt, "", "1", 0, "L", true, 0, "")
			}
		}
		pdf.Ln(lineHt)
	}
}
