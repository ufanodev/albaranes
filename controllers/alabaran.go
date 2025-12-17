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
// HELPERS DE PARSEO Y PRELOAD
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
func cleanAlbaranMap(input map[string]interface{}, original models.Albaran) map[string]interface{} {
	clean := make(map[string]interface{})

	fechaBase := original.Fecha.Format(dateFormat)
	if v, ok := input["fecha"].(string); ok && v != "" {
		fechaBase = v
	}

	for key, value := range input {
		// Protección campos inmutables (id guardado por instrucción del usuario)
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

		// Horas y Tiempos
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

		// Fechas
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
// CONTROLADORES CRUD
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

// 🗑️ DELETE ALBARAN (BORRADO LÓGICO DIRECTO)
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
// EXPORTACIÓN (CORREGIDA PARA EVITAR ERROR DE CONVERSIÓN)
// ---------------------------------------------------------------------

func ExportAlbaranesPDF(c *gin.Context, db *gorm.DB) {
	var req struct {
		ReportName string                   `json:"reportName"`
		Data       []map[string]interface{} `json:"data"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos"})
		return
	}

	var mappedData []utils.TitularData
	for _, m := range req.Data {
		item := utils.TitularData{}
		for k, v := range m {
			item[k] = fmt.Sprintf("%v", v)
		}
		mappedData = append(mappedData, item)
	}

	url, err := utils.GenerateGenericPDF(req.ReportName, mappedData)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Fallo al generar PDF"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "downloadURL": url})
}

func ExportAlbaranesXLSX(c *gin.Context, db *gorm.DB) {
	var req struct {
		ReportName string                   `json:"reportName"`
		Data       []map[string]interface{} `json:"data"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos"})
		return
	}

	var mappedData []utils.TitularData
	for _, m := range req.Data {
		item := utils.TitularData{}
		for k, v := range m {
			item[k] = fmt.Sprintf("%v", v)
		}
		mappedData = append(mappedData, item)
	}

	url, err := utils.GenerateTitularesXLSX(req.ReportName, mappedData)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Fallo al generar Excel"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "downloadURL": url})
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
