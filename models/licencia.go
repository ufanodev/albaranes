package models

// Licencia representa la tabla 'licencias'.
type Licencia struct {
	ID uint `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	// ELIMINAMOS EL TAG DE ÍNDICE ADICIONAL
	Licencia  string `gorm:"column:licencia;size:10;uniqueIndex;not null" json:"licencia"` // SOLO uniqueIndex es suficiente
	DNI       string `gorm:"column:dni;size:15" json:"dni"`
	Nombre    string `gorm:"column:nombre;size:100" json:"nombre"`
	Direccion string `gorm:"column:direccion;size:200" json:"direccion"`
	CP        string `gorm:"column:cp;size:10" json:"cp"`
	Telefono  string `gorm:"column:telefono;size:20" json:"telefono"`
	Email     string `gorm:"column:email;size:100" json:"email"`
	Socio     bool   `gorm:"column:socio" json:"socio"`
	Chofer    bool   `gorm:"column:chofer" json:"chofer"`
}

// TableName define el nombre de la tabla en la DB.
func (Licencia) TableName() string {
	return "licencias"
}
