package config

import (
	"fmt"
	"log"
	"os"

	"albaranes/models"

	"github.com/joho/godotenv"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

// ConnectDatabase inicializa la conexión a MySQL, carga .env y realiza la migración.
func ConnectDatabase() (*gorm.DB, error) {
	// ⚙️ Cargar variables de entorno desde .env (Se hace aquí para que estén disponibles para toda la app)
	log.Println("⚙️ [Config] Intentando cargar variables de entorno desde .env...")
	err := godotenv.Load()
	if err != nil {
		log.Println("⚠️ [Config] Advertencia: No se encontró archivo .env. Usando variables de entorno del sistema.")
	}

	dbUser := os.Getenv("DB_USER")
	dbPass := os.Getenv("DB_PASSWORD")
	dbHost := os.Getenv("DB_HOST")
	dbPort := os.Getenv("DB_PORT")
	dbName := os.Getenv("DB_NAME")

	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		dbUser, dbPass, dbHost, dbPort, dbName)

	// 🔗 Conectar a la base de datos
	log.Printf("🔗 [DB] Conectando a MySQL en %s:%s...", dbHost, dbPort)
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		return nil, fmt.Errorf("❌ [DB] Falló la conexión a la base de datos: %w", err)
	}

	log.Println("✅ [DB] Conexión a MySQL exitosa.")

	// 🛠️ AutoMigrate de todos los modelos
	log.Println("🛠️ [DB] Ejecutando GORM AutoMigrate para crear/actualizar tablas...")
	err = db.AutoMigrate(
		&models.User{},
		&models.Licencia{},
		&models.Empresa{},
		&models.Albaran{},
	)
	if err != nil {
		return nil, fmt.Errorf("❌ [DB] Falló AutoMigrate: %w", err)
	}

	log.Println("✨ [DB] Migraciones de GORM ejecutadas exitosamente.")

	return db, nil
}

// GetRegisterKeys recupera las credenciales de la llave de registro del .env
// Usada por el middleware RegisterKeyAuth en utils/security.go
func GetRegisterKeys() (string, string) {
	// Las variables ya fueron cargadas por ConnectDatabase()
	user := os.Getenv("REGISTER_KEY_USER")
	pass := os.Getenv("REGISTER_KEY_PASS")

	if user == "" || pass == "" {
		log.Println("⚠️ [Config] Advertencia: Llave de registro no configurada (REGISTER_KEY_USER o REGISTER_KEY_PASS vacías).")
	}

	return user, pass
}
