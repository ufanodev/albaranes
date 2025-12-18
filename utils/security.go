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

// Nombre de la cookie que contendrá el token JWT.
const AuthCookieName = "authToken"

// ---------------------------------------------------------------------
// --- Utilidades de Hashing (bcrypt)
// ---------------------------------------------------------------------

// GenerateHashPassword toma una contraseña en texto plano y devuelve su hash con bcrypt.
func GenerateHashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(bytes), err
}

// CheckPasswordHash compara una contraseña con su hash bcrypt.
func CheckPasswordHash(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

// ---------------------------------------------------------------------
// --- Utilidades de Gestión de Cookies JWT
// ---------------------------------------------------------------------

// GenerateAuthCookie crea y devuelve una cookie HttpOnly con el token JWT.
// 🛡️ ACTUALIZADO: Ahora acepta y guarda licenciaID en el token.
func GenerateAuthCookie(userID uint, role string, licenciaID uint) (*http.Cookie, error) {
	secretKey := os.Getenv("JWT_SECRET_KEY")
	if secretKey == "" {
		return nil, fmt.Errorf("clave secreta JWT no configurada")
	}

	// Expiración para el token (3 horas)
	expirationTime := time.Now().Add(time.Hour * 3)

	claims := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id":     userID,
		"role":        role,
		"licencia_id": licenciaID, // 👈 Se añade la referencia de licencia al token
		"exp":         expirationTime.Unix(),
	})

	tokenString, err := claims.SignedString([]byte(secretKey))
	if err != nil {
		return nil, err
	}

	// Crea la cookie HttpOnly
	cookie := &http.Cookie{
		Name:     AuthCookieName,
		Value:    tokenString,
		Expires:  expirationTime,
		HttpOnly: true,  // CLAVE: No accesible desde JS
		Secure:   false, // Usar 'true' en producción con HTTPS
		SameSite: http.SameSiteLaxMode,
		Path:     "/",
	}

	return cookie, nil
}

// ClearAuthCookie devuelve una cookie configurada para ser eliminada inmediatamente.
func ClearAuthCookie() *http.Cookie {
	return &http.Cookie{
		Name:     AuthCookieName,
		Value:    "",
		MaxAge:   -1,              // Borrado inmediato por el navegador
		Expires:  time.Unix(0, 0), // Expira inmediatamente
		HttpOnly: true,
		Secure:   false,
		SameSite: http.SameSiteLaxMode,
		Path:     "/",
	}
}

// ClearAndSetAuthCookie es un helper para eliminar la cookie de autenticación de la respuesta.
func ClearAndSetAuthCookie(c *gin.Context) {
	clearCookie := ClearAuthCookie()
	c.SetCookie(
		clearCookie.Name,
		clearCookie.Value,
		clearCookie.MaxAge,
		clearCookie.Path,
		clearCookie.Domain,
		clearCookie.Secure,
		clearCookie.HttpOnly,
	)
}

// ---------------------------------------------------------------------
// --- Middlewares y Validación de Sesión
// ---------------------------------------------------------------------

// CheckSessionForView valida el token JWT de la cookie para las vistas HTML.
func CheckSessionForView(c *gin.Context) bool {
	secretKey := os.Getenv("JWT_SECRET_KEY")
	if secretKey == "" {
		log.Println("ERROR: Clave JWT no configurada en el servidor")
		return false
	}

	cookie, err := c.Request.Cookie(AuthCookieName)
	if err != nil {
		return false
	}

	tokenString := cookie.Value

	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("método de firma inesperado")
		}
		return []byte(secretKey), nil
	})

	if err != nil || !token.Valid {
		ClearAndSetAuthCookie(c)
		return false
	}

	return true
}

// JWTAuthMiddleware es el middleware principal para las rutas API.
// 🛡️ ACTUALIZADO: Ahora extrae e inyecta licencia_id en el contexto de Gin.
func JWTAuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		secretKey := os.Getenv("JWT_SECRET_KEY")
		if secretKey == "" {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Clave JWT no configurada en el servidor"})
			return
		}

		cookie, err := c.Request.Cookie(AuthCookieName)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Acceso no autorizado: no hay sesión activa"})
			return
		}

		tokenString := cookie.Value

		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("método de firma inesperado")
			}
			return []byte(secretKey), nil
		})

		if err != nil || !token.Valid {
			ClearAndSetAuthCookie(c)
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Token de sesión inválido o expirado"})
			return
		}

		// Extraer Claims y pasar al contexto de Gin
		if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
			userIDFloat, okID := claims["user_id"].(float64)
			userRole, okRole := claims["role"].(string)
			licIDFloat, _ := claims["licencia_id"].(float64) // 👈 Extraemos la licencia

			if !okID || !okRole {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Claims de usuario faltantes o inválidos"})
				return
			}

			// Inyectamos los datos en el contexto para que los controladores puedan usarlos
			c.Set("userID", uint(userIDFloat))
			c.Set("userRole", userRole)
			c.Set("licencia_id", uint(licIDFloat)) // 👈 Inyectamos en el contexto

			c.Next()
		} else {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Token claims inválidos"})
			return
		}
	}
}

// ---------------------------------------------------------------------
// --- Middleware de Llave de Registro (RegisterKeyAuth)
// ---------------------------------------------------------------------

func RegisterKeyAuth() gin.HandlerFunc {
	expectedUser, expectedPass := config.GetRegisterKeys()

	if expectedUser == "" || expectedPass == "" {
		log.Println("⚠️ [Security] Llave de registro no configurada. La ruta /register está desprotegida.")
		return func(c *gin.Context) {
			c.Next()
		}
	}

	return func(c *gin.Context) {
		providedUser := c.GetHeader("X-Admin-User")
		providedPass := c.GetHeader("X-Admin-Pass")

		if providedUser == expectedUser && providedPass == expectedPass {
			c.Next()
		} else {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "❌ Credenciales de registro inválidas."})
			return
		}
	}
}
