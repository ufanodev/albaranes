package utils

import "sort"

// Constante para la ruta base de documentos (Usada por PDF y XLSX)
const DocumentsDir = "./documentos"

// TitularData es la estructura genérica para una fila de datos de la tabla.
// Se usa para pasar datos a los generadores de reportes.
type TitularData map[string]string

// GetHeaders devuelve la unión de claves de todas las filas, en orden alfabético.
// Un map de Go no conserva el orden de las claves (ni el del JSON de origen),
// así que el orden final lo decide cada generador (ordenarHeaders en el PDF,
// ExcelData.Headers en el Excel).
func GetHeaders(data []TitularData) []string {
	vistos := make(map[string]bool)
	headers := []string{}
	for _, fila := range data {
		for k := range fila {
			if !vistos[k] {
				vistos[k] = true
				headers = append(headers, k)
			}
		}
	}
	sort.Strings(headers)
	return headers
}
