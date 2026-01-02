package controllers

import (
	"log"
	"net/http"

	"albaranes/models"
	"albaranes/utils"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// =================================================================
// 🔑 CONTROLADORES PARA TITULARES (Sincronizados con DB)
// =================================================================

// GetMisConductores devuelve los conductores asociados a la licencia del usuario logueado.
// Resuelve el error 1054: Unknown column 'licencia_ref'.
func GetMisConductores(c *gin.Context, db *gorm.DB) {
	// 1. Obtener ID de licencia desde el JWT
	val, exists := c.Get("licencia_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Sesión no válida"})
		return
	}

	licID := uint(0)
	switch v := val.(type) {
	case float64:
		licID = uint(v)
	case uint:
		licID = v
	}

	// 2. Obtener el NUMERO de licencia (ej: "7") porque la tabla conductores no usa IDs numéricos
	var licenciaMaster models.Licencia
	if err := db.First(&licenciaMaster, licID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Licencia maestra no encontrada"})
		return
	}

	var conductores []models.Conductor
	// 3. BUSQUEDA CORREGIDA: Filtramos por 'licencia' (string) y 'activo' (bool)
	err := db.Where("licencia = ? AND activo = ?", licenciaMaster.Licencia, true).
		Order("nombre asc").
		Find(&conductores).Error

	if err != nil {
		log.Printf("🔴 [GetMisConductores] Error SQL: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al recuperar conductores."})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": conductores})
}

// =================================================================
// 🔑 CONTROLADORES CRUD (API ADMIN)
// =================================================================

func GetConductores(c *gin.Context, db *gorm.DB) {
	var conductores []models.Conductor
	if err := db.Where("activo = ?", true).Find(&conductores).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al obtener lista"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": conductores})
}

func GetConductorByLicenciaYNumero(c *gin.Context, db *gorm.DB) {
	licencia := c.Param("licencia")
	nconductor := c.Param("nconductor")
	var conductor models.Conductor
	if err := db.Where("licencia = ? AND conductor = ? AND activo = ?", licencia, nconductor, true).First(&conductor).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Conductor no encontrado"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": conductor})
}

func CreateConductor(c *gin.Context, db *gorm.DB) {
	var input models.CreateConductorInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos"})
		return
	}

	conductor := models.Conductor{
		Licencia:  input.Licencia,
		Conductor: input.Conductor,
		Nombre:    input.Nombre,
		Email:     input.Email,
		Telefono:  input.Telefono,
		Activo:    true,
	}

	if err := db.Create(&conductor).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al crear"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "✅ Conductor creado"})
}

func UpdateConductorByLicenciaYConductor(c *gin.Context, db *gorm.DB) {
	licencia := c.Param("licencia")
	conductorNum := c.Param("conductor")
	var conductor models.Conductor
	if err := db.Where("licencia = ? AND conductor = ?", licencia, conductorNum).First(&conductor).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "No encontrado"})
		return
	}

	var input models.UpdateConductorInput
	c.ShouldBindJSON(&input)

	updates := make(map[string]interface{})
	if input.Conductor != nil {
		updates["conductor"] = *input.Conductor
	}
	if input.Nombre != nil {
		updates["nombre"] = *input.Nombre
	}
	if input.Email != nil {
		updates["email"] = *input.Email
	}
	if input.Telefono != nil {
		updates["telefono"] = *input.Telefono
	}
	if input.Activo != nil {
		updates["activo"] = *input.Activo
	}

	db.Model(&conductor).Updates(updates)
	c.JSON(http.StatusOK, gin.H{"message": "✅ Actualizado"})
}

func DeleteConductorByID(c *gin.Context, db *gorm.DB) {
	id := c.Param("id")
	if err := db.Model(&models.Conductor{}).Where("id = ?", id).Update("activo", false).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al desactivar"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "✅ Desactivado"})
}

// =================================================================
// 🎯 EXPORTACIÓN
// =================================================================

func ExportConductoresPDF(c *gin.Context, db *gorm.DB) {
	var req struct {
		ReportName string              `json:"reportName"`
		Data       []map[string]string `json:"data"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "JSON inválido"})
		return
	}
	url, err := utils.GenerateGenericPDF(req.ReportName, req.Data)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "downloadURL": url})
}

func ExportConductoresXLSX(c *gin.Context, db *gorm.DB) {
	var req struct {
		ReportName string              `json:"reportName"`
		Data       []map[string]string `json:"data"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "JSON inválido"})
		return
	}
	url, err := utils.GenerateTitularesXLSX(req.ReportName, req.Data)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "downloadURL": url})
}
