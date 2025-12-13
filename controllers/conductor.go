package controllers

import (
	"fmt"
	"log"
	"net/http"
	"strings"

	"albaranes/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// --- Estructuras de Input (DTOs) ---

// CreateConductorInput DTO para la creación de un nuevo conductor
type CreateConductorInput struct {
	Licencia  string `json:"licencia" binding:"required,max=3"`
	Conductor string `json:"conductor" binding:"required,max=20"` // Campo 'Conductor' en el modelo
	Nombre    string `json:"nombre" binding:"required,max=100"`
	Email     string `json:"email" binding:"required,email,max=100"`
	Telefono  string `json:"telefono" binding:"max=20"`
}

// UpdateConductorInput DTO para la actualización de un conductor (usamos punteros para opcionales)
type UpdateConductorInput struct {
	Conductor *string `json:"conductor" binding:"omitempty,max=20"`
	Nombre    *string `json:"nombre" binding:"omitempty,max=100"`
	Email     *string `json:"email" binding:"omitempty,email,max=100"`
	Telefono  *string `json:"telefono" binding:"omitempty,max=20"`
	Activo    *bool   `json:"activo"` // Para desactivación/reactivación (borrado lógico)
}

// =================================================================
// 🔑 Controladores CRUD
// =================================================================

// GetConductores lista todos los conductores (para la tabla principal).
// Ruta: GET /api/v1/conductores
func GetConductores(c *gin.Context, db *gorm.DB) {
	var conductores []models.Conductor

	result := db.Find(&conductores)

	if result.Error != nil {
		log.Printf("🔴 [GetConductores] Error GORM: %v", result.Error)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "❌ Error al obtener la lista de conductores."})
		return
	}

	log.Printf("✅ [GetConductores] Registros encontrados: %d", result.RowsAffected)

	c.JSON(http.StatusOK, gin.H{"data": conductores})
}

// GetConductor obtiene un conductor por su Licencia.
// Ruta: GET /api/v1/conductores/:licencia
func GetConductor(c *gin.Context, db *gorm.DB) {
	licencia := c.Param("licencia")
	var conductor models.Conductor

	// Buscar por Licencia. First() selecciona la primera coincidencia (la de menor ID si hay duplicados)
	if err := db.Where("licencia = ?", licencia).First(&conductor).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "❌ Conductor no encontrado."})
			return
		}
		log.Printf("🔴 [GetConductor] Error GORM: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "❌ Error al buscar conductor."})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": conductor})
}

// CreateConductor crea un nuevo conductor.
// Ruta: POST /api/v1/conductores
func CreateConductor(c *gin.Context, db *gorm.DB) {
	var input CreateConductorInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos de entrada inválidos", "details": err.Error()})
		return
	}

	// --- LÓGICA DE VERIFICACIÓN DE EXISTENCIA POR LICENCIA Y EMAIL ---

	var err error

	// Verificar si ya existe UN CONDUCTOR con la MISMA LICENCIA Y MISMO EMAIL.
	var existingConductor models.Conductor

	// Buscar un conductor que coincida con Licencia Y Email
	err = db.Where("licencia = ? AND email = ?", input.Licencia, input.Email).Select("id").First(&existingConductor).Error

	if err == nil {
		// Encontrado: Conflicto (Licencia ya tiene este email asignado)
		log.Printf("⚠️ [CreateConductor] Error 409: La Licencia %s ya tiene registrado el Email %s.", input.Licencia, input.Email)
		c.JSON(http.StatusConflict, gin.H{"error": fmt.Sprintf("❌ La Licencia '%s' ya tiene registrado un conductor con el Email '%s'.", input.Licencia, input.Email)})
		return
	}

	// Verificación de error interno GORM
	if err != nil && err != gorm.ErrRecordNotFound {
		log.Printf("🔴 [CreateConductor] Error GORM durante verificación: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "❌ Error interno al verificar unicidad."})
		return
	}

	// Si la DB tiene una restricción UNIQUE en 'email' que no se eliminó, el db.Create fallará con un 500
	// si el email es usado por OTRA licencia.

	// --- FIN LÓGICA DE VERIFICACIÓN ---

	conductor := models.Conductor{
		Licencia:  input.Licencia,
		Conductor: input.Conductor,
		Nombre:    input.Nombre,
		Email:     input.Email,
		Telefono:  input.Telefono,
	}

	if result := db.Create(&conductor); result.Error != nil {
		log.Printf("🔴 [CreateConductor] Error GORM al crear: %v", result.Error)
		// Captura cualquier error de duplicidad tardío (ej. si el índice UNIQUE en email aún existe)
		if strings.Contains(result.Error.Error(), "Duplicate entry") {
			c.JSON(http.StatusConflict, gin.H{"error": "❌ Error de duplicidad al crear (Revisa índice UNIQUE en Email)."})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "❌ Error al crear conductor."})
		return
	}

	log.Printf("✅ [CreateConductor] Conductor creado: Licencia %s (ID: %d)", conductor.Licencia, conductor.ID)
	c.JSON(http.StatusCreated, gin.H{"message": "✅ Conductor creado exitosamente.", "licencia": conductor.Licencia, "id": conductor.ID})
}

// UpdateConductor actualiza los datos de un conductor.
// Ruta: PUT /api/v1/conductores/:licencia
func UpdateConductor(c *gin.Context, db *gorm.DB) {
	licencia := c.Param("licencia")
	var conductor models.Conductor

	// 1. Buscar conductor existente
	// NOTA: Si hay múltiples conductores con la misma licencia, First() solo encontrará uno (el de menor ID).
	if err := db.Where("licencia = ?", licencia).First(&conductor).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "❌ Conductor no encontrado para actualizar."})
			return
		}
		log.Printf("🔴 [UpdateConductor] Error GORM al buscar: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "❌ Error al buscar conductor."})
		return
	}

	// 2. Bind del JSON de actualización
	var input UpdateConductorInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos de actualización inválidos", "details": err.Error()})
		return
	}

	// 3. Crear mapa de updates (solo campos con puntero no nulo)
	updates := make(map[string]interface{})

	if input.Conductor != nil {
		updates["conductor"] = *input.Conductor
	}
	if input.Nombre != nil {
		updates["nombre"] = *input.Nombre
	}

	// Validación y asignación del Email (Debe ser único para esta Licencia, excluyendo el conductor actual)
	if input.Email != nil {
		var existingConductorWithEmail models.Conductor

		// Buscar si existe otro conductor que:
		// A) Tenga la misma licencia que estamos actualizando.
		// B) Use el email proporcionado.
		// C) NO sea el registro actual (excluido por ID).

		if err := db.Where("email = ? AND licencia = ? AND id <> ?", *input.Email, licencia, conductor.ID).Select("id").First(&existingConductorWithEmail).Error; err == nil {
			c.JSON(http.StatusConflict, gin.H{"error": fmt.Sprintf("❌ El Email '%s' ya está registrado para la Licencia '%s'.", *input.Email, licencia)})
			return
		}

		updates["email"] = *input.Email
	}

	if input.Telefono != nil {
		updates["telefono"] = *input.Telefono
	}
	if input.Activo != nil {
		updates["activo"] = *input.Activo
	} // Borrado lógico/Reactivación

	// 4. Ejecutar la actualización
	if len(updates) > 0 {
		if result := db.Model(&conductor).Updates(updates); result.Error != nil {
			log.Printf("🔴 [UpdateConductor] Error GORM al actualizar: %v", result.Error)
			if strings.Contains(result.Error.Error(), "Duplicate entry") {
				c.JSON(http.StatusConflict, gin.H{"error": "❌ Error de duplicidad al actualizar (Posible Email)."})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "❌ Error al actualizar conductor."})
			return
		}
		log.Printf("✅ [UpdateConductor] Conductor %s (ID: %d) actualizado. Campos: %v", licencia, conductor.ID, updates)
	} else {
		log.Printf("ℹ️ [UpdateConductor] Conductor %s llamado, pero no se proporcionaron campos válidos para actualizar.", licencia)
	}

	c.JSON(http.StatusOK, gin.H{"message": "✅ Conductor actualizado exitosamente.", "licencia": licencia})
}

// DeleteConductor realiza el borrado lógico de un conductor (Activo = false).
// Ruta: DELETE /api/v1/conductores/:licencia
func DeleteConductor(c *gin.Context, db *gorm.DB) {
	licencia := c.Param("licencia")
	var conductor models.Conductor

	// 1. Buscar conductor existente
	if err := db.Where("licencia = ?", licencia).First(&conductor).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "❌ Conductor no encontrado para desactivar."})
		return
	}

	// 2. Desactivación lógica: Actualiza el campo 'activo' a false
	if result := db.Model(&conductor).Update("activo", false); result.Error != nil {
		log.Printf("🔴 [DeleteConductor] Error GORM al desactivar: %v", result.Error)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "❌ Error al desactivar conductor."})
		return
	}

	log.Printf("✅ [DeleteConductor] Conductor %s (ID: %d) desactivado (borrado lógico).", licencia, conductor.ID)
	c.JSON(http.StatusOK, gin.H{"message": "✅ Conductor desactivado exitosamente.", "licencia": licencia})
}
