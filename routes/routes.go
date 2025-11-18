package routes

import (
	"net/http"

	"albaranes/controllers"
	"albaranes/utils"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// SetupRouter configura todas las rutas del servidor.
func SetupRouter(db *gorm.DB) *gin.Engine {
	r := gin.Default()

	// 1. Configuración de archivos estáticos y plantillas del Frontend
	// Se asume que la carpeta de archivos estáticos se llama 'web' o 'static'
	r.Static("/css", "./web/css")
	r.Static("/js", "./web/js")
	r.LoadHTMLGlob("web/*.html")

	// --- Rutas del Frontend ---

	r.GET("/", func(c *gin.Context) { c.HTML(http.StatusOK, "login.html", nil) })
	r.GET("/login", func(c *gin.Context) { c.HTML(http.StatusOK, "login.html", nil) })
	r.GET("/recuerdame", func(c *gin.Context) { c.HTML(http.StatusOK, "recuerdame.html", nil) })
	r.GET("/busqueda", func(c *gin.Context) { c.HTML(http.StatusOK, "busqueda.html", nil) })

	// --- Rutas de la API ---
	api := r.Group("/api/v1")
	{
		// ➡️ Rutas Públicas (Auth)
		api.POST("/register", utils.RegisterKeyAuth(), func(c *gin.Context) {
			controllers.Register(c, db)
		})
		api.POST("/login", func(c *gin.Context) {
			controllers.Login(c, db)
		})

		// 🔒 Rutas Protegidas (Nivel Base: Requiere JWT Válido)
		protected := api.Group("/")
		protected.Use(utils.JWTAuthMiddleware()) // Nivel 1: Token válido (user o admin)
		{
			// --- Rutas CRUD de USUARIOS (Restricción a Rol Admin) ---
			userGroup := protected.Group("/users")

			// APLICA LA RESTRICCIÓN: Solo permite el paso si el rol es 'admin'
			userGroup.Use(controllers.RequireRole("admin"))
			{
				// CRUD: Leer
				userGroup.GET("/", func(c *gin.Context) { controllers.GetUsers(c, db) })
				userGroup.GET("/:id", func(c *gin.Context) { controllers.GetUser(c, db) })

				// CRUD: Actualizar (PUT) - COMPLETADO
				userGroup.PUT("/:id", func(c *gin.Context) { controllers.UpdateUser(c, db) })

				// CRUD: Eliminar/Desactivar (DELETE) - COMPLETADO
				userGroup.DELETE("/:id", func(c *gin.Context) { controllers.DeleteUser(c, db) })
			}

			// --- Rutas CRUD de LICENCIAS (Se añadirán aquí) ---
		}
	}

	return r
}
