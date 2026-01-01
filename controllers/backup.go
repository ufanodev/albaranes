package controllers

import (
	"albaranes/utils" // Ajusta este path según el nombre de tu módulo en go.mod
	"database/sql"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	_ "github.com/go-sql-driver/mysql"
	"github.com/joho/godotenv"
)

// DBConfig estructura para la configuración
type DBConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	DBName   string
}

// getDBConfig carga las variables de entorno en cada petición para evitar el error :0
func getDBConfig() DBConfig {
	_ = godotenv.Load() // Asegura la lectura del archivo .env
	return DBConfig{
		Host:     os.Getenv("DB_HOST"),
		Port:     os.Getenv("DB_PORT"),
		User:     os.Getenv("DB_USER"),
		Password: os.Getenv("DB_PASSWORD"),
		DBName:   os.Getenv("DB_NAME"),
	}
}

// initDBConnection para operaciones directas de SQL (Snapshots)
func initDBConnection(config DBConfig) (*sql.DB, error) {
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s",
		config.User, config.Password, config.Host, config.Port, config.DBName)
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return nil, err
	}
	return db, db.Ping()
}

// RealizarBackup maneja POST /api/v1/backup/:tipo/:accion
func RealizarBackup(c *gin.Context) {
	config := getDBConfig()
	tipo := c.Param("tipo")     // 'albaranes', 'conductores', 'todos'
	accion := c.Param("accion") // 'crear' (.sql) o 'copia' (Snapshot)

	if config.Host == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Configuración de DB no detectada en .env"})
		return
	}

	switch accion {
	case "crear":
		// 🚀 BACKUP SELECTIVO (OPCIÓN C)
		fileName, err := utils.GenerarSQLBackupNativo(
			config.Host,
			config.Port,
			config.User,
			config.Password,
			config.DBName,
			tipo,
		)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error en backup nativo: " + err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message": fmt.Sprintf("✅ Backup de %s generado con éxito (Solo esta tabla)", strings.ToUpper(tipo)),
			"file":    fileName,
		})

	case "copia":
		// 🚀 SNAPSHOT EN BASE DE DATOS (OPCIÓN 2)
		copiaName, err := executeTableSnapshot(tipo, config)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Fallo al crear snapshot: " + err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"message": fmt.Sprintf("✅ Snapshot de %s creado como: %s", strings.ToUpper(tipo), copiaName),
		})

	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "Acción no implementada"})
	}
}

// executeTableSnapshot clona la tabla físicamente dentro de MySQL
func executeTableSnapshot(tipo string, config DBConfig) (string, error) {
	if tipo == "todos" {
		return "", fmt.Errorf("el snapshot no se aplica a toda la DB")
	}

	dbSQL, err := initDBConnection(config)
	if err != nil {
		return "", err
	}
	defer dbSQL.Close()

	timestamp := time.Now().Format("20060102_150405")
	newTableName := fmt.Sprintf("%s_snapshot_%s", tipo, timestamp)

	// 1. Crear estructura idéntica
	_, err = dbSQL.Exec(fmt.Sprintf("CREATE TABLE `%s` LIKE `%s`", newTableName, tipo))
	if err != nil {
		return "", err
	}

	// 2. Copiar todos los registros
	_, err = dbSQL.Exec(fmt.Sprintf("INSERT INTO `%s` SELECT * FROM `%s`", newTableName, tipo))
	if err != nil {
		return "", err
	}

	return newTableName, nil
}

// ObtenerBackupsList lista los archivos .sql reales
func ObtenerBackupsList(c *gin.Context) {
	const backupDir = "./backups"
	files, err := os.ReadDir(backupDir)
	if err != nil {
		c.JSON(http.StatusOK, []gin.H{{"name": "Directorio de backups vacío o no encontrado."}})
		return
	}

	var backupList []gin.H
	for _, file := range files {
		if !file.IsDir() && strings.HasSuffix(file.Name(), ".sql") {
			info, _ := file.Info()

			fileType := "tabla"
			if strings.Contains(file.Name(), "todos") {
				fileType = "full"
			}

			backupList = append(backupList, gin.H{
				"name": file.Name(),
				"size": fmt.Sprintf("%.2f KB", float64(info.Size())/1024),
				"date": info.ModTime().Format("02/01/2006 15:04"),
				"type": fileType,
			})
		}
	}
	c.JSON(http.StatusOK, backupList)
}
