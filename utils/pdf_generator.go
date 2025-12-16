package utils

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/jung-kurt/gofpdf"
)

// NOTA: DocumentsDir, TitularData y GetHeaders ya no se declaran aquí.
// Son accedidas desde el mismo paquete 'utils' después de moverlas a 'export_common.go'.

// GenerateGenericPDF genera un archivo PDF a partir de una matriz de datos genérica.
func GenerateGenericPDF(reportName string, data []TitularData) (string, error) {

	// 1. Validar datos
	if len(data) == 0 {
		return "", fmt.Errorf("no hay datos para generar el PDF")
	}

	headers := GetHeaders(data)
	if len(headers) == 0 {
		return "", fmt.Errorf("la estructura de datos no contiene claves (columnas)")
	}

	// 2. Generar el nombre y ruta completa del archivo
	reportClean := strings.ReplaceAll(reportName, " ", "")
	filePath, err := getPDFFilePath(reportClean)
	if err != nil {
		return "", fmt.Errorf("error al obtener la ruta del archivo: %w", err)
	}

	// Si quieres visualizar cómo quedaría el PDF:
	//

	// 3. Iniciar gofpdf y Renderizar
	pdf := gofpdf.New("L", "mm", "A4", "")
	pdf.AddPage()

	renderPDFHeader(pdf, reportName)
	renderPDFTable(pdf, headers, data)

	// 4. Guardar
	if err := pdf.OutputFileAndClose(filePath); err != nil {
		return "", fmt.Errorf("error al guardar el archivo PDF: %w", err)
	}

	// 5. Devolver la URL de descarga
	downloadURL := "/" + filepath.Base(DocumentsDir) + "/" + filepath.Base(filePath)

	return downloadURL, nil
}

// getPDFFilePath crea el directorio y devuelve la ruta completa del archivo
func getPDFFilePath(reportName string) (string, error) {
	// DocumentsDir ya está definido en export_common.go
	if err := os.MkdirAll(DocumentsDir, 0755); err != nil {
		return "", err
	}
	dateString := time.Now().Format("02012006")
	fileName := fmt.Sprintf("%s-%s.pdf", strings.ToUpper(reportName), dateString)

	return filepath.Join(DocumentsDir, fileName), nil
}

// Funciones de renderizado (se mantienen como auxiliares)
func renderPDFHeader(pdf *gofpdf.Fpdf, title string) {
	pdf.SetFont("Arial", "B", 16)
	pdf.Cell(40, 10, title)
	pdf.Ln(8)
	pdf.SetFont("Arial", "", 10)
	pdf.Cell(0, 5, fmt.Sprintf("Generado el: %s", time.Now().Format("02/01/2006 15:04:05")))
	pdf.Ln(10)
}

func renderPDFTable(pdf *gofpdf.Fpdf, headers []string, data []TitularData) {
	lineHt := 7.0
	pageWidth := 277.0 // Ancho útil de A4 Landscape (A4: 297mm - 20mm de márgenes)
	colCount := float64(len(headers))
	colWidth := pageWidth / colCount // Cálculo de ancho automático simple

	// Imprimir Cabecera
	pdf.SetFont("Arial", "B", 9)
	pdf.SetFillColor(59, 130, 246) // Color azul para la cabecera
	pdf.SetTextColor(255, 255, 255)
	for _, str := range headers {
		pdf.CellFormat(colWidth, lineHt, str, "1", 0, "C", true, 0, "")
	}
	pdf.Ln(lineHt)

	// Imprimir Filas de Datos
	pdf.SetFont("Arial", "", 8)
	pdf.SetTextColor(0, 0, 0)
	for i, row := range data {
		// Alternancia de colores para las filas
		if i%2 == 0 {
			pdf.SetFillColor(243, 244, 246) // Gris muy claro (para filas pares 0, 2, 4...)
		} else {
			pdf.SetFillColor(255, 255, 255) // Blanco (para filas impares 1, 3, 5...)
		}

		pdf.SetX(pdf.GetX())
		for _, header := range headers {
			value := row[header]
			pdf.CellFormat(colWidth, lineHt, value, "1", 0, "L", true, 0, "")
		}
		pdf.Ln(lineHt)
	}
}
