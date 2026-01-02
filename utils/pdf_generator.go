package utils

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/jung-kurt/gofpdf"
)

// GenerateGenericPDF genera un archivo PDF aceptando interface{} para evitar errores de tipo en el controlador.
func GenerateGenericPDF(reportName string, data interface{}) (string, error) {
	// 1. Convertir la interfaz genérica a []TitularData de forma segura
	var lista []TitularData

	switch v := data.(type) {
	case []TitularData:
		lista = v
	case []interface{}:
		// Si viene decodificado de JSON como []interface{}
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
		return "", fmt.Errorf("formato de datos no compatible para PDF: %T", data)
	}

	// 2. Validar datos convertidos
	if len(lista) == 0 {
		return "", fmt.Errorf("no hay datos para generar el PDF")
	}

	headers := GetHeaders(lista)
	if len(headers) == 0 {
		return "", fmt.Errorf("la estructura de datos no contiene columnas")
	}

	// 3. Generar la ruta del archivo
	reportClean := strings.ReplaceAll(reportName, " ", "")
	filePath, err := getPDFFilePath(reportClean)
	if err != nil {
		return "", err
	}

	// 4. Iniciar PDF (L = Landscape / Horizontal)
	pdf := gofpdf.New("L", "mm", "A4", "")
	pdf.AddPage()

	renderPDFHeader(pdf, reportName)
	renderPDFTable(pdf, headers, lista)

	// 5. Guardar
	if err := pdf.OutputFileAndClose(filePath); err != nil {
		return "", fmt.Errorf("error al guardar el archivo PDF: %w", err)
	}

	// 6. Devolver la URL de descarga
	downloadURL := "/" + filepath.Base(DocumentsDir) + "/" + filepath.Base(filePath)

	return downloadURL, nil
}

// getPDFFilePath crea el directorio y devuelve la ruta completa del archivo
func getPDFFilePath(reportName string) (string, error) {
	if err := os.MkdirAll(DocumentsDir, 0755); err != nil {
		return "", err
	}
	dateString := time.Now().Format("02012006_150405")
	fileName := fmt.Sprintf("%s-%s.pdf", strings.ToUpper(reportName), dateString)

	return filepath.Join(DocumentsDir, fileName), nil
}

// Funciones de renderizado auxiliares
func renderPDFHeader(pdf *gofpdf.Fpdf, title string) {
	pdf.SetFont("Arial", "B", 16)
	pdf.SetTextColor(255, 140, 0) // Naranja corporativo
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
	colCount := float64(len(headers))
	colWidth := pageWidth / colCount

	// Cabecera de tabla
	pdf.SetFont("Arial", "B", 8)
	pdf.SetFillColor(255, 140, 0)   // Naranja
	pdf.SetTextColor(255, 255, 255) // Blanco
	for _, str := range headers {
		pdf.CellFormat(colWidth, lineHt, str, "1", 0, "C", true, 0, "")
	}
	pdf.Ln(lineHt)

	// Datos
	pdf.SetFont("Arial", "", 7)
	pdf.SetTextColor(0, 0, 0)
	for i, row := range data {
		if i%2 == 0 {
			pdf.SetFillColor(245, 245, 245) // Gris alterno
		} else {
			pdf.SetFillColor(255, 255, 255)
		}

		for _, header := range headers {
			val := row[header]
			// Control de longitud para evitar desbordamiento
			if len(val) > 30 {
				val = val[:27] + "..."
			}
			pdf.CellFormat(colWidth, lineHt, val, "1", 0, "L", true, 0, "")
		}
		pdf.Ln(lineHt)
	}
}
