/**
 * ARCHIVO: utils/security.go
 * DESCRIPCIÓN: Gestión de seguridad, JWT, Hashing y Middlewares.
 * ACTUALIZADO: 19/02/2026 - FIX: Normalización de claims para compatibilidad total Admin/User.
 */

package utils

import (
	"albaranes/config"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

// Nombre de la cookie que contendrá el token JWT.
const AuthCookieName = "authToken"

// ---------------------------------------------------------------------
// SECCIÓN 1: HASHING DE CONTRASEÑAS (BCRYPT)
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

// GenerateAuthCookie crea el token incluyendo el rol y la licencia_id
func GenerateAuthCookie(userID uint, role string, licenciaID uint) (*http.Cookie, error) {
	secretKey := os.Getenv("JWT_SECRET_KEY")
	if secretKey == "" {
		return nil, fmt.Errorf("clave secreta JWT no configurada")
	}

	expirationTime := time.Now().Add(time.Hour * 3)

	claims := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id":     userID,
		"role":        role,       // 👈 "admin" o "titular"
		"licencia_id": licenciaID, // 👈 0 para admin, ID real para titulares
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
// SECCIÓN 3: MIDDLEWARES Y VALIDACIÓN
// ---------------------------------------------------------------------

// CheckSessionForView valida la sesión para las vistas HTML (.html)
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

	// Inyectar datos básicos en el contexto por si la vista los requiere
	if claims, ok := token.Claims.(jwt.MapClaims); ok {
		c.Set("role", claims["role"])
		c.Set("licencia_id", claims["licencia_id"])
	}

	return true
}

// JWTAuthMiddleware es el middleware principal para las rutas /api/v1
func JWTAuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		secretKey := os.Getenv("JWT_SECRET_KEY")
		cookie, err := c.Request.Cookie(AuthCookieName)
		if err != nil {
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
			ClearAndSetAuthCookie(c)
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Sesión expirada o inválida"})
			return
		}

		if claims, ok := token.Claims.(jwt.MapClaims); ok {
			// 🛡️ Extracción segura para evitar Panics (JSON trata números como float64)
			var userID uint
			if val, ok := claims["user_id"].(float64); ok {
				userID = uint(val)
			}

			var licID uint
			if val, ok := claims["licencia_id"].(float64); ok {
				licID = uint(val)
			}

			userRole, _ := claims["role"].(string)

			// 💉 INYECCIÓN EN CONTEXTO GIN
			// Estas claves deben ser exactas a las que busca routes.go y controllers
			c.Set("userID", userID)
			c.Set("role", userRole)     // 👈 Usado por el router para decidir la función Update
			c.Set("licencia_id", licID) // 👈 Usado por controllers para filtrar datos de usuarios

			c.Next()
		} else {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Claims inválidos"})
		}
	}
}

// RequireRole protege rutas específicas que solo admiten un rol (ej: solo admin)
func RequireRole(role string) gin.HandlerFunc {
	return func(c *gin.Context) {
		val, _ := c.Get("role")
		if val != role {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Acceso denegado: requiere rol " + role})
			return
		}
		c.Next()
	}
}

// ---------------------------------------------------------------------
// SECCIÓN 4: SEGURIDAD DE REGISTRO
// ---------------------------------------------------------------------

func RegisterKeyAuth() gin.HandlerFunc {
	expectedUser, expectedPass := config.GetRegisterKeys()
	return func(c *gin.Context) {
		if c.GetHeader("X-Admin-User") == expectedUser && c.GetHeader("X-Admin-Pass") == expectedPass {
			c.Next()
		} else {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Credenciales de registro inválidas"})
		}
	}
}
