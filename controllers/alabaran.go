package controllers

import (
	"albaranes/models"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// Constante para el formato de fecha esperado en la URL
const dateFormat = "2006-01-02"

// preloadAlbaran ayuda a cargar las relaciones necesarias (Licencia y Empresa)
func preloadAlbaran(db *gorm.DB) *gorm.DB {
	return db.Preload("LicenciaData").Preload("EmpresaData")
}

// CreateAlbaran maneja la creación de un nuevo albarán.
func CreateAlbaran(c *gin.Context, db *gorm.DB) {
	var input models.Albaran

	// Binding del JSON al modelo
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos de entrada inválidos", "details": err.Error()})
		return
	}

	// Validaciones básicas (Referencias obligatorias)
	if input.LicenciaRef == 0 || input.EmpresaRef == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Es obligatorio asignar una Licencia y una Empresa válida."})
		return
	}

	// Crear registro
	if result := db.Create(&input); result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al crear el albarán", "details": result.Error.Error()})
		return
	}

	// Devolver el objeto creado
	c.JSON(http.StatusCreated, gin.H{"message": "✅ Albarán creado exitosamente", "data": input})
}

// GetAlbaranes obtiene la lista de albaranes con paginación (sin filtros específicos).
// Parámetros query: ?page=1&pageSize=10
func GetAlbaranes(c *gin.Context, db *gorm.DB) {
	// Paginación
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 10
	}
	offset := (page - 1) * pageSize

	var albaranes []models.Albaran
	var total int64

	// Contar total de registros
	db.Model(&models.Albaran{}).Count(&total)

	// Consultar con precarga y paginación
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
// Parámetros de ruta: /api/v1/albaranes/byempresa/:id
// Parámetros query: ?page=1&pageSize=10
func GetAlbaranesByEmpresa(c *gin.Context, db *gorm.DB) {
	// 1. Obtener y validar el ID de la empresa de los parámetros de ruta
	idStr := c.Param("id")
	empresaID, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil || empresaID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID de Empresa inválido o faltante"})
		return
	}

	// 2. Paginación
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 10
	}
	offset := (page - 1) * pageSize

	var albaranes []models.Albaran
	var total int64

	// 3. Consulta Base (Filtrado y Conteo)
	baseQuery := db.Model(&models.Albaran{}).Where("empresa_ref = ?", empresaID)

	// Contar total de registros filtrados
	baseQuery.Count(&total)

	// Consultar con precarga, filtrado y paginación
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

// SearchAlbaranes permite buscar por licencia y rango de fechas.
// Parámetros query: ?licencia_ref=1&fecha_ini=2025-01-01&fecha_fin=2025-01-31&page=1&pageSize=10
func SearchAlbaranes(c *gin.Context, db *gorm.DB) {
	// 1. Paginación
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 10
	}
	offset := (page - 1) * pageSize

	var albaranes []models.Albaran
	var total int64

	// Consulta base
	query := db.Model(&models.Albaran{})

	// 2. Filtrar por ID de Licencia (licencia_ref)
	licenciaRefStr := c.Query("licencia_ref")
	if licenciaRefStr != "" {
		licenciaID, err := strconv.ParseUint(licenciaRefStr, 10, 32)
		if err == nil && licenciaID > 0 {
			query = query.Where("licencia_ref = ?", licenciaID)
		} else if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Formato de licencia_ref inválido"})
			return
		}
	}

	// 3. Filtrar por Rango de Fechas (fecha_ini y fecha_fin)
	fechaIniStr := c.Query("fecha_ini")
	fechaFinStr := c.Query("fecha_fin")

	if fechaIniStr != "" && fechaFinStr != "" {
		// Parsear fecha inicial
		fechaIni, err := time.Parse(dateFormat, fechaIniStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Formato de fecha_ini inválido. Use YYYY-MM-DD", "details": err.Error()})
			return
		}

		// Parsear fecha final (añadir 23:59:59 para incluir todo el último día)
		fechaFin, err := time.Parse(dateFormat, fechaFinStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Formato de fecha_fin inválido. Use YYYY-MM-DD", "details": err.Error()})
			return
		}
		// Ajustar fecha fin para incluir el final del día
		fechaFin = fechaFin.Add(24*time.Hour - 1*time.Second)

		// Aplicar filtro WHERE fecha BETWEEN fecha_ini AND fecha_fin
		query = query.Where("fecha BETWEEN ? AND ?", fechaIni, fechaFin)
	} else if fechaIniStr != "" || fechaFinStr != "" {
		// Manejar caso donde solo se proporciona una de las dos fechas
		c.JSON(http.StatusBadRequest, gin.H{"error": "Debe proporcionar tanto fecha_ini como fecha_fin para la búsqueda por rango"})
		return
	}

	// 4. Conteo y Paginación
	query.Count(&total)

	// Consultar con precarga, filtrado y paginación
	if result := preloadAlbaran(query).Limit(pageSize).Offset(offset).Order("fecha desc, id desc").Find(&albaranes); result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al obtener la lista de albaranes filtrada"})
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

// GetAlbaran obtiene un albarán por su ID.
func GetAlbaran(c *gin.Context, db *gorm.DB) {
	id := c.Param("id")
	var albaran models.Albaran

	if result := preloadAlbaran(db).First(&albaran, id); result.Error != nil {
		if result.Error == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "❌ Albarán no encontrado"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al buscar el albarán"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": albaran})
}

// UpdateAlbaran actualiza un albarán existente.
func UpdateAlbaran(c *gin.Context, db *gorm.DB) {
	id := c.Param("id")
	var albaran models.Albaran

	// Verificar existencia
	if err := db.First(&albaran, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "❌ Albarán no encontrado"})
		return
	}

	// Usamos un mapa para permitir actualizaciones parciales (PATCH/PUT)
	var input map[string]interface{}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos", "details": err.Error()})
		return
	}

	// Actualizar
	if err := db.Model(&albaran).Updates(input).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al actualizar el albarán", "details": err.Error()})
		return
	}

	// Devolver el objeto actualizado
	preloadAlbaran(db).First(&albaran, id)
	c.JSON(http.StatusOK, gin.H{"message": "✅ Albarán actualizado", "data": albaran})
}

// DeleteAlbaran elimina un albarán.
func DeleteAlbaran(c *gin.Context, db *gorm.DB) {
	id := c.Param("id")

	if result := db.Delete(&models.Albaran{}, id); result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al eliminar el albarán"})
		return
	} else if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "❌ Albarán no encontrado para eliminar"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "✅ Albarán eliminado exitosamente", "id": id})
}
