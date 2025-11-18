package main

import (
	"albaranes/config"
	"albaranes/routes"
	"log"

	// Necesario para godotenv
	"github.com/joho/godotenv" // Importa la librería
)

func main() {
	// 1. Cargar archivo .env
	// Esto hace que JWT_SECRET_KEY y las variables de DB estén disponibles
	if err := godotenv.Load(); err != nil {
		// No debe ser fatal si el archivo no existe, pero sí es un error crítico
		log.Fatalf("🛑 [FATAL] Error cargando el archivo .env: %v", err)
	}

	// DEBUG: Confirma que la clave JWT se cargó (Opcional)
	log.Println("🔑 [Security] JWT Secret Key cargada con éxito.")

	// 2. Inicializar la DB
	db, err := config.ConnectDatabase()
	if err != nil {
		log.Fatalf("🛑 [FATAL] Error al iniciar la aplicación: %v", err)
	}

	// 3. Configurar el router
	r := routes.SetupRouter(db)

	// 4. Iniciar el servidor
	log.Println("🚦 [Server] Servidor Gin iniciado y escuchando.")
	log.Println("🌐 [Server] Accede a la API en http://localhost:8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatalf("🛑 [FATAL] Error al iniciar el servidor: %v", err)
	}
}
