// Archivo: ./utils/export_common.go

package utils

// Constante para la ruta base de documentos (Usada por PDF y XLSX)
const DocumentsDir = "./documentos"

// TitularData es la estructura genérica para una fila de datos de la tabla.
type TitularData map[string]string

// GetHeaders extrae las cabeceras del primer elemento de la data.
// Nota: Dependemos del orden en que se envían las claves desde JavaScript.
func GetHeaders(data []TitularData) []string {
	if len(data) == 0 {
		return []string{}
	}

	headers := make([]string, 0, len(data[0]))
	// Usamos un bucle for-range sobre el mapa para extraer las claves.
	for key := range data[0] {
		headers = append(headers, key)
	}

	return headers
}
