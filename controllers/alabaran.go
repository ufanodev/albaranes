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

// 🛡️ LÓGICA DE LIMPIEZA MAESTRA (Respeta ID guardado por instrucción del usuario)
func cleanAlbaranMap(input map[string]interface{}, original models.Albaran) map[string]interface{} {
	clean := make(map[string]interface{})
	fechaBase := original.Fecha.Format(dateFormat)
	if v, ok := input["fecha"].(string); ok && v != "" {
		fechaBase = v
	}

	for key, value := range input {
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
			str, _ := value.(string)
			if t, err := parseTimePtr(fechaBase, str); err == nil {
				clean[strings.Title(key)] = t
			}
			continue
		}

		if strings.Contains(strings.ToLower(key), "fecha") {
			if str, ok := value.(string); ok && str != "" {
				if t, err := parseDatePtr(str); err == nil {
					clean[structKey] = *t
				}
			}
		} else {
			clean[structKey] = value
		}
	}
	return clean
}

// ---------------------------------------------------------------------
// SECCIÓN: CONTROLADORES ADMINISTRACIÓN (PANEL GLOBAL)
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

// ✅ Función SearchAlbaranes (Para el Panel de Administración)
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
	c.ShouldBindJSON(&input)
	cleanInput := cleanAlbaranMap(input, models.Albaran{Fecha: time.Now()})
	cleanInput["Estado"] = 0
	db.Model(&models.Albaran{}).Create(cleanInput)
	c.JSON(http.StatusCreated, gin.H{"message": "✅ Creado"})
}

func UpdateAlbaranAdmin(c *gin.Context, db *gorm.DB) {
	id := c.Param("id")
	var albaran models.Albaran
	db.First(&albaran, id)
	var input map[string]interface{}
	c.ShouldBindJSON(&input)
	db.Model(&albaran).Updates(cleanAlbaranMap(input, albaran))
	c.JSON(http.StatusOK, gin.H{"message": "✅ Actualizado"})
}

func CopyAlbaranAdmin(c *gin.Context, db *gorm.DB) {
	var input map[string]interface{}
	c.ShouldBindJSON(&input)
	cleanInput := cleanAlbaranMap(input, models.Albaran{Fecha: time.Now()})
	cleanInput["Estado"] = 0
	db.Model(&models.Albaran{}).Create(cleanInput)
	c.JSON(http.StatusCreated, gin.H{"message": "✅ Copiado"})
}

func DeleteAlbaran(c *gin.Context, db *gorm.DB) {
	id := c.Param("id")
	db.Exec("UPDATE albaranes SET estado = 1 WHERE id = ?", id)
	c.JSON(http.StatusOK, gin.H{"message": "✅ Borrado"})
}

// ---------------------------------------------------------------------
// SECCIÓN: EXPORTACIÓN
// ---------------------------------------------------------------------

func ExportAlbaranesPDF(c *gin.Context, db *gorm.DB) {
	var req ExportRequest
	c.ShouldBindJSON(&req)
	url, _ := utils.GenerateGenericPDF(req.ReportName, req.Data)
	c.JSON(http.StatusOK, gin.H{"success": true, "downloadURL": url})
}

func ExportAlbaranesXLSX(c *gin.Context, db *gorm.DB) {
	var req ExportRequest
	c.ShouldBindJSON(&req)
	url, _ := utils.GenerateTitularesXLSX(req.ReportName, req.Data)
	c.JSON(http.StatusOK, gin.H{"success": true, "downloadURL": url})
}

// =====================================================================
// 🆕 MÉTODOS TITULARES (QUERY DINÁMICA SQL SOLICITADA)
// =====================================================================

func SearchAlbaranesUser(c *gin.Context, db *gorm.DB) {
	var albaranes []models.Albaran

	// LOG INICIAL DE AUDITORÍA
	fmt.Printf("\n[SQL-AUDIT] 📥 Request: %s\n", c.Request.URL.RawQuery)

	val, exists := c.Get("licencia_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Sesión no válida"})
		return
	}
	var userLicID uint
	switch v := val.(type) {
	case uint:
		userLicID = v
	case float64:
		userLicID = uint(v)
	}

	// Iniciamos la Query con Debug para ver el SQL exacto en consola
	debugDB := db.Debug()
	query := preloadAlbaran(debugDB.Model(&models.Albaran{})).
		Where("licencia_ref = ? AND estado = ?", userLicID, 0)

	// --- IMPLEMENTACIÓN DE LA QUERY SOLICITADA ---

	// 1. Empresa (:empresa)
	if v := c.Query("empresa_ref"); v != "" {
		fmt.Printf("[FILTER] Empresa ID: %s\n", v)
		query = query.Where("empresa_ref = ?", v)
	}

	// 2. Estado (Lógica 0 o 1 para enviado/pagado/cobrado)
	if v := c.Query("state"); v != "" {
		fmt.Printf("[FILTER] Estado UI: %s\n", v)
		switch v {
		case "creado":
			query = query.Where("enviado = 0 AND pagado = 0")
		case "enviado":
			query = query.Where("enviado = 1 AND pagado = 0")
		case "pagado":
			// Caso solicitado: enviado=1, pagado=1, cobrado=1
			query = query.Where("enviado = 1 AND pagado = 1 AND cobrado = 1")
		case "finalizado":
			query = query.Where("pagado = 1")
		}
	}

	// 3. Referencia exacta o parcial (:referencia)
	if v := c.Query("referencia"); v != "" {
		fmt.Printf("[FILTER] Referencia: %s\n", v)
		query = query.Where("referencia LIKE ?", "%"+v+"%")
	}

	// 4. Rango de fechas (:desde, :hasta)
	if v := c.Query("fecha_desde"); v != "" {
		query = query.Where("fecha >= ?", v)
	}
	if v := c.Query("fecha_hasta"); v != "" {
		query = query.Where("fecha <= ?", v)
	}

	// 5. Búsqueda por palabra libre (:palabra)
	if v := c.Query("palabra"); v != "" {
		fmt.Printf("[FILTER] Palabra Global: %s\n", v)
		p := "%" + v + "%"
		query = query.Where(
			debugDB.Where("empresa_nombre LIKE ?", p).
				Or("cliente LIKE ?", p).
				Or("origen LIKE ?", p).
				Or("destino LIKE ?", p).
				Or("referencia LIKE ?", p),
		)
	}

	// 6. Orden y Límite (Reflejo del SQL solicitado)
	err := query.Order("fecha DESC, id DESC").Limit(25).Find(&albaranes).Error

	if err != nil {
		fmt.Printf("[SQL-AUDIT] ❌ ERROR: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error SQL"})
		return
	}

	fmt.Printf("[SQL-AUDIT] ✅ Resultados: %d\n", len(albaranes))
	c.JSON(http.StatusOK, gin.H{"data": albaranes})
}

func UpdateAlbaranUser(c *gin.Context, db *gorm.DB) {
	id := c.Param("id")
	var albaran models.Albaran
	db.First(&albaran, id)
	var input map[string]interface{}
	c.ShouldBindJSON(&input)

	// Protecciones: Usuario no cambia campos clave ni inmutables
	delete(input, "numero_albaran")
	delete(input, "licencia_ref")
	delete(input, "estado")

	db.Model(&albaran).Updates(cleanAlbaranMap(input, albaran))
	c.JSON(http.StatusOK, gin.H{"message": "✅ Actualizado"})
}

func GetLicenciaInfoForUser(c *gin.Context, db *gorm.DB) {
	val, _ := c.Get("licencia_id")
	licID := uint(0)
	switch v := val.(type) {
	case uint:
		licID = v
	case float64:
		licID = uint(v)
	}
	var lic models.Licencia
	if err := db.First(&lic, licID).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{"licencia_id": 0, "licencia_numero": "S/N"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"licencia_id": lic.ID, "licencia_numero": lic.Licencia})
}

func BulkChargeAlbaranes(c *gin.Context, db *gorm.DB) {
	var input struct {
		IDs []uint `json:"ids" binding:"required"`
	}
	c.ShouldBindJSON(&input)
	db.Model(&models.Albaran{}).Where("id IN ?", input.IDs).Updates(map[string]interface{}{"cobrado": true, "pagado": true})
	c.JSON(http.StatusOK, gin.H{"message": "✅ Actualizado"})
}
