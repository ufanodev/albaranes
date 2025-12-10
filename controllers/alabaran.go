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

// Constante para el formato de fecha esperado en la URL y la DB
const dateFormat = "2006-01-02"

// Estructura para recibir IDs en acciones masivas
type BulkIDsInput struct {
	IDs []uint `json:"ids" binding:"required"`
}

// ---------------------------------------------------------------------
// DTO para la Creación (Incluye todos los campos de la DB)
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

	AutorizadoPor      string `json:"autorizado_por"`
	Observaciones      string `json:"observaciones"`
	NumFactura         string `json:"num_factura"`
	ObservacionesAdmin string `json:"observaciones_admin"`

	Cobrado    bool   `json:"cobrado"`
	Pagado     bool   `json:"pagado"`
	FechaCobro string `json:"fecha_cobro"`
	FechaPago  string `json:"fecha_pago"`
}

// ---------------------------------------------------------------------
// AYUDANTES DE PARSEO Y CONVERSIÓN
// ---------------------------------------------------------------------

func parseStringPtr(s string) *string {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	return &s
}

func parseDatePtr(dateStr string) (*time.Time, error) {
	if strings.TrimSpace(dateStr) == "" {
		return nil, nil
	}
	t, err := time.Parse(dateFormat, dateStr)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func parseTimePtr(dateBase, timeStr string) (*time.Time, error) {
	if strings.TrimSpace(timeStr) == "" {
		return nil, nil
	}
	if strings.TrimSpace(dateBase) == "" {
		return nil, fmt.Errorf("fecha base requerida para hora")
	}

	full := fmt.Sprintf("%s %s:00", dateBase, timeStr)
	t, err := time.Parse("2006-01-02 15:04:05", full)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func preloadAlbaran(db *gorm.DB) *gorm.DB {
	return db.Preload("LicenciaData").Preload("EmpresaData")
}

// ---------------------------------------------------------------------
// CONTROLADORES DE CONSULTA (GET)
// ---------------------------------------------------------------------

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
		"page":       pageSize,
		"total":      total,
		"totalPages": (total + int64(pageSize) - 1) / int64(pageSize),
	})
}

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

func SearchAlbaranes(c *gin.Context, db *gorm.DB) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "5000"))
	offset := (page - 1) * pageSize

	var albaranes []models.Albaran
	var total int64

	query := db.Model(&models.Albaran{}).
		Preload("LicenciaData").
		Preload("EmpresaData")

	// LÓGICA DE FILTROS DINÁMICOS (Mantenida)
	licenciaRef := c.Query("licencia_ref")
	if licenciaRef != "" {
		query = query.Where("licencia_ref = ?", licenciaRef)
	}

	empresaRef := c.Query("empresa_ref")
	if empresaRef != "" {
		query = query.Where("empresa_ref = ?", empresaRef)
	}

	enviado := c.Query("enviado")
	if enviado != "" {
		query = query.Where("enviado = ?", enviado)
	}

	cobrado := c.Query("cobrado")
	if cobrado != "" {
		query = query.Where("cobrado = ?", cobrado)
	}

	state := c.Query("state")
	if state != "" {
		switch strings.ToLower(state) {
		case "creado":
			query = query.Where("IFNULL(enviado, 0) = 0 AND IFNULL(cobrado, 0) = 0 AND IFNULL(finalizado, 0) = 0")
		case "enviado":
			query = query.Where("enviado = ?", 1).
				Where("IFNULL(cobrado, 0) = 0").
				Where("IFNULL(pagado, 0) = 0").
				Where("IFNULL(finalizado, 0) = 0")
		case "pagado":
			query = query.Where("IFNULL(cobrado, 0) = 1 OR IFNULL(pagado, 0) = 1")
		case "finalizado":
			query = query.Where("finalizado = ?", 1)
		}
	}

	referencia := c.Query("referencia")
	if referencia != "" {
		searchRef := "%" + strings.ToLower(referencia) + "%"
		query = query.Where(
			"LOWER(referencia) LIKE ? OR LOWER(numero_albaran) LIKE ?",
			searchRef,
			searchRef,
		)
	}

	fechaIni := c.Query("fecha_ini")
	if fechaIni != "" {
		query = query.Where("fecha >= ?", fechaIni)
	}
	fechaFin := c.Query("fecha_fin")
	if fechaFin != "" {
		query = query.Where("fecha <= ?", fechaFin)
	}

	palabra := c.Query("palabra")
	searchType := c.Query("search_type")

	if palabra != "" {
		words := strings.Fields(strings.ToLower(palabra))
		searchFields := []string{
			"numero_albaran", "referencia", "asalariado", "dni_pasajero",
			"matricula", "cliente", "origen", "parada", "destino",
			"observaciones", "observaciones_admin", "num_factura",
			"autorizado_por",
		}

		var searchClauses []string
		var searchValues []interface{}

		switch searchType {
		case "exacta":
			log.Printf("Búsqueda: Exacta (%s)", palabra)
			for _, field := range searchFields {
				searchClauses = append(searchClauses, fmt.Sprintf("LOWER(IFNULL(%s, '')) LIKE ?", field))
				searchValues = append(searchValues, "%"+strings.ToLower(palabra)+"%")
			}
			query = query.Where(strings.Join(searchClauses, " OR "), searchValues...)

		case "todas":
			log.Printf("Búsqueda: Todas (%v)", words)
			for _, word := range words {
				var wordClauses []string
				var wordValues []interface{}
				for _, field := range searchFields {
					wordClauses = append(wordClauses, fmt.Sprintf("LOWER(IFNULL(%s, '')) LIKE ?", field))
					wordValues = append(wordValues, "%"+word+"%")
				}
				query = query.Where("("+strings.Join(wordClauses, " OR ")+")", wordValues...)
			}

		case "cualquier":
			log.Printf("Búsqueda: Cualquier (%v)", words)
			for _, field := range searchFields {
				for _, word := range words {
					searchClauses = append(searchClauses, fmt.Sprintf("LOWER(IFNULL(%s, '')) LIKE ?", field))
					searchValues = append(searchValues, "%"+word+"%")
				}
			}
			query = query.Where(strings.Join(searchClauses, " OR "), searchValues...)

		default:
			log.Printf("Búsqueda: Default (Exacta) (%s)", palabra)
			for _, field := range searchFields {
				searchClauses = append(searchClauses, fmt.Sprintf("LOWER(IFNULL(%s, '')) LIKE ?", field))
				searchValues = append(searchValues, "%"+strings.ToLower(palabra)+"%")
			}
			query = query.Where(strings.Join(searchClauses, " OR "), searchValues...)
		}
	}

	query.Count(&total)

	if result := query.Limit(pageSize).Offset(offset).Order("albaranes.fecha desc, albaranes.id desc").Find(&albaranes); result.Error != nil {
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
// CONTROLADORES CRUD y ACCIONES MASIVAS
// ---------------------------------------------------------------------

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

// BulkPayAlbaranes (Mantenido para compatibilidad si el frontend lo necesita para Pagos a Titulares)
func BulkPayAlbaranes(c *gin.Context, db *gorm.DB) {
	var input BulkIDsInput
	if err := c.ShouldBindJSON(&input); err != nil {
		log.Printf("🔴 [BulkPay] Error al recibir lista de IDs: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Lista de IDs inválida", "details": err.Error()})
		return
	}

	log.Printf("💰 [BulkPay] IDs recibidos para Pago Masivo (Titulares): %v", input.IDs)

	if len(input.IDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No se proporcionaron IDs para el pago"})
		return
	}

	updates := map[string]interface{}{
		"Pagado":    true,
		"FechaPago": time.Now().Format(dateFormat),
	}

	log.Printf("[BulkPay] Campos a actualizar: %+v", updates)

	result := db.Model(&models.Albaran{}).Where("id IN ?", input.IDs).Updates(updates)

	if result.Error != nil {
		log.Printf("🔴 [BulkPay] Error DB al actualizar albaranes: %v", result.Error)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al actualizar los albaranes como pagados"})
		return
	}

	log.Printf("✅ [BulkPay] %d registros marcados como PAGADOS.", result.RowsAffected)
	c.JSON(http.StatusOK, gin.H{
		"message": "✅ Albaranes marcados como Pagados exitosamente",
		"updated": result.RowsAffected,
	})
}

// 💳 BulkChargeAlbaranes marca una lista de albaranes como cobrados con la fecha actual.
func BulkChargeAlbaranes(c *gin.Context, db *gorm.DB) {
	// Usaremos BulkIDsInput y asumiremos que el JSON puede contener las fechas,
	// o que BulkIDsInput ya fue ampliado para incluir las fechas como strings.
	var input struct {
		BulkIDsInput
		FechaCobro string `json:"fecha_cobro"`
		FechaPago  string `json:"fecha_pago"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		log.Printf("🔴 [BulkCharge] Error al recibir lista de IDs: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Lista de IDs inválida",
			"details": err.Error(),
		})
		return
	}

	log.Printf("💳 [BulkCharge] IDs recibidos para Cobro Masivo (Empresa): %v", input.IDs)

	if len(input.IDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No hay IDs"})
		return
	}

	// Fechas recibidas del front
	fechaCobro := input.FechaCobro
	fechaPago := input.FechaPago

	// Obtener fecha actual
	hoy := time.Now().Format(dateFormat)

	// Si faltan, se autocompletan
	if fechaCobro == "" {
		fechaCobro = hoy
	}
	if fechaPago == "" {
		fechaPago = fechaCobro
	}

	// Campos a actualizar (cobrado, fecha_cobro, fecha_pago)
	updates := map[string]interface{}{
		"cobrado":     true,       // Campo 34: Marcar como cobrado=1
		"fecha_cobro": fechaCobro, // Campo 35
		"fecha_pago":  fechaPago,  // Campo 37
		// 🚨 CRÍTICO: Añadir 'pagado' para que el filtro JS (que usa pagado=0 por defecto) funcione correctamente
		"pagado": true, // Campo 36: Marcar como pagado=1
	}

	log.Printf("[BulkCharge] Campos a actualizar: %+v", updates)

	// Actualizar
	result := db.Model(&models.Albaran{}).
		Where("id IN ?", input.IDs).
		Updates(updates)

	if result.Error != nil {
		log.Printf("🔴 [BulkCharge] Error DB: %v", result.Error)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Error DB",
		})
		return
	}

	log.Printf("✅ [BulkCharge] %d registros actualizados.", result.RowsAffected)
	c.JSON(http.StatusOK, gin.H{
		"message": "Albaranes actualizados",
		"updated": result.RowsAffected,
	})
}

func CreateAlbaran(c *gin.Context, db *gorm.DB) {
	var dto CreateAlbaranDTO

	if err := c.ShouldBindJSON(&dto); err != nil {
		log.Printf("🔴 [CreateAlbaran] Bind error: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos", "details": err.Error()})
		return
	}

	jsonInput, _ := json.MarshalIndent(dto, "", "  ")
	log.Printf("🔵 [CreateAlbaran] DTO recibido:\n%s", string(jsonInput))

	fecha, err := time.Parse(dateFormat, dto.Fecha)
	if err != nil {
		log.Printf("🔴 [CreateAlbaran] Error de formato en Fecha: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Fecha inválida, use YYYY-MM-DD"})
		return
	}

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

	if dto.LicenciaRef == 0 || dto.EmpresaRef == 0 || dto.NumeroAlbaran == "" || dto.ImporteTotal == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Es obligatorio Licencia, Empresa, Nº Albarán e Importe Total"})
		return
	}

	albaran := models.Albaran{
		NumeroAlbaran: dto.NumeroAlbaran,
		Fecha:         fecha,
		LicenciaRef:   dto.LicenciaRef,
		EmpresaRef:    dto.EmpresaRef,

		Referencia:         parseStringPtr(dto.Referencia),
		Asalariado:         parseStringPtr(dto.Asalariado),
		DNIPasajero:        parseStringPtr(dto.DNIPasajero),
		Matricula:          parseStringPtr(dto.Matricula),
		Cliente:            parseStringPtr(dto.Cliente),
		Origen:             parseStringPtr(dto.Origen),
		Parada:             parseStringPtr(dto.Parada),
		Destino:            parseStringPtr(dto.Destino),
		AutorizadoPor:      parseStringPtr(dto.AutorizadoPor),
		Observaciones:      parseStringPtr(dto.Observaciones),
		NumFactura:         parseStringPtr(dto.NumFactura),
		ObservacionesAdmin: parseStringPtr(dto.ObservacionesAdmin),

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

		Cobrado:    dto.Cobrado,
		FechaCobro: fechaCobroPtr,
		Pagado:     dto.Pagado,
		FechaPago:  fechaPagoPtr,
	}

	if err := db.Create(&albaran).Error; err != nil {
		log.Printf("🔴 [CreateAlbaran] Error DB: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al crear", "details": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "✅ Creado", "data": albaran})
}

// ❌ FUNCIÓN UpdateAlbaran CORREGIDA para manejar booleanos y fechas
func UpdateAlbaran(c *gin.Context, db *gorm.DB) {
	id := c.Param("id")
	log.Printf("🟢 [UpdateAlbaran] Iniciando actualización para ID: %s", id)

	var albaran models.Albaran
	if err := db.First(&albaran, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "No encontrado"})
		return
	}

	var input map[string]interface{}
	if err := c.ShouldBindJSON(&input); err != nil {
		log.Printf("🔴 [UpdateAlbaran] Error binding JSON: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos", "details": err.Error()})
		return
	}

	jsonInput, _ := json.MarshalIndent(input, "", "  ")
	log.Printf("🔵 [UpdateAlbaran] Payload de actualización para ID %s:\n%s", id, string(jsonInput))

	// --- Preparar un mapa limpio para GORM ---
	cleanInput := make(map[string]interface{})

	// Iterar sobre el input y realizar conversiones/mapeos
	for key, value := range input {
		// Mapear el nombre del campo de JSON/Frontend a la clave del Struct (PascalCase)
		var structKey string
		switch key {
		case "cobrado":
			structKey = "Cobrado"
		case "fecha_cobro":
			structKey = "FechaCobro"
		case "pagado":
			structKey = "Pagado"
		case "fecha_pago":
			structKey = "FechaPago"
		default:
			structKey = key
		}

		// Manejo de valores específicos

		if structKey == "FechaCobro" || structKey == "FechaPago" {
			if dateStr, ok := value.(string); ok {
				log.Printf("🔵 [UpdateAlbaran] Procesando %s: '%s'", structKey, dateStr)
				if t, err := parseDatePtr(dateStr); err == nil && t != nil {
					cleanInput[structKey] = *t // Usar time.Time
				} else if dateStr == "" {
					cleanInput[structKey] = nil // Para establecer a NULL
				} else if err != nil {
					log.Printf("🔴 [UpdateAlbaran] Error parseando %s: %v", structKey, err)
				}
			} else if value == nil {
				cleanInput[structKey] = nil // Asegurar NULL si viene explícitamente nulo
			}
		} else if value != nil {
			cleanInput[structKey] = value
		}
	}

	finalInput, _ := json.MarshalIndent(cleanInput, "", "  ")
	log.Printf("🔵 [UpdateAlbaran] Input Final para GORM:\n%s", string(finalInput))

	if err := db.Model(&albaran).Updates(cleanInput).Error; err != nil {
		log.Printf("🔴 [UpdateAlbaran] Error DB: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al actualizar el albarán", "details": err.Error()})
		return
	}

	log.Printf("✅ [UpdateAlbaran] ID %s actualizado con éxito. Filas afectadas: %d", id, db.RowsAffected)

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
