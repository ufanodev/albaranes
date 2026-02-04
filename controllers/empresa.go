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

type CreateEmpresaInput struct {
	NIF           string `json:"nif" binding:"required,max=20"`
	Nombre        string `json:"nombre" binding:"required,max=100"`
	Direccion     string `json:"direccion" binding:"max=200"`
	CP            string `json:"cp" binding:"max=10"`
	Poblacion     string `json:"poblacion"` // Sincronizado con JS
	Telefono      string `json:"telefono" binding:"max=20"`
	Email         string `json:"email" binding:"omitempty,email,max=100"`
	Observaciones string `json:"observaciones"`
	Estado        bool   `json:"estado"`    // Captura el Toggle del formulario
}

type UpdateEmpresaInput struct {
	NIF           string `json:"nif" binding:"max=20"`
	Nombre        string `json:"nombre" binding:"max=100"`
	Direccion     string `json:"direccion" binding:"max=200"`
	CP            string `json:"cp" binding:"max=10"`
	Poblacion     string `json:"poblacion"`
	Telefono      string `json:"telefono" binding:"max=20"`
	Email         string `json:"email" binding:"omitempty,email,max=100"`
	Observaciones string `json:"observaciones"`
	Estado        *bool  `json:"estado"`    // Usamos puntero para permitir actualizar a false
}

// --- Handlers CRUD ---

// GetEmpresas obtiene todas las empresas
func GetEmpresas(c *gin.Context, db *gorm.DB) {
	var empresas []models.Empresa
	// Ordenamos por nombre A-Z por defecto desde la DB
	if err := db.Order("nombre asc").Find(&empresas).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "❌ Error al obtener empresas"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": empresas})
}

// CreateEmpresa maneja el POST /api/v1/empresas
func CreateEmpresa(c *gin.Context, db *gorm.DB) {
	var input CreateEmpresaInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos", "details": err.Error()})
		return
	}

	empresa := models.Empresa{
		NIF:           input.NIF,
		Nombre:        input.Nombre,
		Direccion:     input.Direccion,
		CP:            input.CP,
		Poblacion:     input.Poblacion,
		Telefono:      input.Telefono,
		Email:         input.Email,
		Observaciones: input.Observaciones,
		Estado:        input.Estado,
	}

	if err := db.Create(&empresa).Error; err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "❌ El NIF ya existe o error en base de datos."})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "✅ Empresa creada con éxito", "data": empresa})
}

// GetEmpresa obtiene una empresa por ID
func GetEmpresa(c *gin.Context, db *gorm.DB) {
	idStr := c.Param("id")
	var empresa models.Empresa
	if err := db.First(&empresa, idStr).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "❌ Empresa no encontrada"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": empresa})
}

// UpdateEmpresa maneja el PUT /api/v1/empresas/:id
func UpdateEmpresa(c *gin.Context, db *gorm.DB) {
	idStr := c.Param("id")
	var empresa models.Empresa
	if err := db.First(&empresa, idStr).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "❌ Empresa no encontrada"})
		return
	}

	var input UpdateEmpresaInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos de actualización inválidos"})
		return
	}

	// Usamos Map para asegurar que GORM actualice todos los campos, incluso booleanos false
	updates := map[string]interface{}{
		"nif":           input.NIF,
		"nombre":        input.Nombre,
		"direccion":     input.Direccion,
		"cp":            input.CP,
		"poblacion":     input.Poblacion,
		"telefono":      input.Telefono,
		"email":         input.Email,
		"observaciones": input.Observaciones,
	}
	
	if input.Estado != nil {
		updates["estado"] = *input.Estado
	}

	if err := db.Model(&empresa).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "❌ Error al actualizar la empresa"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "✅ Empresa actualizada con éxito", "data": empresa})
}

// DeleteEmpresa elimina físicamente una empresa
func DeleteEmpresa(c *gin.Context, db *gorm.DB) {
	idStr := c.Param("id")
	if err := db.Delete(&models.Empresa{}, idStr).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "❌ Error al eliminar la empresa"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "✅ Empresa eliminada correctamente"})
}

// ---------------------------------------------------------------------
// CONTROLADORES DE EXPORTACIÓN
// ---------------------------------------------------------------------

func ExportEmpresasPDF(c *gin.Context, db *gorm.DB) {
	var req ExportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "❌ JSON inválido."})
		return
	}

	downloadURL, err := utils.GenerateGenericPDF(req.ReportName, req.Data)
	if err != nil {
		log.Printf("🔴 ERROR PDF Empresas: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Error al generar PDF"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "downloadURL": downloadURL})
}

func ExportEmpresasXLSX(c *gin.Context, db *gorm.DB) {
	var req ExportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "❌ JSON inválido."})
		return
	}

	downloadURL, err := utils.GenerateTitularesXLSX(req.ReportName, req.Data)
	if err != nil {
		log.Printf("🔴 ERROR XLSX Empresas: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Error al generar Excel"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "downloadURL": downloadURL})
}