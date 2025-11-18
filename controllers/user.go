package controllers

import (
	"log"
	"net/http"
	"strconv"

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

// RequireRole es una función de utilidad que genera un middleware para verificar el rol del usuario en el contexto.
// Se usa en routes.go para proteger rutas específicas (ej: solo 'admin').
func RequireRole(role string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// userRole fue establecido por JWTAuthMiddleware
		userRole, exists := c.Get("userRole")

		// Comprobar si existe Y si el rol del token NO es igual al requerido
		if !exists || userRole.(string) != role {
			// Abortar si el rol no coincide (ej: si es 'user' y se requiere 'admin')
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "🚫 Acceso denegado. Se requiere el rol: " + role})
			return
		}
		c.Next()
	}
}

// --- Controladores de Autenticación ---

// Register maneja la creación de un nuevo usuario en la base de datos.
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

// Login maneja la autenticación de un usuario y la emisión de un JWT.
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

	token, err := utils.GenerateJWT(user.ID, user.Role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "❌ Error al generar el token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "✅ Login exitoso", "token": token, "role": user.Role, "usuario": user.Usuario})
}

// --- Controladores CRUD (Protegidos por Rol Admin en routes.go) ---

// GetUsers obtiene una lista de todos los usuarios.
func GetUsers(c *gin.Context, db *gorm.DB) {
	var users []models.User
	// ⚠️ SEGURIDAD: Excluir el campo 'Password' por seguridad
	if err := db.Select("id, usuario, email, role, activo, created_at, updated_at").Find(&users).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "❌ Error al obtener la lista de usuarios"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": users})
}

// GetUser obtiene un usuario por ID.
func GetUser(c *gin.Context, db *gorm.DB) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID de usuario inválido"})
		return
	}

	var user models.User
	if err := db.Select("id, usuario, email, role, activo, created_at, updated_at").First(&user, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "❌ Usuario no encontrado"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": user})
}

// UpdateUser actualiza los campos de un usuario por ID.
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

// DeleteUser cambia el estado 'activo' del usuario a false (desactivación).
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

	// Solo desactiva, no elimina el registro permanentemente
	if result := db.Model(&user).Update("activo", false); result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "❌ Error al desactivar el usuario"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "✅ Usuario desactivado exitosamente", "id": id})
}
