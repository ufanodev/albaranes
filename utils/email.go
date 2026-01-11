package utils

import (
	"fmt"
	"net/smtp"
	"os"
)

// SendResetPasswordEmail envía el código de seguridad por email
func SendResetPasswordEmail(targetEmail, code string) error {
	host := os.Getenv("EMAIL_SMTP_HOST")
	port := os.Getenv("EMAIL_SMTP_PORT")
	from := os.Getenv("EMAIL_FROM_ADDRESS")
	pass := os.Getenv("EMAIL_SMTP_PASSWORD")

	// Configuración del mensaje
	subject := "Subject: 🔑 Código de Seguridad - Albaranes\n"
	mime := "MIME-version: 1.0;\nContent-Type: text/html; charset=\"UTF-8\";\n\n"
	body := fmt.Sprintf(`
		<div style="font-family: sans-serif; max-width: 450px; margin: 0 auto; border: 2px solid #FFDAB9; padding: 20px; border-radius: 15px; text-align: center;">
			<h2 style="color: #000;">Recuperación de Contraseña</h2>
			<p style="color: #666;">Has solicitado un código para cambiar tu contraseña en Albaranes Radiotaxi.</p>
			<div style="margin: 25px 0; font-size: 35px; font-weight: bold; color: #FF8C00; background: #FFF5EE; padding: 15px; border-radius: 10px; letter-spacing: 8px;">
				%s
			</div>
			<p style="color: #999; font-size: 12px;">Este código caducará en 15 minutos por seguridad.</p>
		</div>`, code)

	msg := []byte(subject + mime + body)

	// Autenticación SMTP
	auth := smtp.PlainAuth("", from, pass, host)

	// Envío del correo
	err := smtp.SendMail(host+":"+port, auth, from, []string{targetEmail}, msg)
	if err != nil {
		return fmt.Errorf("error enviando email: %v", err)
	}
	return nil
}
