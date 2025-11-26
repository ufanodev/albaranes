package models

// Conductor representa la tabla 'conductores'.
type Conductor struct {
	// Usamos 'licencia' como clave primaria, no autoincremental
	Licencia  string `gorm:"column:licencia;primaryKey;size:3;not null" json:"licencia" binding:"required"`
	Conductor string `gorm:"column:conductor;size:20;not null" json:"conductor"`
	Nombre    string `gorm:"column:nombre;size:100;not null" json:"nombre"`
	Email     string `gorm:"column:email;size:100;uniqueIndex;not null" json:"email"`
	Telefono  string `gorm:"column:telefono;size:20" json:"telefono"`
}

// TableName define el nombre de la tabla en la DB.
func (Conductor) TableName() string {
	return "conductores"
}

// --- DTOs para el Frontend (pueden ir aquí o en controllers) ---

// CreateConductorInput es el DTO para la creación de un Conductor.
type CreateConductorInput struct {
	Licencia  string `json:"licencia" binding:"required,max=3"`
	Conductor string `json:"conductor" binding:"required,max=20"`
	Nombre    string `json:"nombre" binding:"required,max=100"`
	Email     string `json:"email" binding:"required,email,max=100"`
	Telefono  string `json:"telefono" binding:"max=20"`
}

// UpdateConductorInput es el DTO para la actualización de un Conductor.
type UpdateConductorInput struct {
	Conductor string `json:"conductor" binding:"max=20"`
	Nombre    string `json:"nombre" binding:"max=100"`
	Email     string `json:"email" binding:"email,max=100"`
	Telefono  string `json:"telefono" binding:"max=20"`
}
