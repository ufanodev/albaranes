/**
 * ARCHIVO: routes/routes.go
 * DESCRIPCIÓN: Configuración integral de rutas.
 * ACTUALIZADO: 19/02/2026 - FIX: Acceso a catálogos para corregir 401 en licencias.
 */

package routes

import (
	"albaranes/controllers"
	"albaranes/utils"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func NoCacheMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Cache-Control", "no-cache, no-store, max-age=0, must-revalidate")
		c.Header("Pragma", "no-cache")
		c.Header("Expires", "0")
		c.Next()
	}
}

func AuthRedirectMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		path := c.Request.URL.Path
		if strings.HasPrefix(path, "/api/v1") {
			c.Next()
			return
		}
		if !utils.CheckSessionForView(c) {
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
	public := r.Group("/")
	public.Use(NoCacheMiddleware())
	{
		public.GET("/", func(c *gin.Context) { c.HTML(http.StatusOK, "login.html", nil) })
		public.GET("/login", func(c *gin.Context) { c.HTML(http.StatusOK, "login.html", nil) })
		public.GET("/recuerdame", func(c *gin.Context) { c.HTML(http.StatusOK, "recuerdame.html", nil) })
		public.GET("/resetpwd", func(c *gin.Context) { c.HTML(http.StatusOK, "resetpwd.html", nil) })
	}

	// 3. VISTAS PROTEGIDAS (HTML)
	protected := r.Group("/")
	protected.Use(NoCacheMiddleware(), AuthRedirectMiddleware())
	{
		protected.GET("/busqueda", func(c *gin.Context) { c.HTML(200, "busqueda.html", nil) })
		protected.GET("/titulares", func(c *gin.Context) { c.HTML(200, "busqueda.html", nil) })
		protected.GET("/titulares/nuevo_albaran", func(c *gin.Context) { c.HTML(200, "albaran_nuevo.html", nil) })
		protected.GET("/titulares/enviados", func(c *gin.Context) { c.HTML(200, "albaran_enviado.html", nil) })
		protected.GET("/titulares/pendientes", func(c *gin.Context) { c.HTML(200, "albaran_pendiente.html", nil) })
		protected.GET("/titulares/update/:id", func(c *gin.Context) { c.HTML(200, "albaran_update.html", nil) })
		protected.GET("/titulares/view/:id", func(c *gin.Context) { c.HTML(200, "albaran_view.html", nil) })
		protected.GET("/albaranes/view/:id", func(c *gin.Context) { c.HTML(200, "albaran_view.html", nil) })

		admin := protected.Group("/admin")
		{
			admin.GET("", func(c *gin.Context) { c.HTML(200, "admin.html", nil) })
			admin.GET("/", func(c *gin.Context) { c.HTML(200, "admin.html", nil) })
			admin.GET("/albaranes", func(c *gin.Context) { c.HTML(200, "admin.html", nil) })
			admin.GET("/nuevo_albaran", func(c *gin.Context) { c.HTML(200, "admin_albaran_nuevo.html", nil) })
			admin.GET("/albaranes/view/:id", func(c *gin.Context) { c.HTML(200, "admin_albaran_view.html", nil) })
			admin.GET("/albaranes/update/:id", func(c *gin.Context) { c.HTML(200, "admin_albaran_update.html", nil) })
			admin.GET("/albaranes/borrar/:id", func(c *gin.Context) { c.HTML(200, "admin_albaran_borrar.html", nil) })
			admin.GET("/albaranes/copiar/:id", func(c *gin.Context) { c.HTML(200, "admin_albaran_copiar.html", nil) })

			admin.GET("/titulares", func(c *gin.Context) { c.HTML(200, "admin_titular.html", nil) })
			admin.GET("/titulares/crear", func(c *gin.Context) { c.HTML(200, "admin_titular_crud.html", nil) })
			admin.GET("/titulares/update/:id", func(c *gin.Context) { c.HTML(200, "admin_titular_crud.html", nil) })
			admin.GET("/titulares/view/:id", func(c *gin.Context) { c.HTML(200, "admin_titular_crud.html", nil) })

			admin.GET("/empresas", func(c *gin.Context) { c.HTML(200, "admin_empresas.html", nil) })
			admin.GET("/empresas/crear", func(c *gin.Context) { c.HTML(200, "admin_empresas_crud.html", nil) })
			admin.GET("/empresas/update/:id", func(c *gin.Context) { c.HTML(200, "admin_empresas_crud.html", nil) })
			admin.GET("/empresas/view/:id", func(c *gin.Context) { c.HTML(200, "admin_empresas_crud.html", nil) })

			admin.GET("/usuarios", func(c *gin.Context) { c.HTML(200, "admin_usuarios.html", nil) })
			admin.GET("/usuarios/crear", func(c *gin.Context) { c.HTML(200, "admin_usuarios_crud.html", nil) })
			admin.GET("/usuarios/update/:id", func(c *gin.Context) { c.HTML(200, "admin_usuarios_crud.html", nil) })

			admin.GET("/conductor", func(c *gin.Context) { c.HTML(200, "admin_conductor.html", nil) })
			admin.GET("/conductor/crear", func(c *gin.Context) { c.HTML(200, "admin_conductor_crud.html", nil) })
			admin.GET("/conductor/update/:licencia/:nconductor", func(c *gin.Context) { c.HTML(200, "admin_conductor_crud.html", nil) })
			admin.GET("/conductor/view/:licencia/:nconductor", func(c *gin.Context) { c.HTML(200, "admin_conductor_crud.html", nil) })

			admin.GET("/backup", func(c *gin.Context) { c.HTML(200, "admin_backup.html", nil) })
			admin.GET("/pago_emp", func(c *gin.Context) { c.HTML(200, "admin_pago_emp.html", nil) })
			admin.GET("/pago_tit", func(c *gin.Context) { c.HTML(200, "admin_pago_tit.html", nil) })
		}
	}

	// 4. API REST (api/v1)
	api := r.Group("/api/v1")
	{
		api.POST("/login", func(c *gin.Context) { controllers.Login(c, db) })
		api.POST("/logout", func(c *gin.Context) {
			utils.ClearAndSetAuthCookie(c)
			c.JSON(200, gin.H{"message": "Sesión cerrada"})
		})
		api.POST("/auth/request-reset", func(c *gin.Context) { controllers.RequestPasswordReset(c, db) })
		api.POST("/auth/confirm-reset", func(c *gin.Context) { controllers.ConfirmPasswordReset(c, db) })

		protectedAPI := api.Group("/")
		protectedAPI.Use(utils.JWTAuthMiddleware())
		{
			// ✅ CATÁLOGOS ABIERTOS A CUALQUIER USUARIO LOGUEADO (Para evitar 401 en combos)
			protectedAPI.GET("/licencias", func(c *gin.Context) { controllers.GetLicencias(c, db) })
			protectedAPI.GET("/empresas", func(c *gin.Context) { controllers.GetEmpresas(c, db) })

			protectedAPI.GET("/user/licencia_info", func(c *gin.Context) { controllers.GetLicenciaInfoForUser(c, db) })
			protectedAPI.GET("/conductores/mis-conductores", func(c *gin.Context) { controllers.GetMisConductores(c, db) })

			// Usuarios (Solo Admin)
			users := protectedAPI.Group("/users")
			users.Use(controllers.RequireRole("admin"))
			{
				users.GET("", func(c *gin.Context) { controllers.GetUsers(c, db) })
				users.POST("", func(c *gin.Context) { controllers.Register(c, db) })
				users.GET("/search", func(c *gin.Context) { controllers.SearchUsers(c, db) })
				users.PUT("/:id", func(c *gin.Context) { controllers.UpdateUser(c, db) })
				users.DELETE("/:id", func(c *gin.Context) { controllers.DeleteUser(c, db) })
			}

			// Gestión avanzada de Licencias (Solo Admin modifica)
			licsAdmin := protectedAPI.Group("/licencias")
			licsAdmin.Use(controllers.RequireRole("admin"))
			{
				licsAdmin.POST("", func(c *gin.Context) { controllers.CreateLicencia(c, db) })
				licsAdmin.GET("/search", func(c *gin.Context) { controllers.SearchLicencias(c, db) })
				licsAdmin.GET("/:id", func(c *gin.Context) { controllers.GetLicencia(c, db) })
				licsAdmin.PUT("/:id", func(c *gin.Context) { controllers.UpdateLicencia(c, db) })
				licsAdmin.DELETE("/:id", func(c *gin.Context) { controllers.DeleteLicencia(c, db) })
				licsAdmin.POST("/export/pdf", controllers.ExportTitularesPDFHandler)
				licsAdmin.POST("/export/xlsx", func(c *gin.Context) { controllers.ExportTitularesXLSX(c, db) })
			}

			// Gestión avanzada de Empresas (Solo Admin modifica)
			empsAdmin := protectedAPI.Group("/empresas")
			empsAdmin.Use(controllers.RequireRole("admin"))
			{
				empsAdmin.POST("", func(c *gin.Context) { controllers.CreateEmpresa(c, db) })
				empsAdmin.PUT("/:id", func(c *gin.Context) { controllers.UpdateEmpresa(c, db) })
				empsAdmin.DELETE("/:id", func(c *gin.Context) { controllers.DeleteEmpresa(c, db) })
				empsAdmin.GET("/:id", func(c *gin.Context) { controllers.GetEmpresa(c, db) })
				empsAdmin.POST("/export/pdf", func(c *gin.Context) { controllers.ExportEmpresasPDF(c, db) })
				empsAdmin.POST("/export/xlsx", func(c *gin.Context) { controllers.ExportEmpresasXLSX(c, db) })
			}

			// Albaranes
			albs := protectedAPI.Group("/albaranes")
			{
				albs.GET("/search-user", func(c *gin.Context) { controllers.SearchAlbaranesUser(c, db) })
				albs.GET("/search", func(c *gin.Context) { controllers.SearchAlbaranes(c, db) })
				albs.GET("/id/:id", func(c *gin.Context) { controllers.GetAlbaran(c, db) })
				albs.POST("", func(c *gin.Context) { controllers.CreateAlbaran(c, db) })
				albs.PUT("/:id", func(c *gin.Context) { controllers.UpdateAlbaran(c, db) })
				albs.PUT("/user/:id", func(c *gin.Context) { controllers.UpdateAlbaranUser(c, db) })
				albs.DELETE("/:id", func(c *gin.Context) { controllers.DeleteAlbaran(c, db) })
				albs.POST("/export/pdf", func(c *gin.Context) { controllers.ExportAlbaranesPDF(c, db) })
				albs.POST("/export/xlsx", func(c *gin.Context) { controllers.ExportAlbaranesXLSX(c, db) })
			}

			// Backup
			protectedAPI.GET("/backup/list", controllers.ObtenerBackupsList)
			protectedAPI.POST("/backup/:tipo/:accion", controllers.RealizarBackup)
		}
	}

	return r
}
