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
	Telefono      string `json:"telefono" binding:"max=20"`
	Email         string `json:"email" binding:"omitempty,email,max=100"` // omitempty para permitir vacíos
	Observaciones string `json:"observaciones"`
}

type UpdateEmpresaInput struct {
	NIF           string `json:"nif" binding:"max=20"`
	Nombre        string `json:"nombre" binding:"max=100"`
	Direccion     string `json:"direccion" binding:"max=200"`
	CP            string `json:"cp" binding:"max=10"`
	Telefono      string `json:"telefono" binding:"max=20"`
	Email         string `json:"email" binding:"omitempty,email,max=100"`
	Observaciones string `json:"observaciones"`
}

// --- Handlers CRUD ---

func GetEmpresas(c *gin.Context, db *gorm.DB) {
	var empresas []models.Empresa
	if err := db.Find(&empresas).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "❌ Error al obtener empresas"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": empresas})
}

func CreateEmpresa(c *gin.Context, db *gorm.DB) {
	var input CreateEmpresaInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos", "details": err.Error()})
		return
	}

	empresa := models.Empresa{
		NIF: input.NIF, Nombre: input.Nombre, Direccion: input.Direccion,
		CP: input.CP, Telefono: input.Telefono, Email: input.Email, Observaciones: input.Observaciones,
	}

	if err := db.Create(&empresa).Error; err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "❌ El NIF ya existe."})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "✅ Empresa creada", "data": empresa})
}

func GetEmpresa(c *gin.Context, db *gorm.DB) {
	idStr := c.Param("id")
	var empresa models.Empresa
	if err := db.First(&empresa, idStr).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "❌ Empresa no encontrada"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": empresa})
}

func UpdateEmpresa(c *gin.Context, db *gorm.DB) {
	idStr := c.Param("id")
	var empresa models.Empresa
	if err := db.First(&empresa, idStr).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "❌ Empresa no encontrada"})
		return
	}

	var input UpdateEmpresaInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos"})
		return
	}

	db.Model(&empresa).Updates(input)
	c.JSON(http.StatusOK, gin.H{"message": "✅ Empresa actualizada", "data": empresa})
}

func DeleteEmpresa(c *gin.Context, db *gorm.DB) {
	idStr := c.Param("id")
	if err := db.Delete(&models.Empresa{}, idStr).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "❌ Error al eliminar"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "✅ Empresa eliminada"})
}

// ---------------------------------------------------------------------
// CONTROLADORES DE EXPORTACIÓN (Unificados con Utils)
// ---------------------------------------------------------------------

func ExportEmpresasPDF(c *gin.Context, db *gorm.DB) {
	var req ExportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "❌ JSON inválido."})
		return
	}

	// Llama al método genérico unificado en utils
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

	// Llama al método genérico unificado en utils
	downloadURL, err := utils.GenerateTitularesXLSX(req.ReportName, req.Data)
	if err != nil {
		log.Printf("🔴 ERROR XLSX Empresas: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Error al generar Excel"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "downloadURL": downloadURL})
}
