package controllers

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"albaranes/models"
	"albaranes/utils"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// --- Estructuras de Input (DTOs) ---

type RegisterInput struct {
	Usuario     string `json:"usuario" binding:"required"`
	Password    string `json:"password" binding:"required,min=6"`
	Email       string `json:"email" binding:"required,email"`
	Role        string `json:"role"`
	LicenciaRef *uint  `json:"licencia_ref"`
}

type LoginInput struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type UpdateUserInput struct {
	Usuario     *string `json:"usuario"`
	Email       *string `json:"email"`
	Role        *string `json:"role"`
	Activo      *bool   `json:"activo"`
	Password    *string `json:"password"`
	LicenciaRef *uint   `json:"licencia_ref"`
}

// --- Middleware de Autorización de Rol ---

func RequireRole(role string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userRole, exists := c.Get("userRole")
		if !exists {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "❌ Sesión no válida."})
			return
		}

		if userRole.(string) != role {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "🚫 Acceso denegado."})
			return
		}
		c.Next()
	}
}

// =====================================================================
// 🔑 CONTROLADORES DE AUTENTICACIÓN Y RECUPERACIÓN
// =====================================================================

// RequestPasswordReset genera el token y prepara el envío (Paso 1)
// Se exporta con Mayúscula para que routes.go lo vea.
func RequestPasswordReset(c *gin.Context, db *gorm.DB) {
	var input struct {
		Email string `json:"email" binding:"required,email"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Email inválido"})
		return
	}

	var user models.User
	// Buscamos al usuario por email
	if err := db.Where("email = ?", input.Email).First(&user).Error; err == nil {
		// 1. Generar un token único y expiración (1 hora)
		token := uuid.New().String()
		expiration := time.Now().Add(1 * time.Hour)

		// 2. Guardar en la base de datos
		db.Model(&user).Updates(map[string]interface{}{
			"reset_token":   token,
			"reset_expires": expiration,
		})

		// 3. Log de simulación para desarrollo
		fmt.Printf("\n--- 📧 SIMULACIÓN ENVÍO EMAIL ---\n")
		fmt.Printf("Para: %s\n", user.Email)
		fmt.Printf("Link: http://localhost:8080/resetpwd?token=%s\n", token)
		fmt.Printf("---------------------------------\n")
	}

	// Respuesta genérica por seguridad (enumeración de cuentas)
	c.JSON(http.StatusOK, gin.H{"message": "Si el email está registrado, recibirás un enlace de recuperación."})
}

// ConfirmPasswordReset valida el token y cambia la contraseña (Paso final)
// Se exporta con Mayúscula para que routes.go lo vea.
func ConfirmPasswordReset(c *gin.Context, db *gorm.DB) {
	var input struct {
		Token    string `json:"token" binding:"required"`
		Password string `json:"password" binding:"required,min=6"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos (mínimo 6 caracteres)"})
		return
	}

	var user models.User
	// Buscar usuario con el token y que no haya expirado (time.Now() < reset_expires)
	err := db.Where("reset_token = ? AND reset_expires > ?", input.Token, time.Now()).First(&user).Error
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "El enlace ha expirado o es inválido."})
		return
	}

	// 1. Hashear nueva contraseña
	hashedPassword, _ := utils.GenerateHashPassword(input.Password)

	// 2. Actualizar usuario y limpiar campos de reset para que el token no se use 2 veces
	db.Model(&user).Updates(map[string]interface{}{
		"password":      hashedPassword,
		"reset_token":   "",
		"reset_expires": nil,
	})

	c.JSON(http.StatusOK, gin.H{"message": "✅ Contraseña actualizada correctamente."})
}

func Register(c *gin.Context, db *gorm.DB) {
	var input RegisterInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos: " + err.Error()})
		return
	}

	hashedPassword, _ := utils.GenerateHashPassword(input.Password)
	var licenciaRefValue uint = 0
	if input.LicenciaRef != nil {
		licenciaRefValue = *input.LicenciaRef
	}

	user := models.User{
		Usuario:     input.Usuario,
		Password:    hashedPassword,
		Email:       input.Email,
		Role:        input.Role,
		Activo:      true,
		LicenciaRef: licenciaRefValue,
	}

	if err := db.Create(&user).Error; err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Email o Usuario ya en uso."})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "✅ Usuario registrado correctamente"})
}

func Login(c *gin.Context, db *gorm.DB) {
	var input LoginInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos"})
		return
	}

	var user models.User
	if err := db.Where("email = ?", input.Email).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Credenciales inválidas"})
		return
	}

	// Lectura directa RAW para asegurar LicenciaRef
	var dbLicRef uint
	db.Raw("SELECT licencia_ref FROM usuarios WHERE email = ?", input.Email).Scan(&dbLicRef)

	if user.LicenciaRef == 0 && dbLicRef > 0 {
		user.LicenciaRef = dbLicRef
	}

	if !user.Activo {
		c.JSON(http.StatusForbidden, gin.H{"error": "Cuenta inactiva"})
		return
	}

	if !utils.CheckPasswordHash(input.Password, user.Password) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Credenciales inválidas"})
		return
	}

	authCookie, err := utils.GenerateAuthCookie(user.ID, user.Role, user.LicenciaRef)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error de sesión"})
		return
	}

	c.SetCookie(
		authCookie.Name,
		authCookie.Value,
		int(time.Until(authCookie.Expires).Seconds()),
		authCookie.Path,
		"",
		authCookie.Secure,
		authCookie.HttpOnly,
	)

	c.JSON(http.StatusOK, gin.H{"message": "✅ Login exitoso", "role": user.Role, "usuario": user.Usuario})
}

// =====================================================================
// 🛠️ CONTROLADORES CRUD
// =====================================================================

func GetUsers(c *gin.Context, db *gorm.DB) {
	var users []models.User
	db.Select("id, usuario, email, role, activo, licencia_ref").Find(&users)
	c.JSON(http.StatusOK, gin.H{"data": users})
}

func SearchUsers(c *gin.Context, db *gorm.DB) {
	var users []models.User
	query := db.Model(&models.User{}).Select("id, usuario, email, role, activo, licencia_ref")

	if u := c.Query("usuario"); u != "" {
		query = query.Where("LOWER(usuario) LIKE ?", "%"+strings.ToLower(u)+"%")
	}
	if e := c.Query("email"); e != "" {
		query = query.Where("LOWER(email) LIKE ?", "%"+strings.ToLower(e)+"%")
	}

	query.Order("id asc").Find(&users)
	c.JSON(http.StatusOK, gin.H{"data": users})
}

func UpdateUser(c *gin.Context, db *gorm.DB) {
	id := c.Param("id")
	var user models.User
	if err := db.First(&user, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "No encontrado"})
		return
	}

	var input UpdateUserInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos"})
		return
	}

	updates := make(map[string]interface{})
	if input.Usuario != nil {
		updates["usuario"] = *input.Usuario
	}
	if input.Email != nil {
		updates["email"] = *input.Email
	}
	if input.Role != nil {
		updates["role"] = *input.Role
	}
	if input.Activo != nil {
		updates["activo"] = *input.Activo
	}
	if input.LicenciaRef != nil {
		updates["licencia_ref"] = *input.LicenciaRef
	}
	if input.Password != nil && *input.Password != "" {
		hashed, _ := utils.GenerateHashPassword(*input.Password)
		updates["password"] = hashed
	}

	db.Model(&user).Updates(updates)
	c.JSON(http.StatusOK, gin.H{"message": "✅ Actualizado correctamente"})
}

func DeleteUser(c *gin.Context, db *gorm.DB) {
	id := c.Param("id")
	db.Model(&models.User{}).Where("id = ?", id).Update("activo", false)
	c.JSON(http.StatusOK, gin.H{"message": "✅ Desactivado"})
}

// =====================================================================
// 📄 EXPORTACIÓN
// =====================================================================

func ExportUsersPDF(c *gin.Context, db *gorm.DB) {
	var req ExportRequest // Toma la estructura de common.go automáticamente
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "JSON inválido"})
		return
	}
	url, err := utils.GenerateGenericPDF(req.ReportName, req.Data)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error PDF"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "downloadURL": url})
}

func ExportUsersXLSX(c *gin.Context, db *gorm.DB) {
	var req ExportRequest // Toma la estructura de common.go automáticamente
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "JSON inválido"})
		return
	}
	url, err := utils.GenerateTitularesXLSX(req.ReportName, req.Data)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error XLSX"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "downloadURL": url})
}
