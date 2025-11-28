package controllers

import (
	"albaranes/models"
	"encoding/json" // Importado para imprimir JSONs de debug
	"log"           // Importado para logging
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// Constante para el formato de fecha esperado en la URL
const dateFormat = "2006-01-02"

// Estructura para recibir IDs en acciones masivas
type BulkIDsInput struct {
	IDs []uint `json:"ids" binding:"required"`
}

// preloadAlbaran ayuda a cargar las relaciones necesarias (Licencia y Empresa)
func preloadAlbaran(db *gorm.DB) *gorm.DB {
	return db.Preload("LicenciaData").Preload("EmpresaData")
}

// ---------------------------------------------------------------------
// --- Controladores de Consulta (GET)
// ---------------------------------------------------------------------

// GetAlbaranes obtiene la lista de albaranes con paginación (sin filtros específicos).
func GetAlbaranes(c *gin.Context, db *gorm.DB) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))
	offset := (page - 1) * pageSize

	var albaranes []models.Albaran
	var total int64

	db.Model(&models.Albaran{}).Count(&total)

	if result := preloadAlbaran(db).Limit(pageSize).Offset(offset).Order("id desc").Find(&albaranes); result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al obtener la lista de albaranes"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":       albaranes,
		"page":       page,
		"pageSize":   pageSize,
		"total":      total,
		"totalPages": (total + int64(pageSize) - 1) / int64(pageSize),
	})
}

// GetAlbaranesByEmpresa obtiene la lista de albaranes filtrada por Empresa ID.
func GetAlbaranesByEmpresa(c *gin.Context, db *gorm.DB) {
	idStr := c.Param("id")
	empresaID, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil || empresaID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID de Empresa inválido o faltante"})
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))
	offset := (page - 1) * pageSize

	var albaranes []models.Albaran
	var total int64

	baseQuery := db.Model(&models.Albaran{}).Where("empresa_ref = ?", empresaID)
	baseQuery.Count(&total)

	if result := preloadAlbaran(baseQuery).Limit(pageSize).Offset(offset).Order("id desc").Find(&albaranes); result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al obtener la lista de albaranes filtrada"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":       albaranes,
		"empresa_id": empresaID,
		"page":       page,
		"pageSize":   pageSize,
		"total":      total,
		"totalPages": (total + int64(pageSize) - 1) / int64(pageSize),
	})
}

// SearchAlbaranes permite buscar con filtros.
func SearchAlbaranes(c *gin.Context, db *gorm.DB) {
	// Log de parámetros recibidos
	log.Printf("🔍 [SearchAlbaranes] Query Params: %v", c.Request.URL.Query())

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))
	offset := (page - 1) * pageSize

	var albaranes []models.Albaran
	var total int64

	query := db.Model(&models.Albaran{})

	// Filtros
	if licenciaRefStr := c.Query("licencia_ref"); licenciaRefStr != "" {
		query = query.Where("albaranes.licencia_ref = ?", licenciaRefStr)
	}

	if ref := c.Query("referencia"); ref != "" {
		query = query.Where("albaranes.referencia LIKE ?", "%"+ref+"%")
	}

	// Filtro Empresa (Join)
	if empresaNombre := c.Query("empresa_nombre"); empresaNombre != "" {
		log.Printf("🔍 Filtrando por empresa: %s", empresaNombre)
		query = query.Joins("JOIN empresas ON empresas.id = albaranes.empresa_ref").
			Where("empresas.nombre LIKE ?", "%"+empresaNombre+"%")
	}

	// Filtro de fechas
	fechaIniStr := c.Query("fecha_ini")
	fechaFinStr := c.Query("fecha_fin")
	if fechaIniStr != "" && fechaFinStr != "" {
		query = query.Where("albaranes.fecha BETWEEN ? AND ?", fechaIniStr, fechaFinStr+" 23:59:59")
	}

	// Filtro State
	if state := c.Query("state"); state != "" {
		state = strings.ToLower(state)
		log.Printf("🔍 Filtrando por estado: %s", state)
		switch state {
		case "creado":
			query = query.Where("albaranes.enviado = ? AND albaranes.cobrado = ?", false, false)
		case "enviado":
			query = query.Where("albaranes.enviado = ? AND albaranes.cobrado = ?", true, false)
		case "pagado":
			query = query.Where("albaranes.pagado = ?", true)
		case "finalizado":
			query = query.Where("albaranes.enviado = ? AND albaranes.cobrado = ?", true, true)
		}
	}

	query.Count(&total)

	if result := preloadAlbaran(query).Limit(pageSize).Offset(offset).Order("albaranes.fecha desc, albaranes.id desc").Find(&albaranes); result.Error != nil {
		log.Printf("🔴 [SearchAlbaranes] Error DB: %v", result.Error)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al obtener la lista filtrada"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":       albaranes,
		"page":       page,
		"pageSize":   pageSize,
		"total":      total,
		"totalPages": (total + int64(pageSize) - 1) / int64(pageSize),
	})
}

// GetAlbaran obtiene un albarán por ID.
func GetAlbaran(c *gin.Context, db *gorm.DB) {
	id := c.Param("id")
	log.Printf("🟢 [GetAlbaran] Solicitando ID: %s", id)

	var albaran models.Albaran

	if result := preloadAlbaran(db).First(&albaran, id); result.Error != nil {
		if result.Error == gorm.ErrRecordNotFound {
			log.Printf("🔴 [GetAlbaran] No encontrado ID: %s", id)
			c.JSON(http.StatusNotFound, gin.H{"error": "❌ Albarán no encontrado"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al buscar el albarán"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": albaran})
}

// ---------------------------------------------------------------------
// --- Controladores CRUD y ACCIONES MASIVAS
// ---------------------------------------------------------------------

// BulkSendAlbaranes actualiza el estado 'enviado' a true.
func BulkSendAlbaranes(c *gin.Context, db *gorm.DB) {
	var input BulkIDsInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Lista de IDs inválida", "details": err.Error()})
		return
	}

	log.Printf("📦 [BulkSend] IDs recibidos para enviar: %v", input.IDs)

	if len(input.IDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No se proporcionaron IDs"})
		return
	}

	result := db.Model(&models.Albaran{}).Where("id IN ?", input.IDs).Update("enviado", true)

	if result.Error != nil {
		log.Printf("🔴 [BulkSend] Error DB: %v", result.Error)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al actualizar los albaranes"})
		return
	}

	log.Printf("✅ [BulkSend] %d registros actualizados.", result.RowsAffected)
	c.JSON(http.StatusOK, gin.H{
		"message": "✅ Albaranes enviados exitosamente",
		"updated": result.RowsAffected,
	})
}

func CreateAlbaran(c *gin.Context, db *gorm.DB) {
	var input models.Albaran

	if err := c.ShouldBindJSON(&input); err != nil {
		log.Printf("🔴 [CreateAlbaran] Error binding JSON: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos", "details": err.Error()})
		return
	}

	// Debug Input
	jsonInput, _ := json.MarshalIndent(input, "", "  ")
	log.Printf("🔵 [CreateAlbaran] Datos recibidos:\n%s", string(jsonInput))

	if input.LicenciaRef == 0 || input.EmpresaRef == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Es obligatorio asignar una Licencia y una Empresa válida."})
		return
	}

	if result := db.Create(&input); result.Error != nil {
		log.Printf("🔴 [CreateAlbaran] Error DB: %v", result.Error)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al crear", "details": result.Error.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "✅ Creado", "data": input})
}

// UpdateAlbaran actualiza un albarán existente (CORREGIDO: Sanitización de FKs y Fechas).
func UpdateAlbaran(c *gin.Context, db *gorm.DB) {
	id := c.Param("id")
	log.Printf("🟢 [UpdateAlbaran] Iniciando actualización para ID: %s", id)

	var albaran models.Albaran
	// 1. Buscar el registro existente
	if err := db.First(&albaran, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "No encontrado"})
		return
	}

	// 2. Bind JSON a un mapa
	var input map[string]interface{}
	if err := c.ShouldBindJSON(&input); err != nil {
		log.Printf("🔴 [UpdateAlbaran] Error binding JSON: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos", "details": err.Error()})
		return
	}

	// Debug: Imprimir mapa recibido
	jsonInput, _ := json.MarshalIndent(input, "", "  ")
	log.Printf("🔵 [UpdateAlbaran] Mapa recibido:\n%s", string(jsonInput))

	// 3. SANITIZACIÓN DE DATOS
	delete(input, "id") // Eliminar ID para proteger la PK

	// Si empresa_ref es 0, lo quitamos para no romper la FK
	if val, ok := input["empresa_ref"]; ok {
		if v, ok := val.(float64); ok && v == 0 {
			delete(input, "empresa_ref")
		}
	}
	// Lo mismo para licencia_ref
	if val, ok := input["licencia_ref"]; ok {
		if v, ok := val.(float64); ok && v == 0 {
			delete(input, "licencia_ref")
		}
	}

	// 🚨 CORRECCIÓN: Sanitizar fechas vacías (cadena vacía -> nil)
	dateFields := []string{"fecha_cobro", "fecha_pago", "fecha"}
	for _, field := range dateFields {
		if val, ok := input[field]; ok {
			if s, ok := val.(string); ok && strings.TrimSpace(s) == "" {
				input[field] = nil
			}
		}
	}

	// 🚨 CORRECCIÓN: Sanitizar y formatear HORAS para columnas DATETIME
	// Si 'hora' o 'tiempo_espera' son "HH:MM", los combinamos con la fecha del albarán
	// para satisfacer el tipo de columna DATETIME en la base de datos.

	// Determinar la fecha base a usar (la nueva del input o la existente en BD)
	baseDateStr := albaran.Fecha.Format("2006-01-02") // Fecha por defecto: la que ya tiene
	if val, ok := input["fecha"]; ok {
		if s, ok := val.(string); ok && strings.TrimSpace(s) != "" {
			// Si viene una fecha nueva válida, usamos esa
			if len(s) >= 10 {
				baseDateStr = s[:10]
			}
		}
	}

	timeFields := []string{"hora", "tiempo_espera"}
	for _, field := range timeFields {
		if val, ok := input[field]; ok {
			s, isString := val.(string)

			// Si está vacío, lo ponemos a nil
			if isString && strings.TrimSpace(s) == "" {
				input[field] = nil
				continue
			}

			// Si parece una hora "HH:MM" (5 chars), le pegamos la fecha
			if isString && len(s) == 5 && strings.Contains(s, ":") {
				fullDateTime := baseDateStr + " " + s + ":00"
				input[field] = fullDateTime
				log.Printf("🔧 [UpdateAlbaran] Corrigiendo formato %s: %s -> %s", field, s, fullDateTime)
			}
		}
	}

	// 4. Actualizar en BD
	if err := db.Model(&albaran).Updates(input).Error; err != nil {
		log.Printf("🔴 [UpdateAlbaran] Error DB: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al actualizar el albarán", "details": err.Error()})
		return
	}

	log.Printf("✅ [UpdateAlbaran] ID %s actualizado con éxito.", id)

	// 5. Recargar datos para devolver la versión actualizada
	preloadAlbaran(db).First(&albaran, id)
	c.JSON(http.StatusOK, gin.H{"message": "✅ Albarán actualizado", "data": albaran})
}

func DeleteAlbaran(c *gin.Context, db *gorm.DB) {
	id := c.Param("id")
	log.Printf("🗑️ [DeleteAlbaran] Borrando ID: %s", id)

	if result := db.Delete(&models.Albaran{}, id); result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al eliminar"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Eliminado"})
}
