package controllers

import (
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"albaranes/models"
	"albaranes/utils"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// --- Estructuras de Input (DTOs) ---

type RegisterInput struct {
	Usuario  string `json:"usuario" binding:"required"`
	Password string `json:"password" binding:"required,min=6"`
	Email    string `json:"email" binding:"required,email"`
	Role     string `json:"role"`
}

type LoginInput struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type UpdateUserInput struct {
	Usuario string `json:"usuario"`
	Email   string `json:"email"`
	Role    string `json:"role"`
	Activo  *bool  `json:"activo"`
}

// --- Middleware de Autorización de Rol ---

func RequireRole(role string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userRole, exists := c.Get("userRole")

		if !exists {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "❌ Sesión no válida o token ausente."})
			return
		}

		if userRole.(string) != role {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "🚫 Acceso denegado. Se requiere el rol: " + role})
			return
		}
		c.Next()
	}
}

// ---------------------------------------------------------------------
// --- Funciones de Mapeo de Identidad
// ---------------------------------------------------------------------

func GetUserEmailBySessionID(c *gin.Context, db *gorm.DB) (string, error) {
	userIDVal, exists := c.Get("userID")
	if !exists {
		return "", gorm.ErrRecordNotFound
	}

	userID, _ := userIDVal.(uint)

	var user models.User
	if err := db.Select("email").First(&user, userID).Error; err != nil {
		return "", err
	}
	return user.Email, nil
}

func GetLicenciaByEmail(db *gorm.DB, email string) (uint, error) {
	if email == "" {
		return 0, gorm.ErrRecordNotFound
	}

	var licencia models.Licencia
	if err := db.Select("id").Where("email = ?", email).First(&licencia).Error; err != nil {
		return 0, err
	}

	return licencia.ID, nil
}

func GetLicenciaRefFromSession(c *gin.Context, db *gorm.DB) {
	userEmail, err := GetUserEmailBySessionID(c, db)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Usuario de sesión no encontrado."})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al buscar email."})
		return
	}

	licenciaID, err := GetLicenciaByEmail(db, userEmail)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusOK, gin.H{"licencia_ref": 0, "error": "❌ Licencia no encontrada con ese email."})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al buscar la Licencia por email."})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"licencia_ref": licenciaID,
	})
}

// --- Controladores de Autenticación ---

func Register(c *gin.Context, db *gorm.DB) {
	var input RegisterInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos de registro inválidos", "details": err.Error()})
		return
	}

	hashedPassword, err := utils.GenerateHashPassword(input.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "❌ Fallo interno al procesar la contraseña"})
		return
	}

	user := models.User{
		Usuario:  input.Usuario,
		Password: hashedPassword,
		Email:    input.Email,
		Role:     input.Role,
		Activo:   true,
	}

	if result := db.Create(&user); result.Error != nil {
		log.Printf("ERROR GORM al crear usuario: %v", result.Error)
		c.JSON(http.StatusConflict, gin.H{"error": "❌ El email o nombre de usuario ya está en uso."})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "✅ Usuario registrado exitosamente", "id": user.ID, "usuario": user.Usuario, "role": user.Role})
}

func Login(c *gin.Context, db *gorm.DB) {
	var input LoginInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos de login inválidos"})
		return
	}

	var user models.User
	if err := db.Where("email = ?", input.Email).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "❌ Credenciales inválidas"})
		return
	}

	if !user.Activo {
		c.JSON(http.StatusForbidden, gin.H{"error": "🛑 Cuenta de usuario inactiva"})
		return
	}

	if !utils.CheckPasswordHash(input.Password, user.Password) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "❌ Credenciales inválidas"})
		return
	}

	authCookie, err := utils.GenerateAuthCookie(user.ID, user.Role)
	if err != nil {
		log.Printf("ERROR al generar la cookie JWT: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "❌ Error interno al iniciar sesión"})
		return
	}

	maxAge := int(time.Until(authCookie.Expires).Seconds())

	c.SetCookie(
		authCookie.Name,
		authCookie.Value,
		maxAge,
		authCookie.Path,
		"", // Domain. Cadena vacía
		authCookie.Secure,
		authCookie.HttpOnly,
	)

	c.JSON(http.StatusOK, gin.H{
		"message": "✅ Login exitoso",
		"role":    user.Role,
		"usuario": user.Usuario,
	})
}

// --- Controladores CRUD (GET/LIST/SEARCH) ---

// GetUsers lista todos los usuarios (sin filtros).
func GetUsers(c *gin.Context, db *gorm.DB) {
	var users []models.User
	// Incluimos licencia_ref
	if err := db.Select("id, usuario, email, role, activo, created_at, updated_at, licencia_ref").Find(&users).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "❌ Error al obtener la lista de usuarios"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": users})
}

// SearchUsers permite buscar y filtrar usuarios por query parameters.
func SearchUsers(c *gin.Context, db *gorm.DB) {
	var users []models.User
	// Incluimos licencia_ref en la selección
	query := db.Model(&models.User{}).Select("id, usuario, email, role, activo, created_at, updated_at, licencia_ref")

	// --- Lógica de Filtros (usa query params) ---

	// FILTRO por Usuario (Búsqueda parcial, insensible a mayúsculas)
	usuario := c.Query("usuario")
	if usuario != "" {
		searchPattern := "%" + strings.ToLower(usuario) + "%"
		query = query.Where("LOWER(usuario) LIKE ?", searchPattern)
	}

	// FILTRO por Email (Búsqueda parcial, insensible a mayúsculas)
	email := c.Query("email")
	if email != "" {
		searchPattern := "%" + strings.ToLower(email) + "%"
		query = query.Where("LOWER(email) LIKE ?", searchPattern)
	}

	// FILTRO por Role (Búsqueda exacta, insensible a mayúsculas)
	role := c.Query("role")
	if role != "" {
		query = query.Where("LOWER(role) = ?", strings.ToLower(role))
	}

	// FILTRO por Activo (Booleano/String "true"/"false")
	activo := c.Query("activo")
	if activo != "" {
		activoBool, err := strconv.ParseBool(activo)
		if err == nil {
			query = query.Where("activo = ?", activoBool)
		} else {
			log.Printf("⚠️ [SearchUsers] Filtro activo inválido: %s", activo)
		}
	}

	// Ejecutar la búsqueda
	if err := query.Order("id asc").Find(&users).Error; err != nil {
		log.Printf("🔴 [SearchUsers] Error GORM al buscar usuarios: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "❌ Error al ejecutar la búsqueda de usuarios"})
		return
	}

	// Devolver la lista filtrada
	c.JSON(http.StatusOK, gin.H{"data": users})
}

func GetUser(c *gin.Context, db *gorm.DB) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID de usuario inválido"})
		return
	}

	var user models.User
	// Incluimos licencia_ref en la selección
	if err := db.Select("id, usuario, email, role, activo, created_at, updated_at, licencia_ref").First(&user, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "❌ Usuario no encontrado"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": user})
}

// --- Controladores CRUD (PUT / DELETE) ---

func UpdateUser(c *gin.Context, db *gorm.DB) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID de usuario inválido"})
		return
	}

	var user models.User
	if err := db.First(&user, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "❌ Usuario no encontrado"})
		return
	}

	var input UpdateUserInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos de actualización inválidos", "details": err.Error()})
		return
	}

	updates := make(map[string]interface{})

	if input.Usuario != "" {
		updates["usuario"] = input.Usuario
	}
	if input.Email != "" {
		updates["email"] = input.Email
	}
	if input.Role != "" {
		updates["role"] = input.Role
	}
	if input.Activo != nil {
		updates["activo"] = *input.Activo
	}

	if len(updates) > 0 {
		if result := db.Model(&user).Updates(updates); result.Error != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "❌ Error al actualizar el usuario"})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "✅ Usuario actualizado exitosamente", "data": user})
}

func DeleteUser(c *gin.Context, db *gorm.DB) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID de usuario inválido"})
		return
	}

	var user models.User
	if err := db.First(&user, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "❌ Usuario no encontrado"})
		return
	}

	// Desactivación lógica: Actualiza el campo 'activo' a false
	if result := db.Model(&user).Update("activo", false); result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "❌ Error al desactivar el usuario"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "✅ Usuario desactivado exitosamente", "id": id})
}
