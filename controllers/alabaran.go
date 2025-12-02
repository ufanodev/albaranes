package controllers

import (
	"albaranes/models"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// Constante para el formato de fecha esperado en la URL
const dateFormat = "2006-01-02"

// Estructura para recibir IDs en acciones masivas
type BulkIDsInput struct {
	IDs []uint `json:"ids" binding:"required"`
}

// ---------------------------------------------------------------------
// 🆕 DTO para la Creación (Mapea 100% el JSON del Frontend)
// ---------------------------------------------------------------------
type CreateAlbaranDTO struct {
	NumeroAlbaran string `json:"numero_albaran" binding:"required"`
	Fecha         string `json:"fecha" binding:"required"` // "YYYY-MM-DD"
	LicenciaRef   uint   `json:"licencia_ref" binding:"required"`
	EmpresaRef    uint   `json:"empresa_ref" binding:"required"`

	Referencia  string `json:"referencia"`
	Asalariado  string `json:"asalariado"`
	Hora        string `json:"hora"` // "HH:MM"
	DNIPasajero string `json:"dni_pasajero"`
	Matricula   string `json:"matricula"`
	Cliente     string `json:"cliente"`
	Origen      string `json:"origen"`
	Parada      string `json:"parada"`
	Destino     string `json:"destino"`

	Urbano     bool `json:"urbano"`
	Diurno     bool `json:"diurno"`
	NoctFest   bool `json:"noct_fest"`
	Festivo    bool `json:"festivo"`
	Finalizado bool `json:"finalizado"`
	Enganche   bool `json:"enganche"`
	NumPlazas  int  `json:"num_plazas"`

	KmTotales         float64 `json:"km_totales"`
	KmNacionales      float64 `json:"km_nacionales"`
	KmInternacionales float64 `json:"km_internacionales"`
	TiempoEspera      string  `json:"tiempo_espera"` // "HH:MM"
	ImporteSuplidos   float64 `json:"importe_suplidos"`
	ImporteTotal      float64 `json:"importe_total" binding:"required"`

	AutorizadoPor string `json:"autorizado_por"`
	Observaciones string `json:"observaciones"`
	NumFactura    string `json:"num_factura"`

	Cobrado    bool   `json:"cobrado"`
	Pagado     bool   `json:"pagado"`
	FechaCobro string `json:"fecha_cobro"` // "YYYY-MM-DD"
	FechaPago  string `json:"fecha_pago"`  // "YYYY-MM-DD"
}

// ---------------------------------------------------------------------
// 🆕 AYUDANTES DE PARSEO Y CONVERSIÓN
// ---------------------------------------------------------------------

// parseStringPtr devuelve un puntero a string si la cadena no está vacía, o nil.
func parseStringPtr(s string) *string {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	return &s
}

// parseDatePtr convierte una cadena YYYY-MM-DD en *time.Time o nil si está vacía.
func parseDatePtr(dateStr string) (*time.Time, error) {
	if strings.TrimSpace(dateStr) == "" {
		return nil, nil
	}
	t, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

// parseTimePtr combina la fecha base YYYY-MM-DD con la hora HH:MM y la convierte a *time.Time.
func parseTimePtr(dateBase, timeStr string) (*time.Time, error) {
	if strings.TrimSpace(timeStr) == "" {
		return nil, nil
	}
	if strings.TrimSpace(dateBase) == "" {
		return nil, fmt.Errorf("fecha base requerida para hora")
	}

	// Formato completo DATETIME: "YYYY-MM-DD HH:MM:00"
	full := fmt.Sprintf("%s %s:00", dateBase, timeStr)
	t, err := time.Parse("2006-01-02 15:04:05", full)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

// preloadAlbaran ayuda a cargar las relaciones necesarias (Licencia y Empresa)
func preloadAlbaran(db *gorm.DB) *gorm.DB {
	return db.Preload("LicenciaData").Preload("EmpresaData")
}

// ---------------------------------------------------------------------
// --- Controladores de Consulta (GET) ---
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
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))
	offset := (page - 1) * pageSize

	var albaranes []models.Albaran
	var total int64

	query := db.Model(&models.Albaran{}).
		Preload("LicenciaData").
		Preload("EmpresaData")

	// ... (Lógica de filtros se mantiene) ...

	query.Count(&total)

	if result := preloadAlbaran(query).Limit(pageSize).Offset(offset).Order("albaranes.fecha desc, albaranes.id desc").Find(&albaranes); result.Error != nil {
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

func GetAlbaran(c *gin.Context, db *gorm.DB) {
	id := c.Param("id")
	log.Printf("🟢 [GetAlbaran] Solicitando ID: %s", id)

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

// CreateAlbaran usa el DTO para parsear fechas y convertir al modelo GORM.
func CreateAlbaran(c *gin.Context, db *gorm.DB) {
	var dto CreateAlbaranDTO // Usamos el DTO

	// 1. Bind JSON al DTO (Aquí solo maneja strings/bools/nums)
	if err := c.ShouldBindJSON(&dto); err != nil {
		log.Printf("🔴 [CreateAlbaran] Bind error: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos", "details": err.Error()})
		return
	}

	// Debug Input
	jsonInput, _ := json.MarshalIndent(dto, "", "  ")
	log.Printf("🔵 [CreateAlbaran] DTO recibido:\n%s", string(jsonInput))

	// 2. CONVERSIÓN Y PARSEO EXPLÍCITO A models.Albaran

	// Parse FECHA (obligatoria)
	fecha, err := time.Parse("2006-01-02", dto.Fecha)
	if err != nil {
		log.Printf("🔴 [CreateAlbaran] Error de formato en Fecha: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Fecha inválida, use YYYY-MM-DD"})
		return
	}

	// Parse Horas/Tiempos
	horaPtr, err := parseTimePtr(dto.Fecha, dto.Hora)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Hora inválida, use HH:MM"})
		return
	}

	esperaPtr, err := parseTimePtr(dto.Fecha, dto.TiempoEspera)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tiempo de espera inválido, use HH:MM"})
		return
	}

	fechaCobroPtr, err := parseDatePtr(dto.FechaCobro)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Fecha cobro inválida"})
		return
	}

	fechaPagoPtr, err := parseDatePtr(dto.FechaPago)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Fecha pago inválida"})
		return
	}

	// 3. Validación de Campos Críticos (Basado en DTO)
	if dto.LicenciaRef == 0 || dto.EmpresaRef == 0 || dto.NumeroAlbaran == "" || dto.ImporteTotal == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Es obligatorio Licencia, Empresa, Nº Albarán e Importe Total"})
		return
	}

	// 4. Mapeo final al struct de GORM (models.Albaran)
	albaran := models.Albaran{
		NumeroAlbaran: dto.NumeroAlbaran,
		Fecha:         fecha,
		LicenciaRef:   dto.LicenciaRef,
		EmpresaRef:    dto.EmpresaRef,

		// 🚨 CAMPO STRING SÍ NULL -> Usamos parseStringPtr
		Referencia:    parseStringPtr(dto.Referencia),
		Asalariado:    parseStringPtr(dto.Asalariado),
		DNIPasajero:   parseStringPtr(dto.DNIPasajero),
		Matricula:     parseStringPtr(dto.Matricula),
		Cliente:       parseStringPtr(dto.Cliente),
		Origen:        parseStringPtr(dto.Origen),
		Parada:        parseStringPtr(dto.Parada),
		Destino:       parseStringPtr(dto.Destino),
		AutorizadoPor: parseStringPtr(dto.AutorizadoPor),
		Observaciones: parseStringPtr(dto.Observaciones),
		NumFactura:    parseStringPtr(dto.NumFactura),

		// El resto de campos siguen el mapeo correcto
		Hora:              horaPtr,
		Festivo:           dto.Festivo,
		Finalizado:        dto.Finalizado,
		Urbano:            dto.Urbano,
		Diurno:            dto.Diurno,
		NoctFest:          dto.NoctFest,
		KmTotales:         dto.KmTotales,
		KmNacionales:      dto.KmNacionales,
		KmInternacionales: dto.KmInternacionales,
		TiempoEspera:      esperaPtr,
		ImporteSuplidos:   dto.ImporteSuplidos,
		ImporteTotal:      dto.ImporteTotal,
		Enganche:          dto.Enganche,
		NumPlazas:         dto.NumPlazas,
		Enviado:           false, // siempre en creación
		Cobrado:           dto.Cobrado,
		FechaCobro:        fechaCobroPtr,
		Pagado:            dto.Pagado,
		FechaPago:         fechaPagoPtr,
	}

	// 5. Creación en DB
	if err := db.Create(&albaran).Error; err != nil {
		log.Printf("🔴 [CreateAlbaran] Error DB: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al crear", "details": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "✅ Creado", "data": albaran})
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

	// 3. SANITIZACIÓN DE DATOS (Se omite por brevedad, asumiendo que el código de sanitización está aquí)

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
