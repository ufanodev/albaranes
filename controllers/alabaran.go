/**
 * ARCHIVO: controllers/albaran.go
 * DESCRIPCIÓN: Gestión integral de albaranes con mapeo tipado.
 * ACTUALIZADO: 13/04/2026 - FIX FINAL: Horas como Strings literales para evitar desfase UTC+2.
 */

package controllers

import (
	"albaranes/models"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const dateFormat = "2006-01-02"

// ---------------------------------------------------------------------
// SECCIÓN: HELPERS DE PARSEO Y LIMPIEZA
// ---------------------------------------------------------------------

func parseDatePtr(dateStr string) (*time.Time, error) {
	if strings.TrimSpace(dateStr) == "" {
		return nil, nil
	}
	// Usamos Parse en lugar de ParseInLocation para que sea UTC "ingenuo".
	t, err := time.Parse(dateFormat, dateStr)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

// NUEVO HELPER: Convierte la combinación de fecha y hora en un string literal para MySQL.
// Esto evita que el driver de Go aplique offsets de zona horaria (CEST/UTC).
func formatDateTimeString(dateBase, timeStr string) interface{} {
	if strings.TrimSpace(timeStr) == "" {
		return nil
	}
	// Si viene HH:mm, añadimos segundos
	if len(timeStr) == 5 {
		timeStr += ":00"
	}
	// Retornamos formato estándar MySQL: YYYY-MM-DD HH:mm:ss
	return fmt.Sprintf("%s %s", dateBase, timeStr)
}

func parseTimePtr(dateBase, timeStr string) (*time.Time, error) {
	if strings.TrimSpace(timeStr) == "" {
		return nil, nil
	}
	if len(timeStr) == 5 {
		timeStr += ":00"
	}
	full := fmt.Sprintf("%s %s", dateBase, timeStr)
	loc, _ := time.LoadLocation("Europe/Madrid")
	t, err := time.ParseInLocation("2006-01-02 15:04:05", full, loc)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func preloadAlbaran(db *gorm.DB) *gorm.DB {
	return db.Preload("LicenciaData").Preload("EmpresaData")
}

func getUintFromContext(c *gin.Context, key string) uint {
	val, exists := c.Get(key)
	if !exists {
		return 0
	}
	switch v := val.(type) {
	case float64:
		return uint(v)
	case uint:
		return v
	case int:
		return uint(v)
	default:
		return 0
	}
}

// cleanAlbaranMap mapea el JSON a campos del Struct para lógica interna
func cleanAlbaranMap(input map[string]interface{}, original models.Albaran) map[string]interface{} {
	clean := make(map[string]interface{})
	fechaBase := time.Now().Format(dateFormat)
	if !original.Fecha.IsZero() {
		fechaBase = original.Fecha.Format(dateFormat)
	}
	if v, ok := input["fecha"].(string); ok && v != "" {
		if len(v) > 10 {
			fechaBase = v[:10]
		} else {
			fechaBase = v
		}
	}

	// Campos que deben ser tratados como strings literales en la consulta SQL
	timeFields := map[string]bool{
		"hora": true, "hora_ini": true, "hora_fin": true,
		"espera_ini": true, "espera_fin": true, "tiempo_espera": true,
	}

	for key, value := range input {
		if strings.ToLower(key) == "id" || key == "created_at" || key == "updated_at" {
			continue
		}

		// TRATAMIENTO DE TIEMPOS (FIX 2 HORAS):
		if timeFields[key] {
			str, _ := value.(string)
			structKey := ""
			// Mapeo manual de nombres para mantener compatibilidad con el switch inferior
			parts := strings.Split(key, "_")
			for i := range parts {
				parts[i] = strings.Title(parts[i])
			}
			structKey = strings.Join(parts, "")
			if key == "hora" {
				structKey = "Hora"
			}

			// Guardamos el string literal "YYYY-MM-DD HH:mm:ss"
			clean[structKey] = formatDateTimeString(fechaBase, str)
			continue
		}

		structKey := ""
		switch key {
		case "licencia_ref":
			structKey = "LicenciaRef"
		case "empresa_ref":
			structKey = "EmpresaRef"
		case "numero_albaran":
			structKey = "NumeroAlbaran"
		case "empresa_nombre":
			structKey = "EmpresaNombre"
		case "dni_pasajero":
			structKey = "DNIPasajero"
		case "tlf_pasajero":
			structKey = "TlfPasajero"
		case "matricula":
			structKey = "Matricula"
		case "cliente", "nombre_pasajero":
			structKey = "Cliente"
		case "noct_fest":
			structKey = "NoctFest"
		case "diurno":
			structKey = "Diurno"
		case "urbano":
			structKey = "Urbano"
		case "remolque":
			structKey = "Remolque"
		case "km_totales":
			structKey = "KmTotales"
		case "km_nacionales":
			structKey = "KmNacionales"
		case "km_internacionales":
			structKey = "KmInternacionales"
		case "hora_total":
			structKey = "HoraTotal"
		case "importe_suplidos":
			structKey = "ImporteSuplidos"
		case "importe_total":
			structKey = "ImporteTotal"
		case "asalariado":
			structKey = "Asalariado"
		case "autorizado_por":
			structKey = "AutorizadoPor"
		case "num_plazas":
			structKey = "NumPlazas"
		case "adjuntos":
			structKey = "Adjuntos"
		case "adjuntos_ref":
			structKey = "AdjuntosRef"
		case "enviado":
			structKey = "Enviado"
		case "cobrado":
			structKey = "Cobrado"
		case "pagado":
			structKey = "Pagado"
		case "num_factura":
			structKey = "NumFactura"
		case "finalizado":
			structKey = "Finalizado"
		case "festivo":
			structKey = "Festivo"
		default:
			parts := strings.Split(key, "_")
			for i := range parts {
				parts[i] = strings.Title(parts[i])
			}
			structKey = strings.Join(parts, "")
		}

		if strings.Contains(strings.ToLower(key), "fecha") {
			if str, ok := value.(string); ok && str != "" {
				soloFecha := str
				if len(str) > 10 {
					soloFecha = str[:10]
				}
				if t, err := parseDatePtr(soloFecha); err == nil {
					if key == "fecha_pago" || key == "fecha_cobro" {
						clean[structKey] = t
					} else {
						clean[structKey] = *t
					}
				}
			}
		} else {
			clean[structKey] = value
		}
	}
	return clean
}

// ---------------------------------------------------------------------
// SECCIÓN: CRUD PRINCIPAL
// ---------------------------------------------------------------------

func GetAlbaran(c *gin.Context, db *gorm.DB) {
	id := c.Param("id")
	var albaran models.Albaran
	if err := db.Preload("LicenciaData").Preload("EmpresaData").First(&albaran, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "❌ No encontrado"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": albaran})
}

func CreateAlbaran(c *gin.Context, db *gorm.DB) {
	var input map[string]interface{}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "JSON inválido"})
		return
	}

	albaran := models.Albaran{}
	cleanInput := cleanAlbaranMap(input, albaran)

	// Usamos SQL Directo para Create para asegurar que los strings de tiempo entren sin procesar
	query := `INSERT INTO albaranes (
        numero_albaran, fecha, licencia_ref, empresa_ref, licencia, empresa_nombre,
        referencia, asalariado, hora, hora_ini, hora_fin, hora_total, espera_ini, 
        espera_fin, dni_pasajero, tlf_pasajero, matricula, cliente, origen, parada, 
        destino, urbano, diurno, noct_fest, km_totales, km_nacionales, km_internacionales,
        importe_suplidos, importe_total, autorizado_por, remolque, num_plazas, 
        observaciones, adjuntos, adjuntos_ref, finalizado, festivo, estado, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NOW(), NOW())`

	err := db.Exec(query,
		strFromInterface(cleanInput["NumeroAlbaran"]),
		timePtrOrNil(cleanInput, "Fecha"),
		intOrZero(cleanInput, "LicenciaRef"),
		intOrZero(cleanInput, "EmpresaRef"),
		strOrEmpty(cleanInput, "Licencia"),
		strOrEmpty(cleanInput, "EmpresaNombre"),
		strPtrOrNil(cleanInput, "Referencia"),
		strPtrOrNil(cleanInput, "Asalariado"),
		cleanInput["Hora"],    // String literal o nil
		cleanInput["HoraIni"], // String literal o nil
		cleanInput["HoraFin"], // String literal o nil
		floatOrZero(cleanInput, "HoraTotal"),
		cleanInput["EsperaIni"], // String literal o nil
		cleanInput["EsperaFin"], // String literal o nil
		strPtrOrNil(cleanInput, "DNIPasajero"),
		strOrEmpty(cleanInput, "TlfPasajero"),
		strPtrOrNil(cleanInput, "Matricula"),
		strPtrOrNil(cleanInput, "Cliente"),
		strPtrOrNil(cleanInput, "Origen"),
		strPtrOrNil(cleanInput, "Parada"),
		strPtrOrNil(cleanInput, "Destino"),
		boolOrFalse(cleanInput, "Urbano"),
		boolOrFalse(cleanInput, "Diurno"),
		boolOrFalse(cleanInput, "NoctFest"),
		floatOrZero(cleanInput, "KmTotales"),
		floatOrZero(cleanInput, "KmNacionales"),
		floatOrZero(cleanInput, "KmInternacionales"),
		floatOrZero(cleanInput, "ImporteSuplidos"),
		floatOrZero(cleanInput, "ImporteTotal"),
		strPtrOrNil(cleanInput, "AutorizadoPor"),
		boolOrFalse(cleanInput, "Remolque"),
		intOrZero(cleanInput, "NumPlazas"),
		strPtrOrNil(cleanInput, "Observaciones"),
		boolOrFalse(cleanInput, "Adjuntos"),
		strOrEmpty(cleanInput, "AdjuntosRef"),
		boolOrFalse(cleanInput, "Finalizado"),
		boolOrFalse(cleanInput, "Festivo"),
	).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "✅ Albarán creado"})
}

func UpdateAlbaran(c *gin.Context, db *gorm.DB) {
	role, _ := c.Get("role")
	if role == "admin" {
		UpdateAlbaranAdmin(c, db)
	} else {
		UpdateAlbaranUser(c, db)
	}
}

func UpdateAlbaranAdmin(c *gin.Context, db *gorm.DB) {
	id := c.Param("id")
	var albaran models.Albaran
	if err := db.First(&albaran, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Albarán no encontrado"})
		return
	}

	var input map[string]interface{}
	c.ShouldBindJSON(&input)

	if len(input) <= 3 && (input["enviado"] != nil || input["pagado"] != nil || input["cobrado"] != nil) {
		db.Model(&albaran).Updates(input)
		c.JSON(http.StatusOK, gin.H{"message": "✅ Estado actualizado"})
		return
	}

	cleanInput := cleanAlbaranMap(input, albaran)
	err := execUpdateSQL(db, cleanInput, albaran.ID, 0, true)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "✅ Actualizado por Admin"})
}

func UpdateAlbaranUser(c *gin.Context, db *gorm.DB) {
	id := c.Param("id")
	licID := getUintFromContext(c, "licencia_id")
	var albaran models.Albaran

	if err := db.Where("id = ? AND licencia_ref = ?", id, licID).First(&albaran).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Sin permiso"})
		return
	}

	var input map[string]interface{}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "JSON inválido"})
		return
	}

	// Envío simplificado de estado
	if len(input) <= 3 && input["enviado"] != nil {
		if err := db.Model(&albaran).Updates(input).Error; err != nil {
			c.JSON(500, gin.H{"error": "Error al marcar enviado"})
			return
		}
		c.JSON(200, gin.H{"message": "✅ Albarán enviado correctamente"})
		return
	}

	delete(input, "numero_albaran")
	delete(input, "licencia_ref")
	cleanInput := cleanAlbaranMap(input, albaran)

	err := execUpdateSQL(db, cleanInput, albaran.ID, licID, false)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al actualizar"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "✅ Actualizado"})
}

func execUpdateSQL(db *gorm.DB, cleanInput map[string]interface{}, id uint, licID uint, isAdmin bool) error {
	query := `
        UPDATE albaranes SET
            fecha = ?, hora_ini = ?, hora_fin = ?, espera_ini = ?, espera_fin = ?, 
            referencia = ?, asalariado = ?, dni_pasajero = ?, tlf_pasajero = ?,
            matricula = ?, cliente = ?, origen = ?, parada = ?, destino = ?, 
            empresa_ref = ?, empresa_nombre = ?, km_totales = ?, km_nacionales = ?,
            km_internacionales = ?, importe_total = ?, importe_suplidos = ?,
            hora_total = ?, num_plazas = ?, urbano = ?, diurno = ?, noct_fest = ?, 
            remolque = ?, adjuntos = ?, adjuntos_ref = ?, autorizado_por = ?,
            observaciones = ?, enviado = ?, cobrado = ?, pagado = ?, 
            num_factura = ?, finalizado = ?, fecha_cobro = ?, updated_at = NOW()
        WHERE id = ?`

	params := []interface{}{
		timePtrOrNil(cleanInput, "Fecha"),
		cleanInput["HoraIni"],   // String literal
		cleanInput["HoraFin"],   // String literal
		cleanInput["EsperaIni"], // String literal
		cleanInput["EsperaFin"], // String literal
		strPtrOrNil(cleanInput, "Referencia"),
		strPtrOrNil(cleanInput, "Asalariado"),
		strPtrOrNil(cleanInput, "DNIPasajero"),
		strOrEmpty(cleanInput, "TlfPasajero"),
		strPtrOrNil(cleanInput, "Matricula"),
		strPtrOrNil(cleanInput, "Cliente"),
		strPtrOrNil(cleanInput, "Origen"),
		strPtrOrNil(cleanInput, "Parada"),
		strPtrOrNil(cleanInput, "Destino"),
		intOrZero(cleanInput, "EmpresaRef"),
		strOrEmpty(cleanInput, "EmpresaNombre"),
		floatOrZero(cleanInput, "KmTotales"),
		floatOrZero(cleanInput, "KmNacionales"),
		floatOrZero(cleanInput, "KmInternacionales"),
		floatOrZero(cleanInput, "ImporteTotal"),
		floatOrZero(cleanInput, "ImporteSuplidos"),
		floatOrZero(cleanInput, "HoraTotal"),
		intOrZero(cleanInput, "NumPlazas"),
		boolOrFalse(cleanInput, "Urbano"),
		boolOrFalse(cleanInput, "Diurno"),
		boolOrFalse(cleanInput, "NoctFest"),
		boolOrFalse(cleanInput, "Remolque"),
		boolOrFalse(cleanInput, "Adjuntos"),
		strOrEmpty(cleanInput, "AdjuntosRef"),
		strPtrOrNil(cleanInput, "AutorizadoPor"),
		strPtrOrNil(cleanInput, "Observaciones"),
		boolOrFalse(cleanInput, "Enviado"),
		boolOrFalse(cleanInput, "Cobrado"),
		boolOrFalse(cleanInput, "Pagado"),
		strOrEmpty(cleanInput, "NumFactura"),
		boolOrFalse(cleanInput, "Finalizado"),
		timePtrOrNil(cleanInput, "FechaCobro"), id,
	}

	if !isAdmin {
		query += " AND licencia_ref = ?"
		params = append(params, licID)
	}

	return db.Exec(query, params...).Error
}

func SearchAlbaranesUser(c *gin.Context, db *gorm.DB) {
	licID := getUintFromContext(c, "licencia_id")
	var albaranes []models.Albaran
	db.Preload("LicenciaData").Preload("EmpresaData").
		Where("licencia_ref = ? AND estado = ?", licID, 0).
		Order("fecha DESC, id DESC").Find(&albaranes)
	c.JSON(200, gin.H{"data": albaranes})
}

func SearchAlbaranes(c *gin.Context, db *gorm.DB) {
	var albaranes []models.Albaran
	db.Preload("LicenciaData").Preload("EmpresaData").
		Where("estado = ?", 0).Order("fecha DESC, id DESC").Find(&albaranes)
	c.JSON(200, gin.H{"data": albaranes})
}

func DeleteAlbaran(c *gin.Context, db *gorm.DB) {
	id := c.Param("id")
	db.Model(&models.Albaran{}).Where("id = ?", id).Update("estado", 1)
	c.JSON(200, gin.H{"message": "✅ Borrado"})
}

func GetLicenciaInfoForUser(c *gin.Context, db *gorm.DB) {
	licID := getUintFromContext(c, "licencia_id")
	var lic models.Licencia
	if err := db.First(&lic, licID).Error; err == nil {
		c.JSON(200, gin.H{"licencia_id": lic.ID, "licencia_numero": lic.Licencia})
	} else {
		c.JSON(404, gin.H{"error": "No hallada"})
	}
}

// Helpers tipados robustos
func timePtrOrNil(m map[string]interface{}, key string) interface{} {
	if v, ok := m[key]; ok && v != nil {
		return v
	}
	return nil
}
func strOrEmpty(m map[string]interface{}, key string) string {
	if v, ok := m[key].(string); ok {
		return v
	}
	return ""
}
func strPtrOrNil(m map[string]interface{}, key string) interface{} {
	if v, ok := m[key].(string); ok && strings.TrimSpace(v) != "" {
		return v
	}
	return nil
}
func floatOrZero(m map[string]interface{}, key string) float64 {
	val, ok := m[key]
	if !ok || val == nil {
		return 0.0
	}
	switch v := val.(type) {
	case float64:
		return v
	case float32:
		return float64(v)
	case int:
		return float64(v)
	case string:
		var f float64
		v = strings.ReplaceAll(v, ",", ".")
		fmt.Sscanf(v, "%f", &f)
		return f
	}
	return 0.0
}
func intOrZero(m map[string]interface{}, key string) int {
	val, ok := m[key]
	if !ok || val == nil {
		return 0
	}
	switch v := val.(type) {
	case float64:
		return int(v)
	case int:
		return v
	}
	return 0
}
func boolOrFalse(m map[string]interface{}, key string) bool {
	if v, ok := m[key].(bool); ok {
		return v
	}
	return false
}
func strFromInterface(v interface{}) string {
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}

func ExportAlbaranesPDF(c *gin.Context, db *gorm.DB)  {}
func ExportAlbaranesXLSX(c *gin.Context, db *gorm.DB) {}
