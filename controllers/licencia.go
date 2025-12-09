package controllers

import (
	"log"
	"net/http"
	"strconv"

	"albaranes/models"

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
	Estado    *bool  `json:"estado"` // Permitir definir estado inicial (default: true en el modelo)
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
	Estado    *bool  `json:"estado"` // Permitir actualizar el estado
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
		Estado:    initialState, // Usar el estado definido o true por defecto
	}

	if result := db.Create(&licencia); result.Error != nil {
		log.Printf("ERROR GORM al crear licencia: %v", result.Error)
		c.JSON(http.StatusConflict, gin.H{"error": "❌ Ya existe una licencia con ese número."})
		return
	}

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
		c.JSON(http.StatusInternalServerError, gin.H{"error": "❌ Error al actualizar la licencia"})
		return
	}

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
		c.JSON(http.StatusNotFound, gin.H{"error": "❌ Licencia no encontrada para desactivar"})
		return
	}

	// Acción clave: Establecer Estado = false
	if result := db.Model(&licencia).Update("Estado", false); result.Error != nil {
		log.Printf("ERROR GORM al desactivar licencia: %v", result.Error)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "❌ Error al desactivar la licencia"})
		return
	}

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
		c.JSON(http.StatusInternalServerError, gin.H{"error": "❌ Error al eliminar la licencia"})
		return
	}

	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "❌ Licencia no encontrada para eliminar"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "✅ Licencia eliminada exitosamente", "id": id})
}

// SearchLicencias busca licencias por el número de licencia (campo 'licencia').
func SearchLicencias(c *gin.Context, db *gorm.DB) {
	searchTerm := c.Query("q")

	if searchTerm == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "❌ Se requiere un término de búsqueda ('q')."})
		return
	}

	var licencias []models.Licencia
	searchPattern := "%" + searchTerm + "%"

	if err := db.Where("licencia LIKE ?", searchPattern).Find(&licencias).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "❌ Error al buscar licencias."})
		return
	}

	if len(licencias) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"message": "🔍 No se encontraron licencias que coincidan con el término."})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": licencias})
}
