package controllers

import (
	"log"
	"net/http"

	"albaranes/models"
	"albaranes/utils"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// --- Estructuras de Input (DTOs) ---

type CreateConductorInput struct {
	Licencia  string `json:"licencia" binding:"required,max=3"`
	Conductor string `json:"conductor" binding:"required,max=20"`
	Nombre    string `json:"nombre" binding:"required,max=100"`
	Email     string `json:"email" binding:"required,email,max=100"`
	Telefono  string `json:"telefono" binding:"max=20"`
}

type UpdateConductorInput struct {
	Conductor *string `json:"conductor" binding:"omitempty,max=20"`
	Nombre    *string `json:"nombre" binding:"omitempty,max=100"`
	Email     *string `json:"email" binding:"omitempty,email,max=100"`
	Telefono  *string `json:"telefono" binding:"omitempty,max=20"`
	Activo    *bool   `json:"activo"`
}

// =================================================================
// 🔑 Controladores CRUD (API)
// =================================================================

func GetConductores(c *gin.Context, db *gorm.DB) {
	var conductores []models.Conductor
	result := db.Find(&conductores)
	if result.Error != nil {
		log.Printf("🔴 [GetConductores] Error GORM: %v", result.Error)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "❌ Error al obtener la lista."})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": conductores})
}

func GetConductor(c *gin.Context, db *gorm.DB) {
	licencia := c.Param("licencia")
	var conductor models.Conductor
	if err := db.Where("licencia = ?", licencia).First(&conductor).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "❌ Conductor no encontrado."})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": conductor})
}

func GetConductorByLicenciaYNumero(c *gin.Context, db *gorm.DB) {
	licencia := c.Param("licencia")
	nconductor := c.Param("nconductor")
	var conductor models.Conductor
	if err := db.Where("licencia = ? AND conductor = ?", licencia, nconductor).First(&conductor).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "❌ Conductor no encontrado."})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": conductor})
}

func CreateConductor(c *gin.Context, db *gorm.DB) {
	var input CreateConductorInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos", "details": err.Error()})
		return
	}

	var existingConductor models.Conductor
	err := db.Where("licencia = ? AND email = ?", input.Licencia, input.Email).Select("id").First(&existingConductor).Error
	if err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "❌ Este email ya existe para esta licencia."})
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": "❌ Error al crear conductor."})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "✅ Conductor creado.", "id": conductor.ID})
}

func UpdateConductor(c *gin.Context, db *gorm.DB) {
	licencia := c.Param("licencia")
	var conductor models.Conductor
	if err := db.Where("licencia = ?", licencia).First(&conductor).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "❌ No encontrado."})
		return
	}

	var input UpdateConductorInput
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
	c.JSON(http.StatusOK, gin.H{"message": "✅ Actualizado."})
}

func UpdateConductorByLicenciaYConductor(c *gin.Context, db *gorm.DB) {
	licencia := c.Param("licencia")
	conductorNum := c.Param("conductor")
	var conductor models.Conductor
	if err := db.Where("licencia = ? AND conductor = ?", licencia, conductorNum).First(&conductor).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "❌ No encontrado."})
		return
	}

	var input UpdateConductorInput
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
	c.JSON(http.StatusOK, gin.H{"message": "✅ Actualizado."})
}

func DeleteConductor(c *gin.Context, db *gorm.DB) {
	licencia := c.Param("licencia")
	db.Model(&models.Conductor{}).Where("licencia = ?", licencia).Update("activo", false)
	c.JSON(http.StatusOK, gin.H{"message": "✅ Desactivado."})
}

func DeleteConductorByID(c *gin.Context, db *gorm.DB) {
	id := c.Param("id")
	db.Model(&models.Conductor{}).Where("id = ?", id).Update("activo", false)
	c.JSON(http.StatusOK, gin.H{"message": "✅ Desactivado."})
}

func DeleteConductorByLicenciaYNumero(c *gin.Context, db *gorm.DB) {
	licencia := c.Param("licencia")
	nconductor := c.Param("nconductor")
	db.Model(&models.Conductor{}).Where("licencia = ? AND conductor = ?", licencia, nconductor).Update("activo", false)
	c.JSON(http.StatusOK, gin.H{"message": "✅ Desactivado."})
}

// =================================================================
// 🎯 CONTROLADORES DE EXPORTACIÓN (PDF y XLSX)
// =================================================================

// ExportConductoresPDF maneja la generación del PDF de conductores.
func ExportConductoresPDF(c *gin.Context, db *gorm.DB) {
	var req ExportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Printf("🔴 ERROR Conductores PDF Bind: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Solicitud JSON inválida"})
		return
	}

	if len(req.Data) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "No hay datos para exportar"})
		return
	}

	// Usamos la utilidad genérica de PDF
	downloadURL, err := utils.GenerateGenericPDF(req.ReportName, req.Data)
	if err != nil {
		log.Printf("🔴 ERROR Generando PDF Conductores: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Error al generar el archivo PDF"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":     true,
		"downloadURL": downloadURL,
	})
}

// ExportConductoresXLSX maneja la generación del Excel de conductores.
func ExportConductoresXLSX(c *gin.Context, db *gorm.DB) {
	var req ExportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Printf("🔴 ERROR Conductores XLSX Bind: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Solicitud JSON inválida"})
		return
	}

	if len(req.Data) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "No hay datos para exportar"})
		return
	}

	// Usamos la utilidad de Excel compatible con map[string]string
	downloadURL, err := utils.GenerateTitularesXLSX(req.ReportName, req.Data)
	if err != nil {
		log.Printf("🔴 ERROR Generando XLSX Conductores: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Error al generar el archivo Excel"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":     true,
		"downloadURL": downloadURL,
	})
}

// =================================================================
// 🎯 CONTROLADORES HTML (frontend)
// =================================================================

func GetConductorForEditHTML(c *gin.Context, db *gorm.DB) {
	licencia := c.Param("licencia")
	condParam := c.Param("conductor")
	var conductor models.Conductor
	var err error
	if condParam != "" && condParam != ":conductor" {
		err = db.Where("licencia = ? AND conductor = ?", licencia, condParam).First(&conductor).Error
	} else {
		err = db.Where("licencia = ?", licencia).First(&conductor).Error
	}
	if err != nil {
		c.HTML(http.StatusNotFound, "error.html", gin.H{"error": "No encontrado"})
		return
	}
	c.HTML(http.StatusOK, "admin_conductor_crud.html", gin.H{"Title": "Editar Conductor", "Conductor": conductor, "IsEdit": true, "Action": "edit"})
}

func GetConductorForViewHTML(c *gin.Context, db *gorm.DB) {
	licencia := c.Param("licencia")
	condParam := c.Param("conductor")
	var conductor models.Conductor
	var err error
	if condParam != "" && condParam != ":conductor" {
		err = db.Where("licencia = ? AND conductor = ?", licencia, condParam).First(&conductor).Error
	} else {
		err = db.Where("licencia = ?", licencia).First(&conductor).Error
	}
	if err != nil {
		c.HTML(http.StatusNotFound, "error.html", gin.H{"error": "No encontrado"})
		return
	}
	c.HTML(http.StatusOK, "admin_conductor_crud.html", gin.H{"Title": "Ver Conductor", "Conductor": conductor, "IsView": true, "Action": "view"})
}

func DeleteConductorHTML(c *gin.Context, db *gorm.DB) {
	licencia := c.Param("licencia")
	condParam := c.Param("conductor")
	if condParam != "" && condParam != ":conductor" {
		db.Model(&models.Conductor{}).Where("licencia = ? AND conductor = ?", licencia, condParam).Update("activo", false)
	} else {
		db.Model(&models.Conductor{}).Where("licencia = ?", licencia).Update("activo", false)
	}
	c.Redirect(http.StatusSeeOther, "/admin/conductor")
}
