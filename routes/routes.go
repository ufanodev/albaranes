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
// No intenta forzar la redirección de /login a /admin, solucionando el bucle.
func AuthRedirectMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {

		// 1. Verificar si la sesión es VÁLIDA. (Limpia la cookie si está expirada/inválida)
		isSessionValid := utils.CheckSessionForView(c)

		// Rutas que requieren una sesión válida
		isProtectedView := strings.HasPrefix(c.Request.URL.Path, "/admin") ||
			strings.HasPrefix(c.Request.URL.Path, "/titulares")

		// A. Si NO hay sesión válida Y se accede a una vista protegida, redirigir al login.
		if !isSessionValid && isProtectedView {
			// Si la cookie estaba expirada, ya fue limpiada por CheckSessionForView.
			c.Redirect(http.StatusTemporaryRedirect, "/login")
			c.Abort()
			return
		}

		// B. Si el usuario está logueado y accede a / o /login, permitimos el paso.
		// La lógica de redirección a /admin después del login ocurre en JavaScript,
		// y no debe ser forzada en el middleware aquí para evitar el bucle de logout.

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
		// Vistas Públicas (Permiten el paso a logueados, pero el JS de login redirigirá si el login es exitoso)
		viewGroup.GET("/", func(c *gin.Context) { c.HTML(http.StatusOK, "login.html", nil) })
		viewGroup.GET("/login", func(c *gin.Context) { c.HTML(http.StatusOK, "login.html", nil) })
		viewGroup.GET("/recuerdame", func(c *gin.Context) { c.HTML(http.StatusOK, "recuerdame.html", nil) })
		viewGroup.GET("/busqueda", func(c *gin.Context) { c.HTML(http.StatusOK, "busqueda.html", nil) })

		// Vistas de Usuario Titular (Protegidas)
		// NOTA: Para el usuario titular, /titulares y /titulares/albaranes son la misma cosa
		viewGroup.GET("/titulares", func(c *gin.Context) { c.HTML(http.StatusOK, "busqueda.html", nil) })
		viewGroup.GET("/titulares/nuevo_albaran", func(c *gin.Context) { c.HTML(http.StatusOK, "albaran_nuevo.html", nil) })
		viewGroup.GET("/titulares/enviados", func(c *gin.Context) { c.HTML(http.StatusOK, "albaran_enviado.html", nil) })
		viewGroup.GET("/titulares/pendientes", func(c *gin.Context) { c.HTML(http.StatusOK, "albaran_pendiente.html", nil) })
		viewGroup.GET("/titulares/update/:id", func(c *gin.Context) { c.HTML(http.StatusOK, "albaran_update.html", nil) })
		viewGroup.GET("/titulares/view/:id", func(c *gin.Context) { c.HTML(http.StatusOK, "albaran_view.html", nil) })

		// Vistas de Administración (Protegidas)
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
		// Autenticación NO protegida
		api.POST("/register", utils.RegisterKeyAuth(), func(c *gin.Context) { controllers.Register(c, db) })
		api.POST("/login", func(c *gin.Context) { controllers.Login(c, db) })

		// Logout: Borra la Cookie HttpOnly 🧹
		api.POST("/logout", func(c *gin.Context) {
			utils.ClearAndSetAuthCookie(c)
			c.JSON(http.StatusOK, gin.H{"message": "Sesión cerrada correctamente"})
		})

		// Rutas Protegidas (Requieren Cookie HttpOnly JWT)
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
