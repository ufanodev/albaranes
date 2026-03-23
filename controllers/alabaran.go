/**
 * ARCHIVO: controllers/albaran.go
 * DESCRIPCIÓN: Gestión integral de albaranes con soporte robusto para SQL directo y tipos de tiempo.
 * ACTUALIZADO: 23/03/2026 - FIX: Soporte para estados (enviado, cobrado, pagado) en SQL directo.
 */

package controllers

import (
	"albaranes/models"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const dateFormat = "2006-01-02"

// ---------------------------------------------------------------------
// SECCIÓN: HELPERS DE PARSEO Y LIMPIEZA
// ---------------------------------------------------------------------

func parseDatePtr(dateStr string) (*time.Time, error) {
	if strings.TrimSpace(dateStr) == "" {
		return nil, nil
	}
	// ✅ Usar zona horaria local para evitar saltos de día/hora
	loc, _ := time.LoadLocation("Europe/Madrid")
	t, err := time.ParseInLocation(dateFormat, dateStr, loc)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func parseTimePtr(dateBase, timeStr string) (*time.Time, error) {
	if strings.TrimSpace(timeStr) == "" {
		return nil, nil
	}
	if len(timeStr) == 5 {
		timeStr += ":00"
	}
	full := fmt.Sprintf("%s %s", dateBase, timeStr)

	// ✅ Forzar interpretación en hora local (Madrid) para que coincida con MySQL
	loc, _ := time.LoadLocation("Europe/Madrid")
	t, err := time.ParseInLocation("2006-01-02 15:04:05", full, loc)

	if err != nil {
		fmt.Printf("❌ [parseTimePtr] FALLO: base=%s time=%s → %v\n", dateBase, timeStr, err)
		return nil, err
	}
	fmt.Printf("✅ [parseTimePtr] OK: %s → %v\n", full, t)
	return &t, nil
}

func preloadAlbaran(db *gorm.DB) *gorm.DB {
	return db.Preload("LicenciaData").Preload("EmpresaData")
}

func getUintFromContext(c *gin.Context, key string) uint {
	val, exists := c.Get(key)
	if !exists {
		return 0
	}
	switch v := val.(type) {
	case float64:
		return uint(v)
	case uint:
		return v
	case int:
		return uint(v)
	default:
		return 0
	}
}

func cleanAlbaranMap(input map[string]interface{}, original models.Albaran) map[string]interface{} {
	clean := make(map[string]interface{})
	fechaBase := time.Now().Format(dateFormat)
	if !original.Fecha.IsZero() {
		fechaBase = original.Fecha.Format(dateFormat)
	}
	if v, ok := input["fecha"].(string); ok && v != "" {
		fechaBase = v
	}

	timeFields := map[string]string{
		"hora": "Hora", "hora_ini": "HoraIni", "hora_fin": "HoraFin",
		"espera_ini": "EsperaIni", "espera_fin": "EsperaFin", "tiempo_espera": "TiempoEspera",
	}

	for key, value := range input {
		if strings.ToLower(key) == "id" || key == "created_at" || key == "updated_at" {
			continue
		}

		if structKey, ok := timeFields[key]; ok {
			str, _ := value.(string)
			if t, err := parseTimePtr(fechaBase, str); err == nil {
				clean[structKey] = t
			}
			continue
		}

		structKey := ""
		switch key {
		case "licencia_ref":
			structKey = "LicenciaRef"
		case "empresa_ref":
			structKey = "EmpresaRef"
		case "numero_albaran":
			structKey = "NumeroAlbaran"
		case "empresa_nombre":
			structKey = "EmpresaNombre"
		case "dni_pasajero":
			structKey = "DNIPasajero"
		case "tlf_pasajero":
			structKey = "TlfPasajero"
		case "matricula":
			structKey = "Matricula"
		case "nombre_pasajero", "cliente":
			structKey = "Cliente"
		case "noct_fest":
			structKey = "NoctFest"
		case "diurno":
			structKey = "Diurno"
		case "urbano":
			structKey = "Urbano"
		case "remolque":
			structKey = "Remolque"
		case "km_totales":
			structKey = "KmTotales"
		case "km_nacionales":
			structKey = "KmNacionales"
		case "km_internacionales":
			structKey = "KmInternacionales"
		case "hora_total":
			structKey = "HoraTotal"
		case "importe_suplidos":
			structKey = "ImporteSuplidos"
		case "importe_total":
			structKey = "ImporteTotal"
		case "asalariado":
			structKey = "Asalariado"
		case "autorizado_por":
			structKey = "AutorizadoPor"
		case "num_plazas":
			structKey = "NumPlazas"
		case "adjuntos_bool":
			structKey = "Adjuntos"
		case "adjuntos":
			structKey = "AdjuntosRef"
		case "enviado":
			structKey = "Enviado"
		case "cobrado":
			structKey = "Cobrado"
		case "pagado":
			structKey = "Pagado"
		case "num_factura":
			structKey = "NumFactura"
		case "finalizado":
			structKey = "Finalizado"
		case "festivo":
			structKey = "Festivo"
		default:
			parts := strings.Split(key, "_")
			for i := range parts {
				parts[i] = strings.Title(parts[i])
			}
			structKey = strings.Join(parts, "")
		}

		if strings.Contains(strings.ToLower(key), "fecha") {
			if str, ok := value.(string); ok && str != "" {
				if t, err := parseDatePtr(str); err == nil {
					if key == "fecha_pago" || key == "fecha_cobro" {
						clean[structKey] = t
					} else {
						clean[structKey] = *t
					}
				}
			}
		} else {
			clean[structKey] = value
		}
	}
	return clean
}

// ---------------------------------------------------------------------
// SECCIÓN: CRUD PRINCIPAL
// ---------------------------------------------------------------------

func GetAlbaran(c *gin.Context, db *gorm.DB) {
	id := c.Param("id")
	var albaran models.Albaran
	if err := preloadAlbaran(db).First(&albaran, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "❌ No encontrado"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": albaran})
}

func CreateAlbaran(c *gin.Context, db *gorm.DB) {
	var input map[string]interface{}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "JSON inválido"})
		return
	}
	cleanInput := cleanAlbaranMap(input, models.Albaran{Fecha: time.Now()})
	if err := db.Model(&models.Albaran{}).Create(cleanInput).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al guardar"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "✅ Albarán creado"})
}

func UpdateAlbaran(c *gin.Context, db *gorm.DB) {
	role, _ := c.Get("role")
	if role == "admin" {
		UpdateAlbaranAdmin(c, db)
	} else {
		UpdateAlbaranUser(c, db)
	}
}

func UpdateAlbaranAdmin(c *gin.Context, db *gorm.DB) {
	id := c.Param("id")
	var albaran models.Albaran
	if err := db.First(&albaran, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Albarán no encontrado"})
		return
	}
	var input map[string]interface{}
	c.ShouldBindJSON(&input)
	cleanInput := cleanAlbaranMap(input, albaran)

	if val := intOrZero(cleanInput, "EmpresaRef"); val > 0 {
		var emp models.Empresa
		if err := db.First(&emp, val).Error; err == nil {
			cleanInput["EmpresaNombre"] = emp.Nombre
		}
	}

	err := execUpdateSQL(db, cleanInput, albaran.ID, 0, true)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error SQL: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "✅ Actualizado por Administrador"})
}

func UpdateAlbaranUser(c *gin.Context, db *gorm.DB) {
	id := c.Param("id")
	var albaran models.Albaran
	licID := getUintFromContext(c, "licencia_id")

	if err := db.Where("id = ? AND licencia_ref = ?", id, licID).First(&albaran).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Permiso denegado"})
		return
	}

	var input map[string]interface{}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "JSON inválido"})
		return
	}

	delete(input, "numero_albaran")
	delete(input, "licencia_ref")

	cleanInput := cleanAlbaranMap(input, albaran)

	if val := intOrZero(cleanInput, "EmpresaRef"); val > 0 {
		var emp models.Empresa
		if err := db.First(&emp, val).Error; err == nil {
			cleanInput["EmpresaNombre"] = emp.Nombre
		}
	}

	err := execUpdateSQL(db, cleanInput, albaran.ID, licID, false)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al actualizar"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "✅ Actualizado correctamente"})
}

// ---------------------------------------------------------------------
// SECCIÓN: EJECUCIÓN SQL DIRECTA
// ---------------------------------------------------------------------

func execUpdateSQL(db *gorm.DB, cleanInput map[string]interface{}, id uint, licID uint, isAdmin bool) error {
	// ✅ DEPUREACIÓN DE VALORES ANTES DE SQL
	fmt.Printf("\n🔍 [execUpdateSQL] id=%d | licID=%d | isAdmin=%v\n", id, licID, isAdmin)
	fmt.Printf("   HoraIni=%v | HoraFin=%v | Fecha=%v\n\n",
		timePtrOrNil(cleanInput, "HoraIni"),
		timePtrOrNil(cleanInput, "HoraFin"),
		timePtrOrNil(cleanInput, "Fecha"))

	query := `
        UPDATE albaranes SET
            fecha              = ?, hora_ini           = ?, hora_fin           = ?,
            espera_ini         = ?, espera_fin         = ?, referencia         = ?,
            asalariado         = ?, dni_pasajero       = ?, tlf_pasajero       = ?,
            matricula          = ?, cliente            = ?, origen             = ?,
            parada             = ?, destino            = ?, empresa_ref        = ?,
            empresa_nombre     = ?, km_totales         = ?, km_nacionales      = ?,
            km_internacionales = ?, importe_total      = ?, importe_suplidos   = ?,
            hora_total         = ?, num_plazas         = ?, urbano             = ?,
            diurno             = ?, noct_fest          = ?, remolque           = ?,
            adjuntos           = ?, adjuntos_ref       = ?, autorizado_por     = ?,
            observaciones      = ?, enviado            = ?, cobrado            = ?,
            pagado             = ?, num_factura        = ?, finalizado         = ?,
            fecha_cobro        = ?, updated_at         = NOW()
        WHERE id = ?`

	params := []interface{}{
		timePtrOrNil(cleanInput, "Fecha"),
		timePtrOrNil(cleanInput, "HoraIni"),
		timePtrOrNil(cleanInput, "HoraFin"),
		timePtrOrNil(cleanInput, "EsperaIni"),
		timePtrOrNil(cleanInput, "EsperaFin"),
		strPtrOrNil(cleanInput, "Referencia"),
		strPtrOrNil(cleanInput, "Asalariado"),
		strPtrOrNil(cleanInput, "DNIPasajero"),
		strOrEmpty(cleanInput, "TlfPasajero"),
		strPtrOrNil(cleanInput, "Matricula"),
		strPtrOrNil(cleanInput, "Cliente"),
		strPtrOrNil(cleanInput, "Origen"),
		strPtrOrNil(cleanInput, "Parada"),
		strPtrOrNil(cleanInput, "Destino"),
		intOrZero(cleanInput, "EmpresaRef"),
		strOrEmpty(cleanInput, "EmpresaNombre"),
		floatOrZero(cleanInput, "KmTotales"),
		floatOrZero(cleanInput, "KmNacionales"),
		floatOrZero(cleanInput, "KmInternacionales"),
		floatOrZero(cleanInput, "ImporteTotal"),
		floatOrZero(cleanInput, "ImporteSuplidos"),
		floatOrZero(cleanInput, "HoraTotal"),
		intOrZero(cleanInput, "NumPlazas"),
		boolOrFalse(cleanInput, "Urbano"),
		boolOrFalse(cleanInput, "Diurno"),
		boolOrFalse(cleanInput, "NoctFest"),
		boolOrFalse(cleanInput, "Remolque"),
		boolOrFalse(cleanInput, "Adjuntos"),
		strOrEmpty(cleanInput, "AdjuntosRef"),
		strPtrOrNil(cleanInput, "AutorizadoPor"),
		strPtrOrNil(cleanInput, "Observaciones"),
		boolOrFalse(cleanInput, "Enviado"),   // ✅ AÑADIDO
		boolOrFalse(cleanInput, "Cobrado"),   // ✅ AÑADIDO
		boolOrFalse(cleanInput, "Pagado"),    // ✅ AÑADIDO
		strOrEmpty(cleanInput, "NumFactura"), // ✅ AÑADIDO
		boolOrFalse(cleanInput, "Finalizado"),
		timePtrOrNil(cleanInput, "FechaCobro"),
		id,
	}

	if !isAdmin {
		query += " AND licencia_ref = ?"
		params = append(params, licID)
	}

	// ✅ Debug habilitado para ver el SQL generado
	result := db.Debug().Exec(query, params...)

	fmt.Printf("🔍 [SQL] RowsAffected=%d | Error=%v\n\n", result.RowsAffected, result.Error)

	return result.Error
}

func SearchAlbaranesUser(c *gin.Context, db *gorm.DB) {
	licID := getUintFromContext(c, "licencia_id")
	var albaranes []models.Albaran
	query := preloadAlbaran(db.Model(&models.Albaran{})).Where("licencia_ref = ? AND estado = ?", licID, 0)
	query.Order("fecha DESC, id DESC").Find(&albaranes)
	c.JSON(http.StatusOK, gin.H{"data": albaranes})
}

func SearchAlbaranes(c *gin.Context, db *gorm.DB) {
	var albaranes []models.Albaran
	query := preloadAlbaran(db.Model(&models.Albaran{})).Where("estado = ?", 0)
	query.Order("fecha DESC, id DESC").Find(&albaranes)
	c.JSON(http.StatusOK, gin.H{"data": albaranes})
}

func DeleteAlbaran(c *gin.Context, db *gorm.DB) {
	id := c.Param("id")
	db.Model(&models.Albaran{}).Where("id = ?", id).Update("estado", 1)
	c.JSON(http.StatusOK, gin.H{"message": "✅ Borrado"})
}

func GetLicenciaInfoForUser(c *gin.Context, db *gorm.DB) {
	licID := getUintFromContext(c, "licencia_id")
	var lic models.Licencia
	if err := db.First(&lic, licID).Error; err == nil {
		c.JSON(http.StatusOK, gin.H{"licencia_id": lic.ID, "licencia_numero": lic.Licencia})
	} else {
		c.JSON(http.StatusNotFound, gin.H{"error": "No hallada"})
	}
}

// ---------------------------------------------------------------------
// SECCIÓN: HELPERS TIPADOS PARA SQL DIRECTO
// ---------------------------------------------------------------------

func timePtrOrNil(m map[string]interface{}, key string) interface{} {
	if v, ok := m[key]; ok {
		if v == nil {
			return nil
		}
		switch t := v.(type) {
		case *time.Time:
			if t == nil {
				return nil
			}
			return *t
		case time.Time:
			return t
		}
	}
	return nil
}

func strOrEmpty(m map[string]interface{}, key string) string {
	if v, ok := m[key]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}

func strPtrOrNil(m map[string]interface{}, key string) interface{} {
	if v, ok := m[key]; ok {
		if s, ok := v.(string); ok {
			if strings.TrimSpace(s) == "" {
				return nil
			}
			return s
		}
		if v == nil {
			return nil
		}
	}
	return nil
}

func floatOrZero(m map[string]interface{}, key string) float64 {
	if v, ok := m[key]; ok {
		switch n := v.(type) {
		case float64:
			return n
		case float32:
			return float64(n)
		case int:
			return float64(n)
		}
	}
	return 0
}

func intOrZero(m map[string]interface{}, key string) int {
	if v, ok := m[key]; ok {
		switch n := v.(type) {
		case float64:
			return int(n)
		case int:
			return n
		case uint:
			return int(n)
		}
	}
	return 0
}

func boolOrFalse(m map[string]interface{}, key string) bool {
	if v, ok := m[key]; ok {
		if b, ok := v.(bool); ok {
			return b
		}
	}
	return false
}

func nilOrVal(m map[string]interface{}, key string) interface{} {
	if v, ok := m[key]; ok {
		return v
	}
	return nil
}

func ExportAlbaranesPDF(c *gin.Context, db *gorm.DB)  {}
func ExportAlbaranesXLSX(c *gin.Context, db *gorm.DB) {}
