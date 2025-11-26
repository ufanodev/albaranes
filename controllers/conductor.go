package controllers

import (
	"albaranes/models"
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// --- Handlers CRUD para Conductores ---

// CreateConductor maneja la creación de un nuevo conductor.
func CreateConductor(c *gin.Context, db *gorm.DB) {
	var input models.CreateConductorInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos", "details": err.Error()})
		return
	}

	conductor := models.Conductor{
		Licencia:  input.Licencia,
		Conductor: input.Conductor,
		Nombre:    input.Nombre,
		Email:     input.Email,
		Telefono:  input.Telefono,
	}

	if result := db.Create(&conductor); result.Error != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "❌ Ya existe un conductor con esa Licencia o Email."})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "✅ Conductor creado exitosamente", "data": conductor})
}

// GetConductores obtiene la lista de todos los conductores.
func GetConductores(c *gin.Context, db *gorm.DB) {
	var conductores []models.Conductor

	if err := db.Find(&conductores).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "❌ Error al obtener la lista de conductores"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": conductores})
}

// GetConductor obtiene un conductor por su Licencia (PK).
func GetConductor(c *gin.Context, db *gorm.DB) {
	licencia := c.Param("licencia") // Usamos el nombre de la PK como parámetro
	var conductor models.Conductor

	if err := db.First(&conductor, "licencia = ?", licencia).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "❌ Conductor no encontrado"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al buscar conductor"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": conductor})
}

// UpdateConductor actualiza los campos de un conductor por Licencia (PUT).
func UpdateConductor(c *gin.Context, db *gorm.DB) {
	licencia := c.Param("licencia")
	var conductor models.Conductor

	if err := db.First(&conductor, "licencia = ?", licencia).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "❌ Conductor no encontrado para actualizar"})
		return
	}

	var input models.UpdateConductorInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos de actualización inválidos", "details": err.Error()})
		return
	}

	// Actualizamos solo los campos proporcionados y válidos
	if result := db.Model(&conductor).Updates(input); result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "❌ Error al actualizar el conductor"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "✅ Conductor actualizado exitosamente", "data": conductor})
}

// DeleteConductor elimina un conductor por Licencia (DELETE).
func DeleteConductor(c *gin.Context, db *gorm.DB) {
	licencia := c.Param("licencia")

	if result := db.Delete(&models.Conductor{}, "licencia = ?", licencia); result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "❌ Error al eliminar el conductor"})
		return
	} else if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "❌ Conductor no encontrado para eliminar"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "✅ Conductor eliminado exitosamente", "licencia": licencia})
}
