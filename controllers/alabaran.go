/**
 * ARCHIVO: controllers/albaran.go
 * DESCRIPCIÓN: Gestión integral de albaranes con mapeo tipado.
 * ACTUALIZADO: 28/05/2026
 *   - AÑADIDO: ExportAlbaranesPDF, ExportAlbaranesXLSX (admin)
 *   - AÑADIDO: ExportAlbaranesTitularPDF, ExportAlbaranesTitularXLSX (titular, JWT)
 *   - FIX: GenerateGenericXLSX → GenerateTitularesXLSX (nombre real de la función)
 *   13/05/2026
 *   - FIX: UpdateAlbaranAdmin detecta payloads de cobro/pago y hace UPDATE quirúrgico
 *     en lugar de UPDATE total (que machacaba todos los campos con NULL).
 */

package controllers

import (
	"albaranes/models"
	"albaranes/utils"
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
	t, err := time.Parse(dateFormat, dateStr)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func formatDateTimeWithOffset(dateBase, timeStr string) interface{} {
	if strings.TrimSpace(timeStr) == "" {
		return nil
	}
	if len(timeStr) == 5 {
		timeStr += ":00"
	}

	full := fmt.Sprintf("%s %s", dateBase, timeStr)

	loc, err := time.LoadLocation("Europe/Madrid")
	if err != nil {
		t, _ := time.Parse("2006-01-02 15:04:05", full)
		return t.Add(-2 * time.Hour).Format("2006-01-02 15:04:05")
	}

	tMadrid, err := time.ParseInLocation("2006-01-02 15:04:05", full, loc)
	if err != nil {
		return nil
	}

	tUTC := tMadrid.UTC()
	return tUTC.Format("2006-01-02 15:04:05")
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

	timeFields := map[string]bool{
		"hora": true, "hora_ini": true, "hora_fin": true,
		"espera_ini": true, "espera_fin": true, "tiempo_espera": true,
	}

	for key, value := range input {
		if strings.ToLower(key) == "id" || key == "created_at" || key == "updated_at" {
			continue
		}

		if timeFields[key] {
			str, _ := value.(string)
			structKey := ""
			parts := strings.Split(key, "_")
			for i := range parts {
				parts[i] = strings.Title(parts[i])
			}
			structKey = strings.Join(parts, "")
			if key == "hora" {
				structKey = "Hora"
			}
			clean[structKey] = formatDateTimeWithOffset(fechaBase, str)
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
// isPayloadQuirurgico detecta si el body es un payload de cobro/pago
// ---------------------------------------------------------------------
func isPayloadQuirurgico(input map[string]interface{}) bool {
	camposQuirurgicos := map[string]bool{
		"cobrado":      true,
		"pagado":       true,
		"enviado":      true,
		"fecha_cobro":  true,
		"fecha_pago":   true,
		"licencia_ref": true,
	}

	camposAlbaran := []string{
		"fecha", "hora_ini", "hora_fin", "origen", "destino",
		"cliente", "empresa_ref", "importe_total", "km_totales",
		"numero_albaran", "matricula", "referencia",
	}

	for _, campo := range camposAlbaran {
		if _, ok := input[campo]; ok {
			return false
		}
	}

	for key := range input {
		if !camposQuirurgicos[key] {
			return false
		}
	}
	return true
}

// ---------------------------------------------------------------------
// SECCIÓN: HELPERS DE EXPORTACIÓN
// ---------------------------------------------------------------------

func floatFromInterface(v interface{}) float64 {
	switch val := v.(type) {
	case float64:
		return val
	case float32:
		return float64(val)
	case int:
		return float64(val)
	}
	return 0
}

func estadoFromRow(row map[string]interface{}) string {
	if v, ok := row["pagado"].(bool); ok && v {
		return "Pagado"
	}
	if v, ok := row["enviado"].(bool); ok && v {
		return "Enviado"
	}
	return "Creado"
}

func fechaCorta(row map[string]interface{}) string {
	if f, ok := row["fecha"].(string); ok && len(f) >= 10 {
		return f[:10]
	}
	return ""
}

// ---------------------------------------------------------------------
// SECCIÓN: EXPORTACIÓN ADMIN
// Campos: Nº Albarán, Fecha, Licencia, Empresa, Ref, Importe, Estado
// ---------------------------------------------------------------------

func ExportAlbaranesPDF(c *gin.Context, db *gorm.DB) {
	var body struct {
		Data []map[string]interface{} `json:"data"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || len(body.Data) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Sin datos"})
		return
	}

	var lista []utils.TitularData
	for _, row := range body.Data {
		lista = append(lista, utils.TitularData{
			"Nº ALBARÁN": strFromInterface(row["numero_albaran"]),
			"FECHA":      fechaCorta(row),
			"LICENCIA":   strFromInterface(row["licencia_numero"]),
			"EMPRESA":    strFromInterface(row["empresa_nombre"]),
			"REF.":       strFromInterface(row["referencia"]),
			"IMPORTE":    fmt.Sprintf("%.2f", floatFromInterface(row["importe_total"])),
			"ESTADO":     estadoFromRow(row),
		})
	}

	path, err := utils.GenerateGenericPDF("ALBARANES ADMIN", lista)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"url": path})
}

func ExportAlbaranesXLSX(c *gin.Context, db *gorm.DB) {
	var body struct {
		Data []map[string]interface{} `json:"data"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || len(body.Data) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Sin datos"})
		return
	}

	var lista []utils.TitularData
	for _, row := range body.Data {
		lista = append(lista, utils.TitularData{
			"Nº ALBARÁN": strFromInterface(row["numero_albaran"]),
			"FECHA":      fechaCorta(row),
			"LICENCIA":   strFromInterface(row["licencia_numero"]),
			"EMPRESA":    strFromInterface(row["empresa_nombre"]),
			"REF.":       strFromInterface(row["referencia"]),
			"IMPORTE":    fmt.Sprintf("%.2f", floatFromInterface(row["importe_total"])),
			"ESTADO":     estadoFromRow(row),
		})
	}

	path, err := utils.GenerateTitularesXLSX("ALBARANES ADMIN", lista)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"url": path})
}

// ---------------------------------------------------------------------
// SECCIÓN: EXPORTACIÓN TITULAR (JWT requerido)
// Campos: Nº Albarán, Fecha, Empresa, Ref., Conductor, Importe, Estado
// ---------------------------------------------------------------------

func ExportAlbaranesTitularPDF(c *gin.Context, db *gorm.DB) {
	var body struct {
		Data []map[string]interface{} `json:"data"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || len(body.Data) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Sin datos"})
		return
	}

	var lista []utils.TitularData
	for _, row := range body.Data {
		lista = append(lista, utils.TitularData{
			"Nº ALBARÁN": strFromInterface(row["numero_albaran"]),
			"FECHA":      fechaCorta(row),
			"EMPRESA":    strFromInterface(row["empresa_nombre"]),
			"REF.":       strFromInterface(row["referencia"]),
			"CONDUCTOR":  strFromInterface(row["asalariado"]),
			"IMPORTE":    fmt.Sprintf("%.2f", floatFromInterface(row["importe_total"])),
			"ESTADO":     estadoFromRow(row),
		})
	}

	path, err := utils.GenerateGenericPDF("ALBARANES TITULAR", lista)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"url": path})
}

func ExportAlbaranesTitularXLSX(c *gin.Context, db *gorm.DB) {
	var body struct {
		Data []map[string]interface{} `json:"data"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || len(body.Data) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Sin datos"})
		return
	}

	var lista []utils.TitularData
	for _, row := range body.Data {
		lista = append(lista, utils.TitularData{
			"Nº ALBARÁN": strFromInterface(row["numero_albaran"]),
			"FECHA":      fechaCorta(row),
			"EMPRESA":    strFromInterface(row["empresa_nombre"]),
			"REF.":       strFromInterface(row["referencia"]),
			"CONDUCTOR":  strFromInterface(row["asalariado"]),
			"IMPORTE":    fmt.Sprintf("%.2f", floatFromInterface(row["importe_total"])),
			"ESTADO":     estadoFromRow(row),
		})
	}

	path, err := utils.GenerateTitularesXLSX("ALBARANES TITULAR", lista)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"url": path})
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
		cleanInput["Hora"],
		cleanInput["HoraIni"],
		cleanInput["HoraFin"],
		floatOrZero(cleanInput, "HoraTotal"),
		cleanInput["EsperaIni"],
		cleanInput["EsperaFin"],
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
	c.JSON(http.StatusCreated, gin.H{"message": "✅ Albarán creado con corrección horaria"})
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
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "JSON inválido"})
		return
	}

	if isPayloadQuirurgico(input) {
		setClauses := []string{}
		params := []interface{}{}

		if v, ok := input["cobrado"]; ok {
			setClauses = append(setClauses, "cobrado = ?")
			params = append(params, v)
		}
		if v, ok := input["pagado"]; ok {
			setClauses = append(setClauses, "pagado = ?")
			params = append(params, v)
		}
		if v, ok := input["enviado"]; ok {
			setClauses = append(setClauses, "enviado = ?")
			params = append(params, v)
		}
		if v, ok := input["fecha_cobro"].(string); ok && v != "" {
			soloFecha := v
			if len(v) > 10 {
				soloFecha = v[:10]
			}
			if t, err := parseDatePtr(soloFecha); err == nil && t != nil {
				setClauses = append(setClauses, "fecha_cobro = ?")
				params = append(params, t)
			}
		}
		if v, ok := input["fecha_pago"].(string); ok && v != "" {
			soloFecha := v
			if len(v) > 10 {
				soloFecha = v[:10]
			}
			if t, err := parseDatePtr(soloFecha); err == nil && t != nil {
				setClauses = append(setClauses, "fecha_pago = ?")
				params = append(params, t)
			}
		}

		if len(setClauses) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Sin campos para actualizar"})
			return
		}

		setClauses = append(setClauses, "updated_at = NOW()")
		params = append(params, albaran.ID)

		query := "UPDATE albaranes SET " + strings.Join(setClauses, ", ") + " WHERE id = ?"
		if err := db.Exec(query, params...).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "✅ Estado actualizado"})
		return
	}

	cleanInput := cleanAlbaranMap(input, albaran)
	if err := execUpdateSQL(db, cleanInput, albaran.ID, 0, true); err != nil {
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

	if err := execUpdateSQL(db, cleanInput, albaran.ID, licID, false); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al actualizar"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "✅ Actualizado con corrección horaria"})
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
		cleanInput["HoraIni"],
		cleanInput["HoraFin"],
		cleanInput["EsperaIni"],
		cleanInput["EsperaFin"],
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
		timePtrOrNil(cleanInput, "FechaCobro"),
		id,
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

// ---------------------------------------------------------------------
// SECCIÓN: HELPERS TIPADOS
// ---------------------------------------------------------------------

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
