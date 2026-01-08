#!/bin/bash



SERVICE_NAME="radio_app"

SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

APP_DIR="/home/deployment"

APP_BIN="${APP_DIR}/radio_app"

APP_USER="bitnami"



echo "=============================="

echo "í ½íº€ Instalando servicio systemd"

echo "=============================="



# 1ï¸âƒ£ Comprobaciones bÃ¡sicas

if [ ! -f "$APP_BIN" ]; then

    echo "âŒ ERROR: No existe $APP_BIN"

    exit 1

fi



if [ ! -f "$APP_DIR/.env" ]; then

    echo "âš ï¸  AVISO: No existe $APP_DIR/.env (el servicio puede fallar)"

fi



# 2ï¸âƒ£ Crear archivo systemd

echo "í ½í³ Creando servicio $SERVICE_NAME..."



sudo tee "$SERVICE_FILE" > /dev/null <<EOF

[Unit]

Description=Radio Go Application

After=network.target mariadb.service apache2.service



[Service]

Type=simple

User=$APP_USER

WorkingDirectory=$APP_DIR

ExecStart=$APP_BIN

Restart=always

RestartSec=5

EnvironmentFile=$APP_DIR/.env



# Logs

StandardOutput=append:/var/log/radio_app.log

StandardError=append:/var/log/radio_app.error.log



[Install]

WantedBy=multi-user.target

EOF



# 3ï¸âƒ£ Permisos de logs

echo "í ½í³‚ Preparando logs..."

sudo touch /var/log/radio_app.log /var/log/radio_app.error.log

sudo chown $APP_USER:$APP_USER /var/log/radio_app.log /var/log/radio_app.error.log



# 4ï¸âƒ£ Recargar systemd

echo "í ½í´„ Recargando systemd..."

sudo systemctl daemon-reload



# 5ï¸âƒ£ Arrancar servicio

echo "â–¶ï¸  Iniciando servicio..."

sudo systemctl start $SERVICE_NAME



# 6ï¸âƒ£ Habilitar auto-arranque

echo "â™»ï¸  Habilitando auto-arranque..."

sudo systemctl enable $SERVICE_NAME



# 7ï¸âƒ£ Estado

echo "í ½í³Š Estado del servicio:"

sudo systemctl status $SERVICE_NAME --no-pager



echo ""

echo "=============================="

echo "âœ… SERVICIO INSTALADO"

echo "=============================="

echo ""

echo "í ½í³Œ Comandos Ãºtiles:"

echo "  Ver logs:        journalctl -u $SERVICE_NAME -f"

echo "  Ver logs archivo tail -f /var/log/radio_app.log"

echo "  Reiniciar:       sudo systemctl restart $SERVICE_NAME"

echo "  Detener:         sudo systemctl stop $SERVICE_NAME"

echo ""

