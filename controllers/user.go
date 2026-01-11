package controllers

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"albaranes/models"
	"albaranes/utils"

	"github.com/gin-gonic/gin"
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

// RequestPasswordReset (Paso 1): Genera código de 6 dígitos y envía email
func RequestPasswordReset(c *gin.Context, db *gorm.DB) {
	var input struct {
		Email string `json:"email" binding:"required,email"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Formato de email inválido"})
		return
	}

	var user models.User
	// 1. Verificar si el email existe
	if err := db.Where("email = ?", input.Email).First(&user).Error; err != nil {
		// Por seguridad (evitar enumeración), respondemos éxito genérico
		c.JSON(http.StatusOK, gin.H{"message": "Si el email está registrado, recibirá un código pronto."})
		return
	}

	// 2. Generar código de 6 dígitos aleatorio
	code := fmt.Sprintf("%06d", time.Now().UnixNano()%1000000)
	expiration := time.Now().Add(15 * time.Minute) // Caduca en 15 min

	// 3. Actualizar base de datos
	db.Model(&user).Updates(map[string]interface{}{
		"reset_token":   code,
		"reset_expires": expiration,
	})

	// 4. Envío de Email Real (SMTP configurado en .env)
	err := utils.SendResetPasswordEmail(user.Email, code)
	if err != nil {
		fmt.Printf("❌ Error SMTP con %s: %v\n", user.Email, err)
	} else {
		fmt.Printf("✅ Código [%s] enviado con éxito a: %s\n", code, user.Email)
	}

	c.JSON(http.StatusOK, gin.H{"message": "✅ Se ha enviado un código de seguridad a su email."})
}

// ConfirmPasswordReset (Paso 2): Valida Email + Código y cambia password
func ConfirmPasswordReset(c *gin.Context, db *gorm.DB) {
	var input struct {
		Email    string `json:"email" binding:"required,email"`
		Code     string `json:"code" binding:"required"`
		Password string `json:"password" binding:"required,min=6"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos (Contraseña mín. 6 caracteres)"})
		return
	}

	var user models.User
	// Validar Email + Código + Expiración
	err := db.Where("email = ? AND reset_token = ? AND reset_expires > ?",
		input.Email, input.Code, time.Now()).First(&user).Error

	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "El código es incorrecto o ha caducado."})
		return
	}

	// 1. Hashear nueva password
	hashedPassword, _ := utils.GenerateHashPassword(input.Password)

	// 2. Actualizar y limpiar tokens
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
	var licRef uint = 0
	if input.LicenciaRef != nil {
		licRef = *input.LicenciaRef
	}

	user := models.User{
		Usuario:     input.Usuario,
		Password:    hashedPassword,
		Email:       input.Email,
		Role:        input.Role,
		Activo:      true,
		LicenciaRef: licRef,
	}

	if err := db.Create(&user).Error; err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "El email o usuario ya existen."})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "✅ Usuario registrado"})
}

func Login(c *gin.Context, db *gorm.DB) {
	var input LoginInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos"})
		return
	}

	var user models.User
	if err := db.Where("email = ?", input.Email).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Credenciales incorrectas"})
		return
	}

	// Asegurar LicenciaRef para sesiones
	var dbLicRef uint
	db.Raw("SELECT licencia_ref FROM usuarios WHERE email = ?", input.Email).Scan(&dbLicRef)
	if user.LicenciaRef == 0 && dbLicRef > 0 {
		user.LicenciaRef = dbLicRef
	}

	if !user.Activo {
		c.JSON(http.StatusForbidden, gin.H{"error": "Cuenta desactivada"})
		return
	}

	if !utils.CheckPasswordHash(input.Password, user.Password) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Credenciales incorrectas"})
		return
	}

	authCookie, err := utils.GenerateAuthCookie(user.ID, user.Role, user.LicenciaRef)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al crear sesión"})
		return
	}

	c.SetCookie(
		authCookie.Name, authCookie.Value, int(time.Until(authCookie.Expires).Seconds()),
		authCookie.Path, "", authCookie.Secure, authCookie.HttpOnly,
	)

	c.JSON(http.StatusOK, gin.H{"message": "✅ Bienvenido", "role": user.Role, "usuario": user.Usuario})
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
		c.JSON(http.StatusNotFound, gin.H{"error": "Usuario no encontrado"})
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
	c.JSON(http.StatusOK, gin.H{"message": "✅ Usuario actualizado"})
}

func DeleteUser(c *gin.Context, db *gorm.DB) {
	id := c.Param("id")
	db.Model(&models.User{}).Where("id = ?", id).Update("activo", false)
	c.JSON(http.StatusOK, gin.H{"message": "✅ Usuario desactivado"})
}

// =====================================================================
// 📄 EXPORTACIÓN
// =====================================================================

func ExportUsersPDF(c *gin.Context, db *gorm.DB) {
	var req ExportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "JSON inválido"})
		return
	}
	url, err := utils.GenerateGenericPDF(req.ReportName, req.Data)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al generar PDF"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "downloadURL": url})
}

func ExportUsersXLSX(c *gin.Context, db *gorm.DB) {
	var req ExportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "JSON inválido"})
		return
	}
	url, err := utils.GenerateTitularesXLSX(req.ReportName, req.Data)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al generar XLSX"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "downloadURL": url})
}
