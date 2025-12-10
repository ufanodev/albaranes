package main

import (
	"albaranes/config"
	"albaranes/routes"
	"albaranes/utils"
	"log"

	"github.com/joho/godotenv"
	"gorm.io/gorm"
)

// Definición mínima del modelo User para el script de inicialización.
// IMPORTANTE: Esta definición DEBE coincidir con el modelo en models/user.go
type User struct {
	ID       uint   `gorm:"primaryKey"`
	Usuario  string `gorm:"column:usuario"` // Nombre de usuario
	Email    string `gorm:"uniqueIndex"`
	Password string
	Role     string `gorm:"column:role"`
	Activo   bool   `gorm:"column:activo"`
}

// TableName define explícitamente el nombre de la tabla para GORM
// Esto es necesario si el nombre de tu struct (User) no coincide
// con el nombre plural de la tabla que usas (usuarios).
func (User) TableName() string {
	return "usuarios" // <--- ¡Aseguramos que apunta a la tabla correcta!
}

// createInitialAdmin verifica si existe un usuario con rol 'admin'. Si no, lo crea.
func createInitialAdmin(db *gorm.DB) {
	const defaultEmail = "ufano.developer@gmail.com"
	const defaultUsername = "ufano"
	const defaultPassword = "ufanodev4218!"
	const defaultRole = "admin"

	var count int64
	// Usa el struct User (que ya apunta a la tabla "usuarios")
	db.Model(&User{}).Where("role = ?", defaultRole).Count(&count)

	if count == 0 {
		log.Println("🟡 [INIT] No existe ningún administrador. Creando usuario admin por defecto...")

		hashed, err := utils.GenerateHashPassword(defaultPassword)
		if err != nil {
			log.Fatalf("🛑 [FATAL] Error generando hash de contraseña del admin: %v", err)
		}

		admin := User{
			Usuario:  defaultUsername,
			Email:    defaultEmail,
			Password: hashed,
			Role:     defaultRole,
			Activo:   true,
		}

		// GORM usará la función TableName() para saber dónde insertar.
		if err := db.Create(&admin).Error; err != nil {
			log.Fatalf("🛑 [FATAL] Error creando el admin inicial: %v", err)
		}

		log.Printf("✅ [INIT] Administrador inicial creado con éxito. Usuario: %s, Email: %s", defaultUsername, defaultEmail)
	} else {
		log.Println("✔️ [INIT] Ya existe al menos un administrador. No se creó uno nuevo.")
	}
}

func main() {
	// 1. Cargar archivo .env
	if err := godotenv.Load(); err != nil {
		log.Fatalf("🛑 [FATAL] Error cargando el archivo .env: %v", err)
	}

	log.Println("🔑 [Security] JWT Secret Key cargada con éxito.")

	// 2. Inicializar la DB
	db, err := config.ConnectDatabase()
	if err != nil {
		log.Fatalf("🛑 [FATAL] Error al iniciar la aplicación: %v", err)
	}

	// 2.5. Crear el administrador inicial si no existe
	createInitialAdmin(db)

	// 3. Configurar el router
	r := routes.SetupRouter(db)

	// 4. Iniciar el servidor
	log.Println("🚦 [Server] Servidor Gin iniciado y escuchando.")
	log.Println("🌐 [Server] Accede a la API en http://localhost:8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatalf("🛑 [FATAL] Error al iniciar el servidor: %v", err)
	}
}
