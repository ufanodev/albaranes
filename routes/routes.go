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
	r.Static("/css", "./web/css")
	r.Static("/js", "./web/js")
	r.LoadHTMLGlob("web/*.html")

	// --- Rutas del Frontend Públicas ---

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
			userGroup.Use(controllers.RequireRole("admin"))
			{
				userGroup.GET("/", func(c *gin.Context) { controllers.GetUsers(c, db) })
				userGroup.GET("/:id", func(c *gin.Context) { controllers.GetUser(c, db) })
				userGroup.PUT("/:id", func(c *gin.Context) { controllers.UpdateUser(c, db) })
				userGroup.DELETE("/:id", func(c *gin.Context) { controllers.DeleteUser(c, db) })
			}

			// --- Rutas CRUD de LICENCIAS (Restricción a Rol Admin) ---
			licenciaGroup := protected.Group("/licencias")
			licenciaGroup.Use(controllers.RequireRole("admin"))
			{
				licenciaGroup.POST("/", func(c *gin.Context) { controllers.CreateLicencia(c, db) })

				// La ruta /search debe ir antes de /:id
				licenciaGroup.GET("/search", func(c *gin.Context) { controllers.SearchLicencias(c, db) })

				licenciaGroup.GET("/", func(c *gin.Context) { controllers.GetLicencias(c, db) })
				licenciaGroup.GET("/:id", func(c *gin.Context) { controllers.GetLicencia(c, db) })

				licenciaGroup.PUT("/:id", func(c *gin.Context) { controllers.UpdateLicencia(c, db) })
				licenciaGroup.DELETE("/:id", func(c *gin.Context) { controllers.DeleteLicencia(c, db) })
			}

			// 🏢 NUEVAS RUTAS CRUD y BÚSQUEDA de EMPRESAS
			empresaGroup := protected.Group("/empresas")
			empresaGroup.Use(controllers.RequireRole("admin"))
			{
				// CRUD: Crear y Listar
				empresaGroup.POST("/", func(c *gin.Context) { controllers.CreateEmpresa(c, db) })
				empresaGroup.GET("/", func(c *gin.Context) { controllers.GetEmpresas(c, db) })

				// BÚSQUEDA por NIF (Debe ir antes de GET /:id)
				empresaGroup.GET("/nif/:nif", func(c *gin.Context) { controllers.SearchEmpresaByNIF(c, db) })

				// BÚSQUEDA por Nombre (Debe ir antes de GET /:id)
				empresaGroup.GET("/search", func(c *gin.Context) { controllers.SearchEmpresasByNombre(c, db) })

				// CRUD: Ver Detalle (por ID), Actualizar, Eliminar
				empresaGroup.GET("/:id", func(c *gin.Context) { controllers.GetEmpresa(c, db) })
				empresaGroup.PUT("/:id", func(c *gin.Context) { controllers.UpdateEmpresa(c, db) })
				empresaGroup.DELETE("/:id", func(c *gin.Context) { controllers.DeleteEmpresa(c, db) })
			}
		}
	}

	// 🔒 GRUPO: Rutas del Frontend Protegidas (Requieren JWT y Rol Admin)
	adminViews := r.Group("/admin")
	adminViews.Use(utils.JWTAuthMiddleware(), controllers.RequireRole("admin"))
	{
		// Vistas de Administración
		adminViews.GET("/titulares", func(c *gin.Context) {
			c.HTML(http.StatusOK, "admin_titular.html", nil)
		})
		adminViews.GET("/usuarios", func(c *gin.Context) {
			c.HTML(http.StatusOK, "admin_usuarios.html", nil)
		})

		// 🆕 NUEVA VISTA DE EMPRESAS AÑADIDA
		adminViews.GET("/empresas", func(c *gin.Context) {
			c.HTML(http.StatusOK, "admin_empresas.html", nil)
		})
	}

	return r
}
