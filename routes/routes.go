package routes

import (
	"net/http"
	"strings"

	"albaranes/controllers"
	"albaranes/utils"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// NoCacheMiddleware desactiva la caché del navegador.
func NoCacheMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Cache-Control", "no-cache, no-store, max-age=0, must-revalidate, value")
		c.Header("Pragma", "no-cache")
		c.Header("Expires", "0")
		c.Next()
	}
}

// AuthRedirectMiddleware asegura que solo las rutas protegidas requieran una sesión válida.
func AuthRedirectMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {

		// 1. Verificar si la sesión es VÁLIDA. (Limpia la cookie si está expirada/inválida)
		isSessionValid := utils.CheckSessionForView(c)

		// Rutas que requieren una sesión válida
		isProtectedView := strings.HasPrefix(c.Request.URL.Path, "/admin") ||
			strings.HasPrefix(c.Request.URL.Path, "/titulares")

		// A. Si NO hay sesión válida Y se accede a una vista protegida, redirigir al login.
		if !isSessionValid && isProtectedView {
			c.Redirect(http.StatusTemporaryRedirect, "/login")
			c.Abort()
			return
		}

		c.Next()
	}
}

// SetupRouter configura todas las rutas del servidor.
func SetupRouter(db *gorm.DB) *gin.Engine {
	r := gin.Default()

	// 1. Archivos Estáticos y plantillas
	r.Static("/css", "./static/css")
	r.Static("/js", "./static/js")
	r.Static("/Imagenes", "./static/Imagenes")
	r.LoadHTMLGlob("static/*.html")

	// Grupo de Vistas (Frontend): Aplica middlewares de NoCache y redirección de autenticación.
	viewGroup := r.Group("/")
	viewGroup.Use(NoCacheMiddleware(), AuthRedirectMiddleware())

	// 2. Vistas Públicas y Protegidas (Frontend)
	{
		viewGroup.GET("/", func(c *gin.Context) { c.HTML(http.StatusOK, "login.html", nil) })
		viewGroup.GET("/login", func(c *gin.Context) { c.HTML(http.StatusOK, "login.html", nil) })
		viewGroup.GET("/recuerdame", func(c *gin.Context) { c.HTML(http.StatusOK, "recuerdame.html", nil) })
		viewGroup.GET("/busqueda", func(c *gin.Context) { c.HTML(http.StatusOK, "busqueda.html", nil) })

		viewGroup.GET("/titulares", func(c *gin.Context) { c.HTML(http.StatusOK, "busqueda.html", nil) })
		viewGroup.GET("/titulares/nuevo_albaran", func(c *gin.Context) { c.HTML(http.StatusOK, "albaran_nuevo.html", nil) })
		viewGroup.GET("/titulares/enviados", func(c *gin.Context) { c.HTML(http.StatusOK, "albaran_enviado.html", nil) })
		viewGroup.GET("/titulares/pendientes", func(c *gin.Context) { c.HTML(http.StatusOK, "albaran_pendiente.html", nil) })
		viewGroup.GET("/titulares/update/:id", func(c *gin.Context) { c.HTML(http.StatusOK, "albaran_update.html", nil) })
		viewGroup.GET("/titulares/view/:id", func(c *gin.Context) { c.HTML(http.StatusOK, "albaran_view.html", nil) })

		// ✅ RUTA AÑADIDA: Maneja la vista del albarán por su ID para /albaranes/view/45
		viewGroup.GET("/albaranes/view/:id", func(c *gin.Context) { c.HTML(http.StatusOK, "albaran_view.html", nil) })

		adminViews := viewGroup.Group("/admin")
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
	}

	// 3. API REST (Backend Datos)
	api := r.Group("/api/v1")
	{
		api.POST("/register", utils.RegisterKeyAuth(), func(c *gin.Context) { controllers.Register(c, db) })
		api.POST("/login", func(c *gin.Context) { controllers.Login(c, db) })

		api.POST("/logout", func(c *gin.Context) {
			utils.ClearAndSetAuthCookie(c)
			c.JSON(http.StatusOK, gin.H{"message": "Sesión cerrada correctamente"})
		})

		protected := api.Group("/")
		protected.Use(utils.JWTAuthMiddleware())
		{
			// --- Rutas de Identidad y Mapeo ---
			protected.GET("/user/licencia_ref", func(c *gin.Context) { controllers.GetLicenciaRefFromSession(c, db) })

			// ✅ LISTADO DE EMPRESAS (Accesible por cualquier usuario logueado)
			protected.GET("/empresas", func(c *gin.Context) { controllers.GetEmpresas(c, db) })
			protected.GET("/empresas/", func(c *gin.Context) { controllers.GetEmpresas(c, db) })

			// ✅ LISTADO DE CONDUCTORES (NUEVO: Accesible por cualquier usuario logueado)
			protected.GET("/conductores", func(c *gin.Context) { controllers.GetConductores(c, db) })
			protected.GET("/conductores/", func(c *gin.Context) { controllers.GetConductores(c, db) })

			// --- CRUD CONDUCTORES (REQUIERE ADMIN) ---
			conductorGroup := protected.Group("/conductores")
			conductorGroup.Use(controllers.RequireRole("admin"))
			{
				conductorGroup.POST("/", func(c *gin.Context) { controllers.CreateConductor(c, db) })
				// GET LISTADO MOVIDO ARRIBA
				conductorGroup.GET("/:licencia", func(c *gin.Context) { controllers.GetConductor(c, db) })
				conductorGroup.PUT("/:licencia", func(c *gin.Context) { controllers.UpdateConductor(c, db) })
				conductorGroup.DELETE("/:licencia", func(c *gin.Context) { controllers.DeleteConductor(c, db) })
			}

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

			// --- CRUD EMPRESAS (CRUD RESTRINGIDO A ADMIN) ---
			empresaGroup := protected.Group("/empresas")
			empresaGroup.Use(controllers.RequireRole("admin"))
			{
				empresaGroup.POST("/", func(c *gin.Context) { controllers.CreateEmpresa(c, db) })
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
				albaranGroup.POST("/bulk-send", func(c *gin.Context) { controllers.BulkSendAlbaranes(c, db) }) // Envío Masivo

				albaranGroup.GET("/byempresa/:id", func(c *gin.Context) { controllers.GetAlbaranesByEmpresa(c, db) })
				albaranGroup.GET("/search", func(c *gin.Context) { controllers.SearchAlbaranes(c, db) })
				albaranGroup.GET("/", func(c *gin.Context) { controllers.GetAlbaranes(c, db) })
				albaranGroup.GET("/:id", func(c *gin.Context) { controllers.GetAlbaran(c, db) })
				albaranGroup.PUT("/:id", func(c *gin.Context) { controllers.UpdateAlbaran(c, db) })
				albaranGroup.DELETE("/:id", func(c *gin.Context) { controllers.DeleteAlbaran(c, db) })
			}
		}
	}

	return r
}
