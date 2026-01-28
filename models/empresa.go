package models

// Empresa representa la tabla 'empresas' para clientes o proveedores.
type Empresa struct {
	ID            uint   `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	NIF           string `gorm:"column:nif;size:20;uniqueIndex;not null" json:"nif"`
	Nombre        string `gorm:"column:nombre;size:100;not null" json:"nombre"`
	Direccion     string `gorm:"column:direccion;size:200" json:"direccion"`
	CP            string `gorm:"column:cp;size:10" json:"cp"`
	Poblacion     string `gorm:"column:poblacion;size:100" json:"poblacion"` // 👈 Añadido
	Telefono      string `gorm:"column:telefono;size:20" json:"telefono"`
	Email         string `gorm:"column:email;size:100" json:"email"`
	Observaciones string `gorm:"column:observaciones;type:text" json:"observaciones"`
	Estado        bool   `gorm:"column:estado;default:true" json:"estado"` // 👈 Añadido
}

// TableName define el nombre de la tabla en la DB.
func (Empresa) TableName() string {
	return "empresas"
}
