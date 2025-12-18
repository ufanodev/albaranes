package routes

import (
	"net/http"
	"strings"

	"albaranes/controllers"
	"albaranes/utils"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// NoCacheMiddleware desactiva la caché del navegador para evitar que se vean datos tras logout.
func NoCacheMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Cache-Control", "no-cache, no-store, max-age=0, must-revalidate")
		c.Header("Pragma", "no-cache")
		c.Header("Expires", "0")
		c.Next()
	}
}

// AuthRedirectMiddleware asegura que solo las rutas protegidas requieran una sesión válida.
func AuthRedirectMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		isSessionValid := utils.CheckSessionForView(c)

		// Definimos los prefijos que requieren autenticación visual
		isProtectedView := strings.HasPrefix(c.Request.URL.Path, "/admin") ||
			strings.HasPrefix(c.Request.URL.Path, "/titulares") ||
			strings.HasPrefix(c.Request.URL.Path, "/busqueda")

		if !isSessionValid && isProtectedView {
			c.Redirect(http.StatusTemporaryRedirect, "/login")
			c.Abort()
			return
		}
		c.Next()
	}
}

func SetupRouter(db *gorm.DB) *gin.Engine {
	r := gin.Default()

	// 1. Archivos Estáticos
	r.Static("/css", "./static/css")
	r.Static("/js", "./static/js")
	r.Static("/Imagenes", "./static/Imagenes")
	r.Static("/backups", "./backups")
	r.Static("/documentos", "./documentos")

	r.LoadHTMLGlob("static/*.html")

	// Grupo de Vistas (HTML) con Middleware de sesión y caché
	viewGroup := r.Group("/")
	viewGroup.Use(NoCacheMiddleware(), AuthRedirectMiddleware())
	{
		// Rutas Públicas
		viewGroup.GET("/", func(c *gin.Context) { c.HTML(http.StatusOK, "login.html", nil) })
		viewGroup.GET("/login", func(c *gin.Context) { c.HTML(http.StatusOK, "login.html", nil) })
		viewGroup.GET("/recuerdame", func(c *gin.Context) { c.HTML(http.StatusOK, "recuerdame.html", nil) })

		// Rutas Titulares (Búsqueda y Gestión)
		viewGroup.GET("/busqueda", func(c *gin.Context) { c.HTML(http.StatusOK, "busqueda.html", nil) })
		titulares := viewGroup.Group("/titulares")
		{
			titulares.GET("/", func(c *gin.Context) { c.HTML(http.StatusOK, "busqueda.html", nil) })
			titulares.GET("/nuevo_albaran", func(c *gin.Context) { c.HTML(http.StatusOK, "albaran_nuevo.html", nil) })
			titulares.GET("/enviados", func(c *gin.Context) { c.HTML(http.StatusOK, "albaran_enviado.html", nil) })
			titulares.GET("/pendientes", func(c *gin.Context) { c.HTML(http.StatusOK, "albaran_pendiente.html", nil) })
			titulares.GET("/update/:id", func(c *gin.Context) { c.HTML(http.StatusOK, "albaran_update.html", nil) })
			titulares.GET("/view/:id", func(c *gin.Context) { c.HTML(http.StatusOK, "albaran_view.html", nil) })
		}

		// Rutas Administración (Vistas)
		admin := viewGroup.Group("/admin")
		{
			admin.GET("/", func(c *gin.Context) { c.HTML(http.StatusOK, "admin.html", nil) })
			admin.GET("/albaranes", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_busqueda.html", nil) })
			admin.GET("/nuevo_albaran", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_albaran_nuevo.html", nil) })
			admin.GET("/albaranes/view/:id", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_albaran_view.html", nil) })
			admin.GET("/albaranes/update/:id", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_albaran_update.html", nil) })
			admin.GET("/albaranes/borrar/:id", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_albaran_borrar.html", nil) })
			admin.GET("/albaranes/copiar/:id", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_albaran_copiar.html", nil) })

			// Gestión de Tablas Maestras
			admin.GET("/titulares", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_titular.html", nil) })
			admin.GET("/titulares/crear", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_titular_crud.html", nil) })
			admin.GET("/titulares/update/:id", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_titular_crud.html", nil) })

			admin.GET("/empresas", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_empresas.html", nil) })
			admin.GET("/empresas/crear", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_empresas_crud.html", nil) })
			admin.GET("/empresas/update/:id", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_empresas_crud.html", nil) })

			admin.GET("/usuarios", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_usuarios.html", nil) })
			admin.GET("/usuarios/crear", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_usuarios_crud.html", nil) })
			admin.GET("/usuarios/update/:id", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_usuarios_crud.html", nil) })

			admin.GET("/conductor", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_conductor.html", nil) })
			admin.GET("/conductor/crear", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_conductor_crud.html", nil) })
			admin.GET("/conductor/update/:licencia/:nconductor", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_conductor_crud.html", nil) })

			admin.GET("/backup", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_backup.html", nil) })
			admin.GET("/pago_emp", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_pago_emp.html", nil) })
			admin.GET("/pago_tit", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_pago_tit.html", nil) })
		}
	}

	// 2. API REST (v1)
	api := r.Group("/api/v1")
	{
		// Rutas Públicas de la API
		api.POST("/register", func(c *gin.Context) { controllers.Register(c, db) })
		api.POST("/login", func(c *gin.Context) { controllers.Login(c, db) })
		api.POST("/logout", func(c *gin.Context) {
			utils.ClearAndSetAuthCookie(c)
			c.JSON(http.StatusOK, gin.H{"message": "Sesión cerrada"})
		})

		// Rutas Protegidas de la API (Requieren Token JWT)
		protected := api.Group("/")
		protected.Use(utils.JWTAuthMiddleware())
		{
			// Información de Usuario/Licencia
			protected.GET("/user/licencia_info", func(c *gin.Context) { controllers.GetLicenciaInfoForUser(c, db) })
			protected.GET("/empresas", func(c *gin.Context) { controllers.GetEmpresas(c, db) })
			protected.GET("/conductores", func(c *gin.Context) { controllers.GetConductores(c, db) })

			// Grupos CRUD con restricción de Rol Admin
			adminAPI := protected.Group("/")
			adminAPI.Use(controllers.RequireRole("admin"))
			{
				// Conductores
				cond := adminAPI.Group("/conductores")
				cond.POST("/", func(c *gin.Context) { controllers.CreateConductor(c, db) })
				cond.GET("/licencia_conductor/:licencia/:nconductor", func(c *gin.Context) { controllers.GetConductorByLicenciaYNumero(c, db) })
				cond.PUT("/licencia_conductor/:licencia/:conductor", func(c *gin.Context) { controllers.UpdateConductorByLicenciaYConductor(c, db) })
				cond.DELETE("/id/:id", func(c *gin.Context) { controllers.DeleteConductorByID(c, db) })

				// Licencias (Titulares)
				lic := adminAPI.Group("/licencias")
				lic.GET("/", func(c *gin.Context) { controllers.GetLicencias(c, db) })
				lic.POST("/", func(c *gin.Context) { controllers.CreateLicencia(c, db) })
				lic.PUT("/:id", func(c *gin.Context) { controllers.UpdateLicencia(c, db) })
				lic.DELETE("/:id", func(c *gin.Context) { controllers.DeleteLicencia(c, db) })

				// Usuarios y Empresas
				adminAPI.Group("/users").GET("/", func(c *gin.Context) { controllers.GetUsers(c, db) })
				adminAPI.Group("/empresas").POST("/", func(c *gin.Context) { controllers.CreateEmpresa(c, db) })
			}

			// Gestión de Albaranes (Modo Híbrido User/Admin)
			albaranes := protected.Group("/albaranes")
			{
				albaranes.GET("/search-user", func(c *gin.Context) { controllers.SearchAlbaranesUser(c, db) })
				albaranes.GET("/search", func(c *gin.Context) { controllers.SearchAlbaranes(c, db) })
				albaranes.GET("/id/:id", func(c *gin.Context) { controllers.GetAlbaran(c, db) })
				albaranes.POST("/", func(c *gin.Context) { controllers.CreateAlbaran(c, db) })
				albaranes.PUT("/:id", func(c *gin.Context) { controllers.UpdateAlbaranUser(c, db) })
				albaranes.PUT("/admin/:id", func(c *gin.Context) { controllers.UpdateAlbaranAdmin(c, db) })
				albaranes.DELETE("/:id", func(c *gin.Context) { controllers.DeleteAlbaran(c, db) })
				albaranes.POST("/export/pdf", func(c *gin.Context) { controllers.ExportAlbaranesPDF(c, db) })
				albaranes.POST("/export/xlsx", func(c *gin.Context) { controllers.ExportAlbaranesXLSX(c, db) })
			}

			// Backups
			protected.GET("/backup/list", controllers.ObtenerBackupsList)
			protected.POST("/backup/:tipo/:accion", controllers.RealizarBackup)
		}
	}

	// 3. Captura Global de Errores 404 (Rutas inexistentes)
	r.NoRoute(func(c *gin.Context) {
		c.JSON(http.StatusNotFound, gin.H{
			"error":   "Ruta no encontrada",
			"path":    c.Request.URL.Path,
			"message": "Compruebe la URL o contacte con soporte",
		})
	})

	return r
}
