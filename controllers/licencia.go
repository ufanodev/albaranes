package controllers

import (
	"log"
	"net/http"
	"strconv"

	"albaranes/models"
	"albaranes/utils" // Asume que 'albaranes' es el nombre de tu módulo Go

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// --- Estructuras de Input (DTOs) ---

// CreateLicenciaInput es el DTO para la creación de una Licencia.
type CreateLicenciaInput struct {
	Licencia  string `json:"licencia" binding:"required,max=10"`
	DNI       string `json:"dni" binding:"max=15"`
	Nombre    string `json:"nombre" binding:"required,max=100"`
	Direccion string `json:"direccion" binding:"max=200"`
	CP        string `json:"cp" binding:"max=10"`
	Telefono  string `json:"telefono" binding:"max=20"`
	Email     string `json:"email" binding:"email,max=100"`
	Socio     bool   `json:"socio"`
	Chofer    bool   `json:"chofer"`
	Estado    *bool  `json:"estado"`
}

// UpdateLicenciaInput es el DTO para la actualización de una Licencia.
type UpdateLicenciaInput struct {
	Licencia  string `json:"licencia" binding:"max=10"`
	DNI       string `json:"dni" binding:"max=15"`
	Nombre    string `json:"nombre" binding:"max=100"`
	Direccion string `json:"direccion" binding:"max=200"`
	CP        string `json:"cp" binding:"max=10"`
	Telefono  string `json:"telefono" binding:"max=20"`
	Email     string `json:"email" binding:"email,max=100"`
	Socio     *bool  `json:"socio"`
	Chofer    *bool  `json:"chofer"`
	Estado    *bool  `json:"estado"`
}

// --- Estructuras para la Exportación Genérica (PDF/XLSX) ---

// ExportRequest es la estructura que recibe los datos de la tabla desde el frontend (JS).
type ExportRequest struct {
	ReportName string              `json:"reportName" binding:"required"`
	Data       []utils.TitularData `json:"data" binding:"required"`
}

// --- Handlers CRUD para Licencias ---

// CreateLicencia maneja la creación de una nueva licencia.
func CreateLicencia(c *gin.Context, db *gorm.DB) {
	var input CreateLicenciaInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos para la licencia", "details": err.Error()})
		return
	}

	// Inicializar el estado en true por defecto
	initialState := true
	if input.Estado != nil {
		initialState = *input.Estado
	}

	licencia := models.Licencia{
		Licencia:  input.Licencia,
		DNI:       input.DNI,
		Nombre:    input.Nombre,
		Direccion: input.Direccion,
		CP:        input.CP,
		Telefono:  input.Telefono,
		Email:     input.Email,
		Socio:     input.Socio,
		Chofer:    input.Chofer,
		Estado:    initialState,
	}

	if result := db.Create(&licencia); result.Error != nil {
		log.Printf("ERROR GORM al crear licencia: %v", result.Error)
		// ❌ Ya existe una licencia con ese número.
		c.JSON(http.StatusConflict, gin.H{"error": "❌ Ya existe una licencia con ese número."})
		return
	}

	// ✅ Licencia creada exitosamente
	c.JSON(http.StatusCreated, gin.H{"message": "✅ Licencia creada exitosamente", "data": licencia})
}

// GetLicencias obtiene una lista de todas las licencias, filtrando por activo por defecto.
func GetLicencias(c *gin.Context, db *gorm.DB) {
	var licencias []models.Licencia

	query := db.Model(&models.Licencia{})

	// Filtrar por Estado=true a menos que se use ?all=true
	if c.Query("all") != "true" {
		query = query.Where("estado = ?", true)
	}

	if err := query.Find(&licencias).Error; err != nil {
		// ❌ Error al obtener la lista de licencias
		c.JSON(http.StatusInternalServerError, gin.H{"error": "❌ Error al obtener la lista de licencias"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": licencias})
}

// GetLicencia obtiene una licencia por ID.
func GetLicencia(c *gin.Context, db *gorm.DB) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID de licencia inválido"})
		return
	}

	var licencia models.Licencia
	if err := db.First(&licencia, id).Error; err != nil {
		// ❌ Licencia no encontrada
		c.JSON(http.StatusNotFound, gin.H{"error": "❌ Licencia no encontrada"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": licencia})
}

// UpdateLicencia actualiza los campos de una licencia por ID (PUT).
func UpdateLicencia(c *gin.Context, db *gorm.DB) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID de licencia inválido"})
		return
	}

	var licencia models.Licencia
	if err := db.First(&licencia, id).Error; err != nil {
		// ❌ Licencia no encontrada
		c.JSON(http.StatusNotFound, gin.H{"error": "❌ Licencia no encontrada"})
		return
	}

	var input UpdateLicenciaInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos de actualización inválidos", "details": err.Error()})
		return
	}

	// GORM actualizará el modelo, incluyendo el campo Estado si fue proporcionado en el input.
	if result := db.Model(&licencia).Updates(input); result.Error != nil {
		// ❌ Error al actualizar la licencia
		c.JSON(http.StatusInternalServerError, gin.H{"error": "❌ Error al actualizar la licencia"})
		return
	}

	// ✅ Licencia actualizada exitosamente
	c.JSON(http.StatusOK, gin.H{"message": "✅ Licencia actualizada exitosamente", "data": licencia})
}

// 🟢 SoftDeleteLicencia: Cambia el campo Estado a FALSE (Borrado Lógico)
func SoftDeleteLicencia(c *gin.Context, db *gorm.DB) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID de licencia inválido"})
		return
	}

	var licencia models.Licencia
	if err := db.First(&licencia, id).Error; err != nil {
		// ❌ Licencia no encontrada para desactivar
		c.JSON(http.StatusNotFound, gin.H{"error": "❌ Licencia no encontrada para desactivar"})
		return
	}

	// Acción clave: Establecer Estado = false
	if result := db.Model(&licencia).Update("Estado", false); result.Error != nil {
		log.Printf("ERROR GORM al desactivar licencia: %v", result.Error)
		// ❌ Error al desactivar la licencia
		c.JSON(http.StatusInternalServerError, gin.H{"error": "❌ Error al desactivar la licencia"})
		return
	}

	// ✅ Licencia desactivada (estado = false) con éxito
	c.JSON(http.StatusOK, gin.H{"message": "✅ Licencia desactivada (estado = false) con éxito", "id": id})
}

// DeleteLicencia elimina una licencia por ID (Eliminación física de la DB).
func DeleteLicencia(c *gin.Context, db *gorm.DB) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID de licencia inválido"})
		return
	}

	var result *gorm.DB
	result = db.Delete(&models.Licencia{}, id)

	if result.Error != nil {
		// ❌ Error al eliminar la licencia
		c.JSON(http.StatusInternalServerError, gin.H{"error": "❌ Error al eliminar la licencia"})
		return
	}

	if result.RowsAffected == 0 {
		// ❌ Licencia no encontrada para eliminar
		c.JSON(http.StatusNotFound, gin.H{"error": "❌ Licencia no encontrada para eliminar"})
		return
	}

	// ✅ Licencia eliminada exitosamente
	c.JSON(http.StatusOK, gin.H{"message": "✅ Licencia eliminada exitosamente", "id": id})
}

// SearchLicencias busca licencias por el número de licencia (campo 'licencia').
func SearchLicencias(c *gin.Context, db *gorm.DB) {
	searchTerm := c.Query("q")

	if searchTerm == "" {
		// ❌ Se requiere un término de búsqueda ('q').
		c.JSON(http.StatusBadRequest, gin.H{"error": "❌ Se requiere un término de búsqueda ('q')."})
		return
	}

	var licencias []models.Licencia
	searchPattern := "%" + searchTerm + "%"

	if err := db.Where("licencia LIKE ?", searchPattern).Find(&licencias).Error; err != nil {
		// ❌ Error al buscar licencias.
		c.JSON(http.StatusInternalServerError, gin.H{"error": "❌ Error al buscar licencias."})
		return
	}

	if len(licencias) == 0 {
		// 🔍 No se encontraron licencias que coincidan con el término.
		c.JSON(http.StatusNotFound, gin.H{"message": "🔍 No se encontraron licencias que coincidan con el término."})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": licencias})
}

// --- 📄 HANDLER PARA GENERACIÓN DE PDF ---

// ExportTitularesPDFHandler maneja la generación del PDF de la lista actual de titulares.
// Recibe los datos ya filtrados y ordenados desde el frontend (JS).
func ExportTitularesPDFHandler(c *gin.Context) {
	var req ExportRequest // Usamos ExportRequest

	// 1. Recibir y validar el JSON del frontend
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Solicitud JSON inválida. Asegúrese de enviar 'reportName' y 'data'.", "details": err.Error()})
		return
	}

	if len(req.Data) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "No hay titulares para generar el PDF."})
		return
	}

	// 2. Llamar a la utilidad genérica para generar el PDF
	downloadURL, err := utils.GenerateGenericPDF(req.ReportName, req.Data)
	if err != nil {
		log.Printf("ERROR PDF: %v", err)
		// ❌ Error interno al generar el PDF.
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "❌ Error interno al generar el PDF."})
		return
	}

	// 3. Respuesta exitosa con la URL de descarga
	c.JSON(http.StatusOK, gin.H{
		"success":     true,
		"message":     "✅ PDF generado correctamente en el servidor.",
		"downloadURL": downloadURL,
	})
}

// --- 📊 HANDLER PARA GENERACIÓN DE XLSX (Excel) ---

// ExportTitularesXLSX maneja la generación del XLSX de la lista actual de titulares.
// Recibe los datos ya filtrados y ordenados desde el frontend (JS).
func ExportTitularesXLSX(c *gin.Context, db *gorm.DB) {
	var req ExportRequest

	// 1. Recibir y validar el JSON del frontend
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Solicitud JSON inválida. Asegúrese de enviar 'reportName' y 'data'.", "details": err.Error()})
		return
	}

	if len(req.Data) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "No hay titulares para generar el XLSX."})
		return
	}

	// 2. Llamar a la utilidad genérica para generar el XLSX
	downloadURL, err := utils.GenerateTitularesXLSX(req.ReportName, req.Data)
	if err != nil {
		log.Printf("ERROR XLSX: %v", err)
		// ❌ Error interno al generar el XLSX.
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "❌ Error interno al generar el XLSX."})
		return
	}

	// 3. Respuesta exitosa con la URL de descarga
	c.JSON(http.StatusOK, gin.H{
		"success":     true,
		"message":     "✅ XLSX generado correctamente en el servidor.",
		"downloadURL": downloadURL,
	})
}
