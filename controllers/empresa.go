package controllers

import (
	"log"
	"net/http"
	"strconv"

	"albaranes/models"
	"albaranes/utils" // 🔑 Importación necesaria para utils.Generate... y utils.TitularData (indirectamente)

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// --- Estructuras de Input (DTOs) ---

// CreateEmpresaInput es el DTO para la creación de una Empresa.
type CreateEmpresaInput struct {
	NIF           string `json:"nif" binding:"required,max=20"`
	Nombre        string `json:"nombre" binding:"required,max=100"`
	Direccion     string `json:"direccion" binding:"max=200"`
	CP            string `json:"cp" binding:"max=10"`
	Telefono      string `json:"telefono" binding:"max=20"`
	Email         string `json:"email" binding:"email,max=100"`
	Observaciones string `json:"observaciones"`
}

// UpdateEmpresaInput es el DTO para la actualización de una Empresa.
type UpdateEmpresaInput struct {
	NIF           string `json:"nif" binding:"max=20"`
	Nombre        string `json:"nombre" binding:"max=100"`
	Direccion     string `json:"direccion" binding:"max=200"`
	CP            string `json:"cp" binding:"max=10"`
	Telefono      string `json:"telefono" binding:"max=20"`
	Email         string `json:"email" binding:"email,max=100"`
	Observaciones string `json:"observaciones"`
}

// --- Handlers CRUD ---

// CreateEmpresa maneja la creación de una nueva empresa.
func CreateEmpresa(c *gin.Context, db *gorm.DB) {
	var input CreateEmpresaInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos para la empresa", "details": err.Error()})
		return
	}

	empresa := models.Empresa{
		NIF:           input.NIF,
		Nombre:        input.Nombre,
		Direccion:     input.Direccion,
		CP:            input.CP,
		Telefono:      input.Telefono,
		Email:         input.Email,
		Observaciones: input.Observaciones,
	}

	if result := db.Create(&empresa); result.Error != nil {
		log.Printf("ERROR GORM al crear empresa: %v", result.Error)
		c.JSON(http.StatusConflict, gin.H{"error": "❌ Ya existe una empresa con ese NIF."})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "✅ Empresa creada exitosamente", "data": empresa})
}

// GetEmpresas obtiene una lista de todas las empresas.
func GetEmpresas(c *gin.Context, db *gorm.DB) {
	var empresas []models.Empresa
	if err := db.Find(&empresas).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "❌ Error al obtener la lista de empresas"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": empresas})
}

// GetEmpresa obtiene una empresa por ID.
func GetEmpresa(c *gin.Context, db *gorm.DB) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID de empresa inválido"})
		return
	}

	var empresa models.Empresa
	if err := db.First(&empresa, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "❌ Empresa no encontrada"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": empresa})
}

// UpdateEmpresa actualiza los campos de una empresa por ID (PUT).
func UpdateEmpresa(c *gin.Context, db *gorm.DB) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID de empresa inválido"})
		return
	}

	var empresa models.Empresa
	if err := db.First(&empresa, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "❌ Empresa no encontrada"})
		return
	}

	var input UpdateEmpresaInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos de actualización inválidos", "details": err.Error()})
		return
	}

	if result := db.Model(&empresa).Updates(input); result.Error != nil {
		log.Printf("ERROR GORM al actualizar empresa: %v", result.Error)
		c.JSON(http.StatusConflict, gin.H{"error": "❌ Error al actualizar. El NIF ya puede existir o datos incorrectos."})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "✅ Empresa actualizada exitosamente", "data": empresa})
}

// DeleteEmpresa elimina una empresa por ID (Eliminación física).
func DeleteEmpresa(c *gin.Context, db *gorm.DB) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID de empresa inválido"})
		return
	}

	if result := db.Delete(&models.Empresa{}, id); result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "❌ Error al eliminar la empresa"})
		return
	} else if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "❌ Empresa no encontrada para eliminar"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "✅ Empresa eliminada exitosamente", "id": id})
}

// --- Handlers de Búsqueda ---

// SearchEmpresaByNIF busca una empresa por su NIF exacto.
func SearchEmpresaByNIF(c *gin.Context, db *gorm.DB) {
	nif := c.Param("nif")

	var empresa models.Empresa
	if err := db.Where("nif = ?", nif).First(&empresa).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "🔍 Empresa no encontrada con ese NIF."})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "❌ Error al buscar empresa por NIF."})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": empresa})
}

// SearchEmpresasByNombre busca empresas por nombre (patrón LIKE).
func SearchEmpresasByNombre(c *gin.Context, db *gorm.DB) {
	searchTerm := c.Query("q")

	if searchTerm == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "❌ Se requiere un término de búsqueda ('q') para buscar por nombre."})
		return
	}

	var empresas []models.Empresa
	searchPattern := "%" + searchTerm + "%"

	if err := db.Where("nombre LIKE ?", searchPattern).Find(&empresas).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "❌ Error al buscar empresas por nombre."})
		return
	}

	if len(empresas) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"message": "🔍 No se encontraron empresas que coincidan con el nombre."})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": empresas})
}

// ---------------------------------------------------------------------
// CONTROLADORES DE EXPORTACIÓN (PDF y XLSX)
// ---------------------------------------------------------------------

// ExportEmpresasPDF maneja la generación del PDF de la lista actual de empresas.
func ExportEmpresasPDF(c *gin.Context, db *gorm.DB) {
	// Se asume ExportRequest está disponible en el paquete controllers (e.g., export_common.go)
	var req ExportRequest

	// 1. Recibir y validar el JSON del frontend
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Printf("🔴 ERROR Empresa PDF: Fallo en JSON Bind. Detalles: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "❌ Solicitud JSON inválida.", "details": err.Error()})
		return
	}

	if len(req.Data) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "❌ No hay empresas para generar el PDF."})
		return
	}

	// 2. Llamar a la utilidad genérica para generar el PDF
	downloadURL, err := utils.GenerateGenericPDF(req.ReportName, req.Data)
	if err != nil {
		log.Printf("🔴 ERROR PDF Empresas: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "❌ Error interno al generar el PDF de empresas."})
		return
	}

	// 3. Respuesta exitosa con la URL de descarga
	c.JSON(http.StatusOK, gin.H{
		"success":     true,
		"message":     "✅ PDF de empresas generado correctamente.",
		"downloadURL": downloadURL,
	})
}

// ExportEmpresasXLSX maneja la generación del XLSX de la lista actual de empresas.
func ExportEmpresasXLSX(c *gin.Context, db *gorm.DB) {
	// Se asume ExportRequest está disponible en el paquete controllers (e.g., export_common.go)
	var req ExportRequest

	// 1. Recibir y validar el JSON del frontend
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Printf("🔴 ERROR Empresa XLSX: Fallo en JSON Bind. Detalles: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "❌ Solicitud JSON inválida.", "details": err.Error()})
		return
	}

	if len(req.Data) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "❌ No hay empresas para generar el XLSX."})
		return
	}

	// 2. Llamar a la utilidad genérica para generar el XLSX
	// Usamos GenerateTitularesXLSX asumiendo que es una función genérica dentro de utils
	// o que utils tiene una función específica para empresas.
	downloadURL, err := utils.GenerateTitularesXLSX(req.ReportName, req.Data)
	if err != nil {
		log.Printf("🔴 ERROR XLSX Empresas: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "❌ Error interno al generar el XLSX de empresas."})
		return
	}

	// 3. Respuesta exitosa con la URL de descarga
	c.JSON(http.StatusOK, gin.H{
		"success":     true,
		"message":     "✅ XLSX de empresas generado correctamente.",
		"downloadURL": downloadURL,
	})
}
