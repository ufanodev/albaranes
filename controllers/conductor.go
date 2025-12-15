package controllers

import (
	"fmt"
	"log"
	"net/http"
	"strconv"
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

// GetConductor obtiene el PRIMER conductor encontrado por su Licencia (Legacy, impreciso).
// Ruta: GET /api/v1/conductores/:licencia
func GetConductor(c *gin.Context, db *gorm.DB) {
	licencia := c.Param("licencia")
	var conductor models.Conductor

	// Buscar por Licencia. First() selecciona la primera coincidencia.
	if err := db.Where("licencia = ?", licencia).First(&conductor).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "❌ Conductor no encontrado."})
			return
		}
		log.Printf("🔴 [GetConductor - Legacy] Error GORM: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "❌ Error al buscar conductor."})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": conductor})
}

// GetConductorByLicenciaYNumero obtiene un conductor por Licencia Y Número de Conductor (Preciso).
// Ruta: GET /api/v1/conductores/licencia_conductor/:licencia/:nconductor
func GetConductorByLicenciaYNumero(c *gin.Context, db *gorm.DB) {
	licencia := c.Param("licencia")
	nconductor := c.Param("nconductor") // 'nconductor' es el campo 'conductor' en el modelo

	log.Printf("ℹ️ [GetConductorByLicenciaYNumero] Buscando: Licencia=%s, Conductor=%s", licencia, nconductor)

	var conductor models.Conductor

	// Buscar por clave compuesta (Licencia + Conductor)
	if err := db.Where("licencia = ? AND conductor = ?", licencia, nconductor).First(&conductor).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("❌ Conductor con Licencia '%s' y Nº Conductor '%s' no encontrado.", licencia, nconductor)})
			return
		}
		log.Printf("🔴 [GetConductorByLicenciaYNumero] Error GORM: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "❌ Error al buscar conductor."})
		return
	}

	log.Printf("✅ [GetConductorByLicenciaYNumero] Conductor encontrado: ID: %d", conductor.ID)
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

	// --- LÓGICA DE VERIFICACIÓN DE EXISTENCIA POR LICENCIA Y EMAIL (CREATE) ---

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

	// --- FIN LÓGICA DE VERIFICACIÓN ---

	conductor := models.Conductor{
		Licencia:  input.Licencia,
		Conductor: input.Conductor,
		Nombre:    input.Nombre,
		Email:     input.Email,
		Telefono:  input.Telefono,
		Activo:    true, // Por defecto, es activo al crear
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

// =================================================================
// ✏️ UPDATE - Versiones híbridas (legacy + preciso)
// =================================================================

// UpdateConductor actualiza los datos de un conductor (LEGACY - por licencia sola).
// Ruta: PUT /api/v1/conductores/:licencia
// NOTA: Esta ruta solo puede actualizar el PRIMER conductor encontrado con esa Licencia (Legacy).
func UpdateConductor(c *gin.Context, db *gorm.DB) {
	licencia := c.Param("licencia")
	var conductor models.Conductor

	// 1. Buscar conductor existente (primero encontrado)
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

	// VALIDACIÓN CLAVE: Excluir el registro actual (conductor.ID)
	if input.Email != nil {
		var existingConductorWithEmail models.Conductor

		// Buscar si existe OTRO conductor (ID <> conductor.ID) con el mismo email Y misma licencia
		if err := db.Where("email = ? AND licencia = ? AND id <> ?", *input.Email, licencia, conductor.ID).Select("id").First(&existingConductorWithEmail).Error; err == nil {
			log.Printf("⚠️ [UpdateConductor] Error 409: El Email '%s' ya está registrado para la Licencia '%s' en otro registro (ID: %d).", *input.Email, licencia, existingConductorWithEmail.ID)
			c.JSON(http.StatusConflict, gin.H{"error": fmt.Sprintf("❌ El Email '%s' ya está registrado para la Licencia '%s' en otro conductor.", *input.Email, licencia)})
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

// UpdateConductorByLicenciaYConductor actualiza un conductor por Licencia + Conductor (PRECISO).
// Ruta: PUT /api/v1/conductores/licencia_conductor/:licencia/:conductor
func UpdateConductorByLicenciaYConductor(c *gin.Context, db *gorm.DB) {
	licencia := c.Param("licencia")
	conductorNum := c.Param("conductor")

	log.Printf("ℹ️ [UpdateConductorByLicenciaYConductor] Buscando: Licencia=%s, Conductor=%s", licencia, conductorNum)

	var conductor models.Conductor
	if err := db.Where("licencia = ? AND conductor = ?", licencia, conductorNum).First(&conductor).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("❌ Conductor con Licencia '%s' y Nº Conductor '%s' no encontrado.", licencia, conductorNum)})
			return
		}
		log.Printf("🔴 [UpdateConductorByLicenciaYConductor] Error GORM al buscar: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "❌ Error al buscar conductor."})
		return
	}

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

	// VALIDACIÓN CLAVE: Excluir el registro actual (conductor.ID)
	if input.Email != nil {
		var existingConductorWithEmail models.Conductor

		// Buscar si existe OTRO conductor (ID <> conductor.ID) con el mismo email Y misma licencia
		if err := db.Where("email = ? AND licencia = ? AND id <> ?", *input.Email, licencia, conductor.ID).Select("id").First(&existingConductorWithEmail).Error; err == nil {
			log.Printf("⚠️ [UpdateConductorByLicenciaYConductor] Error 409: El Email '%s' ya está registrado para la Licencia '%s' en otro registro (ID: %d).", *input.Email, licencia, existingConductorWithEmail.ID)
			c.JSON(http.StatusConflict, gin.H{"error": fmt.Sprintf("❌ El Email '%s' ya está registrado para la Licencia '%s' en otro conductor.", *input.Email, licencia)})
			return
		}

		updates["email"] = *input.Email
	}

	if input.Telefono != nil {
		updates["telefono"] = *input.Telefono
	}
	if input.Activo != nil {
		updates["activo"] = *input.Activo
	}

	// 4. Ejecutar la actualización
	if len(updates) > 0 {
		if result := db.Model(&conductor).Updates(updates); result.Error != nil {
			log.Printf("🔴 [UpdateConductorByLicenciaYConductor] Error GORM al actualizar: %v", result.Error)
			if strings.Contains(result.Error.Error(), "Duplicate entry") {
				c.JSON(http.StatusConflict, gin.H{"error": "❌ Error de duplicidad al actualizar."})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "❌ Error al actualizar conductor."})
			return
		}
		log.Printf("✅ [UpdateConductorByLicenciaYConductor] Conductor %s/%s (ID: %d) actualizado.", licencia, conductorNum, conductor.ID)
	}

	c.JSON(http.StatusOK, gin.H{"message": "✅ Conductor actualizado exitosamente.", "licencia": licencia, "conductor": conductorNum})
}

// =================================================================
// 🗑️ DELETE - 3 OPCIONES HÍBRIDAS
// =================================================================

// DeleteConductor realiza el borrado lógico de un conductor (LEGACY - por licencia sola).
// Ruta: DELETE /api/v1/conductores/:licencia
func DeleteConductor(c *gin.Context, db *gorm.DB) {
	licencia := c.Param("licencia")
	var conductor models.Conductor

	// 1. Buscar conductor existente (primero encontrado)
	if err := db.Where("licencia = ?", licencia).First(&conductor).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "❌ Conductor no encontrado para desactivar."})
			return
		}
		log.Printf("🔴 [DeleteConductor - Legacy] Error GORM: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "❌ Error al buscar conductor."})
		return
	}

	// 2. Desactivación lógica
	if result := db.Model(&conductor).Update("activo", false); result.Error != nil {
		log.Printf("🔴 [DeleteConductor - Legacy] Error GORM al desactivar: %v", result.Error)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "❌ Error al desactivar conductor."})
		return
	}

	log.Printf("✅ [DeleteConductor - Legacy] Conductor (Licencia: %s, ID: %d) desactivado.", licencia, conductor.ID)
	c.JSON(http.StatusOK, gin.H{"message": "✅ Conductor desactivado exitosamente (Legacy).", "licencia": licencia})
}

// DeleteConductorByID realiza el borrado lógico de un conductor por su ID único.
// Ruta: DELETE /api/v1/conductores/id/:id
func DeleteConductorByID(c *gin.Context, db *gorm.DB) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "❌ ID de conductor inválido."})
		return
	}

	var conductor models.Conductor
	if err := db.First(&conductor, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("❌ Conductor con ID %s no encontrado para desactivar.", idStr)})
			return
		}
		log.Printf("🔴 [DeleteConductorByID] Error GORM al buscar: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "❌ Error al buscar conductor."})
		return
	}

	// Desactivación lógica
	if result := db.Model(&conductor).Update("activo", false); result.Error != nil {
		log.Printf("🔴 [DeleteConductorByID] Error GORM al desactivar: %v", result.Error)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "❌ Error al desactivar conductor por ID."})
		return
	}

	log.Printf("✅ [DeleteConductorByID] Conductor (ID: %d, Licencia: %s) desactivado.", conductor.ID, conductor.Licencia)
	c.JSON(http.StatusOK, gin.H{"message": "✅ Conductor desactivado exitosamente.", "id": id})
}

// DeleteConductorByLicenciaYNumero realiza el borrado lógico de un conductor por Licencia + Conductor (PRECISO).
// Ruta: DELETE /api/v1/conductores/licencia_conductor/:licencia/:nconductor
func DeleteConductorByLicenciaYNumero(c *gin.Context, db *gorm.DB) {
	licencia := c.Param("licencia")
	nconductor := c.Param("nconductor") // 'nconductor' es el campo 'conductor' en el modelo

	log.Printf("ℹ️ [DeleteConductorByLicenciaYNumero] Intentando desactivar: Licencia=%s, Conductor=%s", licencia, nconductor)

	var conductor models.Conductor
	if err := db.Where("licencia = ? AND conductor = ?", licencia, nconductor).First(&conductor).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("❌ Conductor con Licencia '%s' y Nº Conductor '%s' no encontrado para desactivar.", licencia, nconductor)})
			return
		}
		log.Printf("🔴 [DeleteConductorByLicenciaYNumero] Error GORM: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "❌ Error al buscar conductor."})
		return
	}

	// Desactivación lógica
	if result := db.Model(&conductor).Update("activo", false); result.Error != nil {
		log.Printf("🔴 [DeleteConductorByLicenciaYNumero] Error GORM al desactivar: %v", result.Error)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "❌ Error al desactivar conductor."})
		return
	}

	log.Printf("✅ [DeleteConductorByLicenciaYNumero] Conductor (Licencia: %s, Conductor: %s, ID: %d) desactivado.", licencia, nconductor, conductor.ID)
	c.JSON(http.StatusOK, gin.H{"message": "✅ Conductor desactivado exitosamente (100% preciso).", "licencia": licencia, "nconductor": nconductor})
}

// =================================================================
// 🎯 CONTROLADORES HTML (para vistas frontend)
// =================================================================

// GetConductorForEditHTML - Carga HTML para editar conductor (híbrido: acepta /licencia o /licencia/conductor)
func GetConductorForEditHTML(c *gin.Context, db *gorm.DB) {
	licencia := c.Param("licencia")
	conductorParam := c.Param("conductor") // Puede estar vacío si es ruta legacy

	log.Printf("🔍 [GetConductorForEditHTML] Buscando: Licencia=%s, Conductor=%s", licencia, conductorParam)

	var conductor models.Conductor
	var err error

	// Si viene el parámetro conductor, buscar por ambos
	if conductorParam != "" && conductorParam != ":conductor" {
		err = db.Where("licencia = ? AND conductor = ?", licencia, conductorParam).First(&conductor).Error
	} else {
		// Modo legacy: primer conductor con esa licencia
		err = db.Where("licencia = ?", licencia).First(&conductor).Error
	}

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.HTML(http.StatusNotFound, "error.html", gin.H{
				"error": "Conductor no encontrado",
			})
			return
		}
		log.Printf("🔴 [GetConductorForEditHTML] Error al buscar: %v", err)
		c.HTML(http.StatusInternalServerError, "error.html", gin.H{
			"error": "Error interno del servidor",
		})
		return
	}

	c.HTML(http.StatusOK, "admin_conductor_crud.html", gin.H{
		"Title":        "Editar Conductor",
		"Conductor":    conductor,
		"IsEdit":       true,
		"Licencia":     conductor.Licencia,
		"ConductorNum": conductor.Conductor,
		"Action":       "edit",
	})
}

// GetConductorForViewHTML - Carga HTML para ver conductor
func GetConductorForViewHTML(c *gin.Context, db *gorm.DB) {
	licencia := c.Param("licencia")
	conductorParam := c.Param("conductor") // Puede estar vacío

	var conductor models.Conductor
	var err error

	if conductorParam != "" && conductorParam != ":conductor" {
		err = db.Where("licencia = ? AND conductor = ?", licencia, conductorParam).First(&conductor).Error
	} else {
		err = db.Where("licencia = ?", licencia).First(&conductor).Error
	}

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.HTML(http.StatusNotFound, "error.html", gin.H{"error": "Conductor no encontrado"})
			return
		}
		c.HTML(http.StatusInternalServerError, "error.html", gin.H{"error": "Error interno"})
		return
	}

	c.HTML(http.StatusOK, "admin_conductor_crud.html", gin.H{
		"Title":        "Ver Conductor",
		"Conductor":    conductor,
		"IsEdit":       false,
		"IsView":       true,
		"Licencia":     conductor.Licencia,
		"ConductorNum": conductor.Conductor,
		"Action":       "view",
	})
}

// DeleteConductorHTML - Borrado lógico HTML (híbrido)
func DeleteConductorHTML(c *gin.Context, db *gorm.DB) {
	licencia := c.Param("licencia")
	conductorParam := c.Param("conductor") // Puede estar vacío

	log.Printf("🗑️ [DeleteConductorHTML] Desactivando: Licencia=%s, Conductor=%s", licencia, conductorParam)

	// NOTA: Para el borrado a través de la URL (si fuera necesario), este controlador lo maneja
	// Sin embargo, el flujo recomendado desde el JS es usar la ruta por ID.

	var result *gorm.DB

	if conductorParam != "" && conductorParam != ":conductor" {
		// Modo PRECISO: por licencia + conductor
		result = db.Model(&models.Conductor{}).
			Where("licencia = ? AND conductor = ?", licencia, conductorParam).
			Update("activo", false)
	} else {
		// Modo LEGACY: por licencia sola (primer registro)
		var conductor models.Conductor
		if err := db.Where("licencia = ?", licencia).First(&conductor).Error; err != nil {
			c.HTML(http.StatusNotFound, "error.html", gin.H{
				"error": "Conductor no encontrado",
			})
			return
		}
		result = db.Model(&conductor).Update("activo", false)
	}

	if result.Error != nil {
		log.Printf("🔴 [DeleteConductorHTML] Error al desactivar: %v", result.Error)
		c.HTML(http.StatusInternalServerError, "error.html", gin.H{
			"error": "Error al desactivar conductor",
		})
		return
	}

	if result.RowsAffected == 0 {
		c.HTML(http.StatusNotFound, "error.html", gin.H{
			"error": "Conductor no encontrado",
		})
		return
	}

	log.Printf("✅ [DeleteConductorHTML] Conductor desactivado: Licencia=%s, Conductor=%s", licencia, conductorParam)
	c.Redirect(http.StatusSeeOther, "/admin/conductor")
}
