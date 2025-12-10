package controllers

import (
	"database/sql"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	_ "github.com/go-sql-driver/mysql" // Driver de MySQL
)

// DBConfig es la estructura para la configuración de la base de datos
// NOTA: Esta configuración DEBE ser cargada por tu 'main.go' desde .env e inyectada.
type DBConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	DBName   string
}

// AppDBConfig simula la carga de la configuración de la DB desde las variables de entorno.
var AppDBConfig = DBConfig{
	Host:     os.Getenv("DB_HOST"),
	Port:     os.Getenv("DB_PORT"),
	User:     os.Getenv("DB_USER"),
	Password: os.Getenv("DB_PASSWORD"),
	DBName:   os.Getenv("DB_NAME"),
}

// initDBConnection establece la conexión directa a la base de datos MySQL.
func initDBConnection() (*sql.DB, error) {

	if AppDBConfig.User == "" {
		return nil, fmt.Errorf("la configuración de la base de datos no está disponible. Asegúrese de cargar .env y asignar AppDBConfig")
	}

	// DSN (Data Source Name)
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s",
		AppDBConfig.User, AppDBConfig.Password, AppDBConfig.Host, AppDBConfig.Port, AppDBConfig.DBName)

	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return nil, fmt.Errorf("error al abrir la conexión a la base de datos: %w", err)
	}

	// Verificar la conexión
	err = db.Ping()
	if err != nil {
		return nil, fmt.Errorf("error al conectar con la base de datos: %w", err)
	}
	return db, nil
}

// RealizarBackup maneja la solicitud HTTP para crear un backup (.sql) o una copia de tabla.
// Ruta: POST /api/v1/backup/:tipo/:accion
func RealizarBackup(c *gin.Context) {

	// Se asume que el middleware RequireRole("admin") ya está protegiendo esta ruta.
	if !IsUserAdmin(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Acceso denegado. Solo administradores pueden realizar esta acción."})
		return
	}

	tipo := c.Param("tipo")     // Tabla: albaranes, conductores, etc., o "todos"
	accion := c.Param("accion") // Acción: "crear" (backup .sql), "copia" (tabla espejo), "cargar" (restaurar)

	// Mapeo de nombres de tablas. Solo las claves son nombres válidos para la copia/creación individual.
	tableNames := map[string]string{
		"albaranes":   "albaranes",
		"conductores": "conductores",
		"empresas":    "empresas",
		"licencias":   "licencias",
		"usuarios":    "usuarios",
	}

	// 1. Validaciones de entrada
	if accion != "crear" && accion != "copia" && accion != "cargar" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Acción no válida. Use 'crear', 'copia' o 'cargar'."})
		return
	}

	if tipo != "todos" && tableNames[tipo] == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tipo de tabla no reconocido o no listado para backup."})
		return
	}

	// La copia de tabla no se aplica a "todos"
	if accion == "copia" && tipo == "todos" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "La acción 'copia' (tabla espejo) no se aplica a la base de datos completa ('todos')."})
		return
	}

	// 2. Ejecutar la acción
	switch accion {
	case "crear":
		// Operación de backup (.sql) - Usamos la simulación
		returnCode, fileName, err := simulateSQLDump(tipo)
		if err != nil {
			c.JSON(returnCode, gin.H{"error": "Error al crear el backup: " + err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"message": fmt.Sprintf("✅ Backup de **%s** creado. Archivo: %s", strings.ToUpper(tipo), fileName),
			"file":    fileName,
		})

	case "copia":
		// Conexión directa a la DB para comandos SQL (CREATE TABLE LIKE / INSERT INTO)
		dbSQL, err := initDBConnection()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al conectar con la DB: " + err.Error()})
			return
		}
		defer dbSQL.Close()

		originalTableName := tableNames[tipo]
		copiaTableName := fmt.Sprintf("%s_copia_%s", originalTableName, time.Now().Format("20060102_150405"))

		// 1. Crear la tabla con la misma estructura
		createQuery := fmt.Sprintf("CREATE TABLE `%s` LIKE `%s`", copiaTableName, originalTableName)
		_, err = dbSQL.Exec(createQuery)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al crear la estructura de la copia de tabla: " + err.Error()})
			return
		}

		// 2. Copiar los datos
		insertQuery := fmt.Sprintf("INSERT INTO `%s` SELECT * FROM `%s`", copiaTableName, originalTableName)
		res, err := dbSQL.Exec(insertQuery)

		if err != nil {
			// Devolvemos 206 Partial Content (Advertencia) si la estructura se creó pero falló la inserción.
			c.JSON(http.StatusPartialContent, gin.H{"message": fmt.Sprintf("✅ Copia de la estructura **%s** creada. ⚠️ Error al copiar datos: %s", originalTableName, err.Error()), "table": copiaTableName})
			return
		}

		rowsAffected, _ := res.RowsAffected()

		c.JSON(http.StatusOK, gin.H{
			"message": fmt.Sprintf("✅ Copia de tabla **%s** creada exitosamente. Nombre: **%s** (Filas copiadas: %d)", strings.ToUpper(tipo), copiaTableName, rowsAffected),
			"table":   copiaTableName,
		})

	case "cargar":
		// Simulación de restauración
		c.JSON(http.StatusAccepted, gin.H{"message": fmt.Sprintf("⚠️ Simulación: Proceso de RESTAURACIÓN de la tabla **%s** iniciado. Requiere selección de archivo.", strings.ToUpper(tipo))})
	}
}

// simulateSQLDump simula la creación de un archivo de backup en el disco (./backups/).
// En un entorno real, aquí se usaría el comando 'mysqldump'.
func simulateSQLDump(tipo string) (int, string, error) {
	const backupDir = "./backups"

	// 1. Crear el directorio 'backups' si no existe
	if _, err := os.Stat(backupDir); os.IsNotExist(err) {
		if err := os.Mkdir(backupDir, 0755); err != nil {
			// Error crítico si no puede crear el directorio (permisos/ruta)
			return http.StatusInternalServerError, "",
				fmt.Errorf("error crítico al crear el directorio %s. Causa: %w (Verifique permisos o la ruta de ejecución de Go)", backupDir, err)
		}
	}

	// 2. Definir nombre de archivo y contenido
	timestamp := time.Now().Format("20060102_150405")
	var fileName string
	var content string

	if tipo == "todos" {
		fileName = fmt.Sprintf("full_db_backup_%s.sql", timestamp)
		content = fmt.Sprintf("-- Backup COMPLETO de DB: %s\n-- Fecha: %s\n-- Contiene todas las tablas\n", AppDBConfig.DBName, time.Now().String())
	} else {
		fileName = fmt.Sprintf("%s_backup_%s.sql", tipo, timestamp)
		content = fmt.Sprintf("-- Backup de la tabla %s\n-- Fecha: %s\n-- Contenido simulado de CREATE TABLE y INSERT INTO\n", tipo, time.Now().String())
	}

	// 3. Escribir el archivo
	filePath := backupDir + "/" + fileName
	err := os.WriteFile(filePath, []byte(content), 0644)
	if err != nil {
		// Error al escribir el archivo
		return http.StatusInternalServerError, "",
			fmt.Errorf("error al escribir el archivo %s. Causa: %w (Verifique la ruta y permisos)", filePath, err)
	}

	return http.StatusOK, fileName, nil
}

// ObtenerBackupsList lista los archivos .sql en el directorio 'backups'.
// Ruta: GET /api/v1/backup/list
func ObtenerBackupsList(c *gin.Context) {

	// 1. Leer el directorio 'backups'
	files, err := os.ReadDir("./backups")
	if err != nil {
		if os.IsNotExist(err) {
			c.JSON(http.StatusOK, []gin.H{
				{"name": "No se encontró el directorio './backups' o está vacío."},
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al leer el directorio de backups: " + err.Error()})
		return
	}

	var backupList []gin.H
	for _, file := range files {
		if !file.IsDir() && strings.HasSuffix(file.Name(), ".sql") {
			info, err := file.Info()
			if err != nil {
				continue // Saltar si no podemos obtener la información
			}

			// 2. Determinar tipo y tabla de referencia
			fileType := "tabla"
			if strings.Contains(file.Name(), "full_db_backup") {
				fileType = "full"
			}

			// Intenta inferir la tabla (ej: "albaranes_backup...")
			parts := strings.Split(file.Name(), "_")
			tableRef := parts[0]

			backupList = append(backupList, gin.H{
				"name":     file.Name(),
				"size":     fmt.Sprintf("%.2f KB", float64(info.Size())/1024),
				"date":     info.ModTime().Format("2006-01-02 15:04"),
				"type":     fileType,
				"tableRef": tableRef,
			})
		}
	}

	// Si la lista está vacía, devuelve un mensaje explícito
	if len(backupList) == 0 {
		c.JSON(http.StatusOK, []gin.H{
			{"name": "No se encontraron archivos de backup (.sql) en el directorio `./backups`."},
		})
		return
	}

	c.JSON(http.StatusOK, backupList)
}

// IsUserAdmin es una función de simulación o stub.
// En un proyecto real, DEBE obtener el rol del usuario del contexto (JWT, sesión)
// y verificar que sea "admin".
func IsUserAdmin(c *gin.Context) bool {
	// Asumimos que el middleware RequireRole("admin") ya ha validado que es un usuario con permisos.
	return true
}
