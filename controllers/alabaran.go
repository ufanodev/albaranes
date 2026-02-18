/**
 * ARCHIVO: controllers/albaran.go
 * DESCRIPCIÓN: Gestión integral de albaranes.
 * ACTUALIZADO: 18/02/2026 - FIX: Prioridad de licencia_ref cuando el rol es nulo o admin.
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

func parseTimePtr(dateBase, timeStr string) (*time.Time, error) {
	if strings.TrimSpace(timeStr) == "" {
		return nil, nil
	}
	if len(timeStr) == 5 {
		timeStr += ":00"
	}
	full := fmt.Sprintf("%s %s", dateBase, timeStr)
	t, err := time.Parse("2006-01-02 15:04:05", full)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func preloadAlbaran(db *gorm.DB) *gorm.DB {
	return db.Preload("LicenciaData").Preload("EmpresaData")
}

func cleanAlbaranMap(input map[string]interface{}, original models.Albaran) map[string]interface{} {
	clean := make(map[string]interface{})
	fechaBase := time.Now().Format(dateFormat)
	if !original.Fecha.IsZero() {
		fechaBase = original.Fecha.Format(dateFormat)
	}
	if v, ok := input["fecha"].(string); ok && v != "" {
		fechaBase = v
	}

	timeFields := map[string]string{
		"hora": "Hora", "hora_ini": "HoraIni", "hora_fin": "HoraFin",
		"espera_ini": "EsperaIni", "espera_fin": "EsperaFin", "tiempo_espera": "TiempoEspera",
	}

	for key, value := range input {
		if strings.ToLower(key) == "id" || key == "created_at" || key == "updated_at" {
			continue
		}

		if structKey, ok := timeFields[key]; ok {
			str, _ := value.(string)
			if t, err := parseTimePtr(fechaBase, str); err == nil {
				clean[structKey] = t
			}
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
		case "nombre_pasajero":
			structKey = "Cliente"
		case "num_factura":
			structKey = "NumFactura"
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
		case "km_ini":
			structKey = "KmIni"
		case "km_fin":
			structKey = "KmFin"
		case "hora_total":
			structKey = "HoraTotal"
		case "importe_espera":
			structKey = "ImporteEspera"
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
		case "adjuntos_bool":
			structKey = "Adjuntos"
		case "adjuntos":
			structKey = "AdjuntosRef"
		default:
			parts := strings.Split(key, "_")
			for i := range parts {
				parts[i] = strings.Title(parts[i])
			}
			structKey = strings.Join(parts, "")
		}

		isNumeric := strings.Contains(strings.ToLower(key), "km_") ||
			strings.Contains(strings.ToLower(key), "importe_") ||
			key == "num_plazas" || key == "hora_total"

		if isNumeric {
			if str, ok := value.(string); ok && strings.TrimSpace(str) == "" {
				clean[structKey] = 0.0
				continue
			}
		}

		if strings.Contains(strings.ToLower(key), "fecha") {
			if str, ok := value.(string); ok && str != "" {
				if t, err := parseDatePtr(str); err == nil {
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

	if _, ok := clean["KmIni"]; !ok {
		clean["KmIni"] = 0.0
	}
	if _, ok := clean["KmFin"]; !ok {
		clean["KmFin"] = 0.0
	}
	if _, ok := clean["ImporteEspera"]; !ok {
		clean["ImporteEspera"] = 0.0
	}
	if _, ok := clean["HoraTotal"]; !ok {
		clean["HoraTotal"] = 0.0
	}
	if _, ok := clean["AdjuntosRef"]; !ok {
		clean["AdjuntosRef"] = ""
	}
	if _, ok := clean["TlfPasajero"]; !ok {
		clean["TlfPasajero"] = "-"
	}

	return clean
}

// ---------------------------------------------------------------------
// SECCIÓN: CRUD PRINCIPAL
// ---------------------------------------------------------------------

func CreateAlbaran(c *gin.Context, db *gorm.DB) {
	var input map[string]interface{}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "JSON inválido"})
		return
	}

	cleanInput := cleanAlbaranMap(input, models.Albaran{Fecha: time.Now()})

	// 🛡️ LÓGICA DE LICENCIA MEJORADA
	// 1. Intentar obtener licencia del TOKEN (Titulares)
	tokenLicVal, _ := c.Get("licencia_id")
	var tokenLicID uint
	switch v := tokenLicVal.(type) {
	case float64:
		tokenLicID = uint(v)
	case uint:
		tokenLicID = v
	}

	// 2. Intentar obtener licencia del JSON (Admin)
	var jsonLicID uint
	if ref, ok := input["licencia_ref"]; ok {
		if f, ok := ref.(float64); ok {
			jsonLicID = uint(f)
		}
	}

	// 3. DECISIÓN: Si el token no tiene licencia (Admin), usamos la del JSON obligatoriamente
	if tokenLicID > 0 {
		cleanInput["LicenciaRef"] = tokenLicID
	} else if jsonLicID > 0 {
		cleanInput["LicenciaRef"] = jsonLicID
	} else {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No se ha especificado una Licencia válida"})
		return
	}

	// Sincronizar texto de Licencia y Empresa (Denormalización)
	if refID, ok := cleanInput["LicenciaRef"].(uint); ok && refID > 0 {
		var lic models.Licencia
		if err := db.First(&lic, refID).Error; err == nil {
			cleanInput["Licencia"] = lic.Licencia
		}
	}

	if ref, ok := cleanInput["EmpresaRef"]; ok {
		var empID uint
		if f, ok := ref.(float64); ok {
			empID = uint(f)
		} else if u, ok := ref.(uint); ok {
			empID = u
		}
		if empID > 0 {
			var emp models.Empresa
			if err := db.First(&emp, empID).Error; err == nil {
				cleanInput["EmpresaNombre"] = emp.Nombre
			}
		}
	}

	cleanInput["Estado"] = 0
	delete(cleanInput, "ID")

	if err := db.Model(&models.Albaran{}).Create(cleanInput).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al guardar: " + err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "✅ Albarán creado correctamente"})
}

// ... (Resto de funciones: GetAlbaran, GetAlbaranes, SearchAlbaranes, etc. se mantienen igual)

func GetAlbaran(c *gin.Context, db *gorm.DB) {
	id := c.Param("id")
	var albaran models.Albaran
	if err := preloadAlbaran(db).First(&albaran, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "❌ No encontrado"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": albaran})
}

func GetAlbaranes(c *gin.Context, db *gorm.DB) {
	var albaranes []models.Albaran
	preloadAlbaran(db).Where("estado = ?", 0).Order("id desc").Find(&albaranes)
	c.JSON(http.StatusOK, gin.H{"data": albaranes})
}

func SearchAlbaranes(c *gin.Context, db *gorm.DB) {
	var albaranes []models.Albaran
	query := preloadAlbaran(db.Model(&models.Albaran{})).Where("estado = ?", 0)
	if v := c.Query("licencia_ref"); v != "" {
		query = query.Where("licencia_ref = ?", v)
	}
	if v := c.Query("empresa_ref"); v != "" {
		query = query.Where("(empresa_ref = ? OR empresa_nombre LIKE ?)", v, "%"+v+"%")
	}
	if v := c.Query("fecha_desde"); v != "" {
		query = query.Where("fecha >= ?", v)
	}
	if v := c.Query("fecha_hasta"); v != "" {
		query = query.Where("fecha <= ?", v)
	}
	if v := c.Query("palabra"); v != "" {
		p := "%" + v + "%"
		query = query.Where(db.Where("numero_albaran LIKE ?", p).Or("cliente LIKE ?", p).Or("empresa_nombre LIKE ?", p))
	}
	query.Order("fecha DESC, id DESC").Find(&albaranes)
	c.JSON(http.StatusOK, gin.H{"data": albaranes})
}

func SearchAlbaranesUser(c *gin.Context, db *gorm.DB) {
	val, _ := c.Get("licencia_id")
	licID := uint(0)
	if v, ok := val.(float64); ok {
		licID = uint(v)
	} else if v, ok := val.(uint); ok {
		licID = v
	}
	var albaranes []models.Albaran
	query := preloadAlbaran(db.Model(&models.Albaran{})).Where("licencia_ref = ? AND estado = ?", licID, 0)
	if v := c.Query("empresa_ref"); v != "" {
		query = query.Where("empresa_ref = ?", v)
	}
	if v := c.Query("referencia"); v != "" {
		query = query.Where("referencia LIKE ?", "%"+v+"%")
	}
	if v := c.Query("fecha_desde"); v != "" {
		query = query.Where("fecha >= ?", v)
	}
	if v := c.Query("fecha_hasta"); v != "" {
		query = query.Where("fecha <= ?", v)
	}
	if v := c.Query("palabra"); v != "" {
		p := "%" + v + "%"
		query = query.Where(db.Where("numero_albaran LIKE ?", p).Or("cliente LIKE ?", p).Or("empresa_nombre LIKE ?", p))
	}
	query.Order("fecha DESC, id DESC").Find(&albaranes)
	c.JSON(http.StatusOK, gin.H{"data": albaranes, "total": len(albaranes)})
}

func UpdateAlbaranUser(c *gin.Context, db *gorm.DB) {
	id := c.Param("id")
	var albaran models.Albaran
	if err := db.First(&albaran, id).Error; err != nil {
		c.JSON(404, gin.H{"error": "No encontrado"})
		return
	}
	var input map[string]interface{}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(400, gin.H{"error": "JSON inválido"})
		return
	}
	delete(input, "numero_albaran")
	delete(input, "licencia_ref")
	cleanInput := cleanAlbaranMap(input, albaran)
	if val, ok := cleanInput["EmpresaRef"]; ok {
		var empID uint
		if f, fOk := val.(float64); fOk {
			empID = uint(f)
		} else if u, uOk := val.(uint); uOk {
			empID = u
		}
		if empID > 0 {
			var emp models.Empresa
			if err := db.First(&emp, empID).Error; err == nil {
				cleanInput["EmpresaNombre"] = emp.Nombre
			}
		}
	}
	if err := db.Model(&albaran).Updates(cleanInput).Error; err != nil {
		c.JSON(500, gin.H{"error": "Error al actualizar"})
		return
	}
	c.JSON(200, gin.H{"message": "✅ Actualizado"})
}

func GetLicenciaInfoForUser(c *gin.Context, db *gorm.DB) {
	val, _ := c.Get("licencia_id")
	licID := uint(0)
	if v, ok := val.(float64); ok {
		licID = uint(v)
	} else if v, ok := val.(uint); ok {
		licID = v
	}
	var lic models.Licencia
	if err := db.First(&lic, licID).Error; err == nil {
		c.JSON(200, gin.H{"licencia_id": lic.ID, "licencia_numero": lic.Licencia})
	} else {
		c.JSON(404, gin.H{"error": "No encontrada"})
	}
}

func BulkChargeAlbaranes(c *gin.Context, db *gorm.DB) {
	var input struct {
		IDs []uint `json:"ids"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "IDs requeridos"})
		return
	}
	db.Model(&models.Albaran{}).Where("id IN ?", input.IDs).Updates(map[string]interface{}{
		"cobrado": true, "pagado": true, "fecha_pago": time.Now(), "fecha_cobro": time.Now(),
	})
	c.JSON(200, gin.H{"message": "✅ Procesado"})
}

func DeleteAlbaran(c *gin.Context, db *gorm.DB) {
	id := c.Param("id")
	if err := db.Model(&models.Albaran{}).Where("id = ?", id).Update("estado", 1).Error; err != nil {
		c.JSON(500, gin.H{"error": "Error al borrar"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "✅ Borrado"})
}

func ExportAlbaranesPDF(c *gin.Context, db *gorm.DB) {
	var req struct {
		ReportName string                   `json:"reportName"`
		Data       []map[string]interface{} `json:"data"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "Datos inválidos"})
		return
	}
	var processedData []utils.TitularData
	for _, item := range req.Data {
		row := make(utils.TitularData)
		for k, v := range item {
			row[k] = fmt.Sprintf("%v", v)
		}
		processedData = append(processedData, row)
	}
	url, err := utils.GenerateGenericPDF(req.ReportName, processedData)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"success": true, "downloadURL": url})
}

func ExportAlbaranesXLSX(c *gin.Context, db *gorm.DB) {
	var req struct {
		ReportName string                   `json:"reportName"`
		Data       []map[string]interface{} `json:"data"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "Datos inválidos"})
		return
	}
	var processedData []utils.TitularData
	for _, item := range req.Data {
		row := make(utils.TitularData)
		for k, v := range item {
			row[k] = fmt.Sprintf("%v", v)
		}
		processedData = append(processedData, row)
	}
	url, err := utils.GenerateTitularesXLSX(req.ReportName, processedData)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"success": true, "downloadURL": url})
}
