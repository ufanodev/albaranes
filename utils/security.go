/**
 * ARCHIVO: utils/security.go
 * DESCRIPCIÓN: Gestión de seguridad, JWT, Hashing y Middlewares.
 * ACTUALIZADO: 19/02/2026 - FIX: Integración de RegisterKeyAuth y Logs de Depuración.
 */

package utils

import (
	"albaranes/config"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

const AuthCookieName = "authToken"

// ---------------------------------------------------------------------
// SECCIÓN 1: HASHING DE CONTRASEÑAS
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
// SECCIÓN 2: GESTIÓN DE JWT Y COOKIES
// ---------------------------------------------------------------------

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

	return &http.Cookie{
		Name:     AuthCookieName,
		Value:    tokenString,
		Expires:  expirationTime,
		HttpOnly: true,
		Secure:   false, // Cambiar a true en producción con HTTPS
		SameSite: http.SameSiteLaxMode,
		Path:     "/",
	}, nil
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
	c.SetCookie(cookie.Name, cookie.Value, cookie.MaxAge, cookie.Path, cookie.Domain, cookie.Secure, cookie.HttpOnly)
}

// ---------------------------------------------------------------------
// SECCIÓN 3: MIDDLEWARES DE AUTENTICACIÓN Y ROLES
// ---------------------------------------------------------------------

func CheckSessionForView(c *gin.Context) bool {
	secretKey := os.Getenv("JWT_SECRET_KEY")
	cookie, err := c.Request.Cookie(AuthCookieName)
	if err != nil {
		return false
	}

	token, err := jwt.Parse(cookie.Value, func(token *jwt.Token) (interface{}, error) {
		return []byte(secretKey), nil
	})

	if err != nil || !token.Valid {
		return false
	}
	return true
}

func JWTAuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		secretKey := os.Getenv("JWT_SECRET_KEY")

		cookie, err := c.Request.Cookie(AuthCookieName)
		if err != nil {
			log.Printf("⚠️ [AUTH] Fallo: Cookie faltante en petición a %s", c.Request.URL.Path)
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "No hay sesión activa"})
			return
		}

		token, err := jwt.Parse(cookie.Value, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("método de firma inválido")
			}
			return []byte(secretKey), nil
		})

		if err != nil || !token.Valid {
			log.Printf("❌ [AUTH] Fallo: Token inválido/expirado en %s. Error: %v", c.Request.URL.Path, err)
			ClearAndSetAuthCookie(c)
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Sesión inválida"})
			return
		}

		if claims, ok := token.Claims.(jwt.MapClaims); ok {
			var userID uint
			if val, ok := claims["user_id"].(float64); ok {
				userID = uint(val)
			}
			var licID uint
			if val, ok := claims["licencia_id"].(float64); ok {
				licID = uint(val)
			}
			userRole, _ := claims["role"].(string)

			c.Set("userID", userID)
			c.Set("role", userRole)
			c.Set("licencia_id", licID)

			log.Printf("✅ [AUTH] Acceso: Usuario %d | Rol: %s | URL: %s", userID, userRole, c.Request.URL.Path)
			c.Next()
		} else {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Claims corruptos"})
		}
	}
}

func RequireRole(role string) gin.HandlerFunc {
	return func(c *gin.Context) {
		val, exists := c.Get("role")
		if !exists || val != role {
			log.Printf("🚫 [RBAC] Denegado: Se requiere '%s', usuario tiene '%v' | URL: %s", role, val, c.Request.URL.Path)
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Permisos insuficientes"})
			return
		}
		c.Next()
	}
}

// ---------------------------------------------------------------------
// SECCIÓN 4: SEGURIDAD DE REGISTRO (Usa paquete config)
// ---------------------------------------------------------------------

func RegisterKeyAuth() gin.HandlerFunc {
	expectedUser, expectedPass := config.GetRegisterKeys()
	return func(c *gin.Context) {
		if c.GetHeader("X-Admin-User") == expectedUser && c.GetHeader("X-Admin-Pass") == expectedPass {
			c.Next()
		} else {
			log.Println("🚨 [SECURITY] Intento de registro fallido: Credenciales X-Admin incorrectas")
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Llave de registro no válida"})
		}
	}
}
