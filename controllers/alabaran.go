package controllers

import (
	"albaranes/models"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// Constante para el formato de fecha esperado en la URL
const dateFormat = "2006-01-02"

// preloadAlbaran ayuda a cargar las relaciones necesarias (Licencia y Empresa)
func preloadAlbaran(db *gorm.DB) *gorm.DB {
	return db.Preload("LicenciaData").Preload("EmpresaData")
}

// ---------------------------------------------------------------------
// --- Controladores de Consulta (GET)
// ---------------------------------------------------------------------

// GetAlbaranes obtiene la lista de albaranes con paginación (sin filtros específicos).
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
func GetAlbaranesByEmpresa(c *gin.Context, db *gorm.DB) {
	idStr := c.Param("id")
	empresaID, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil || empresaID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID de Empresa inválido o faltante"})
		return
	}

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

// SearchAlbaranes permite buscar por licencia, fechas, referencia, estado y nombre de empresa.
// Esta es la función principal usada por el buscador avanzado.
func SearchAlbaranes(c *gin.Context, db *gorm.DB) {
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

	// Iniciar query base con Preloads para que el JSON final tenga los datos anidados
	query := db.Model(&models.Albaran{}).
		Preload("LicenciaData").
		Preload("EmpresaData")

	// 1. Filtro: Licencia (Obligatorio según tu lógica de sesión)
	if licenciaRefStr := c.Query("licencia_ref"); licenciaRefStr != "" {
		query = query.Where("albaranes.licencia_ref = ?", licenciaRefStr)
	}

	// 2. Filtro: Referencia (Búsqueda parcial)
	if ref := c.Query("referencia"); ref != "" {
		query = query.Where("albaranes.referencia LIKE ?", "%"+ref+"%")
	}

	// 3. Filtro: Empresa por Nombre (Requiere JOIN)
	// Si el frontend envía "empresa_nombre=race", hacemos un JOIN con la tabla empresas.
	if empresaNombre := c.Query("empresa_nombre"); empresaNombre != "" {
		// Usamos un JOIN explícito para filtrar por el nombre en la tabla relacionada
		// Asumimos que la tabla se llama 'empresas' y la columna 'nombre'
		query = query.Joins("JOIN empresas ON empresas.id = albaranes.empresa_ref").
			Where("empresas.nombre LIKE ?", "%"+empresaNombre+"%")
	}

	// 4. Filtro: Estado (Mapeo de string del select a booleanos de la BD)
	if state := c.Query("state"); state != "" {
		state = strings.ToLower(state)
		switch state {
		case "creado":
			// Ni enviado ni cobrado
			query = query.Where("albaranes.enviado = ? AND albaranes.cobrado = ?", false, false)
		case "enviado":
			// Enviado pero no cobrado
			query = query.Where("albaranes.enviado = ? AND albaranes.cobrado = ?", true, false)
		case "pagado":
			// Filtramos por el campo 'pagado' (al conductor)
			query = query.Where("albaranes.pagado = ?", true)
		case "finalizado":
			// Todo completado (o la lógica que definas para finalizado)
			query = query.Where("albaranes.enviado = ? AND albaranes.cobrado = ?", true, true)
		}
	}

	// 5. Filtro: Fechas
	fechaIniStr := c.Query("fecha_ini")
	fechaFinStr := c.Query("fecha_fin")

	if fechaIniStr != "" && fechaFinStr != "" {
		// Añadimos hora final al rango para incluir todo el día
		query = query.Where("albaranes.fecha BETWEEN ? AND ?", fechaIniStr, fechaFinStr+" 23:59:59")
	}

	// Contar total (sobre la query filtrada)
	// Nota: Gorm Count infiere la tabla base correctamente incluso con Joins
	if err := query.Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al contar registros"})
		return
	}

	// Ejecutar consulta paginada
	// Especificamos "albaranes.id" en el Order para evitar ambigüedad si hay Joins
	if result := query.Limit(pageSize).Offset(offset).Order("albaranes.fecha desc, albaranes.id desc").Find(&albaranes); result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al obtener la lista de albaranes filtrada", "details": result.Error.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":       albaranes,
		"total":      total,
		"page":       page,
		"pageSize":   pageSize,
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

// ---------------------------------------------------------------------
// --- Controladores CRUD (POST/PUT/DELETE)
// ---------------------------------------------------------------------

// CreateAlbaran maneja la creación de un nuevo albarán.
func CreateAlbaran(c *gin.Context, db *gorm.DB) {
	var input models.Albaran

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos de entrada inválidos", "details": err.Error()})
		return
	}

	if input.LicenciaRef == 0 || input.EmpresaRef == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Es obligatorio asignar una Licencia y una Empresa válida."})
		return
	}

	if result := db.Create(&input); result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al crear el albarán", "details": result.Error.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "✅ Albarán creado exitosamente", "data": input})
}

// UpdateAlbaran actualiza un albarán existente.
func UpdateAlbaran(c *gin.Context, db *gorm.DB) {
	id := c.Param("id")
	var albaran models.Albaran

	if err := db.First(&albaran, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "❌ Albarán no encontrado"})
		return
	}

	var input map[string]interface{}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos", "details": err.Error()})
		return
	}

	if err := db.Model(&albaran).Updates(input).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al actualizar el albarán", "details": err.Error()})
		return
	}

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
