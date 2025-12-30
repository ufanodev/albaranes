Write-Host "=============================="
Write-Host "Compilando Go para Linux"
Write-Host "=============================="

$env:GOOS="linux"
$env:GOARCH="amd64"
$env:CGO_ENABLED="0"

go build -o radio_app

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Fallo al compilar"
    exit 1
}

Write-Host ""
Write-Host "OK: Compilacion completada"
Write-Host "Archivo generado: radio_app"
Pause
