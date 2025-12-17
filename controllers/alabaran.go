package controllers

import (
	"albaranes/models"
	"albaranes/utils"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const dateFormat = "2006-01-02"

// ---------------------------------------------------------------------
// ESTRUCTURAS DE ENTRADA
// ---------------------------------------------------------------------

type BulkIDsInput struct {
	IDs []uint `json:"ids" binding:"required"`
}

type CreateAlbaranDTO struct {
	NumeroAlbaran      string  `json:"numero_albaran" binding:"required"`
	Fecha              string  `json:"fecha" binding:"required"`
	LicenciaRef        uint    `json:"licencia_ref" binding:"required"`
	EmpresaRef         uint    `json:"empresa_ref" binding:"required"`
	Referencia         string  `json:"referencia"`
	Asalariado         string  `json:"asalariado"`
	Hora               string  `json:"hora"`
	DNIPasajero        string  `json:"dni_pasajero"`
	Matricula          string  `json:"matricula"`
	Cliente            string  `json:"cliente"`
	Origen             string  `json:"origen"`
	Parada             string  `json:"parada"`
	Destino            string  `json:"destino"`
	Urbano             bool    `json:"urbano"`
	Diurno             bool    `json:"diurno"`
	NoctFest           bool    `json:"noct_fest"`
	Festivo            bool    `json:"festivo"`
	Finalizado         bool    `json:"finalizado"`
	Enganche           bool    `json:"enganche"`
	NumPlazas          int     `json:"num_plazas"`
	KmTotales          float64 `json:"km_totales"`
	KmNacionales       float64 `json:"km_nacionales"`
	KmInternacionales  float64 `json:"km_internacionales"`
	TiempoEspera       string  `json:"tiempo_espera"`
	ImporteSuplidos    float64 `json:"importe_suplidos"`
	ImporteTotal       float64 `json:"importe_total" binding:"required"`
	AutorizadoPor      string  `json:"autorizado_por"`
	Observaciones      string  `json:"observaciones"`
	NumFactura         string  `json:"num_factura"`
	ObservacionesAdmin string  `json:"observaciones_admin"`
	Cobrado            bool    `json:"cobrado"`
	Pagado             bool    `json:"pagado"`
	FechaCobro         string  `json:"fecha_cobro"`
	FechaPago          string  `json:"fecha_pago"`
	Enviado            bool    `json:"enviado"`
}

// ---------------------------------------------------------------------
// HELPERS DE PARSEO
// ---------------------------------------------------------------------

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

// 🛡️ LÓGICA MAESTRA DE LIMPIEZA PARA EL ADMIN (40 CAMPOS)
func cleanAlbaranMap(input map[string]interface{}, original models.Albaran) map[string]interface{} {
	clean := make(map[string]interface{})

	fechaBase := original.Fecha.Format(dateFormat)
	if v, ok := input["fecha"].(string); ok && v != "" {
		fechaBase = v
	}

	for key, value := range input {
		// Protección campos inmutables de sistema
		if key == "id" || key == "created_at" || key == "updated_at" || key == "ID" {
			continue
		}

		structKey := key
		switch key {
		case "licencia_ref":
			structKey = "LicenciaRef"
		case "empresa_ref":
			structKey = "EmpresaRef"
		case "numero_albaran":
			structKey = "NumeroAlbaran"
		case "num_factura":
			structKey = "NumFactura"
		case "observaciones_admin":
			structKey = "ObservacionesAdmin"
		case "km_nacionales":
			structKey = "KmNacionales"
		case "km_internacionales":
			structKey = "KmInternacionales"
		case "dni_pasajero":
			structKey = "DNIPasajero"
		default:
			structKey = strings.Title(key)
		}

		// Fix Horas (HH:MM -> time.Time)
		if key == "hora" || key == "tiempo_espera" {
			str, ok := value.(string)
			if !ok || strings.TrimSpace(str) == "" {
				clean[strings.Title(key)] = nil
				continue
			}
			if t, err := parseTimePtr(fechaBase, str); err == nil {
				clean[strings.Title(key)] = t
			} else {
				clean[strings.Title(key)] = nil
			}
			continue
		}

		// Parseo de Fechas
		if strings.Contains(strings.ToLower(key), "fecha") {
			if str, ok := value.(string); ok && str != "" {
				if t, err := parseDatePtr(str); err == nil {
					clean[structKey] = *t
				}
			} else {
				clean[structKey] = nil
			}
		} else {
			clean[structKey] = value
		}
	}
	return clean
}

// ---------------------------------------------------------------------
// CONTROLADORES
// ---------------------------------------------------------------------

func GetAlbaranes(c *gin.Context, db *gorm.DB) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))
	var albaranes []models.Albaran
	var total int64
	db.Model(&models.Albaran{}).Count(&total)
	preloadAlbaran(db).Limit(pageSize).Offset((page - 1) * pageSize).Order("id desc").Find(&albaranes)
	c.JSON(http.StatusOK, gin.H{"data": albaranes, "total": total})
}

func GetAlbaran(c *gin.Context, db *gorm.DB) {
	id := c.Param("id")
	var albaran models.Albaran
	if err := preloadAlbaran(db).First(&albaran, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "❌ No encontrado"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": albaran})
}

func SearchAlbaranes(c *gin.Context, db *gorm.DB) {
	var albaranes []models.Albaran
	query := preloadAlbaran(db.Model(&models.Albaran{}))
	if v := c.Query("licencia_ref"); v != "" {
		query = query.Where("licencia_ref = ?", v)
	}
	if v := c.Query("empresa_ref"); v != "" {
		query = query.Where("empresa_ref = ?", v)
	}
	if v := c.Query("referencia"); v != "" {
		query = query.Where("referencia LIKE ?", "%"+v+"%")
	}
	query.Order("fecha desc, id desc").Find(&albaranes)
	c.JSON(http.StatusOK, gin.H{"data": albaranes})
}

func CreateAlbaran(c *gin.Context, db *gorm.DB) {
	var dto CreateAlbaranDTO
	if err := c.ShouldBindJSON(&dto); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "❌ Datos inválidos"})
		return
	}
	fecha, _ := time.Parse(dateFormat, dto.Fecha)
	horaPtr, _ := parseTimePtr(dto.Fecha, dto.Hora)
	albaran := models.Albaran{NumeroAlbaran: dto.NumeroAlbaran, Fecha: fecha, LicenciaRef: dto.LicenciaRef, EmpresaRef: dto.EmpresaRef, Hora: horaPtr, ImporteTotal: dto.ImporteTotal}
	db.Create(&albaran)
	c.JSON(http.StatusCreated, gin.H{"data": albaran})
}

func UpdateAlbaranAdmin(c *gin.Context, db *gorm.DB) {
	id := c.Param("id")
	var albaran models.Albaran
	if err := db.First(&albaran, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "❌ No encontrado"})
		return
	}
	var input map[string]interface{}
	c.ShouldBindJSON(&input)
	cleanInput := cleanAlbaranMap(input, albaran)
	db.Model(&albaran).Updates(cleanInput)
	c.JSON(http.StatusOK, gin.H{"message": "✅ Actualizado por Admin", "data": albaran})
}

// 👑 COPY ALBARAN ADMIN
func CopyAlbaranAdmin(c *gin.Context, db *gorm.DB) {
	var input map[string]interface{}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "❌ Datos inválidos"})
		return
	}

	// Limpiar IDs para forzar creación de nuevo registro
	delete(input, "id")
	delete(input, "ID")
	delete(input, "created_at")
	delete(input, "updated_at")

	// Usamos una fecha base de hoy para el parseo inicial de tiempos si fuera necesario
	cleanInput := cleanAlbaranMap(input, models.Albaran{Fecha: time.Now()})

	if err := db.Model(&models.Albaran{}).Create(cleanInput).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "❌ Error al crear la copia"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "✅ Albarán copiado con éxito", "data": cleanInput})
}

func UpdateAlbaranUser(c *gin.Context, db *gorm.DB) {
	id := c.Param("id")
	var albaran models.Albaran
	if err := db.First(&albaran, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "❌ No encontrado"})
		return
	}
	var input map[string]interface{}
	c.ShouldBindJSON(&input)
	delete(input, "id")
	delete(input, "numero_albaran")
	delete(input, "licencia_ref")
	cleanInput := cleanAlbaranMap(input, albaran)
	db.Model(&albaran).Updates(cleanInput)
	c.JSON(http.StatusOK, gin.H{"message": "✅ Actualizado correctamente", "data": albaran})
}

func DeleteAlbaran(c *gin.Context, db *gorm.DB) {
	id := c.Param("id")
	db.Delete(&models.Albaran{}, id)
	c.JSON(http.StatusOK, gin.H{"message": "✅ Eliminado"})
}

func BulkChargeAlbaranes(c *gin.Context, db *gorm.DB) {
	var input struct {
		BulkIDsInput
		FechaCobro string `json:"fecha_cobro"`
		FechaPago  string `json:"fecha_pago"`
	}
	c.ShouldBindJSON(&input)
	updates := map[string]interface{}{"cobrado": true, "pagado": true, "fecha_cobro": input.FechaCobro, "fecha_pago": input.FechaPago}
	db.Model(&models.Albaran{}).Where("id IN ?", input.IDs).Updates(updates)
	c.JSON(http.StatusOK, gin.H{"message": "✅ Actualizado"})
}

func ExportAlbaranesPDF(c *gin.Context, db *gorm.DB) {
	var req ExportRequest
	c.ShouldBindJSON(&req)
	var mappedData []utils.TitularData
	for _, m := range req.Data {
		mappedData = append(mappedData, utils.TitularData(m))
	}
	url, _ := utils.GenerateGenericPDF(req.ReportName, mappedData)
	c.JSON(http.StatusOK, gin.H{"success": true, "downloadURL": url})
}

func ExportAlbaranesXLSX(c *gin.Context, db *gorm.DB) {
	var req ExportRequest
	c.ShouldBindJSON(&req)
	var mappedData []utils.TitularData
	for _, m := range req.Data {
		mappedData = append(mappedData, utils.TitularData(m))
	}
	url, _ := utils.GenerateTitularesXLSX(req.ReportName, mappedData)
	c.JSON(http.StatusOK, gin.H{"success": true, "downloadURL": url})
}
