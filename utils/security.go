package utils

import (
	"albaranes/config"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

// --- Utilidades de Hashing (bcrypt) ---

// GenerateHashPassword toma una contraseña en texto plano y devuelve su hash con bcrypt.
func GenerateHashPassword(password string) (string, error) {
	// Usa bcrypt.DefaultCost para un nivel de seguridad estándar.
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(bytes), err
}

// CheckPasswordHash compara una contraseña con su hash bcrypt.
func CheckPasswordHash(password, hash string) bool {
	// Compara la contraseña de entrada con el hash guardado.
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

// --- Utilidades de Generación y Validación JWT ---

// GenerateJWT crea un token JWT para un usuario, incluyendo su ID y rol.
func GenerateJWT(userID uint, role string) (string, error) {
	secretKey := os.Getenv("JWT_SECRET_KEY")
	if secretKey == "" {
		return "", fmt.Errorf("clave secreta JWT no configurada")
	}

	claims := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": userID,
		"role":    role,
		// Expiración en 24 horas
		"exp": time.Now().Add(time.Hour * 24).Unix(),
	})

	token, err := claims.SignedString([]byte(secretKey))
	return token, err
}

// JWTAuthMiddleware es el middleware que verifica la validez del token JWT en cada solicitud protegida.
func JWTAuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		secretKey := os.Getenv("JWT_SECRET_KEY")
		if secretKey == "" {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Clave JWT no configurada en el servidor"})
			return
		}

		// 1. Obtener y verificar el encabezado "Authorization: Bearer <token>"
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Token no proporcionado o formato inválido"})
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")

		// 2. Parsear y validar el token usando la clave secreta
		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("método de firma inesperado")
			}
			return []byte(secretKey), nil
		})

		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Token inválido o expirado"})
			return
		}

		// 3. Extraer y pasar los claims (ID y Rol) al contexto de Gin
		if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
			// Convertir el user_id de float64 a uint
			c.Set("userID", uint(claims["user_id"].(float64)))
			// Establecer el rol para que RequireRole pueda verificarlo
			c.Set("userRole", claims["role"])

			c.Next() // Continuar con la ejecución de la ruta
		} else {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Token claims inválidos"})
			return
		}
	}
}

// --- Middleware de Llave de Registro (RegisterKeyAuth) ---

// RegisterKeyAuth Middleware verifica las credenciales de la cabecera X-Admin-User y X-Admin-Pass.
func RegisterKeyAuth() gin.HandlerFunc {
	expectedUser, expectedPass := config.GetRegisterKeys()

	// Control de seguridad si no se configura la llave
	if expectedUser == "" || expectedPass == "" {
		log.Println("⚠️ [Security] Llave de registro no configurada. La ruta /register está desprotegida.")
		return func(c *gin.Context) {
			c.Next()
		}
	}

	return func(c *gin.Context) {
		providedUser := c.GetHeader("X-Admin-User")
		providedPass := c.GetHeader("X-Admin-Pass")

		// Compara las credenciales de la cabecera con las esperadas
		if providedUser == expectedUser && providedPass == expectedPass {
			c.Next()
		} else {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "❌ Credenciales de registro (X-Admin-User/Pass) inválidas."})
			return
		}
	}
}
