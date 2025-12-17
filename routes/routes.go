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
		isSessionValid := utils.CheckSessionForView(c)

		isProtectedView := strings.HasPrefix(c.Request.URL.Path, "/admin") ||
			strings.HasPrefix(c.Request.URL.Path, "/titulares") ||
			strings.HasPrefix(c.Request.URL.Path, "/admin/titulares") ||
			strings.HasPrefix(c.Request.URL.Path, "/admin/empresas") ||
			strings.HasPrefix(c.Request.URL.Path, "/admin/usuarios") ||
			strings.HasPrefix(c.Request.URL.Path, "/admin/conductor")

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

	viewGroup := r.Group("/")
	viewGroup.Use(NoCacheMiddleware(), AuthRedirectMiddleware())

	// 2. Vistas Frontend
	{
		viewGroup.GET("/", func(c *gin.Context) { c.HTML(http.StatusOK, "login.html", nil) })
		viewGroup.GET("/login", func(c *gin.Context) { c.HTML(http.StatusOK, "login.html", nil) })
		viewGroup.GET("/recuerdame", func(c *gin.Context) { c.HTML(http.StatusOK, "recuerdame.html", nil) })
		viewGroup.GET("/busqueda", func(c *gin.Context) { c.HTML(http.StatusOK, "busqueda.html", nil) })

		// Vistas Titulares/Albaranes
		viewGroup.GET("/titulares", func(c *gin.Context) { c.HTML(http.StatusOK, "busqueda.html", nil) })
		viewGroup.GET("/titulares/nuevo_albaran", func(c *gin.Context) { c.HTML(http.StatusOK, "albaran_nuevo.html", nil) })
		viewGroup.GET("/titulares/enviados", func(c *gin.Context) { c.HTML(http.StatusOK, "albaran_enviado.html", nil) })
		viewGroup.GET("/titulares/pendientes", func(c *gin.Context) { c.HTML(http.StatusOK, "albaran_pendiente.html", nil) })
		viewGroup.GET("/titulares/update/:id", func(c *gin.Context) { c.HTML(http.StatusOK, "albaran_update.html", nil) })
		viewGroup.GET("/titulares/view/:id", func(c *gin.Context) { c.HTML(http.StatusOK, "albaran_view.html", nil) })
		viewGroup.GET("/albaranes/view/:id", func(c *gin.Context) { c.HTML(http.StatusOK, "albaran_view.html", nil) })

		// Vistas Admin
		adminViews := viewGroup.Group("/admin")
		{
			adminViews.GET("/", func(c *gin.Context) { c.HTML(http.StatusOK, "admin.html", nil) })
			adminViews.GET("/albaranes", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_busqueda.html", nil) })
			adminViews.GET("/nuevo_albaran", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_albaran_nuevo.html", nil) })
			adminViews.GET("/titulares", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_titular.html", nil) })
			adminViews.GET("/empresas", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_empresas.html", nil) })
			adminViews.GET("/usuarios", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_usuarios.html", nil) })
			adminViews.GET("/backup", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_backup.html", nil) })
			adminViews.GET("/conductor", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_conductor.html", nil) })
			adminViews.GET("/pago_emp", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_pago_emp.html", nil) })
			adminViews.GET("/pago_tit", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_pago_tit.html", nil) })
		}

		// Rutas CRUD auxiliares (Vistas)
		viewGroup.GET("/admin/conductor/crear", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_conductor_crud.html", nil) })
		viewGroup.GET("/admin/conductor/update/:licencia/:nconductor", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_conductor_crud.html", nil) })
		viewGroup.GET("/admin/conductor/view/:licencia/:nconductor", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_conductor_crud.html", nil) })
		viewGroup.GET("/admin/conductor/update/:licencia", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_conductor_crud.html", nil) })
		viewGroup.GET("/admin/conductor/view/:licencia", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_conductor_crud.html", nil) })
		viewGroup.GET("/admin/usuarios/crear", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_usuarios_crud.html", nil) })
		viewGroup.GET("/admin/usuarios/update/:id", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_usuarios_crud.html", nil) })
		viewGroup.GET("/admin/titulares/crear", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_titular_crud.html", nil) })
		viewGroup.GET("/admin/titulares/update/:id", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_titular_crud.html", nil) })
		viewGroup.GET("/admin/empresas/crear", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_empresas_crud.html", nil) })
		viewGroup.GET("/admin/empresas/update/:id", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_empresas_crud.html", nil) })
	}

	// 3. API REST
	api := r.Group("/api/v1")
	{
		api.POST("/register", func(c *gin.Context) { controllers.Register(c, db) })
		api.POST("/login", func(c *gin.Context) { controllers.Login(c, db) })
		api.POST("/logout", func(c *gin.Context) {
			utils.ClearAndSetAuthCookie(c)
			c.JSON(http.StatusOK, gin.H{"message": "Sesión cerrada"})
		})

		protected := api.Group("/")
		protected.Use(utils.JWTAuthMiddleware())
		{
			protected.GET("/user/licencia_ref", func(c *gin.Context) { controllers.GetLicenciaRefFromSession(c, db) })
			protected.GET("/empresas", func(c *gin.Context) { controllers.GetEmpresas(c, db) })
			protected.GET("/conductores", func(c *gin.Context) { controllers.GetConductores(c, db) })

			// --- CRUD CONDUCTORES ---
			conductorGroup := protected.Group("/conductores")
			conductorGroup.Use(controllers.RequireRole("admin"))
			{
				conductorGroup.POST("/", func(c *gin.Context) { controllers.CreateConductor(c, db) })
				conductorGroup.GET("/:licencia", func(c *gin.Context) { controllers.GetConductor(c, db) })
				conductorGroup.PUT("/:licencia", func(c *gin.Context) { controllers.UpdateConductor(c, db) })
				conductorGroup.GET("/licencia_conductor/:licencia/:nconductor", func(c *gin.Context) { controllers.GetConductorByLicenciaYNumero(c, db) })
				conductorGroup.PUT("/licencia_conductor/:licencia/:conductor", func(c *gin.Context) { controllers.UpdateConductorByLicenciaYConductor(c, db) })
				conductorGroup.DELETE("/:licencia", func(c *gin.Context) { controllers.DeleteConductor(c, db) })
				conductorGroup.DELETE("/id/:id", func(c *gin.Context) { controllers.DeleteConductorByID(c, db) })

				// 📄 NUEVAS RUTAS EXPORTACIÓN CONDUCTORES
				conductorGroup.POST("/export/pdf", func(c *gin.Context) { controllers.ExportConductoresPDF(c, db) })
				conductorGroup.POST("/export/xlsx", func(c *gin.Context) { controllers.ExportConductoresXLSX(c, db) })
			}

			// --- CRUD LICENCIAS ---
			licenciaGroup := protected.Group("/licencias")
			licenciaGroup.Use(controllers.RequireRole("admin"))
			{
				licenciaGroup.POST("/", func(c *gin.Context) { controllers.CreateLicencia(c, db) })
				licenciaGroup.GET("/search", func(c *gin.Context) { controllers.SearchLicencias(c, db) })
				licenciaGroup.GET("/", func(c *gin.Context) { controllers.GetLicencias(c, db) })
				licenciaGroup.PUT("/:id", func(c *gin.Context) { controllers.UpdateLicencia(c, db) })
				licenciaGroup.DELETE("/:id", func(c *gin.Context) { controllers.DeleteLicencia(c, db) })
				licenciaGroup.POST("/export/pdf", controllers.ExportTitularesPDFHandler)
				licenciaGroup.POST("/export/xlsx", func(c *gin.Context) { controllers.ExportTitularesXLSX(c, db) })
			}

			// --- CRUD EMPRESAS ---
			empresaGroup := protected.Group("/empresas")
			empresaGroup.Use(controllers.RequireRole("admin"))
			{
				empresaGroup.POST("/", func(c *gin.Context) { controllers.CreateEmpresa(c, db) })
				empresaGroup.GET("/:id", func(c *gin.Context) { controllers.GetEmpresa(c, db) })
				empresaGroup.PUT("/:id", func(c *gin.Context) { controllers.UpdateEmpresa(c, db) })
				empresaGroup.DELETE("/:id", func(c *gin.Context) { controllers.DeleteEmpresa(c, db) })
				empresaGroup.POST("/export/pdf", func(c *gin.Context) { controllers.ExportEmpresasPDF(c, db) })
				empresaGroup.POST("/export/xlsx", func(c *gin.Context) { controllers.ExportEmpresasXLSX(c, db) })
			}

			// --- CRUD USUARIOS ---
			userGroup := protected.Group("/users")
			userGroup.Use(controllers.RequireRole("admin"))
			{
				userGroup.POST("/", func(c *gin.Context) { controllers.Register(c, db) })
				userGroup.GET("/", func(c *gin.Context) { controllers.GetUsers(c, db) })
				userGroup.GET("/search", func(c *gin.Context) { controllers.SearchUsers(c, db) })
				userGroup.PUT("/:id", func(c *gin.Context) { controllers.UpdateUser(c, db) })
				userGroup.DELETE("/:id", func(c *gin.Context) { controllers.DeleteUser(c, db) })
				userGroup.POST("/export/pdf", func(c *gin.Context) { controllers.ExportUsersPDF(c, db) })
				userGroup.POST("/export/xlsx", func(c *gin.Context) { controllers.ExportUsersXLSX(c, db) })
			}

			// --- BACKUP & ALBARANES ---
			protected.GET("/backup/list", controllers.ObtenerBackupsList)
			protected.POST("/backup/:tipo/:accion", controllers.RealizarBackup)

			albaranGroup := protected.Group("/albaranes")
			{
				albaranGroup.GET("/search", func(c *gin.Context) { controllers.SearchAlbaranes(c, db) })
				albaranGroup.POST("/", func(c *gin.Context) { controllers.CreateAlbaran(c, db) })
				albaranGroup.PUT("/:id", func(c *gin.Context) { controllers.UpdateAlbaran(c, db) })
				albaranGroup.DELETE("/:id", func(c *gin.Context) { controllers.DeleteAlbaran(c, db) })
				albaranGroup.PUT("/bulk-pay", func(c *gin.Context) { controllers.BulkChargeAlbaranes(c, db) })
				albaranGroup.POST("/export/pdf", func(c *gin.Context) { controllers.ExportAlbaranesPDF(c, db) })
				albaranGroup.POST("/export/xlsx", func(c *gin.Context) { controllers.ExportAlbaranesXLSX(c, db) })
			}
		}
	}
	return r
}
