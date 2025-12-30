@echo off
REM ==========================================
REM Compilar y ejecutar Go en Windows
REM ==========================================

REM Borra variables de compilación si existen
set GOOS=
set GOARCH=

REM Compila para Windows
go build -o app.exe

IF %ERRORLEVEL% NEQ 0 (
    echo ERROR: La compilación falló.
    pause
    exit /b %ERRORLEVEL%
)

REM Ejecuta el binario
echo Ejecutando app.exe...
app.exe

pause
