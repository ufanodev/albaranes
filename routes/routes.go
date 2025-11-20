package routes

import (
	"net/http"

	"albaranes/controllers"
	"albaranes/utils"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// NoCacheMiddleware desactiva la caché del navegador para las rutas de las vistas.
func NoCacheMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Cache-Control", "no-cache, no-store, max-age=0, must-revalidate, value")
		c.Header("Pragma", "no-cache")
		c.Header("Expires", "0")
		c.Next()
	}
}

// SetupRouter configura todas las rutas del servidor.
func SetupRouter(db *gorm.DB) *gin.Engine {
	r := gin.Default()

	// 1. Archivos Estáticos
	r.Static("/css", "./static/css")
	r.Static("/js", "./static/js")
	r.LoadHTMLGlob("static/*.html")

	// 2. Vistas Públicas (Frontend)
	publicViews := r.Group("/")
	publicViews.Use(NoCacheMiddleware())
	{
		publicViews.GET("/", func(c *gin.Context) { c.HTML(http.StatusOK, "login.html", nil) })
		publicViews.GET("/login", func(c *gin.Context) { c.HTML(http.StatusOK, "login.html", nil) })
		publicViews.GET("/recuerdame", func(c *gin.Context) { c.HTML(http.StatusOK, "recuerdame.html", nil) })
		publicViews.GET("/busqueda", func(c *gin.Context) { c.HTML(http.StatusOK, "busqueda.html", nil) })

		publicViews.GET("/titulares/nuevo_albaran", func(c *gin.Context) {
			c.HTML(http.StatusOK, "albaran_nuevo.html", nil)
		})
	}

	// 3. API REST (Backend Datos - Protegido por Token JWT)
	api := r.Group("/api/v1")
	{
		// Autenticación
		api.POST("/register", utils.RegisterKeyAuth(), func(c *gin.Context) { controllers.Register(c, db) })
		api.POST("/login", func(c *gin.Context) { controllers.Login(c, db) })

		// Rutas Protegidas
		protected := api.Group("/")
		protected.Use(utils.JWTAuthMiddleware())
		{
			// --- CRUD USUARIOS (Solo Admin) ---
			userGroup := protected.Group("/users")
			userGroup.Use(controllers.RequireRole("admin"))
			{
				userGroup.GET("/", func(c *gin.Context) { controllers.GetUsers(c, db) })
				userGroup.GET("/:id", func(c *gin.Context) { controllers.GetUser(c, db) })
				userGroup.PUT("/:id", func(c *gin.Context) { controllers.UpdateUser(c, db) })
				userGroup.DELETE("/:id", func(c *gin.Context) { controllers.DeleteUser(c, db) })
			}

			// --- CRUD LICENCIAS (Solo Admin) ---
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

			// --- CRUD EMPRESAS (Solo Admin) ---
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

			// --- CRUD ALBARANES (Accesible por User y Admin) ---
			albaranGroup := protected.Group("/albaranes")
			{
				albaranGroup.POST("/", func(c *gin.Context) { controllers.CreateAlbaran(c, db) })
				albaranGroup.GET("/byempresa/:id", func(c *gin.Context) { controllers.GetAlbaranesByEmpresa(c, db) })
				// ✅ NUEVA RUTA: Búsqueda general por licencia, fechas, etc.
				// Ejemplo: /api/v1/albaranes/search?licencia_ref=1&fecha_ini=2025-01-01&fecha_fin=2025-01-31
				albaranGroup.GET("/search", func(c *gin.Context) { controllers.SearchAlbaranes(c, db) })
				// Rutas existentes
				albaranGroup.GET("/", func(c *gin.Context) { controllers.GetAlbaranes(c, db) })
				albaranGroup.GET("/:id", func(c *gin.Context) { controllers.GetAlbaran(c, db) })
				albaranGroup.PUT("/:id", func(c *gin.Context) { controllers.UpdateAlbaran(c, db) })
				albaranGroup.DELETE("/:id", func(c *gin.Context) { controllers.DeleteAlbaran(c, db) })
			}
		}
	}

	// 4. Vistas de Administración (Frontend Protegido por JS)
	adminViews := r.Group("/admin")
	adminViews.Use(NoCacheMiddleware())
	{
		adminViews.GET("/", func(c *gin.Context) { c.HTML(http.StatusOK, "admin.html", nil) })
		adminViews.GET("/titulares", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_titular.html", nil) })
		adminViews.GET("/usuarios", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_usuarios.html", nil) })
		adminViews.GET("/empresas", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_empresas.html", nil) })
		adminViews.GET("/albaranes", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_busqueda.html", nil) })
		adminViews.GET("/nuevo_albaran", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_albaran_nuevo.html", nil) })
		adminViews.GET("/backup", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_backup.html", nil) })
		adminViews.GET("/conductor", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_conductor.html", nil) })
		adminViews.GET("/pago_emp", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_pago_emp.html", nil) })
		adminViews.GET("/pago_tit", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_pago_tit.html", nil) })
	}

	return r
}
