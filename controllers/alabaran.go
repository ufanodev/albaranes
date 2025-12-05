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
// DTO para la Creación
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
	t, err := time.Parse("2006-01-02", dateStr)
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
		"page":       page,
		"pageSize":   pageSize,
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

// SearchAlbaranes permite buscar con filtros.
func SearchAlbaranes(c *gin.Context, db *gorm.DB) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "5000"))
	offset := (page - 1) * pageSize

	var albaranes []models.Albaran
	var total int64

	query := db.Model(&models.Albaran{}).
		Preload("LicenciaData").
		Preload("EmpresaData")

	// -----------------------------------------------------------
	// LÓGICA DE FILTROS DINÁMICOS
	// -----------------------------------------------------------

	// 1. FILTRO POR LICENCIA (AHORA ES OPCIONAL PARA ADMIN)
	licenciaRef := c.Query("licencia_ref")
	if licenciaRef != "" {
		// Solo aplica el filtro si el valor no está vacío
		query = query.Where("licencia_ref = ?", licenciaRef)
	}

	// 2. FILTRO POR EMPRESA
	empresaRef := c.Query("empresa_ref")
	if empresaRef != "" {
		query = query.Where("empresa_ref = ?", empresaRef)
	}

	// 3. FILTRO POR ESTADO (Corregido con IFNULL para robustez)
	state := c.Query("state")
	if state != "" {
		switch strings.ToLower(state) {
		case "creado":
			// 'Creado': Si NO ha sido enviado, cobrado ni finalizado.
			query = query.Where("IFNULL(enviado, 0) = 0 AND IFNULL(cobrado, 0) = 0 AND IFNULL(finalizado, 0) = 0")

		case "enviado":
			// 'Enviado': Si enviado=1, pero AÚN NO cobrado/pagado/finalizado (Estado puro de "Enviado").
			query = query.Where("enviado = ?", 1).
				Where("IFNULL(cobrado, 0) = 0").
				Where("IFNULL(pagado, 0) = 0").
				Where("IFNULL(finalizado, 0) = 0")

		case "pagado":
			// 'Pagado': Si cobrado=1 O pagado=1.
			query = query.Where("IFNULL(cobrado, 0) = 1 OR IFNULL(pagado, 0) = 1")

		case "finalizado":
			// 'Finalizado': Si finalizado=1.
			query = query.Where("finalizado = ?", 1)
		}
	}

	// 4. FILTRO POR REFERENCIA (solo referencia/numero_albaran)
	referencia := c.Query("referencia")
	if referencia != "" {
		searchRef := "%" + strings.ToLower(referencia) + "%"
		query = query.Where(
			"LOWER(referencia) LIKE ? OR LOWER(numero_albaran) LIKE ?",
			searchRef,
			searchRef,
		)
	}

	// 5. FILTRO POR FECHAS
	fechaIni := c.Query("fecha_ini")
	if fechaIni != "" {
		query = query.Where("fecha >= ?", fechaIni)
	}
	fechaFin := c.Query("fecha_fin")
	if fechaFin != "" {
		query = query.Where("fecha <= ?", fechaFin)
	}

	// 6. FILTRO POR PALABRA CLAVE (Búsqueda general en múltiples campos STRING)
	palabra := c.Query("palabra")
	searchType := c.Query("search_type")

	if palabra != "" {
		words := strings.Fields(strings.ToLower(palabra))

		// 🚨 CAMPOS DE TEXTO ELEGIDOS PARA LA BÚSQUEDA
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
					// CORRECCIÓN: Usando 'wordClauses' en lugar de 'wordClabaranes'
					wordClauses = append(wordClauses, fmt.Sprintf("LOWER(IFNULL(%s, '')) LIKE ?", field))
					wordValues = append(wordValues, "%"+word+"%")
				}
				query = query.Where("("+strings.Join(wordClauses, " OR ")+")", wordValues...)
			}

		case "cualquier":
			log.Printf("Búsqueda: Cualquier (%v)", words)
			// Usamos OR para que cualquiera de las palabras en cualquiera de los campos coincida
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
	// -----------------------------------------------------------

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

func CreateAlbaran(c *gin.Context, db *gorm.DB) {
	var dto CreateAlbaranDTO

	if err := c.ShouldBindJSON(&dto); err != nil {
		log.Printf("🔴 [CreateAlbaran] Bind error: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos", "details": err.Error()})
		return
	}

	jsonInput, _ := json.MarshalIndent(dto, "", "  ")
	log.Printf("🔵 [CreateAlbaran] DTO recibido:\n%s", string(jsonInput))

	fecha, err := time.Parse("2006-01-02", dto.Fecha)
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

	if err := db.Create(&albaran).Error; err != nil {
		log.Printf("🔴 [CreateAlbaran] Error DB: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al crear", "details": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "✅ Creado", "data": albaran})
}

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

	if err := db.Model(&albaran).Updates(input).Error; err != nil {
		log.Printf("🔴 [UpdateAlbaran] Error DB: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al actualizar el albarán", "details": err.Error()})
		return
	}

	log.Printf("✅ [UpdateAlbaran] ID %s actualizado con éxito.", id)

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
