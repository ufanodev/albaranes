// models/conductor.go (Refactorizado sin CreatedAt/UpdatedAt)

package models

// Omitimos "time" ya que no se usa si eliminamos CreatedAt/UpdatedAt
// import "time"

// Conductor representa la tabla 'conductores'.
type Conductor struct {
	// 🔑 CLAVE PRIMARIA: ID Autoincremental
	ID uint `gorm:"primaryKey;autoIncrement;column:id" json:"id"`

	// Campos de Identificación
	Licencia  string `gorm:"column:licencia;size:3;not null" json:"licencia" binding:"required"`
	Conductor string `gorm:"column:conductor;size:20;not null" json:"conductor"`
	Nombre    string `gorm:"column:nombre;size:100;not null" json:"nombre"`

	// Campos de Contacto y Estado
	Email    string `gorm:"column:email;size:100;uniqueIndex;not null" json:"email"` // ÚNICO
	Telefono string `gorm:"column:telefono;size:20" json:"telefono"`
	Activo   bool   `gorm:"column:activo;not null;default:true" json:"activo"` // Valor por defecto TRUE

	// ❌ ELIMINADOS: CreatedAt y UpdatedAt (Para evitar el error de columna desconocida)
}

// TableName define el nombre de la tabla en la DB.
func (Conductor) TableName() string {
	return "conductores"
}

// --- DTOs para el Frontend (sin cambios ya que no contienen los campos de GORM) ---

type CreateConductorInput struct {
	Licencia  string `json:"licencia" binding:"required,max=3"`
	Conductor string `json:"conductor" binding:"required,max=20"`
	Nombre    string `json:"nombre" binding:"required,max=100"`
	Email     string `json:"email" binding:"required,email,max=100"`
	Telefono  string `json:"telefono" binding:"max=20"`
}

type UpdateConductorInput struct {
	Conductor *string `json:"conductor" binding:"omitempty,max=20"`
	Nombre    *string `json:"nombre" binding:"omitempty,max=100"`
	Email     *string `json:"email" binding:"omitempty,email,max=100"`
	Telefono  *string `json:"telefono" binding:"omitempty,max=20"`
	Activo    *bool   `json:"activo"`
}
