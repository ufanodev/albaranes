package models

import (
	"time"
)

// Albaran representa la tabla 'albaranes'.
type Albaran struct {
	// --- IDENTIFICADORES Y CLAVES (NOT NULL) ---
	ID            uint      `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	NumeroAlbaran string    `gorm:"column:numero_albaran;size:50;uniqueIndex;not null" json:"numero_albaran"`
	Fecha         time.Time `gorm:"column:fecha;type:date;not null;index:idx_albaranes_fecha" json:"fecha"` // NOT NULL

	LicenciaRef uint `gorm:"column:licencia_ref;not null;type:int unsigned;index:idx_albaranes_licencia" json:"licencia_ref"`     // NOT NULL
	EmpresaRef  uint `gorm:"column:empresa_ref;not null;type:int unsigned;index:idx_albaranes_empresa_nombre" json:"empresa_ref"` // NOT NULL

	// Establecer relaciones GORM
	LicenciaData Licencia `gorm:"foreignKey:LicenciaRef"`
	EmpresaData  Empresa  `gorm:"foreignKey:EmpresaRef"`

	// --- CAMPOS DE DATO BÁSICO (NOT NULL/STRING) ---
	// NOTA: Estos campos NO vienen en el formulario, pero GORM los necesita. Los marcamos opcionales o los ignoramos.
	// Los siguientes campos son redundantes si ya tienes las FKs y los precargas.
	Licencia      string `gorm:"column:licencia;size:10" json:"licencia"`
	EmpresaNombre string `gorm:"column:empresa_nombre;size:100" json:"empresa_nombre"`

	// --- CAMPOS DE FORMULARIO (SÍ NULL en SQL -> Punteros o Tipos Go que manejan NULL/cadenas vacías) ---
	Referencia         *string `gorm:"column:referencia;size:100" json:"referencia"`
	Asalariado         *string `gorm:"column:asalariado;size:100" json:"asalariado"`
	DNIPasajero        *string `gorm:"column:dni_pasajero;size:15" json:"dni_pasajero"`
	Matricula          *string `gorm:"column:matricula;size:15" json:"matricula"`
	Cliente            *string `gorm:"column:cliente;size:150" json:"cliente"`
	Origen             *string `gorm:"column:origen;size:200" json:"origen"`
	Parada             *string `gorm:"column:parada;size:200" json:"parada"`
	Destino            *string `gorm:"column:destino;size:200" json:"destino"`
	AutorizadoPor      *string `gorm:"column:autorizado_por;size:100" json:"autorizado_por"`
	Observaciones      *string `gorm:"column:observaciones;type:text" json:"observaciones"`
	NumFactura         *string `gorm:"column:num_factura;size:50" json:"num_factura"`
	ObservacionesAdmin *string `gorm:"column:observaciones_admin;type:text" json:"observaciones_admin"`

	// --- NUMÉRICOS (DECIMAL/BIGINT - GORM prefiere tipos base si el valor NO es NULL, pero lo acepta) ---
	// Como el JS siempre envía 0.0 o el valor, los dejamos como tipo base.
	KmTotales         float64 `gorm:"column:km_totales;type:decimal(8,2)" json:"km_totales"`
	KmNacionales      float64 `gorm:"column:km_nacionales;type:decimal(8,2)" json:"km_nacionales"`
	KmInternacionales float64 `gorm:"column:km_internacionales;type:decimal(8,2)" json:"km_internacionales"`
	ImporteSuplidos   float64 `gorm:"column:importe_suplidos;type:decimal(8,2)" json:"importe_suplidos"`
	ImporteTotal      float64 `gorm:"column:importe_total;type:decimal(10,2)" json:"importe_total"` // NOT NULL en SQL, pero GORM necesita el tipo.
	NumPlazas         int     `gorm:"column:num_plazas" json:"num_plazas"`

	// --- BOOLEANOS (TINYINT - GORM los mapea a bool) ---
	Festivo    bool `gorm:"column:festivo" json:"festivo"`
	Finalizado bool `gorm:"column:finalizado" json:"finalizado"`
	Urbano     bool `gorm:"column:urbano" json:"urbano"`
	Diurno     bool `gorm:"column:diurno" json:"diurno"`
	NoctFest   bool `gorm:"column:noct_fest" json:"noct_fest"`
	Enganche   bool `gorm:"column:enganche" json:"enganche"`
	Enviado    bool `gorm:"column:enviado" json:"enviado"`
	Cobrado    bool `gorm:"column:cobrado" json:"cobrado"`
	Pagado     bool `gorm:"column:pagado" json:"pagado"`

	// --- TIEMPOS Y FECHAS ESPECIALES (SÍ NULL -> Punteros) ---
	// Estos campos pueden ser el origen de tu error 400/500
	Hora         *time.Time `gorm:"column:hora;type:datetime(3)" json:"hora"`
	TiempoEspera *time.Time `gorm:"column:tiempo_espera;type:datetime(3)" json:"tiempo_espera"`
	FechaCobro   *time.Time `gorm:"column:fecha_cobro;type:date" json:"fecha_cobro"`
	FechaPago    *time.Time `gorm:"column:fecha_pago;type:date" json:"fecha_pago"`

	// --- Marcas de Tiempo de GORM ---
	CreatedAt time.Time `gorm:"column:created_at" json:"created_at"`
	UpdatedAt time.Time `gorm:"column:updated_at" json:"updated_at"`
}

func (Albaran) TableName() string {
	return "albaranes"
}
