package models

import "time"

// User representa la tabla 'usuarios' en la base de datos.
type User struct {
	ID          uint   `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	Usuario     string `gorm:"column:usuario;size:50;uniqueIndex;not null" json:"usuario"`
	Password    string `gorm:"column:password;size:255;not null" json:"-"`
	Email       string `gorm:"column:email;size:100;uniqueIndex;not null" json:"email"`
	Role        string `gorm:"column:role;size:20;not null;default:user;index:idx_usuarios_role" json:"role"`
	Activo      bool   `gorm:"column:activo;default:true" json:"activo"`
	LicenciaRef uint   `gorm:"column:licencia_ref;index" json:"licencia_ref"`

	// --- CAMPOS PARA RECUPERACIÓN DE CONTRASEÑA ---
	// ResetToken guarda el UUID único enviado por email para validar el cambio de clave.
	ResetToken string `gorm:"column:reset_token;size:255" json:"-"`
	// ResetExpires guarda la fecha de expiración del token (normalmente 1 hora).
	ResetExpires *time.Time `gorm:"column:reset_expires" json:"-"`

	CreatedAt time.Time `gorm:"column:created_at;autoCreateTime" json:"-"`
	UpdatedAt time.Time `gorm:"column:updated_at;autoUpdateTime" json:"-"`
}

// TableName especifica el nombre real de la tabla en MySQL/PostgreSQL.
func (User) TableName() string {
	return "usuarios"
}
