package utils

import (
	"database/sql"
	"fmt"
	"os"
	"strings"
	"time"
)

func GenerarSQLBackupNativo(host, port, user, pass, dbName, tabla string) (string, error) {
	const backupDir = "./backups"
	if _, err := os.Stat(backupDir); os.IsNotExist(err) {
		os.MkdirAll(backupDir, 0755)
	}

	// Conexión con parseTime para que Go entienda las fechas
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?parseTime=true&loc=Local", user, pass, host, port, dbName)
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return "", err
	}
	defer db.Close()

	timestamp := time.Now().Format("20060102_150405")
	fileName := fmt.Sprintf("%s_backup_%s.sql", tabla, timestamp)
	filePath := backupDir + "/" + fileName

	f, err := os.Create(filePath)
	if err != nil {
		return "", err
	}
	defer f.Close()

	// --- 1. CABECERA ---
	f.WriteString("-- phpMyAdmin SQL Dump Estilo Go\n")
	f.WriteString(fmt.Sprintf("-- Tiempo de generación: %s\n", time.Now().Format("02-01-2006 a las 15:04:05")))
	f.WriteString("SET SQL_MODE = \"NO_AUTO_VALUE_ON_ZERO\";\nSTART TRANSACTION;\nSET time_zone = \"+00:00\";\n\n")

	// --- 2. ESTRUCTURA (CREATE TABLE) ---
	var tableName, createQuery string
	err = db.QueryRow(fmt.Sprintf("SHOW CREATE TABLE `%s`", tabla)).Scan(&tableName, &createQuery)
	if err != nil {
		return "", fmt.Errorf("error estructura: %v", err)
	}

	f.WriteString(fmt.Sprintf("-- Estructura de tabla para `%s` --\n\n", tabla))
	f.WriteString(fmt.Sprintf("DROP TABLE IF EXISTS `%s`;\n%s;\n\n", tabla, createQuery))

	// --- 3. VOLCADO DE DATOS (INSERT INTO) ---
	rows, err := db.Query(fmt.Sprintf("SELECT * FROM `%s`", tabla))
	if err != nil {
		return "", err
	}
	defer rows.Close()

	columns, _ := rows.Columns()
	f.WriteString(fmt.Sprintf("-- Volcado de datos para la tabla `%s` --\n\n", tabla))
	f.WriteString(fmt.Sprintf("INSERT INTO `%s` (`%s`) VALUES\n", tabla, strings.Join(columns, "`, `")))

	firstRow := true
	for rows.Next() {
		if !firstRow {
			f.WriteString(",\n")
		}

		values := make([]interface{}, len(columns))
		valuePtrs := make([]interface{}, len(columns))
		for i := range values {
			valuePtrs[i] = &values[i]
		}

		if err := rows.Scan(valuePtrs...); err != nil {
			return "", err
		}

		var sqlValues []string
		for _, val := range values {
			if val == nil {
				sqlValues = append(sqlValues, "NULL")
			} else {
				switch v := val.(type) {
				case bool:
					if v {
						sqlValues = append(sqlValues, "1")
					} else {
						sqlValues = append(sqlValues, "0")
					}
				case []byte:
					// Escapar comillas simples para evitar inyección/errores
					strVal := strings.ReplaceAll(string(v), "'", "''")
					sqlValues = append(sqlValues, fmt.Sprintf("'%s'", strVal))
				case time.Time:
					if v.IsZero() {
						sqlValues = append(sqlValues, "NULL")
					} else {
						// Formato exacto para SQL
						sqlValues = append(sqlValues, fmt.Sprintf("'%s'", v.Format("2006-01-02 15:04:05.000")))
					}
				default:
					sqlValues = append(sqlValues, fmt.Sprintf("%v", v))
				}
			}
		}
		f.WriteString("(" + strings.Join(sqlValues, ", ") + ")")
		firstRow = false
	}

	f.WriteString(";\n\nCOMMIT;\n")
	f.WriteString("-- Fin del volcado")

	return fileName, nil
}
