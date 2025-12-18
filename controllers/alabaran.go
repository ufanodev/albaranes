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
// SECCIÓN: HELPERS DE PARSEO Y PRELOAD
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
	full := fmt.Sprintf("%s %s:00", dateBase, timeStr)
	t, err := time.Parse("2006-01-02 15:04:05", full)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func preloadAlbaran(db *gorm.DB) *gorm.DB {
	return db.Preload("LicenciaData").Preload("EmpresaData")
}

// 🛡️ LÓGICA DE LIMPIEZA MAESTRA (41 CAMPOS)
// Permite modificar todos los campos excepto el ID guardado.
func cleanAlbaranMap(input map[string]interface{}, original models.Albaran) map[string]interface{} {
	clean := make(map[string]interface{})

	fechaBase := original.Fecha.Format(dateFormat)
	if v, ok := input["fecha"].(string); ok && v != "" {
		fechaBase = v
	}

	for key, value := range input {
		// Protección campos inmutables (ID guardado)
		if key == "id" || key == "created_at" || key == "updated_at" || key == "ID" {
			continue
		}

		structKey := key
		switch key {
		case "licencia_ref":
			structKey = "LicenciaRef"
		case "empresa_ref":
			structKey = "EmpresaRef"
		case "numero_albaran":
			structKey = "NumeroAlbaran"
		case "num_factura":
			structKey = "NumFactura"
		case "observaciones_admin":
			structKey = "ObservacionesAdmin"
		case "km_nacionales":
			structKey = "KmNacionales"
		case "km_internacionales":
			structKey = "KmInternacionales"
		case "dni_pasajero":
			structKey = "DNIPasajero"
		default:
			structKey = strings.Title(key)
		}

		if key == "hora" || key == "tiempo_espera" {
			str, ok := value.(string)
			if !ok || strings.TrimSpace(str) == "" {
				clean[strings.Title(key)] = nil
				continue
			}
			if t, err := parseTimePtr(fechaBase, str); err == nil {
				clean[strings.Title(key)] = t
			} else {
				clean[strings.Title(key)] = nil
			}
			continue
		}

		if strings.Contains(strings.ToLower(key), "fecha") {
			if str, ok := value.(string); ok && str != "" {
				if t, err := parseDatePtr(str); err == nil {
					clean[structKey] = *t
				}
			} else {
				clean[structKey] = nil
			}
		} else {
			clean[structKey] = value
		}
	}
	return clean
}

// ---------------------------------------------------------------------
// SECCIÓN: CONTROLADORES PARA ADMINISTRACIÓN (PANEL GLOBAL)
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

func GetAlbaran(c *gin.Context, db *gorm.DB) {
	id := c.Param("id")
	var albaran models.Albaran
	if err := preloadAlbaran(db).First(&albaran, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "❌ No encontrado"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": albaran})
}

func SearchAlbaranes(c *gin.Context, db *gorm.DB) {
	var albaranes []models.Albaran
	query := preloadAlbaran(db.Model(&models.Albaran{})).Where("albaranes.estado = ?", 0)
	if v := c.Query("licencia_ref"); v != "" {
		query = query.Where("albaranes.licencia_ref = ?", v)
	}
	if v := c.Query("empresa_ref"); v != "" {
		query = query.Where("albaranes.empresa_ref = ?", v)
	}
	if v := c.Query("referencia"); v != "" {
		query = query.Where("albaranes.referencia LIKE ?", "%"+v+"%")
	}
	query.Order("albaranes.fecha desc, albaranes.id desc").Find(&albaranes)
	c.JSON(http.StatusOK, gin.H{"data": albaranes})
}

func CreateAlbaran(c *gin.Context, db *gorm.DB) {
	var input map[string]interface{}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "❌ Datos inválidos"})
		return
	}
	cleanInput := cleanAlbaranMap(input, models.Albaran{Fecha: time.Now()})
	cleanInput["Estado"] = 0
	if err := db.Model(&models.Albaran{}).Create(cleanInput).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "❌ Error al crear"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "✅ Albarán creado"})
}

func UpdateAlbaranAdmin(c *gin.Context, db *gorm.DB) {
	id := c.Param("id")
	var albaran models.Albaran
	if err := db.First(&albaran, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "❌ No encontrado"})
		return
	}
	var input map[string]interface{}
	c.ShouldBindJSON(&input)
	cleanInput := cleanAlbaranMap(input, albaran)
	db.Model(&albaran).Updates(cleanInput)
	c.JSON(http.StatusOK, gin.H{"message": "✅ Actualizado por Admin", "data": albaran})
}

func UpdateAlbaranUser(c *gin.Context, db *gorm.DB) {
	id := c.Param("id")
	var albaran models.Albaran
	if err := db.First(&albaran, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "❌ No encontrado"})
		return
	}
	var input map[string]interface{}
	c.ShouldBindJSON(&input)
	delete(input, "numero_albaran")
	delete(input, "licencia_ref")
	delete(input, "estado")
	delete(input, "observaciones_admin")
	cleanInput := cleanAlbaranMap(input, albaran)
	db.Model(&albaran).Updates(cleanInput)
	c.JSON(http.StatusOK, gin.H{"message": "✅ Actualizado correctamente"})
}

func CopyAlbaranAdmin(c *gin.Context, db *gorm.DB) {
	var input map[string]interface{}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "❌ Datos inválidos"})
		return
	}
	cleanInput := cleanAlbaranMap(input, models.Albaran{Fecha: time.Now()})
	cleanInput["Estado"] = 0
	if err := db.Model(&models.Albaran{}).Create(cleanInput).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "❌ Error al copiar"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "✅ Albarán copiado"})
}

func DeleteAlbaran(c *gin.Context, db *gorm.DB) {
	id := c.Param("id")
	result := db.Exec("UPDATE albaranes SET estado = 1 WHERE id = ?", id)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "❌ Error en base de datos"})
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "❌ No encontrado"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "✅ Albarán borrado correctamente"})
}

// ---------------------------------------------------------------------
// SECCIÓN: EXPORTACIÓN
// ---------------------------------------------------------------------

func ExportAlbaranesPDF(c *gin.Context, db *gorm.DB) {
	var req ExportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos"})
		return
	}
	url, err := utils.GenerateGenericPDF(req.ReportName, req.Data)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Fallo al generar PDF"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "downloadURL": url})
}

func ExportAlbaranesXLSX(c *gin.Context, db *gorm.DB) {
	var req ExportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos"})
		return
	}
	url, err := utils.GenerateTitularesXLSX(req.ReportName, req.Data)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Fallo al generar Excel"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "downloadURL": url})
}

// =====================================================================
// 🆕 SECCIÓN: MÉTODOS EXCLUSIVOS PARA USUARIOS (TITULARES)
// =====================================================================

// SearchAlbaranesUser - Buscador optimizado para el Titular (Sin límite de 10)
func SearchAlbaranesUser(c *gin.Context, db *gorm.DB) {
	var albaranes []models.Albaran

	val, exists := c.Get("licencia_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "No se detectó licencia en la sesión"})
		return
	}

	userLicID := uint(0)
	switch v := val.(type) {
	case uint:
		userLicID = v
	case float64:
		userLicID = uint(v)
	}

	// Consulta base con Joins para poder buscar por nombre de empresa en el modo palabra
	query := db.Model(&models.Albaran{}).
		Preload("LicenciaData").
		Preload("EmpresaData").
		Joins("LEFT JOIN empresas ON empresas.id = albaranes.empresa_ref").
		Where("albaranes.licencia_ref = ? AND albaranes.estado = ?", userLicID, 0)

	// --- FILTROS POR CAMPOS ---
	if v := c.Query("empresa_ref"); v != "" {
		query = query.Where("albaranes.empresa_ref = ?", v)
	}

	if v := c.Query("state"); v != "" {
		switch v {
		case "creado":
			query = query.Where("albaranes.enviado = ? AND albaranes.pagado = ?", false, false)
		case "enviado":
			query = query.Where("albaranes.enviado = ? AND albaranes.pagado = ?", true, false)
		case "pagado":
			query = query.Where("albaranes.pagado = ?", true)
		case "finalizado":
			query = query.Where("albaranes.pagado = ? AND albaranes.cobrado = ?", true, true)
		}
	}

	if v := c.Query("referencia"); v != "" {
		query = query.Where("albaranes.referencia LIKE ?", "%"+v+"%")
	}

	if v := c.Query("fecha_desde"); v != "" {
		query = query.Where("albaranes.fecha >= ?", v)
	}
	if v := c.Query("fecha_hasta"); v != "" {
		query = query.Where("albaranes.fecha <= ?", v)
	}

	// --- 🔍 BÚSQUEDA GLOBAL POR PALABRA ---
	if v := c.Query("palabra"); v != "" {
		p := "%" + v + "%"
		query = query.Where(
			"(albaranes.numero_albaran LIKE ? OR "+
				"albaranes.referencia LIKE ? OR "+
				"albaranes.matricula LIKE ? OR "+
				"albaranes.cliente LIKE ? OR "+
				"albaranes.origen LIKE ? OR "+
				"albaranes.destino LIKE ? OR "+
				"albaranes.asalariado LIKE ? OR "+
				"empresas.nombre LIKE ? OR "+
				"albaranes.observaciones_admin LIKE ?)",
			p, p, p, p, p, p, p, p, p,
		)
	}

	if err := query.Order("albaranes.fecha desc, albaranes.id desc").Find(&albaranes).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error interno al procesar búsqueda"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": albaranes})
}

func GetLicenciaInfoForUser(c *gin.Context, db *gorm.DB) {
	val, exists := c.Get("licencia_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Sesión sin datos de licencia"})
		return
	}

	licID := uint(0)
	switch v := val.(type) {
	case uint:
		licID = v
	case float64:
		licID = uint(v)
	}

	if licID == 0 {
		c.JSON(http.StatusOK, gin.H{"licencia_id": 0, "licencia_numero": "Admin", "titular": "Administrador"})
		return
	}

	var lic models.Licencia
	if err := db.First(&lic, licID).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{"licencia_id": 0, "licencia_numero": "N/A"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"licencia_id": lic.ID, "licencia_numero": lic.Licencia})
}

func BulkChargeAlbaranes(c *gin.Context, db *gorm.DB) {
	var input struct {
		IDs        []uint `json:"ids" binding:"required"`
		FechaCobro string `json:"fecha_cobro"`
		FechaPago  string `json:"fecha_pago"`
	}
	c.ShouldBindJSON(&input)
	updates := map[string]interface{}{"cobrado": true, "pagado": true, "fecha_cobro": input.FechaCobro, "fecha_pago": input.FechaPago}
	db.Model(&models.Albaran{}).Where("id IN ?", input.IDs).Updates(updates)
	c.JSON(http.StatusOK, gin.H{"message": "✅ Actualizado"})
}
