package utils

import (
	"albaranes/config"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

// Nombre de la cookie que contendrá el token JWT.
const AuthCookieName = "authToken"

// ---------------------------------------------------------------------
// --- Utilidades de Hashing (bcrypt)
// ---------------------------------------------------------------------

func GenerateHashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(bytes), err
}

func CheckPasswordHash(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

// ---------------------------------------------------------------------
// --- Utilidades de Gestión de Cookies JWT
// ---------------------------------------------------------------------

// GenerateAuthCookie crea un token JWT con ID de usuario, rol y licencia.
func GenerateAuthCookie(userID uint, role string, licenciaID uint) (*http.Cookie, error) {
	secretKey := os.Getenv("JWT_SECRET_KEY")
	if secretKey == "" {
		return nil, fmt.Errorf("clave secreta JWT no configurada")
	}

	expirationTime := time.Now().Add(time.Hour * 3)

	claims := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id":     userID,
		"role":        role,
		"licencia_id": licenciaID,
		"exp":         expirationTime.Unix(),
	})

	tokenString, err := claims.SignedString([]byte(secretKey))
	if err != nil {
		return nil, err
	}

	cookie := &http.Cookie{
		Name:     AuthCookieName,
		Value:    tokenString,
		Expires:  expirationTime,
		HttpOnly: true,
		Secure:   false, // Cambiar a true si usas HTTPS en producción
		SameSite: http.SameSiteLaxMode,
		Path:     "/",
	}

	return cookie, nil
}

func ClearAuthCookie() *http.Cookie {
	return &http.Cookie{
		Name:     AuthCookieName,
		Value:    "",
		MaxAge:   -1,
		Expires:  time.Unix(0, 0),
		HttpOnly: true,
		Secure:   false,
		SameSite: http.SameSiteLaxMode,
		Path:     "/",
	}
}

func ClearAndSetAuthCookie(c *gin.Context) {
	cookie := ClearAuthCookie()
	c.SetCookie(cookie.Name, cookie.Value, cookie.MaxAge, cookie.Path, "", cookie.Secure, cookie.HttpOnly)
}

// ---------------------------------------------------------------------
// --- Middlewares y Validación de Sesión
// ---------------------------------------------------------------------

// extractTokenFromRequest busca el token en Cookies o en el Header Authorization.
func extractTokenFromRequest(c *gin.Context) (string, error) {
	// 1. Intentar obtener de la cookie (Navegador)
	if cookie, err := c.Request.Cookie(AuthCookieName); err == nil && cookie.Value != "" {
		return cookie.Value, nil
	}

	// 2. Intentar obtener del header Authorization (API/Mobile/Postman)
	authHeader := c.GetHeader("Authorization")
	if authHeader != "" {
		parts := strings.Split(authHeader, " ")
		if len(parts) == 2 && strings.ToLower(parts[0]) == "bearer" {
			return parts[1], nil
		}
		return authHeader, nil
	}

	return "", fmt.Errorf("token no encontrado")
}

// CheckSessionForView valida la sesión para las rutas que devuelven HTML.
func CheckSessionForView(c *gin.Context) bool {
	secretKey := os.Getenv("JWT_SECRET_KEY")
	tokenString, err := extractTokenFromRequest(c)
	if err != nil || secretKey == "" {
		return false
	}

	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		return []byte(secretKey), nil
	})

	return err == nil && token.Valid
}

// JWTAuthMiddleware inyecta user_id, role y licencia_id en el contexto de la petición.
func JWTAuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		secretKey := os.Getenv("JWT_SECRET_KEY")
		if secretKey == "" {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Configuración del servidor incompleta"})
			return
		}

		tokenString, err := extractTokenFromRequest(c)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Sesión no activa"})
			return
		}

		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("método de firma inválido")
			}
			return []byte(secretKey), nil
		})

		if err != nil || !token.Valid {
			ClearAndSetAuthCookie(c)
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Sesión expirada o inválida"})
			return
		}

		if claims, ok := token.Claims.(jwt.MapClaims); ok {
			// Extracción segura de datos numéricos y strings
			userID, _ := claims["user_id"].(float64)
			role, _ := claims["role"].(string)
			licenciaID, _ := claims["licencia_id"].(float64)

			// Inyectar en el contexto para uso de los controladores
			c.Set("user_id", uint(userID))
			c.Set("role", role)
			c.Set("licencia_id", uint(licenciaID))

			c.Next()
		}
	}
}

// ---------------------------------------------------------------------
// --- Middleware de Registro
// ---------------------------------------------------------------------

func RegisterKeyAuth() gin.HandlerFunc {
	expectedUser, expectedPass := config.GetRegisterKeys()
	return func(c *gin.Context) {
		if expectedUser == "" || expectedPass == "" {
			c.Next()
			return
		}
		if c.GetHeader("X-Admin-User") != expectedUser || c.GetHeader("X-Admin-Pass") != expectedPass {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Credenciales de registro inválidas"})
			return
		}
		c.Next()
	}
}
