package models

import (
	"time"
)

// Albaran representa la tabla 'albaranes' en la base de datos.
// Se utilizan punteros (*) para campos opcionales (nullable en DB).
type Albaran struct {
	// --- IDENTIFICADORES Y CLAVES ---
	ID            uint      `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	NumeroAlbaran string    `gorm:"column:numero_albaran;size:50;uniqueIndex;not null" json:"numero_albaran"`
	Fecha         time.Time `gorm:"column:fecha;type:date;not null;index:idx_albaranes_fecha" json:"fecha"`

	// Relaciones (Foreign Keys)
	LicenciaRef uint `gorm:"column:licencia_ref;not null;type:int unsigned;index:idx_albaranes_licencia" json:"licencia_ref"`
	EmpresaRef  uint `gorm:"column:empresa_ref;not null;type:int unsigned;index:idx_albaranes_empresa" json:"empresa_ref"`

	// Datos de Relación (Preload)
	LicenciaData Licencia `gorm:"foreignKey:LicenciaRef" json:"licencia_data,omitempty"`
	EmpresaData  Empresa  `gorm:"foreignKey:EmpresaRef" json:"empresa_data,omitempty"`

	// --- CAMPOS DE TEXTO Y REFERENCIAS ---
	Licencia      string  `gorm:"column:licencia;size:10" json:"licencia"`
	EmpresaNombre string  `gorm:"column:empresa_nombre;size:100" json:"empresa_nombre"`
	Referencia    *string `gorm:"column:referencia;size:100" json:"referencia"`
	Asalariado    *string `gorm:"column:asalariado;size:100" json:"asalariado"`

	// Campos 17, 18, 19 de tu DB
	DNIPasajero *string `gorm:"column:dni_pasajero;size:15" json:"dni_pasajero"`
	TlfPasajero string  `gorm:"column:tlf_pasajero;size:15;not null" json:"tlf_pasajero"`
	Matricula   *string `gorm:"column:matricula;size:15" json:"matricula"`

	Cliente            *string `gorm:"column:cliente;size:150" json:"cliente"` // Mapeado a 'nombre_pasajero'
	Origen             *string `gorm:"column:origen;size:200" json:"origen"`
	Parada             *string `gorm:"column:parada;size:200" json:"parada"`
	Destino            *string `gorm:"column:destino;size:200" json:"destino"`
	AutorizadoPor      *string `gorm:"column:autorizado_por;size:100" json:"autorizado_por"`
	Observaciones      *string `gorm:"column:observaciones;type:text" json:"observaciones"`
	NumFactura         *string `gorm:"column:num_factura;size:50" json:"num_factura"`
	ObservacionesAdmin *string `gorm:"column:observaciones_admin;type:text" json:"observaciones_admin"`

	// --- CAMPOS DE TIEMPO (Formatos HH:mm:ss) ---
	Hora         *time.Time `gorm:"column:hora;type:datetime(3)" json:"hora"`
	HoraIni      *time.Time `gorm:"column:hora_ini;type:datetime(3)" json:"hora_ini"`
	HoraFin      *time.Time `gorm:"column:hora_fin;type:datetime(3)" json:"hora_fin"`
	EsperaIni    *time.Time `gorm:"column:espera_ini;type:datetime(3)" json:"espera_ini"`
	EsperaFin    *time.Time `gorm:"column:espera_fin;type:datetime(3)" json:"espera_fin"`
	TiempoEspera *time.Time `gorm:"column:tiempo_espera;type:datetime(3)" json:"tiempo_espera"`

	// --- DATOS NUMÉRICOS Y KILOMETRAJE ---
	KmIni             float64 `gorm:"column:km_ini;type:decimal(10,2);not null" json:"km_ini"`
	KmFin             float64 `gorm:"column:km_fin;type:decimal(10,2);not null" json:"km_fin"`
	KmTotales         float64 `gorm:"column:km_totales;type:decimal(10,2)" json:"km_totales"`
	KmNacionales      float64 `gorm:"column:km_nacionales;type:decimal(10,2)" json:"km_nacionales"`
	KmInternacionales float64 `gorm:"column:km_internacionales;type:decimal(10,2)" json:"km_internacionales"`

	// Campos 33, 34, 35 de tu DB
	ImporteEspera   float64 `gorm:"column:importe_espera;type:decimal(10,2);not null" json:"importe_espera"`
	ImporteSuplidos float64 `gorm:"column:importe_suplidos;type:decimal(10,2)" json:"importe_suplidos"`
	ImporteTotal    float64 `gorm:"column:importe_total;type:decimal(12,2)" json:"importe_total"`

	NumPlazas int `gorm:"column:num_plazas;default:4" json:"num_plazas"`

	// --- ESTADOS Y BOOLEANOS ---
	Festivo    bool `gorm:"column:festivo;default:0" json:"festivo"`
	Finalizado bool `gorm:"column:finalizado;default:0" json:"finalizado"`
	Urbano     bool `gorm:"column:urbano;default:0" json:"urbano"`
	Diurno     bool `gorm:"column:diurno;default:1" json:"diurno"`
	NoctFest   bool `gorm:"column:noct_fest;default:0" json:"noct_fest"`
	Remolque   bool `gorm:"column:remolque;default:0" json:"remolque"`
	Adjuntos   bool `gorm:"column:adjuntos;default:0" json:"adjuntos"`
	Enviado    bool `gorm:"column:enviado;default:0" json:"enviado"`
	Cobrado    bool `gorm:"column:cobrado;default:0" json:"cobrado"`
	Pagado     bool `gorm:"column:pagado;default:0" json:"pagado"`
	Estado     bool `gorm:"column:estado;default:0" json:"estado"` // 0=Activo, 1=Borrado

	// --- FECHAS DE PROCESO ---
	FechaCobro *time.Time `gorm:"column:fecha_cobro;type:date" json:"fecha_cobro"`
	FechaPago  *time.Time `gorm:"column:fecha_pago;type:date" json:"fecha_pago"`
	FechaEnvio *time.Time `gorm:"column:fecha_envio;type:datetime" json:"fecha_envio"`

	// --- AUDITORÍA ---
	CreatedAt time.Time `gorm:"column:created_at" json:"created_at"`
	UpdatedAt time.Time `gorm:"column:updated_at" json:"updated_at"`
}

// TableName especifica el nombre de la tabla en MySQL.
func (Albaran) TableName() string {
	return "albaranes"
}
