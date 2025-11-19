package routes

import (
	"net/http"

	"albaranes/controllers"
	"albaranes/utils"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// NoCacheMiddleware desactiva la caché del navegador
func NoCacheMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Cache-Control", "no-cache, no-store, max-age=0, must-revalidate, value")
		c.Header("Pragma", "no-cache")
		c.Header("Expires", "0")
		c.Next()
	}
}

// SetupRouter configura todas las rutas del servidor
func SetupRouter(db *gorm.DB) *gin.Engine {
	r := gin.Default()

	// Configuración de archivos estáticos - SOLO desde static/
	r.Static("/css", "./static/css")
	r.Static("/js", "./static/js")
	r.Static("/Imagenes", "./static/Imagenes")

	// Cargar plantillas HTML SOLO desde static/
	r.LoadHTMLGlob("static/*.html")

	// --- Rutas del Frontend Públicas ---
	publicViews := r.Group("/")
	publicViews.Use(NoCacheMiddleware())
	{
		publicViews.GET("/", func(c *gin.Context) {
			c.HTML(http.StatusOK, "login.html", nil)
		})
		publicViews.GET("/login", func(c *gin.Context) {
			c.HTML(http.StatusOK, "login.html", nil)
		})
		publicViews.GET("/recuerdame", func(c *gin.Context) {
			c.HTML(http.StatusOK, "recuerdame.html", nil)
		})
		publicViews.GET("/busqueda", func(c *gin.Context) {
			c.HTML(http.StatusOK, "busqueda.html", nil)
		})
	}

	// --- Rutas de la API ---
	api := r.Group("/api/v1")
	{
		// Rutas Públicas (Auth)
		api.POST("/register", utils.RegisterKeyAuth(), func(c *gin.Context) {
			controllers.Register(c, db)
		})
		api.POST("/login", func(c *gin.Context) {
			controllers.Login(c, db)
		})

		// 🔒 Rutas Protegidas por JWT
		protected := api.Group("/")
		protected.Use(utils.JWTAuthMiddleware())
		{
			// --- Rutas CRUD de USUARIOS (Solo Admin) ---
			userGroup := protected.Group("/users")
			userGroup.Use(controllers.RequireRole("admin"))
			{
				userGroup.GET("/", func(c *gin.Context) { controllers.GetUsers(c, db) })
				userGroup.GET("/:id", func(c *gin.Context) { controllers.GetUser(c, db) })
				userGroup.PUT("/:id", func(c *gin.Context) { controllers.UpdateUser(c, db) })
				userGroup.DELETE("/:id", func(c *gin.Context) { controllers.DeleteUser(c, db) })
			}

			// --- Rutas CRUD de LICENCIAS (Solo Admin) ---
			licenciaGroup := protected.Group("/licencias")
			licenciaGroup.Use(controllers.RequireRole("admin"))
			{
				licenciaGroup.POST("/", func(c *gin.Context) { controllers.CreateLicencia(c, db) })
				licenciaGroup.GET("/search", func(c *gin.Context) { controllers.SearchLicencias(c, db) })
				licenciaGroup.GET("/", func(c *gin.Context) { controllers.GetLicencias(c, db) })
				licenciaGroup.GET("/:id", func(c *gin.Context) { controllers.GetLicencia(c, db) })
				licenciaGroup.PUT("/:id", func(c *gin.Context) { controllers.UpdateLicencia(c, db) })
				licenciaGroup.DELETE("/:id", func(c *gin.Context) { controllers.DeleteLicencia(c, db) })
			}

			// --- Rutas CRUD de EMPRESAS (Solo Admin) ---
			empresaGroup := protected.Group("/empresas")
			empresaGroup.Use(controllers.RequireRole("admin"))
			{
				empresaGroup.POST("/", func(c *gin.Context) { controllers.CreateEmpresa(c, db) })
				empresaGroup.GET("/", func(c *gin.Context) { controllers.GetEmpresas(c, db) })
				empresaGroup.GET("/nif/:nif", func(c *gin.Context) { controllers.SearchEmpresaByNIF(c, db) })
				empresaGroup.GET("/search", func(c *gin.Context) { controllers.SearchEmpresasByNombre(c, db) })
				empresaGroup.GET("/:id", func(c *gin.Context) { controllers.GetEmpresa(c, db) })
				empresaGroup.PUT("/:id", func(c *gin.Context) { controllers.UpdateEmpresa(c, db) })
				empresaGroup.DELETE("/:id", func(c *gin.Context) { controllers.DeleteEmpresa(c, db) })
			}

		}
	}

	// 🔒 RUTAS DE ADMINISTRACIÓN (Frontend) - SOLO desde static/
	adminViews := r.Group("/admin")
	adminViews.Use(NoCacheMiddleware())
	{
		// Panel principal de administración
		adminViews.GET("/", func(c *gin.Context) {
			c.HTML(http.StatusOK, "admin.html", nil)
		})

		// Sub-rutas de administración
		adminViews.GET("/titulares", func(c *gin.Context) {
			c.HTML(http.StatusOK, "admin_titular.html", nil)
		})
		adminViews.GET("/usuarios", func(c *gin.Context) {
			c.HTML(http.StatusOK, "admin_usuarios.html", nil)
		})
		adminViews.GET("/empresas", func(c *gin.Context) {
			c.HTML(http.StatusOK, "admin_empresas.html", nil)
		})
		adminViews.GET("/backup", func(c *gin.Context) {
			c.HTML(http.StatusOK, "admin_backup.html", nil)
		})
		adminViews.GET("/conductor", func(c *gin.Context) {
			c.HTML(http.StatusOK, "admin_conductor.html", nil)
		})
		adminViews.GET("/pago_emp", func(c *gin.Context) {
			c.HTML(http.StatusOK, "admin_pago_emp.html", nil)
		})
		adminViews.GET("/pago_tit", func(c *gin.Context) {
			c.HTML(http.StatusOK, "admin_pago_tit.html", nil)
		})
		adminViews.GET("/albaran", func(c *gin.Context) {
			c.HTML(http.StatusOK, "admin_albaran.html", nil)
		})
	}

	// Manejo de rutas no encontradas
	r.NoRoute(func(c *gin.Context) {
		c.JSON(404, gin.H{"error": "Ruta no encontrada"})
	})

	return r
}
