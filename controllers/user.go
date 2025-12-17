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
	Usuario     string `json:"usuario" binding:"required"`
	Password    string `json:"password" binding:"required,min=6"`
	Email       string `json:"email" binding:"required,email"`
	Role        string `json:"role"`
	LicenciaRef *uint  `json:"licencia_ref"` // Puntero para opcional
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
			log.Printf("🚫 [Auth] Acceso denegado: Token JWT ausente.")
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "❌ Sesión no válida."})
			return
		}

		if userRole.(string) != role {
			log.Printf("🚫 [Auth] Acceso denegado. Rol esperado: %s, Actual: %s", role, userRole.(string))
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "🚫 Acceso denegado. Se requiere rol: " + role})
			return
		}
		c.Next()
	}
}

// --- Funciones de Mapeo de Identidad ---

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
		c.JSON(http.StatusNotFound, gin.H{"error": "Usuario no encontrado."})
		return
	}
	licenciaID, err := GetLicenciaByEmail(db, userEmail)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"licencia_ref": 0})
		return
	}
	c.JSON(http.StatusOK, gin.H{"licencia_ref": licenciaID})
}

// --- Controladores de Autenticación ---

func Register(c *gin.Context, db *gorm.DB) {
	var input RegisterInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos", "details": err.Error()})
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
	c.JSON(http.StatusCreated, gin.H{"message": "✅ Usuario registrado", "id": user.ID})
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

	if !user.Activo {
		c.JSON(http.StatusForbidden, gin.H{"error": "Cuenta inactiva"})
		return
	}

	if !utils.CheckPasswordHash(input.Password, user.Password) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Credenciales inválidas"})
		return
	}

	authCookie, _ := utils.GenerateAuthCookie(user.ID, user.Role)
	c.SetCookie(authCookie.Name, authCookie.Value, int(time.Until(authCookie.Expires).Seconds()), authCookie.Path, "", authCookie.Secure, authCookie.HttpOnly)

	c.JSON(http.StatusOK, gin.H{"message": "✅ Login exitoso", "role": user.Role, "usuario": user.Usuario})
}

// --- Controladores CRUD ---

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
	if r := c.Query("role"); r != "" {
		query = query.Where("LOWER(role) = ?", strings.ToLower(r))
	}
	if a := c.Query("activo"); a != "" {
		if activoBool, err := strconv.ParseBool(a); err == nil {
			query = query.Where("activo = ?", activoBool)
		}
	}

	query.Order("id asc").Find(&users)
	c.JSON(http.StatusOK, gin.H{"data": users})
}

func GetUser(c *gin.Context, db *gorm.DB) {
	id := c.Param("id")
	var user models.User
	if err := db.Select("id, usuario, email, role, activo, licencia_ref").First(&user, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Usuario no encontrado"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": user})
}

func UpdateUser(c *gin.Context, db *gorm.DB) {
	id := c.Param("id")
	var user models.User
	if err := db.First(&user, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Usuario no encontrado"})
		return
	}

	var input UpdateUserInput
	c.ShouldBindJSON(&input)

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
	c.JSON(http.StatusOK, gin.H{"message": "✅ Usuario actualizado", "data": user})
}

func DeleteUser(c *gin.Context, db *gorm.DB) {
	id := c.Param("id")
	if err := db.Model(&models.User{}).Where("id = ?", id).Update("activo", false).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al desactivar"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "✅ Usuario desactivado"})
}

// ---------------------------------------------------------------------
// CONTROLADORES DE EXPORTACIÓN (PDF y XLSX)
// ---------------------------------------------------------------------

// ExportUsersPDF genera un PDF con la lista de usuarios recibida.
func ExportUsersPDF(c *gin.Context, db *gorm.DB) {
	var req ExportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Printf("🔴 ERROR Usuarios PDF Bind: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "JSON inválido"})
		return
	}

	if len(req.Data) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "No hay datos"})
		return
	}

	downloadURL, err := utils.GenerateGenericPDF(req.ReportName, req.Data)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Error al generar PDF"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "downloadURL": downloadURL})
}

// ExportUsersXLSX genera un Excel con la lista de usuarios recibida.
func ExportUsersXLSX(c *gin.Context, db *gorm.DB) {
	var req ExportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Printf("🔴 ERROR Usuarios XLSX Bind: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "JSON inválido"})
		return
	}

	if len(req.Data) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "No hay datos"})
		return
	}

	downloadURL, err := utils.GenerateTitularesXLSX(req.ReportName, req.Data)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Error al generar XLSX"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "downloadURL": downloadURL})
}
