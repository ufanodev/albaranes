package controllers

import "albaranes/utils"

// ExportRequest es la estructura que recibe los datos para generar reportes (PDF/XLSX).
type ExportRequest struct {
	ReportName string              `json:"reportName" binding:"required"`
	Data       []utils.TitularData `json:"data" binding:"required"`
}
