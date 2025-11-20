package models

import (
	"time"
)

// Albaran representa la tabla 'albaranes'.
type Albaran struct {
	ID            uint      `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	NumeroAlbaran string    `gorm:"column:numero_albaran;size:50;uniqueIndex;not null" json:"numero_albaran"`
	Fecha         time.Time `gorm:"column:fecha;type:date;not null;index:idx_albaranes_fecha" json:"fecha"`

	// Referencias (Foreign Keys)
	LicenciaRef uint `gorm:"column:licencia_ref;not null;type:int unsigned;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT;index:idx_albaranes_licencia" json:"licencia_ref"`
	EmpresaRef  uint `gorm:"column:empresa_ref;not null;type:int unsigned;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT;index:idx_albaranes_empresa_nombre" json:"empresa_ref"`

	// Establecer relaciones GORM
	LicenciaData Licencia `gorm:"foreignKey:LicenciaRef"`
	EmpresaData  Empresa  `gorm:"foreignKey:EmpresaRef"`

	// ... (Resto de los campos del albarán) ...

	Licencia      string `gorm:"column:licencia;size:10;not null" json:"licencia"`
	EmpresaNombre string `gorm:"column:empresa_nombre;size:100;not null" json:"empresa_nombre"`
	Referencia    string `gorm:"column:referencia;size:100" json:"referencia"`
	Asalariado    string `gorm:"column:asalariado;size:100" json:"asalariado"`

	// FIX: Se cambia time.Time a *time.Time para permitir NULL en la base de datos
	// y evitar el error "Incorrect datetime value: '0000-00-00'" cuando no se proporciona.
	Hora *time.Time `gorm:"column:hora;type:time" json:"hora"`

	Festivo     bool   `gorm:"column:festivo" json:"festivo"`
	Finalizado  bool   `gorm:"column:finalizado" json:"finalizado"`
	DNIPasajero string `gorm:"column:dni_pasajero;size:15" json:"dni_pasajero"`
	Matricula   string `gorm:"column:matricula;size:15" json:"matricula"`
	Cliente     string `gorm:"column:cliente;size:150" json:"cliente"`
	Origen      string `gorm:"column:origen;size:200" json:"origen"`
	Parada      string `gorm:"column:parada;size:200" json:"parada"`
	Destino     string `gorm:"column:destino;size:200" json:"destino"`
	Urbano      bool   `gorm:"column:urbano" json:"urbano"`
	Diurno      bool   `gorm:"column:diurno" json:"diurno"`
	NoctFest    bool   `gorm:"column:noct_fest" json:"noct_fest"`

	KmTotales         float64 `gorm:"column:km_totales;type:decimal(8,2)" json:"km_totales"`
	KmNacionales      float64 `gorm:"column:km_nacionales;type:decimal(8,2)" json:"km_nacionales"`
	KmInternacionales float64 `gorm:"column:km_internacionales;type:decimal(8,2)" json:"km_internacionales"`

	// FIX: Se cambia time.Time a *time.Time
	TiempoEspera *time.Time `gorm:"column:tiempo_espera;type:time" json:"tiempo_espera"`

	ImporteSuplidos float64 `gorm:"column:importe_suplidos;type:decimal(8,2)" json:"importe_suplidos"`
	ImporteTotal    float64 `gorm:"column:importe_total;type:decimal(10,2)" json:"importe_total"`

	AutorizadoPor string `gorm:"column:autorizado_por;size:100" json:"autorizado_por"`
	Enganche      bool   `gorm:"column:enganche" json:"enganche"`
	NumPlazas     int    `gorm:"column:num_plazas" json:"num_plazas"`
	Observaciones string `gorm:"column:observaciones;type:text" json:"observaciones"`
	NumFactura    string `gorm:"column:num_factura;size:50" json:"num_factura"`
	Enviado       bool   `gorm:"column:enviado" json:"enviado"`
	Cobrado       bool   `gorm:"column:cobrado" json:"cobrado"`

	// FIX: Se cambia time.Time a *time.Time
	FechaCobro *time.Time `gorm:"column:fecha_cobro;type:date" json:"fecha_cobro"`

	Pagado bool `gorm:"column:pagado" json:"pagado"`

	// FIX: Se cambia time.Time a *time.Time
	FechaPago *time.Time `gorm:"column:fecha_pago;type:date" json:"fecha_pago"`

	ObservacionesAdmin string `gorm:"column:observaciones_admin;type:text" json:"observaciones_admin"`

	CreatedAt time.Time `gorm:"column:created_at;autoCreateTime" json:"created_at"`
	UpdatedAt time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updated_at"`
}

func (Albaran) TableName() string {
	return "albaranes"
}
