package routes

import (
	"net/http"
	"strings"

	"albaranes/controllers" // Asegúrate de que esta ruta de importación sea correcta
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

		// 1. Verificar si la sesión es VÁLIDA.
		isSessionValid := utils.CheckSessionForView(c)

		// Rutas que requieren una sesión válida
		isProtectedView := strings.HasPrefix(c.Request.URL.Path, "/admin") ||
			strings.HasPrefix(c.Request.URL.Path, "/titulares") ||
			strings.HasPrefix(c.Request.URL.Path, "/admin/titulares") ||
			strings.HasPrefix(c.Request.URL.Path, "/admin/empresas") ||
			strings.HasPrefix(c.Request.URL.Path, "/admin/usuarios") ||
			strings.HasPrefix(c.Request.URL.Path, "/admin/conductor") // 🔑 Protección Conductores

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

	// Permite servir los archivos .sql de backup estáticamente para descarga
	r.Static("/backups", "./backups")

	// 📄 NUEVA RUTA ESTÁTICA: Permite servir los PDF/XLSX generados para descarga
	r.Static("/documentos", "./documentos")

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

		// --- Rutas de Titulares/Albaranes para usuarios estándar ---
		viewGroup.GET("/titulares", func(c *gin.Context) { c.HTML(http.StatusOK, "busqueda.html", nil) })
		viewGroup.GET("/titulares/nuevo_albaran", func(c *gin.Context) { c.HTML(http.StatusOK, "albaran_nuevo.html", nil) })
		viewGroup.GET("/titulares/enviados", func(c *gin.Context) { c.HTML(http.StatusOK, "albaran_enviado.html", nil) })
		viewGroup.GET("/titulares/pendientes", func(c *gin.Context) { c.HTML(http.StatusOK, "albaran_pendiente.html", nil) })
		viewGroup.GET("/titulares/update/:id", func(c *gin.Context) { c.HTML(http.StatusOK, "albaran_update.html", nil) })
		viewGroup.GET("/titulares/view/:id", func(c *gin.Context) { c.HTML(http.StatusOK, "albaran_view.html", nil) })
		viewGroup.GET("/albaranes/view/:id", func(c *gin.Context) { c.HTML(http.StatusOK, "albaran_view.html", nil) })

		// --- Rutas de Albaranes para Administrador ---
		viewGroup.GET("/admin/albaranes/update/:id", func(c *gin.Context) {
			c.HTML(http.StatusOK, "albaran_update.html", nil)
		})
		viewGroup.GET("/admin/albaranes/copiar/:id", func(c *gin.Context) {
			c.HTML(http.StatusOK, "albaran_copiar.html", nil)
		})
		viewGroup.GET("/admin/albaranes/borrar/:id", func(c *gin.Context) {
			c.HTML(http.StatusOK, "albaran_borrar.html", nil)
		})

		// --- Grupo de Vistas de Administrador (Rutas principales) ---
		adminViews := viewGroup.Group("/admin")
		{
			adminViews.GET("/", func(c *gin.Context) { c.HTML(http.StatusOK, "admin.html", nil) })
			adminViews.GET("/albaranes", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_busqueda.html", nil) })
			adminViews.GET("/nuevo_albaran", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_albaran_nuevo.html", nil) })

			// GESTIÓN PRINCIPAL DE TABLAS (Vistas de lista)
			adminViews.GET("/titulares", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_titular.html", nil) })
			adminViews.GET("/empresas", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_empresas.html", nil) })
			adminViews.GET("/usuarios", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_usuarios.html", nil) }) // Lista Principal

			// VISTAS VARIAS
			adminViews.GET("/backup", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_backup.html", nil) })
			adminViews.GET("/conductor", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_conductor.html", nil) })
			adminViews.GET("/pago_emp", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_pago_emp.html", nil) })
			adminViews.GET("/pago_tit", func(c *gin.Context) { c.HTML(http.StatusOK, "admin_pago_tit.html", nil) })
		}

		// 🔑 RUTAS CRUD de CONDUCTORES (Usando admin_conductor_crud.html)
		viewGroup.GET("/admin/conductor/crear", func(c *gin.Context) {
			c.HTML(http.StatusOK, "admin_conductor_crud.html", nil)
		})

		// 🎯 RUTAS DE EDICIÓN Y VISTA PRECISA (Licencia + Nº Conductor)

		// ✅ Edición/Vista PRECISA (Licencia + Nº Conductor)
		viewGroup.GET("/admin/conductor/update/:licencia/:nconductor", func(c *gin.Context) {
			c.HTML(http.StatusOK, "admin_conductor_crud.html", nil)
		})
		viewGroup.GET("/admin/conductor/view/:licencia/:nconductor", func(c *gin.Context) {
			c.HTML(http.StatusOK, "admin_conductor_crud.html", nil)
		})

		// Edición/Vista LEGACY (Licencia sola, fallback)
		viewGroup.GET("/admin/conductor/update/:licencia", func(c *gin.Context) {
			c.HTML(http.StatusOK, "admin_conductor_crud.html", nil)
		})
		viewGroup.GET("/admin/conductor/view/:licencia", func(c *gin.Context) {
			c.HTML(http.StatusOK, "admin_conductor_crud.html", nil)
		})

		// --- Rutas de DELETE Híbridas ---
		// Borrado Preciso (Por Licencia + Nº Conductor - Ruta alternativa, aunque Legacy se usa más)
		viewGroup.GET("/admin/conductor/delete_lc/:licencia/:nconductor", func(c *gin.Context) {
			c.HTML(http.StatusOK, "admin_conductor_crud.html", nil)
		})
		// Borrado por ID Único (Recomendado)
		viewGroup.GET("/admin/conductor/delete_by_id/:id", func(c *gin.Context) {
			c.HTML(http.StatusOK, "admin_conductor_crud.html", nil)
		})
		// Borrado Legacy (Por Licencia - primer registro)
		viewGroup.GET("/admin/conductor/delete/:licencia", func(c *gin.Context) {
			c.HTML(http.StatusOK, "admin_conductor_crud.html", nil)
		})
		// 🔑 FIN RUTAS CRUD de CONDUCTORES

		// ✅ RUTAS CRUD de USUARIOS (CORREGIDO el error 404 para /crear)
		viewGroup.GET("/admin/usuarios/crear", func(c *gin.Context) {
			c.HTML(http.StatusOK, "admin_usuarios_crud.html", nil)
		})
		viewGroup.GET("/admin/usuarios/update/:id", func(c *gin.Context) {
			c.HTML(http.StatusOK, "admin_usuarios_crud.html", nil)
		})
		viewGroup.GET("/admin/usuarios/view/:id", func(c *gin.Context) {
			c.HTML(http.StatusOK, "admin_usuarios_crud.html", nil)
		})
		viewGroup.GET("/admin/usuarios/delete/:id", func(c *gin.Context) {
			c.HTML(http.StatusOK, "admin_usuarios_crud.html", nil)
		})

		// RUTAS CRUD de TITULARES (Usando admin_titular_crud.html)
		viewGroup.GET("/admin/titulares/crear", func(c *gin.Context) {
			c.HTML(http.StatusOK, "admin_titular_crud.html", nil)
		})
		viewGroup.GET("/admin/titulares/update/:id", func(c *gin.Context) {
			c.HTML(http.StatusOK, "admin_titular_crud.html", nil)
		})
		viewGroup.GET("/admin/titulares/view/:id", func(c *gin.Context) {
			c.HTML(http.StatusOK, "admin_titular_crud.html", nil)
		})
		viewGroup.GET("/admin/titulares/delete/:id", func(c *gin.Context) {
			c.HTML(http.StatusOK, "admin_titular_crud.html", nil)
		})

		// 🏢 RUTAS CRUD de EMPRESAS (Usando admin_empresas_crud.html)
		viewGroup.GET("/admin/empresas/crear", func(c *gin.Context) {
			c.HTML(http.StatusOK, "admin_empresas_crud.html", nil)
		})
		viewGroup.GET("/admin/empresas/update/:id", func(c *gin.Context) {
			c.HTML(http.StatusOK, "admin_empresas_crud.html", nil)
		})
		viewGroup.GET("/admin/empresas/delete/:id", func(c *gin.Context) {
			c.HTML(http.StatusOK, "admin_empresas_crud.html", nil)
		})
	}

	// 3. API REST (Backend Datos)
	api := r.Group("/api/v1")
	{
		api.POST("/register", func(c *gin.Context) { controllers.Register(c, db) })
		api.POST("/login", func(c *gin.Context) { controllers.Login(c, db) })
		api.POST("/logout", func(c *gin.Context) {
			utils.ClearAndSetAuthCookie(c)
			c.JSON(http.StatusOK, gin.H{"message": "Sesión cerrada correctamente"})
		})

		protected := api.Group("/")
		protected.Use(utils.JWTAuthMiddleware())
		{
			// --- Rutas de Mapeo y Listados Generales ---
			protected.GET("/user/licencia_ref", func(c *gin.Context) { controllers.GetLicenciaRefFromSession(c, db) })
			protected.GET("/empresas", func(c *gin.Context) { controllers.GetEmpresas(c, db) })
			protected.GET("/conductores", func(c *gin.Context) { controllers.GetConductores(c, db) })

			// --- CRUD CONDUCTORES (Admin) ---
			conductorGroup := protected.Group("/conductores")
			conductorGroup.Use(controllers.RequireRole("admin"))
			{
				conductorGroup.POST("/", func(c *gin.Context) { controllers.CreateConductor(c, db) })

				// GET Legacy
				conductorGroup.GET("/:licencia", func(c *gin.Context) { controllers.GetConductor(c, db) })

				// PUT Legacy
				conductorGroup.PUT("/:licencia", func(c *gin.Context) { controllers.UpdateConductor(c, db) })

				// RUTA API GET PRECISA (Carga de datos)
				conductorGroup.GET("/licencia_conductor/:licencia/:nconductor", func(c *gin.Context) { controllers.GetConductorByLicenciaYNumero(c, db) })

				// ✅ CORRECCIÓN FINAL: RUTA API PUT PRECISA (Actualización de datos)
				conductorGroup.PUT("/licencia_conductor/:licencia/:conductor", func(c *gin.Context) { controllers.UpdateConductorByLicenciaYConductor(c, db) })

				// Borrado híbrido
				conductorGroup.DELETE("/:licencia", func(c *gin.Context) { controllers.DeleteConductor(c, db) })
				conductorGroup.DELETE("/id/:id", func(c *gin.Context) { controllers.DeleteConductorByID(c, db) })
				conductorGroup.DELETE("/licencia_conductor/:licencia/:nconductor", func(c *gin.Context) { controllers.DeleteConductorByLicenciaYNumero(c, db) })
			}
			// --- FIN CRUD CONDUCTORES (Admin) ---

			// --- CRUD LICENCIAS (Admin) ---
			licenciaGroup := protected.Group("/licencias")
			licenciaGroup.Use(controllers.RequireRole("admin"))
			{
				licenciaGroup.POST("/", func(c *gin.Context) { controllers.CreateLicencia(c, db) })
				licenciaGroup.GET("/search", func(c *gin.Context) { controllers.SearchLicencias(c, db) })
				licenciaGroup.GET("/", func(c *gin.Context) { controllers.GetLicencias(c, db) })
				licenciaGroup.GET("/:id", func(c *gin.Context) { controllers.GetLicencia(c, db) })
				licenciaGroup.PUT("/:id", func(c *gin.Context) { controllers.UpdateLicencia(c, db) })
				licenciaGroup.PUT("/softdelete/:id", func(c *gin.Context) { controllers.SoftDeleteLicencia(c, db) })
				licenciaGroup.DELETE("/:id", func(c *gin.Context) { controllers.DeleteLicencia(c, db) })

				// 📄 RUTA DE EXPORTACIÓN DE PDF
				licenciaGroup.POST("/export/pdf", controllers.ExportTitularesPDFHandler)

				// 📊 RUTA DE EXPORTACIÓN DE XLSX (Excel)
				licenciaGroup.POST("/export/xlsx", func(c *gin.Context) { controllers.ExportTitularesXLSX(c, db) })
			}

			// --- CRUD EMPRESAS (Admin) ---
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

			// 🔑 CRUD USUARIOS (Admin) - Rutas API
			userGroup := protected.Group("/users")
			userGroup.Use(controllers.RequireRole("admin"))
			{
				userGroup.POST("/", func(c *gin.Context) { controllers.Register(c, db) })
				userGroup.GET("/", func(c *gin.Context) { controllers.GetUsers(c, db) })
				userGroup.GET("/search", func(c *gin.Context) { controllers.SearchUsers(c, db) })
				userGroup.GET("/:id", func(c *gin.Context) { controllers.GetUser(c, db) })
				userGroup.PUT("/:id", func(c *gin.Context) { controllers.UpdateUser(c, db) })
				userGroup.DELETE("/:id", func(c *gin.Context) { controllers.DeleteUser(c, db) })
			}

			// 💾 RUTAS DE BACKUP Y COPIA DE TABLA (Admin)
			backupGroup := protected.Group("/backup")
			backupGroup.Use(controllers.RequireRole("admin"))
			{
				// GET /api/v1/backup/list - Lista archivos de backup
				backupGroup.GET("/list", controllers.ObtenerBackupsList)

				// POST /api/v1/backup/:tipo/:accion
				backupGroup.POST("/:tipo/:accion", controllers.RealizarBackup)
			}

			// --- CRUD ALBARANES ---
			albaranGroup := protected.Group("/albaranes")
			{
				albaranGroup.POST("/", func(c *gin.Context) { controllers.CreateAlbaran(c, db) })
				albaranGroup.POST("/bulk-send", func(c *gin.Context) { controllers.BulkSendAlbaranes(c, db) })
				albaranGroup.GET("/byempresa/:id", func(c *gin.Context) { controllers.GetAlbaranesByEmpresa(c, db) })
				albaranGroup.GET("/search", func(c *gin.Context) { controllers.SearchAlbaranes(c, db) })
				protected.GET("/albaranes", func(c *gin.Context) { controllers.GetAlbaranes(c, db) })
				albaranGroup.GET("/:id", func(c *gin.Context) { controllers.GetAlbaran(c, db) })
				albaranGroup.PUT("/:id", func(c *gin.Context) { controllers.UpdateAlbaran(c, db) })

				albaranGroup.PUT("/bulk-pay", func(c *gin.Context) { controllers.BulkChargeAlbaranes(c, db) })

				albaranGroup.DELETE("/:id", func(c *gin.Context) { controllers.DeleteAlbaran(c, db) })

				// 📄 RUTA DE EXPORTACIÓN DE PDF (Albaranes) - ¡AÑADIDA!
				albaranGroup.POST("/export/pdf", func(c *gin.Context) { controllers.ExportAlbaranesPDF(c, db) })

				// 📊 RUTA DE EXPORTACIÓN DE XLSX (Excel) (Albaranes) - ¡AÑADIDA!
				albaranGroup.POST("/export/xlsx", func(c *gin.Context) { controllers.ExportAlbaranesXLSX(c, db) })
			}
		}
	}

	return r
}
