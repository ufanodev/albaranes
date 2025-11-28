package controllers

import (
	"albaranes/models"
	"net/http"
	"strconv"

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

// GetAlbaranes obtiene la lista de albaranes con paginación.
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

// GetAlbaranesByEmpresa obtiene la lista filtrada por Empresa.
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
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))
	offset := (page - 1) * pageSize

	var albaranes []models.Albaran
	var total int64

	query := db.Model(&models.Albaran{})

	// Filtros
	if licenciaRefStr := c.Query("licencia_ref"); licenciaRefStr != "" {
		query = query.Where("licencia_ref = ?", licenciaRefStr)
	}

	// Filtro de fechas
	fechaIniStr := c.Query("fecha_ini")
	fechaFinStr := c.Query("fecha_fin")
	if fechaIniStr != "" && fechaFinStr != "" {
		query = query.Where("fecha BETWEEN ? AND ?", fechaIniStr, fechaFinStr+" 23:59:59")
	}

	// Filtro State (CRÍTICO para la vista de pendientes)
	if state := c.Query("state"); state != "" {
		if state == "creado" {
			// Pendientes: No enviado Y No cobrado
			query = query.Where("enviado = ? AND cobrado = ?", false, false)
		} else if state == "enviado" {
			query = query.Where("enviado = ?", true)
		}
	}

	query.Count(&total)

	if result := preloadAlbaran(query).Limit(pageSize).Offset(offset).Order("id desc").Find(&albaranes); result.Error != nil {
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
	var albaran models.Albaran

	if result := preloadAlbaran(db).First(&albaran, id); result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "❌ Albarán no encontrado"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": albaran})
}

// ---------------------------------------------------------------------
// --- Controladores CRUD y ACCIONES MASIVAS
// ---------------------------------------------------------------------

// BulkSendAlbaranes actualiza el estado 'enviado' a true para una lista de IDs.
func BulkSendAlbaranes(c *gin.Context, db *gorm.DB) {
	var input BulkIDsInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Lista de IDs inválida", "details": err.Error()})
		return
	}

	if len(input.IDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No se proporcionaron IDs"})
		return
	}

	// Actualización masiva: UPDATE albaranes SET enviado = 1 WHERE id IN (...)
	result := db.Model(&models.Albaran{}).Where("id IN ?", input.IDs).Update("enviado", true)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al actualizar los albaranes"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "✅ Albaranes enviados exitosamente",
		"updated": result.RowsAffected,
	})
}

func CreateAlbaran(c *gin.Context, db *gorm.DB) {
	var input models.Albaran
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos"})
		return
	}
	if result := db.Create(&input); result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al crear"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "✅ Creado", "data": input})
}

func UpdateAlbaran(c *gin.Context, db *gorm.DB) {
	id := c.Param("id")
	var albaran models.Albaran
	if err := db.First(&albaran, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "No encontrado"})
		return
	}
	var input map[string]interface{}
	c.ShouldBindJSON(&input)
	db.Model(&albaran).Updates(input)
	c.JSON(http.StatusOK, gin.H{"message": "Actualizado", "data": albaran})
}

func DeleteAlbaran(c *gin.Context, db *gorm.DB) {
	id := c.Param("id")
	if result := db.Delete(&models.Albaran{}, id); result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al eliminar"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Eliminado"})
}
