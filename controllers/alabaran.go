/**
 * ARCHIVO: controllers/albaran.go
 * DESCRIPCIÓN: Gestión integral de albaranes con mapeo tipado.
 * ACTUALIZADO: 18/11/2026 (b)
 *   - ESPERA TOTAL: tiempo_espera (HH:MM) lo introduce el taxista y ahora SÍ se
 *     guarda (faltaba en INSERT y UPDATE). Se guarda como "fecha HH:MM:00".
 *     hora_total se rellena a partir de tiempo_espera en MINUTOS enteros
 *     (ej. 01:42 -> 102), igual que lo guardaba el admin desde el 17/11/2026.
 *   18/11/2026
 *   - FIX HORAS: formatDateTimeWithOffset ya NO convierte a UTC. Las horas
 *     (hora, hora_ini, hora_fin, espera_ini, espera_fin) se guardan tal cual las
 *     introduce el taxista (hora local). Antes se guardaba 1h menos (2h en verano).
 *   17/11/2026 (b)
 *   - FIX: km_ini y km_fin se guardan (antes no estaban en INSERT ni UPDATE).
 *   - FIX: CreateAlbaran guarda cobrado, pagado, num_factura, fecha_cobro y fecha_pago.
 *   - FIX: execUpdateSQL conserva adjuntos / adjuntos_ref si no vienen en el payload.
 *   - FIX: boolOrFalse acepta 1/"1"/"true"/"on"; intOrZero acepta strings.
 *   17/11/2026
 *   - FIX: se embebe la base de zonas horarias (time/tzdata). Así Europe/Madrid
 *     carga siempre y nunca se usa el respaldo de -2h fijo (erróneo en invierno).
 *   - FIX: execUpdateSQL conserva el valor actual de importes, km, hora_total,
 *     num_plazas, empresa_ref, estados (enviado/cobrado/pagado/finalizado) y
 *     fechas de cobro/pago cuando el campo NO viene en el payload (antes se
 *     ponían a 0 / false / NULL).
 *   - FIX: execUpdateSQL ahora guarda fecha_pago (antes se ignoraba).
 *   28/05/2026
 *   - AÑADIDO: ExportAlbaranesPDF, ExportAlbaranesXLSX (admin)
 *   - AÑADIDO: ExportAlbaranesTitularPDF, ExportAlbaranesTitularXLSX (titular, JWT)
 *   - FIX: GenerateGenericXLSX → GenerateTitularesXLSX (nombre real de la función)
 *   13/05/2026
 *   - FIX: UpdateAlbaranAdmin detecta payloads de cobro/pago y hace UPDATE quirúrgico
 *     en lugar de UPDATE total (que machacaba todos los campos con NULL).
 */

package controllers

import (
	"albaranes/models"
	"albaranes/utils"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
	_ "time/tzdata" // zonas horarias embebidas: no depende del tzdata del servidor

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
	t, err := time.Parse(dateFormat, dateStr)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

// formatDateTimeWithOffset une fecha + hora y la devuelve TAL CUAL la introduce
// el usuario (hora local), como string "YYYY-MM-DD HH:MM:SS".
// Se devuelve string (no time.Time) para que ni Go ni el driver MySQL apliquen
// ninguna conversión de zona horaria al guardar.
// (Se mantiene el nombre de la función para no tocar el resto del código.)
func formatDateTimeWithOffset(dateBase, timeStr string) interface{} {
	timeStr = strings.TrimSpace(timeStr)
	if timeStr == "" {
		return nil
	}
	// Por si llega "2026-11-18T12:00" o "2026-11-18 12:00:00": quedarse con la hora
	if i := strings.LastIndexAny(timeStr, "T "); i != -1 {
		timeStr = timeStr[i+1:]
	}
	if len(timeStr) == 5 { // "12:00"
		timeStr += ":00"
	}
	if len(timeStr) > 8 { // "12:00:00.000" o "12:00:00Z"
		timeStr = timeStr[:8]
	}

	full := fmt.Sprintf("%s %s", dateBase, timeStr)
	if _, err := time.Parse("2006-01-02 15:04:05", full); err != nil {
		return nil // fecha u hora no válida
	}
	return full
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
		if len(v) > 10 {
			fechaBase = v[:10]
		} else {
			fechaBase = v
		}
	}

	timeFields := map[string]bool{
		"hora": true, "hora_ini": true, "hora_fin": true,
		"espera_ini": true, "espera_fin": true, "tiempo_espera": true,
	}

	for key, value := range input {
		if strings.ToLower(key) == "id" || key == "created_at" || key == "updated_at" {
			continue
		}

		if timeFields[key] {
			str, _ := value.(string)
			structKey := ""
			parts := strings.Split(key, "_")
			for i := range parts {
				parts[i] = strings.Title(parts[i])
			}
			structKey = strings.Join(parts, "")
			if key == "hora" {
				structKey = "Hora"
			}
			clean[structKey] = formatDateTimeWithOffset(fechaBase, str)
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
		case "cliente", "nombre_pasajero":
			structKey = "Cliente"
		case "noct_fest":
			structKey = "NoctFest"
		case "diurno":
			structKey = "Diurno"
		case "urbano":
			structKey = "Urbano"
		case "remolque":
			structKey = "Remolque"
		case "km_ini":
			structKey = "KmIni"
		case "km_fin":
			structKey = "KmFin"
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
		case "adjuntos":
			structKey = "Adjuntos"
		case "adjuntos_ref":
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
			// fecha_cobro / fecha_pago con null o "" = borrar la fecha explícitamente
			if key == "fecha_pago" || key == "fecha_cobro" {
				if str, ok := value.(string); !ok || strings.TrimSpace(str) == "" {
					clean[structKey] = nil
					continue
				}
			}
			if str, ok := value.(string); ok && str != "" {
				soloFecha := str
				if len(str) > 10 {
					soloFecha = str[:10]
				}
				if t, err := parseDatePtr(soloFecha); err == nil {
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
// sincronizarHoraTotal: si viene tiempo_espera ("YYYY-MM-DD HH:MM:SS"),
// rellena hora_total en MINUTOS enteros (01:42 -> 102).
// Si tiempo_espera viene vacío no toca hora_total (albaranes antiguos).
// ---------------------------------------------------------------------
func sincronizarHoraTotal(clean map[string]interface{}) {
	s, ok := clean["TiempoEspera"].(string)
	if !ok || len(s) < 16 {
		return
	}
	t, err := time.Parse("15:04", s[11:16])
	if err != nil {
		return
	}
	clean["HoraTotal"] = float64(t.Hour()*60 + t.Minute())
}

// ---------------------------------------------------------------------
// isPayloadQuirurgico detecta si el body es un payload de cobro/pago
// ---------------------------------------------------------------------
func isPayloadQuirurgico(input map[string]interface{}) bool {
	camposQuirurgicos := map[string]bool{
		"cobrado":      true,
		"pagado":       true,
		"enviado":      true,
		"fecha_cobro":  true,
		"fecha_pago":   true,
		"licencia_ref": true,
	}

	camposAlbaran := []string{
		"fecha", "hora_ini", "hora_fin", "origen", "destino",
		"cliente", "empresa_ref", "importe_total", "km_totales",
		"numero_albaran", "matricula", "referencia",
	}

	for _, campo := range camposAlbaran {
		if _, ok := input[campo]; ok {
			return false
		}
	}

	for key := range input {
		if !camposQuirurgicos[key] {
			return false
		}
	}
	return true
}

// ---------------------------------------------------------------------
// SECCIÓN: HELPERS DE EXPORTACIÓN
// ---------------------------------------------------------------------

func floatFromInterface(v interface{}) float64 {
	switch val := v.(type) {
	case float64:
		return val
	case float32:
		return float64(val)
	case int:
		return float64(val)
	}
	return 0
}

func estadoFromRow(row map[string]interface{}) string {
	if v, ok := row["pagado"].(bool); ok && v {
		return "Pagado"
	}
	if v, ok := row["enviado"].(bool); ok && v {
		return "Enviado"
	}
	return "Creado"
}

func fechaCorta(row map[string]interface{}) string {
	if f, ok := row["fecha"].(string); ok && len(f) >= 10 {
		return f[:10]
	}
	return ""
}

// empresaFromRow devuelve el nombre de la empresa del albarán.
// La columna empresa_nombre puede estar vacía (se borraba al editar, ver execUpdateSQL);
// en ese caso se usa la empresa precargada (EmpresaData) si viene en la fila.
func empresaFromRow(row map[string]interface{}) string {
	if s := strings.TrimSpace(strFromInterface(row["empresa_nombre"])); s != "" {
		return s
	}
	for _, k := range []string{"EmpresaData", "empresa_data", "empresaData", "empresa"} {
		m, ok := row[k].(map[string]interface{})
		if !ok {
			continue
		}
		for _, campo := range []string{"nombre", "Nombre", "empresa", "Empresa", "empresa_nombre",
			"nombre_empresa", "razon_social", "RazonSocial"} {
			if s := strings.TrimSpace(strFromInterface(m[campo])); s != "" {
				return s
			}
		}
	}
	return ""
}

// empresasDesdeBD lee de la BD el nombre de empresa de los albaranes recibidos
// (solo los de la licencia indicada). Se usa como respaldo si el navegador no lo envía.
// Pasa por JSON para reutilizar empresaFromRow sin depender de los nombres del modelo.
func empresasDesdeBD(db *gorm.DB, licID uint, data []map[string]interface{}) map[uint]string {
	res := map[uint]string{}
	var ids []uint
	for _, row := range data {
		if id := uint(floatFromInterface(row["id"])); id > 0 {
			ids = append(ids, id)
		}
	}
	if len(ids) == 0 || licID == 0 {
		return res
	}
	var albs []models.Albaran
	if err := db.Preload("EmpresaData").
		Where("id IN ? AND licencia_ref = ?", ids, licID).Find(&albs).Error; err != nil {
		return res
	}
	for _, a := range albs {
		b, err := json.Marshal(a)
		if err != nil {
			continue
		}
		var m map[string]interface{}
		if json.Unmarshal(b, &m) == nil {
			if s := empresaFromRow(m); s != "" {
				res[a.ID] = s
			}
		}
	}
	return res
}

// fechaDMY devuelve la fecha del albarán como DD/MM/YYYY (igual que la pantalla).
func fechaDMY(row map[string]interface{}) string {
	f := fechaCorta(row) // "2026-11-12"
	if t, err := time.Parse(dateFormat, f); err == nil {
		return t.Format("02/01/2006")
	}
	return f
}

// ---------------------------------------------------------------------
// SECCIÓN: EXPORTACIÓN ADMIN
// Campos: Nº Albarán, Fecha, Licencia, Empresa, Ref, Importe, Estado
// ---------------------------------------------------------------------

func ExportAlbaranesPDF(c *gin.Context, db *gorm.DB) {
	var body struct {
		Data []map[string]interface{} `json:"data"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || len(body.Data) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Sin datos"})
		return
	}

	var lista []utils.TitularData
	for _, row := range body.Data {
		lista = append(lista, utils.TitularData{
			"Nº ALBARÁN": strFromInterface(row["numero_albaran"]),
			"FECHA":      fechaDMY(row),
			"LICENCIA":   strFromInterface(row["licencia_numero"]),
			"EMPRESA":    empresaFromRow(row),
			"REF.":       strFromInterface(row["referencia"]),
			"IMPORTE":    fmt.Sprintf("%.2f", floatFromInterface(row["importe_total"])),
			"ESTADO":     estadoFromRow(row),
		})
	}

	path, err := utils.GenerateGenericPDF("ALBARANES ADMIN", lista)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"url": path})
}

func ExportAlbaranesXLSX(c *gin.Context, db *gorm.DB) {
	var body struct {
		Data []map[string]interface{} `json:"data"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || len(body.Data) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Sin datos"})
		return
	}

	var lista []utils.TitularData
	for _, row := range body.Data {
		lista = append(lista, utils.TitularData{
			"Nº ALBARÁN": strFromInterface(row["numero_albaran"]),
			"FECHA":      fechaCorta(row),
			"LICENCIA":   strFromInterface(row["licencia_numero"]),
			"EMPRESA":    empresaFromRow(row),
			"REF.":       strFromInterface(row["referencia"]),
			"IMPORTE":    fmt.Sprintf("%.2f", floatFromInterface(row["importe_total"])),
			"ESTADO":     estadoFromRow(row),
		})
	}

	path, err := utils.GenerateTitularesXLSX("ALBARANES ADMIN", lista)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"url": path})
}

// ---------------------------------------------------------------------
// SECCIÓN: EXPORTACIÓN TITULAR (JWT requerido)
// Campos: Nº Albarán, Fecha, Empresa, Ref., Conductor, Importe, Estado
// ---------------------------------------------------------------------

func ExportAlbaranesTitularPDF(c *gin.Context, db *gorm.DB) {
	var body struct {
		Data []map[string]interface{} `json:"data"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || len(body.Data) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Sin datos"})
		return
	}

	// Respaldo: nombre de empresa leído de la BD (solo albaranes de su licencia)
	empresasBD := empresasDesdeBD(db, getUintFromContext(c, "licencia_id"), body.Data)

	var lista []utils.TitularData
	for _, row := range body.Data {
		empresa := empresaFromRow(row)
		if empresa == "" {
			empresa = empresasBD[uint(floatFromInterface(row["id"]))]
		}
		// Sin columna ESTADO en el informe del titular
		lista = append(lista, utils.TitularData{
			"Nº ALBARÁN":    strFromInterface(row["numero_albaran"]),
			"FECHA":         fechaDMY(row),
			"EMPRESA":       empresa,
			"REF.":          strFromInterface(row["referencia"]),
			"CONDUCTOR":     strFromInterface(row["asalariado"]),
			"IMPORTE":       fmt.Sprintf("%.2f", floatFromInterface(row["importe_total"])),
			"OBSERVACIONES": strings.TrimSpace(strFromInterface(row["observaciones"])),
		})
	}

	path, err := utils.GenerateGenericPDF("ALBARANES TITULAR", lista)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"url": path})
}

// ExportAlbaranesTitularXLSX exporta TODOS los campos de los albaranes filtrados en pantalla.
// Del navegador solo se usan los IDs; los datos se leen de la BD y únicamente de la
// licencia del usuario (JWT), así nadie puede alterar importes ni ver otras licencias.
// Acepta {"ids":[1,2,...]} o el formato actual {"data":[{"id":1,...}, ...]}.
func ExportAlbaranesTitularXLSX(c *gin.Context, db *gorm.DB) {
	licID := getUintFromContext(c, "licencia_id")
	if licID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Sesión sin licencia"})
		return
	}

	var body struct {
		IDs  []uint                   `json:"ids"`
		Data []map[string]interface{} `json:"data"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "JSON inválido"})
		return
	}

	ids := body.IDs
	for _, row := range body.Data {
		if id := uint(floatFromInterface(row["id"])); id > 0 {
			ids = append(ids, id)
		}
	}
	if len(ids) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Sin datos"})
		return
	}

	sqlDB, err := db.DB()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// IN (...) filtra; ORDER BY FIELD(...) mantiene el mismo orden que la pantalla
	ph := strings.TrimSuffix(strings.Repeat("?,", len(ids)), ",")
	args := make([]interface{}, 0, 2*len(ids)+1)
	for _, id := range ids {
		args = append(args, id)
	}
	args = append(args, licID)
	for _, id := range ids {
		args = append(args, id)
	}
	where := " WHERE a.id IN (" + ph + ") AND a.licencia_ref = ? AND a.estado = 0" +
		" ORDER BY FIELD(a.id, " + ph + ")"

	path, err := utils.GenerateAlbaranesXLSX(sqlDB, "ALBARANES TITULAR", where, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"url": path})
}

// ---------------------------------------------------------------------
// SECCIÓN: CRUD PRINCIPAL
// ---------------------------------------------------------------------

func GetAlbaran(c *gin.Context, db *gorm.DB) {
	id := c.Param("id")
	var albaran models.Albaran
	if err := db.Preload("LicenciaData").Preload("EmpresaData").First(&albaran, id).Error; err != nil {
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

	albaran := models.Albaran{}
	cleanInput := cleanAlbaranMap(input, albaran)
	sincronizarHoraTotal(cleanInput)

	query := `INSERT INTO albaranes (
        numero_albaran, fecha, licencia_ref, empresa_ref, licencia, empresa_nombre,
        referencia, asalariado, hora, hora_ini, hora_fin, hora_total, espera_ini, 
        espera_fin, tiempo_espera, dni_pasajero, tlf_pasajero, matricula, cliente, origen, parada, 
        destino, urbano, diurno, noct_fest, km_ini, km_fin, km_totales, km_nacionales, km_internacionales,
        importe_suplidos, importe_total, autorizado_por, remolque, num_plazas, 
        observaciones, adjuntos, adjuntos_ref, finalizado, festivo,
        cobrado, pagado, num_factura, fecha_cobro, fecha_pago,
        estado, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, 0, NOW(), NOW())`

	err := db.Exec(query,
		strFromInterface(cleanInput["NumeroAlbaran"]),
		timePtrOrNil(cleanInput, "Fecha"),
		intOrZero(cleanInput, "LicenciaRef"),
		intOrZero(cleanInput, "EmpresaRef"),
		strOrEmpty(cleanInput, "Licencia"),
		strOrEmpty(cleanInput, "EmpresaNombre"),
		strPtrOrNil(cleanInput, "Referencia"),
		strPtrOrNil(cleanInput, "Asalariado"),
		cleanInput["Hora"],
		cleanInput["HoraIni"],
		cleanInput["HoraFin"],
		floatOrZero(cleanInput, "HoraTotal"),
		cleanInput["EsperaIni"],
		cleanInput["EsperaFin"],
		cleanInput["TiempoEspera"],
		strPtrOrNil(cleanInput, "DNIPasajero"),
		strOrEmpty(cleanInput, "TlfPasajero"),
		strPtrOrNil(cleanInput, "Matricula"),
		strPtrOrNil(cleanInput, "Cliente"),
		strPtrOrNil(cleanInput, "Origen"),
		strPtrOrNil(cleanInput, "Parada"),
		strPtrOrNil(cleanInput, "Destino"),
		boolOrFalse(cleanInput, "Urbano"),
		boolOrFalse(cleanInput, "Diurno"),
		boolOrFalse(cleanInput, "NoctFest"),
		floatOrZero(cleanInput, "KmIni"),
		floatOrZero(cleanInput, "KmFin"),
		floatOrZero(cleanInput, "KmTotales"),
		floatOrZero(cleanInput, "KmNacionales"),
		floatOrZero(cleanInput, "KmInternacionales"),
		floatOrZero(cleanInput, "ImporteSuplidos"),
		floatOrZero(cleanInput, "ImporteTotal"),
		strPtrOrNil(cleanInput, "AutorizadoPor"),
		boolOrFalse(cleanInput, "Remolque"),
		intOrZero(cleanInput, "NumPlazas"),
		strPtrOrNil(cleanInput, "Observaciones"),
		boolOrFalse(cleanInput, "Adjuntos"),
		strOrEmpty(cleanInput, "AdjuntosRef"),
		boolOrFalse(cleanInput, "Finalizado"),
		boolOrFalse(cleanInput, "Festivo"),
		boolOrFalse(cleanInput, "Cobrado"),
		boolOrFalse(cleanInput, "Pagado"),
		strPtrOrNil(cleanInput, "NumFactura"),
		timePtrOrNil(cleanInput, "FechaCobro"),
		timePtrOrNil(cleanInput, "FechaPago"),
	).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
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
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "JSON inválido"})
		return
	}

	if isPayloadQuirurgico(input) {
		setClauses := []string{}
		params := []interface{}{}

		if v, ok := input["cobrado"]; ok {
			setClauses = append(setClauses, "cobrado = ?")
			params = append(params, v)
		}
		if v, ok := input["pagado"]; ok {
			setClauses = append(setClauses, "pagado = ?")
			params = append(params, v)
		}
		if v, ok := input["enviado"]; ok {
			setClauses = append(setClauses, "enviado = ?")
			params = append(params, v)
		}
		if v, ok := input["fecha_cobro"].(string); ok && v != "" {
			soloFecha := v
			if len(v) > 10 {
				soloFecha = v[:10]
			}
			if t, err := parseDatePtr(soloFecha); err == nil && t != nil {
				setClauses = append(setClauses, "fecha_cobro = ?")
				params = append(params, t)
			}
		}
		if v, ok := input["fecha_pago"].(string); ok && v != "" {
			soloFecha := v
			if len(v) > 10 {
				soloFecha = v[:10]
			}
			if t, err := parseDatePtr(soloFecha); err == nil && t != nil {
				setClauses = append(setClauses, "fecha_pago = ?")
				params = append(params, t)
			}
		}

		if len(setClauses) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Sin campos para actualizar"})
			return
		}

		setClauses = append(setClauses, "updated_at = NOW()")
		params = append(params, albaran.ID)

		query := "UPDATE albaranes SET " + strings.Join(setClauses, ", ") + " WHERE id = ?"
		if err := db.Exec(query, params...).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "✅ Estado actualizado"})
		return
	}

	cleanInput := cleanAlbaranMap(input, albaran)
	sincronizarHoraTotal(cleanInput)
	if err := execUpdateSQL(db, cleanInput, albaran.ID, 0, true); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "✅ Actualizado por Admin"})
}

func UpdateAlbaranUser(c *gin.Context, db *gorm.DB) {
	id := c.Param("id")
	licID := getUintFromContext(c, "licencia_id")
	var albaran models.Albaran

	if err := db.Where("id = ? AND licencia_ref = ?", id, licID).First(&albaran).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Sin permiso"})
		return
	}

	var input map[string]interface{}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "JSON inválido"})
		return
	}

	if len(input) <= 3 && input["enviado"] != nil {
		if err := db.Model(&albaran).Updates(input).Error; err != nil {
			c.JSON(500, gin.H{"error": "Error al marcar enviado"})
			return
		}
		c.JSON(200, gin.H{"message": "✅ Albarán enviado correctamente"})
		return
	}

	delete(input, "numero_albaran")
	delete(input, "licencia_ref")
	cleanInput := cleanAlbaranMap(input, albaran)
	sincronizarHoraTotal(cleanInput)

	if err := execUpdateSQL(db, cleanInput, albaran.ID, licID, false); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al actualizar"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "✅ Albarán actualizado"})
}

func execUpdateSQL(db *gorm.DB, cleanInput map[string]interface{}, id uint, licID uint, isAdmin bool) error {
	query := `
        UPDATE albaranes SET
            fecha = ?, hora_ini = ?, hora_fin = ?, espera_ini = ?, espera_fin = ?, 
            referencia = ?, asalariado = ?, dni_pasajero = ?, tlf_pasajero = ?,
            matricula = ?, cliente = ?, origen = ?, parada = ?, destino = ?, 
            empresa_ref = IF(?, ?, empresa_ref), empresa_nombre = IF(?, ?, empresa_nombre),
            km_ini = IF(?, ?, km_ini),
            km_fin = IF(?, ?, km_fin),
            km_totales = IF(?, ?, km_totales),
            km_nacionales = IF(?, ?, km_nacionales),
            km_internacionales = IF(?, ?, km_internacionales),
            importe_total = IF(?, ?, importe_total),
            importe_suplidos = IF(?, ?, importe_suplidos),
            hora_total = IF(?, ?, hora_total),
            tiempo_espera = IF(?, ?, tiempo_espera),
            num_plazas = IF(?, ?, num_plazas),
            urbano = ?, diurno = ?, noct_fest = ?,
            remolque = ?,
            adjuntos = IF(?, ?, adjuntos),
            adjuntos_ref = IF(?, ?, adjuntos_ref),
            autorizado_por = ?,
            observaciones = ?,
            enviado = IF(?, ?, enviado),
            cobrado = IF(?, ?, cobrado),
            pagado = IF(?, ?, pagado),
            num_factura = ?,
            finalizado = IF(?, ?, finalizado),
            fecha_cobro = IF(?, ?, fecha_cobro),
            fecha_pago = IF(?, ?, fecha_pago),
            updated_at = NOW()
        WHERE id = ?`

	// "col = IF(?, ?, col)": primer parámetro = ¿vino el campo en el payload?
	// Si no vino, la columna conserva su valor actual.
	has := func(key string) bool { _, ok := cleanInput[key]; return ok }

	params := []interface{}{
		timePtrOrNil(cleanInput, "Fecha"),
		cleanInput["HoraIni"],
		cleanInput["HoraFin"],
		cleanInput["EsperaIni"],
		cleanInput["EsperaFin"],
		strPtrOrNil(cleanInput, "Referencia"),
		strPtrOrNil(cleanInput, "Asalariado"),
		strPtrOrNil(cleanInput, "DNIPasajero"),
		strOrEmpty(cleanInput, "TlfPasajero"),
		strPtrOrNil(cleanInput, "Matricula"),
		strPtrOrNil(cleanInput, "Cliente"),
		strPtrOrNil(cleanInput, "Origen"),
		strPtrOrNil(cleanInput, "Parada"),
		strPtrOrNil(cleanInput, "Destino"),
		has("EmpresaRef"), intOrZero(cleanInput, "EmpresaRef"),
		has("EmpresaNombre"), strOrEmpty(cleanInput, "EmpresaNombre"),
		has("KmIni"), floatOrZero(cleanInput, "KmIni"),
		has("KmFin"), floatOrZero(cleanInput, "KmFin"),
		has("KmTotales"), floatOrZero(cleanInput, "KmTotales"),
		has("KmNacionales"), floatOrZero(cleanInput, "KmNacionales"),
		has("KmInternacionales"), floatOrZero(cleanInput, "KmInternacionales"),
		has("ImporteTotal"), floatOrZero(cleanInput, "ImporteTotal"),
		has("ImporteSuplidos"), floatOrZero(cleanInput, "ImporteSuplidos"),
		has("HoraTotal"), floatOrZero(cleanInput, "HoraTotal"),
		has("TiempoEspera"), cleanInput["TiempoEspera"],
		has("NumPlazas"), intOrZero(cleanInput, "NumPlazas"),
		boolOrFalse(cleanInput, "Urbano"),
		boolOrFalse(cleanInput, "Diurno"),
		boolOrFalse(cleanInput, "NoctFest"),
		boolOrFalse(cleanInput, "Remolque"),
		has("Adjuntos"), boolOrFalse(cleanInput, "Adjuntos"),
		has("AdjuntosRef"), strOrEmpty(cleanInput, "AdjuntosRef"),
		strPtrOrNil(cleanInput, "AutorizadoPor"),
		strPtrOrNil(cleanInput, "Observaciones"),
		has("Enviado"), boolOrFalse(cleanInput, "Enviado"),
		has("Cobrado"), boolOrFalse(cleanInput, "Cobrado"),
		has("Pagado"), boolOrFalse(cleanInput, "Pagado"),
		strOrEmpty(cleanInput, "NumFactura"),
		has("Finalizado"), boolOrFalse(cleanInput, "Finalizado"),
		has("FechaCobro"), timePtrOrNil(cleanInput, "FechaCobro"),
		has("FechaPago"), timePtrOrNil(cleanInput, "FechaPago"),
		id,
	}

	if !isAdmin {
		query += " AND licencia_ref = ?"
		params = append(params, licID)
	}

	return db.Exec(query, params...).Error
}

func SearchAlbaranesUser(c *gin.Context, db *gorm.DB) {
	licID := getUintFromContext(c, "licencia_id")
	var albaranes []models.Albaran
	db.Preload("LicenciaData").Preload("EmpresaData").
		Where("licencia_ref = ? AND estado = ?", licID, 0).
		Order("fecha DESC, id DESC").Find(&albaranes)
	c.JSON(200, gin.H{"data": albaranes})
}

func SearchAlbaranes(c *gin.Context, db *gorm.DB) {
	var albaranes []models.Albaran
	db.Preload("LicenciaData").Preload("EmpresaData").
		Where("estado = ?", 0).Order("fecha DESC, id DESC").Find(&albaranes)
	c.JSON(200, gin.H{"data": albaranes})
}

func DeleteAlbaran(c *gin.Context, db *gorm.DB) {
	id := c.Param("id")
	db.Model(&models.Albaran{}).Where("id = ?", id).Update("estado", 1)
	c.JSON(200, gin.H{"message": "✅ Borrado"})
}

func GetLicenciaInfoForUser(c *gin.Context, db *gorm.DB) {
	licID := getUintFromContext(c, "licencia_id")
	var lic models.Licencia
	if err := db.First(&lic, licID).Error; err == nil {
		c.JSON(200, gin.H{"licencia_id": lic.ID, "licencia_numero": lic.Licencia})
	} else {
		c.JSON(404, gin.H{"error": "No hallada"})
	}
}

// ---------------------------------------------------------------------
// SECCIÓN: HELPERS TIPADOS
// ---------------------------------------------------------------------

func timePtrOrNil(m map[string]interface{}, key string) interface{} {
	if v, ok := m[key]; ok && v != nil {
		return v
	}
	return nil
}

func strOrEmpty(m map[string]interface{}, key string) string {
	if v, ok := m[key].(string); ok {
		return v
	}
	return ""
}

func strPtrOrNil(m map[string]interface{}, key string) interface{} {
	if v, ok := m[key].(string); ok && strings.TrimSpace(v) != "" {
		return v
	}
	return nil
}

func floatOrZero(m map[string]interface{}, key string) float64 {
	val, ok := m[key]
	if !ok || val == nil {
		return 0.0
	}
	switch v := val.(type) {
	case float64:
		return v
	case float32:
		return float64(v)
	case int:
		return float64(v)
	case string:
		var f float64
		v = strings.ReplaceAll(v, ",", ".")
		fmt.Sscanf(v, "%f", &f)
		return f
	}
	return 0.0
}

func intOrZero(m map[string]interface{}, key string) int {
	val, ok := m[key]
	if !ok || val == nil {
		return 0
	}
	switch v := val.(type) {
	case float64:
		return int(v)
	case int:
		return v
	case string:
		var n int
		fmt.Sscanf(strings.TrimSpace(v), "%d", &n)
		return n
	}
	return 0
}

func boolOrFalse(m map[string]interface{}, key string) bool {
	switch v := m[key].(type) {
	case bool:
		return v
	case float64:
		return v != 0
	case int:
		return v != 0
	case string:
		s := strings.ToLower(strings.TrimSpace(v))
		return s == "1" || s == "true" || s == "on"
	}
	return false
}

func strFromInterface(v interface{}) string {
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}
