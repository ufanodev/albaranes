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
	// Puntero: campo opcional, se asigna 0 si es nil.
	LicenciaRef *uint `json:"licencia_ref"`
}

type LoginInput struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// DTO para la actualización de usuario. Usamos punteros para opcionales.
type UpdateUserInput struct {
	Usuario *string `json:"usuario"`
	Email   *string `json:"email"`
	Role    *string `json:"role"`
	Activo  *bool   `json:"activo"`
	// Puntero: solo se envía si se quiere cambiar el password
	Password    *string `json:"password"`
	LicenciaRef *uint   `json:"licencia_ref"`
}

// --- Middleware de Autorización de Rol ---

func RequireRole(role string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userRole, exists := c.Get("userRole")

		if !exists {
			log.Printf("🚫 [Auth] Acceso denegado: Token JWT no contenía el campo 'userRole'.")
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "❌ Sesión no válida o token ausente."})
			return
		}

		if userRole.(string) != role {
			// 🚨 CORRECCIÓN: Usamos log.Printf para registrar la denegación 🚨
			log.Printf("🚫 [Auth] Acceso denegado. Rol esperado: %s, Rol actual: %s. Ruta: %s",
				role, userRole.(string), c.Request.URL.Path)

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

	// Lógica para asignar LicenciaRef: desreferenciar si existe, o usar 0.
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

	if result := db.Create(&user); result.Error != nil {
		log.Printf("🔴 [Register] ERROR GORM al crear usuario: %v", result.Error)
		c.JSON(http.StatusConflict, gin.H{"error": "❌ El email o nombre de usuario ya está en uso."})
		return
	}
	log.Printf("✅ [Register] Usuario creado: ID %d, Email: %s, Rol: %s", user.ID, user.Email, user.Role)

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
		log.Printf("🔴 ERROR al generar la cookie JWT: %v", err)
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

func GetUsers(c *gin.Context, db *gorm.DB) {
	var users []models.User
	if err := db.Select("id, usuario, email, role, activo, created_at, updated_at, licencia_ref").Find(&users).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "❌ Error al obtener la lista de usuarios"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": users})
}

func SearchUsers(c *gin.Context, db *gorm.DB) {
	var users []models.User
	query := db.Model(&models.User{}).Select("id, usuario, email, role, activo, created_at, updated_at, licencia_ref")

	usuario := c.Query("usuario")
	if usuario != "" {
		searchPattern := "%" + strings.ToLower(usuario) + "%"
		query = query.Where("LOWER(usuario) LIKE ?", searchPattern)
	}

	email := c.Query("email")
	if email != "" {
		searchPattern := "%" + strings.ToLower(email) + "%"
		query = query.Where("LOWER(email) LIKE ?", searchPattern)
	}

	role := c.Query("role")
	if role != "" {
		query = query.Where("LOWER(role) = ?", strings.ToLower(role))
	}

	activo := c.Query("activo")
	if activo != "" {
		activoBool, err := strconv.ParseBool(activo)
		if err == nil {
			query = query.Where("activo = ?", activoBool)
		} else {
			log.Printf("⚠️ [SearchUsers] Filtro activo inválido: %s", activo)
		}
	}

	if err := query.Order("id asc").Find(&users).Error; err != nil {
		log.Printf("🔴 [SearchUsers] Error GORM al buscar usuarios: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "❌ Error al ejecutar la búsqueda de usuarios"})
		return
	}

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
	if err := db.Select("id, usuario, email, role, activo, created_at, updated_at, licencia_ref").First(&user, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "❌ Usuario no encontrado"})
		return
	}
	log.Printf("ℹ️ [GetUser] Usuario ID %d encontrado.", user.ID)

	c.JSON(http.StatusOK, gin.H{"data": user})
}

// --- Controladores CRUD (PUT / DELETE) ---

// UpdateUser maneja la actualización de un usuario.
func UpdateUser(c *gin.Context, db *gorm.DB) {
	// 1. Validar ID y buscar usuario
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

	// 2. Bind del JSON
	var input UpdateUserInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos de actualización inválidos", "details": err.Error()})
		return
	}

	// 3. Crear mapa de updates (solo campos proporcionados)
	updates := make(map[string]interface{})

	// Utilizar punteros para verificar si el campo se envió en el JSON
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

	// Manejo de LicenciaRef (puede ser un puntero a 0 o un valor válido)
	if input.LicenciaRef != nil {
		updates["licencia_ref"] = *input.LicenciaRef
	}

	// 4. Lógica de Hashing y actualización de Password
	if input.Password != nil && *input.Password != "" {
		// Generar el hash de la nueva contraseña
		passwordStr := *input.Password
		hashedPassword, err := utils.GenerateHashPassword(passwordStr)
		if err != nil {
			log.Printf("🔴 [UpdateUser] ERROR al hashear password: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "❌ Fallo interno al procesar la nueva contraseña"})
			return
		}
		updates["password"] = hashedPassword // Reemplazar la contraseña de texto plano con el hash
		log.Printf("🔑 [UpdateUser] Contraseña para el usuario %d ha sido hasheada y marcada para actualizar.", user.ID)
	}

	// 5. Ejecutar la actualización
	if len(updates) > 0 {
		if result := db.Model(&user).Updates(updates); result.Error != nil {
			log.Printf("🔴 [UpdateUser] ERROR GORM al actualizar usuario %d: %v", user.ID, result.Error)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "❌ Error al actualizar el usuario"})
			return
		}
		log.Printf("✅ [UpdateUser] Usuario %d actualizado exitosamente. Campos actualizados: %v", user.ID, updates)
	} else {
		log.Printf("ℹ️ [UpdateUser] Usuario %d llamado, pero no se proporcionaron campos válidos para actualizar.", user.ID)
	}

	c.JSON(http.StatusOK, gin.H{"message": "✅ Usuario actualizado exitosamente", "data": user})
}

// DeleteUser maneja el borrado lógico (desactivación).
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
		log.Printf("🔴 [DeleteUser] ERROR GORM al desactivar usuario %d: %v", user.ID, result.Error)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "❌ Error al desactivar el usuario"})
		return
	}

	log.Printf("✅ [DeleteUser] Usuario %d desactivado (borrado lógico) exitosamente.", user.ID)
	c.JSON(http.StatusOK, gin.H{"message": "✅ Usuario desactivado exitosamente", "id": id})
}
