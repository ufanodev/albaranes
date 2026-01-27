package routes

import (
	"net/http"
	"strings"

	"albaranes/controllers"
	"albaranes/utils"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// NoCacheMiddleware evita que el navegador guarde datos sensibles en caché.
func NoCacheMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Cache-Control", "no-cache, no-store, max-age=0, must-revalidate")
		c.Header("Pragma", "no-cache")
		c.Header("Expires", "0")
		c.Next()
	}
}

// AuthRedirectMiddleware redirige al login solo si es una vista HTML.
func AuthRedirectMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		path := c.Request.URL.Path

		if strings.HasPrefix(path, "/api/v1") {
			c.Next()
			return
		}

		isSessionValid := utils.CheckSessionForView(c)
		if !isSessionValid {
			c.Redirect(http.StatusTemporaryRedirect, "/login")
			c.Abort()
			return
		}
		c.Next()
	}
}

func SetupRouter(db *gorm.DB) *gin.Engine {
	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery())

	r.RedirectTrailingSlash = false
	r.RedirectFixedPath = false

	// 1. ARCHIVOS ESTÁTICOS
	r.Static("/css", "./static/css")
	r.Static("/js", "./static/js")
	r.Static("/Imagenes", "./static/Imagenes")
	r.Static("/backups", "./backups")
	r.Static("/documentos", "./documentos")
	r.StaticFile("/favicon.ico", "./static/Imagenes/favicon.ico")

	r.LoadHTMLGlob("static/*.html")

	// 2. VISTAS PÚBLICAS
	publicViews := r.Group("/")
	publicViews.Use(NoCacheMiddleware())
	{
		publicViews.GET("/", func(c *gin.Context) { c.HTML(http.StatusOK, "login.html", nil) })
		publicViews.GET("/login", func(c *gin.Context) { c.HTML(http.StatusOK, "login.html", nil) })
		publicViews.GET("/recuerdame", func(c *gin.Context) { c.HTML(http.StatusOK, "recuerdame.html", nil) })
		publicViews.GET("/resetpwd", func(c *gin.Context) { c.HTML(http.StatusOK, "resetpwd.html", nil) })
	}

	// 3. VISTAS PROTEGIDAS
	protectedViews := r.Group("/")
	protectedViews.Use(NoCacheMiddleware(), AuthRedirectMiddleware())
	{
		protectedViews.GET("/busqueda", func(c *gin.Context) { c.HTML(http.StatusOK, "busqueda.html", nil) })
		protectedViews.GET("/titulares", func(c *gin.Context) { c.HTML(http.StatusOK, "busqueda.html", nil) })
		protectedViews.GET("/titulares/nuevo_albaran", func(c *gin.Context) { c.HTML(http.StatusOK, "albaran_nuevo.html", nil) })
		protectedViews.GET("/titulares/enviados", func(c *gin.Context) { c.HTML(http.StatusOK, "albaran_enviado.html", nil) })
		protectedViews.GET("/titulares/pendientes", func(c *gin.Context) { c.HTML(http.StatusOK, "albaran_pendiente.html", nil) })
		protectedViews.GET("/titulares/update/:id", func(c *gin.Context) { c.HTML(http.StatusOK, "albaran_update.html", nil) })
		protectedViews.GET("/titulares/view/:id", func(c *gin.Context) { c.HTML(http.StatusOK, "albaran_view.html", nil) })
		protectedViews.GET("/albaranes/view/:id", func(c *gin.Context) { c.HTML(http.StatusOK, "albaran_view.html", nil) })

		adminViews := protectedViews.Group("/admin")
		{
			adminViews.GET("", func(c *gin.Context) { c.HTML(http.StatusOK, "admin.html", nil) })
			adminViews.GET("/", func(c *gin.Context) { c.HTML(http.StatusOK, "admin.html", nil) })
			adminViews.GET("/albaranes", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_busqueda.html", nil) })
			adminViews.GET("/nuevo_albaran", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_albaran_nuevo.html", nil) })
			adminViews.GET("/albaranes/view/:id", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_albaran_view.html", nil) })
			adminViews.GET("/albaranes/update/:id", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_albaran_update.html", nil) })
			adminViews.GET("/albaranes/borrar/:id", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_albaran_borrar.html", nil) })
			adminViews.GET("/albaranes/copiar/:id", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_albaran_copiar.html", nil) })
			adminViews.GET("/titulares", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_titular.html", nil) })
			adminViews.GET("/titulares/crear", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_titular_crud.html", nil) })
			adminViews.GET("/titulares/update/:id", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_titular_crud.html", nil) })
			adminViews.GET("/titulares/view/:id", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_titular_crud.html", nil) })
			adminViews.GET("/empresas", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_empresas.html", nil) })
			adminViews.GET("/empresas/crear", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_empresas_crud.html", nil) })
			adminViews.GET("/empresas/update/:id", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_empresas_crud.html", nil) })
			adminViews.GET("/usuarios", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_usuarios.html", nil) })
			adminViews.GET("/usuarios/crear", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_usuarios_crud.html", nil) })
			adminViews.GET("/usuarios/update/:id", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_usuarios_crud.html", nil) })
			adminViews.GET("/conductor", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_conductor.html", nil) })
			adminViews.GET("/conductor/crear", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_conductor_crud.html", nil) })
			adminViews.GET("/conductor/update/:licencia/:nconductor", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_conductor_crud.html", nil) })
			adminViews.GET("/conductor/view/:licencia/:nconductor", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_conductor_crud.html", nil) })
			adminViews.GET("/backup", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_backup.html", nil) })
			adminViews.GET("/pago_emp", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_pago_emp.html", nil) })
			adminViews.GET("/pago_tit", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_pago_tit.html", nil) })
		}
	}

	// 4. API REST
	api := r.Group("/api/v1")
	{
		api.POST("/login", func(c *gin.Context) { controllers.Login(c, db) })
		api.POST("/logout", func(c *gin.Context) {
			utils.ClearAndSetAuthCookie(c)
			c.JSON(http.StatusOK, gin.H{"message": "Sesión cerrada"})
		})
		api.POST("/auth/request-reset", func(c *gin.Context) { controllers.RequestPasswordReset(c, db) })
		api.POST("/auth/confirm-reset", func(c *gin.Context) { controllers.ConfirmPasswordReset(c, db) })

		protectedAPI := api.Group("/")
		protectedAPI.Use(utils.JWTAuthMiddleware())
		{
			protectedAPI.GET("/user/licencia_info", func(c *gin.Context) { controllers.GetLicenciaInfoForUser(c, db) })
			protectedAPI.GET("/conductores/mis-conductores", func(c *gin.Context) { controllers.GetMisConductores(c, db) })

			// CRUD USUARIOS
			userGroup := protectedAPI.Group("/users")
			userGroup.Use(controllers.RequireRole("admin"))
			{
				userGroup.GET("", func(c *gin.Context) { controllers.GetUsers(c, db) })
				userGroup.POST("", func(c *gin.Context) { controllers.Register(c, db) })
				userGroup.GET("/search", func(c *gin.Context) { controllers.SearchUsers(c, db) })
				userGroup.PUT("/:id", func(c *gin.Context) { controllers.UpdateUser(c, db) })
				userGroup.DELETE("/:id", func(c *gin.Context) { controllers.DeleteUser(c, db) })
				userGroup.POST("/export/pdf", func(c *gin.Context) { controllers.ExportUsersPDF(c, db) })
				userGroup.POST("/export/xlsx", func(c *gin.Context) { controllers.ExportUsersXLSX(c, db) })
			}

			// CRUD LICENCIAS (TITULARES)
			licenciaGroup := protectedAPI.Group("/licencias")
			licenciaGroup.Use(controllers.RequireRole("admin"))
			{
				licenciaGroup.GET("", func(c *gin.Context) { controllers.GetLicencias(c, db) })
				licenciaGroup.POST("", func(c *gin.Context) { controllers.CreateLicencia(c, db) })
				licenciaGroup.GET("/search", func(c *gin.Context) { controllers.SearchLicencias(c, db) })
				licenciaGroup.GET("/:id", func(c *gin.Context) { controllers.GetLicencia(c, db) })
				licenciaGroup.PUT("/:id", func(c *gin.Context) { controllers.UpdateLicencia(c, db) })
				licenciaGroup.DELETE("/:id", func(c *gin.Context) { controllers.DeleteLicencia(c, db) })
				licenciaGroup.POST("/export/pdf", controllers.ExportTitularesPDFHandler)
				licenciaGroup.POST("/export/xlsx", func(c *gin.Context) { controllers.ExportTitularesXLSX(c, db) })
			}

			// CRUD EMPRESAS
			empresaGroup := protectedAPI.Group("/empresas")
			{
				empresaGroup.GET("", func(c *gin.Context) { controllers.GetEmpresas(c, db) })
				empresaGroup.POST("/export/pdf", func(c *gin.Context) { controllers.ExportEmpresasPDF(c, db) })
				empresaGroup.POST("/export/xlsx", func(c *gin.Context) { controllers.ExportEmpresasXLSX(c, db) })

				adminEmpresa := empresaGroup.Group("/")
				adminEmpresa.Use(controllers.RequireRole("admin"))
				{
					adminEmpresa.POST("", func(c *gin.Context) { controllers.CreateEmpresa(c, db) })
					adminEmpresa.GET("/:id", func(c *gin.Context) { controllers.GetEmpresa(c, db) })
					adminEmpresa.PUT("/:id", func(c *gin.Context) { controllers.UpdateEmpresa(c, db) })
					adminEmpresa.DELETE("/:id", func(c *gin.Context) { controllers.DeleteEmpresa(c, db) })
				}
			}

			// ALBARANES (Sincronizado con controllers/albaran.go)
			albaranGroup := protectedAPI.Group("/albaranes")
			{
				albaranGroup.GET("/search-user", func(c *gin.Context) { controllers.SearchAlbaranesUser(c, db) })
				albaranGroup.GET("/search", func(c *gin.Context) { controllers.SearchAlbaranes(c, db) })
				albaranGroup.GET("/id/:id", func(c *gin.Context) { controllers.GetAlbaran(c, db) })
				albaranGroup.POST("", func(c *gin.Context) { controllers.CreateAlbaran(c, db) })

				// 🛡️ FIX 404: Añadidas ambas variantes para evitar errores de ruta
				albaranGroup.PUT("/:id", func(c *gin.Context) { controllers.UpdateAlbaranUser(c, db) })
				albaranGroup.PUT("/user/:id", func(c *gin.Context) { controllers.UpdateAlbaranUser(c, db) })

				albaranGroup.DELETE("/:id", func(c *gin.Context) { controllers.DeleteAlbaran(c, db) })
				albaranGroup.POST("/export/pdf", func(c *gin.Context) { controllers.ExportAlbaranesPDF(c, db) })
				albaranGroup.POST("/export/xlsx", func(c *gin.Context) { controllers.ExportAlbaranesXLSX(c, db) })
			}

			// BACKUPS
			protectedAPI.GET("/backup/list", controllers.ObtenerBackupsList)
			protectedAPI.POST("/backup/:tipo/:accion", controllers.RealizarBackup)
		}
	}

	return r
}
