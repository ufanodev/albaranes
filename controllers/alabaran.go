package controllers

import (
	"albaranes/models"
	"albaranes/utils"
	"fmt"
	"net/http"
	"strconv"
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
	// 🛡️ CRÍTICO: Asegura que el JSON incluya los objetos relacionados
	return db.Preload("LicenciaData").Preload("EmpresaData")
}

// 🛡️ LÓGICA DE LIMPIEZA MAESTRA [Respetando bloqueo de ID de 2025-12-17]
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
		"hora":          "Hora",
		"hora_ini":      "HoraIni",
		"hora_fin":      "HoraFin",
		"espera_ini":    "EsperaIni",
		"espera_fin":    "EsperaFin",
		"tiempo_espera": "TiempoEspera",
	}

	for key, value := range input {
		// 🚫 REGLA 2025-12-17: El ID nunca se modifica vía Payload
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
		case "matricula":
			structKey = "Matricula"
		case "nombre_pasajero":
			structKey = "Cliente" // 👈 MAPEO VITAL: HTML 'nombre_pasajero' -> DB 'Cliente'
		case "num_factura":
			structKey = "NumFactura"
		case "noct_fest":
			structKey = "NoctFest"
		case "km_ini":
			structKey = "KmIni"
		case "km_fin":
			structKey = "KmFin"
		case "km_totales":
			structKey = "KmTotales"
		case "km_nacionales":
			structKey = "KmNacionales"
		case "km_internacionales":
			structKey = "KmInternacionales"
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
		default:
			parts := strings.Split(key, "_")
			for i := range parts {
				parts[i] = strings.Title(parts[i])
			}
			structKey = strings.Join(parts, "")
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
	return clean
}

// ---------------------------------------------------------------------
// SECCIÓN: CONTROLADORES ADMINISTRACIÓN
// ---------------------------------------------------------------------

func GetAlbaranes(c *gin.Context, db *gorm.DB) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))
	var albaranes []models.Albaran
	var total int64
	db.Model(&models.Albaran{}).Where("estado = ?", 0).Count(&total)
	preloadAlbaran(db).Where("estado = ?", 0).Limit(pageSize).Offset((page - 1) * pageSize).Order("id desc").Find(&albaranes)
	c.JSON(http.StatusOK, gin.H{"data": albaranes, "total": total})
}

func SearchAlbaranes(c *gin.Context, db *gorm.DB) {
	var albaranes []models.Albaran
	query := preloadAlbaran(db.Model(&models.Albaran{})).Where("estado = ?", 0)
	if v := c.Query("licencia_ref"); v != "" {
		query = query.Where("licencia_ref = ?", v)
	}
	if v := c.Query("empresa_ref"); v != "" {
		query = query.Where("empresa_ref = ?", v)
	}
	if v := c.Query("referencia"); v != "" {
		query = query.Where("referencia LIKE ?", "%"+v+"%")
	}
	if v := c.Query("numero_albaran"); v != "" {
		query = query.Where("numero_albaran LIKE ?", "%"+v+"%")
	}
	query.Order("fecha desc, id desc").Find(&albaranes)
	c.JSON(http.StatusOK, gin.H{"data": albaranes})
}

func GetAlbaran(c *gin.Context, db *gorm.DB) {
	id := c.Param("id")
	var albaran models.Albaran
	if err := preloadAlbaran(db).First(&albaran, id).Error; err != nil {
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
	cleanInput := cleanAlbaranMap(input, models.Albaran{Fecha: time.Now()})

	// Sincronizar nombres para consistencia y evitar NULL en empresa_nombre
	if ref, ok := cleanInput["EmpresaRef"].(float64); ok {
		var emp models.Empresa
		if err := db.First(&emp, uint(ref)).Error; err == nil {
			cleanInput["EmpresaNombre"] = emp.Nombre
		}
	}
	if ref, ok := cleanInput["LicenciaRef"].(float64); ok {
		var lic models.Licencia
		if err := db.First(&lic, uint(ref)).Error; err == nil {
			cleanInput["Licencia"] = lic.Licencia
		}
	}

	cleanInput["Estado"] = 0
	delete(cleanInput, "ID")
	if err := db.Model(&models.Albaran{}).Create(cleanInput).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "✅ Albarán creado correctamente"})
}

func CopyAlbaranAdmin(c *gin.Context, db *gorm.DB) {
	var input map[string]interface{}
	c.ShouldBindJSON(&input)
	cleanInput := cleanAlbaranMap(input, models.Albaran{Fecha: time.Now()})
	cleanInput["Estado"] = 0
	delete(cleanInput, "ID")
	if err := db.Model(&models.Albaran{}).Create(cleanInput).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "✅ Copiado"})
}

func UpdateAlbaranAdmin(c *gin.Context, db *gorm.DB) {
	id := c.Param("id")
	var albaran models.Albaran
	if err := db.First(&albaran, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "No encontrado"})
		return
	}
	var input map[string]interface{}
	c.ShouldBindJSON(&input)
	db.Model(&albaran).Updates(cleanAlbaranMap(input, albaran))
	c.JSON(http.StatusOK, gin.H{"message": "✅ Actualizado por Admin"})
}

func DeleteAlbaran(c *gin.Context, db *gorm.DB) {
	id := c.Param("id")
	db.Model(&models.Albaran{}).Where("id = ?", id).Update("estado", 1)
	c.JSON(http.StatusOK, gin.H{"message": "✅ Borrado"})
}

// ---------------------------------------------------------------------
// SECCIÓN: MÉTODOS TITULARES Y BULK
// ---------------------------------------------------------------------

func SearchAlbaranesUser(c *gin.Context, db *gorm.DB) {
	var albaranes []models.Albaran
	var total int64
	val, _ := c.Get("licencia_id")
	userLicID := uint(0)
	if v, ok := val.(float64); ok {
		userLicID = uint(v)
	} else if v, ok := val.(uint); ok {
		userLicID = v
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "25"))

	// 🛡️ CORRECCIÓN: Siempre usar preloadAlbaran para que el JS reciba EmpresaData
	query := preloadAlbaran(db.Model(&models.Albaran{})).Where("licencia_ref = ? AND estado = ?", userLicID, 0)

	if v := c.Query("empresa_ref"); v != "" {
		query = query.Where("empresa_ref = ?", v)
	}
	if v := c.Query("palabra"); v != "" {
		p := "%" + v + "%"
		query = query.Where(db.Where("empresa_nombre LIKE ?", p).Or("referencia LIKE ?", p).Or("numero_albaran LIKE ?", p))
	}

	query.Count(&total)
	query.Order("fecha DESC, id DESC").Limit(pageSize).Offset((page - 1) * pageSize).Find(&albaranes)

	c.JSON(http.StatusOK, gin.H{"data": albaranes, "total": total})
}

func UpdateAlbaranUser(c *gin.Context, db *gorm.DB) {
	id := c.Param("id")
	var albaran models.Albaran
	if err := db.First(&albaran, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "No encontrado"})
		return
	}
	var input map[string]interface{}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "JSON inválido"})
		return
	}

	// 🚫 REGLA 2025-12-17: Protegemos campos inmutables para Titulares
	delete(input, "numero_albaran")
	delete(input, "licencia_ref")
	delete(input, "estado")

	cleanInput := cleanAlbaranMap(input, albaran)

	if err := db.Model(&albaran).Updates(cleanInput).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "✅ Albarán actualizado correctamente"})
}

func BulkChargeAlbaranes(c *gin.Context, db *gorm.DB) {
	var input struct {
		IDs []uint `json:"ids" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "IDs requeridos"})
		return
	}
	db.Model(&models.Albaran{}).Where("id IN ?", input.IDs).Updates(map[string]interface{}{
		"cobrado": true, "pagado": true, "fecha_pago": time.Now(),
	})
	c.JSON(http.StatusOK, gin.H{"message": "✅ Pago masivo procesado"})
}

func BulkUpdateEnviado(c *gin.Context, db *gorm.DB) {
	var input struct {
		IDs []uint `json:"ids" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "IDs requeridos"})
		return
	}
	db.Model(&models.Albaran{}).Where("id IN ?", input.IDs).Updates(map[string]interface{}{
		"enviado": true, "fecha_envio": time.Now(),
	})
	c.JSON(http.StatusOK, gin.H{"message": "✅ Marcados como enviados"})
}

// ---------------------------------------------------------------------
// SECCIÓN: EXPORTACIÓN
// ---------------------------------------------------------------------

// [REGLA 2026-01-02] Eliminado fragmento ExportRequest local por estar referenciado globalmente
func ExportAlbaranesPDF(c *gin.Context, db *gorm.DB) {
	var req struct {
		ReportName string      `json:"reportName"`
		Data       interface{} `json:"data"`
	}
	c.ShouldBindJSON(&req)
	url, err := utils.GenerateGenericPDF(req.ReportName, req.Data)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "downloadURL": url})
}

func ExportAlbaranesXLSX(c *gin.Context, db *gorm.DB) {
	var req struct {
		ReportName string      `json:"reportName"`
		Data       interface{} `json:"data"`
	}
	c.ShouldBindJSON(&req)
	url, err := utils.GenerateTitularesXLSX(req.ReportName, req.Data)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "downloadURL": url})
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
	db.First(&lic, licID)
	c.JSON(http.StatusOK, gin.H{"licencia_id": lic.ID, "licencia_numero": lic.Licencia})
}
