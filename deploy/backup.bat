@echo off
SETLOCAL EnableDelayedExpansion

:: ==============================================================
:: UKOPERASI - AUTOMATED DATABASE BACKUP SCRIPT FOR WINDOWS 2012
:: ==============================================================

set DB_USER=root
set DB_PASS=koperasi123
set DB_NAME=simkopdes
set BACKUP_DIR=D:\project\Koperasi\backups

:: Format Tanggal: YYYYMMDD_HHMMSS
for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (set date=%%c%%b%%a)
for /f "tokens=1-2 delims=/:" %%a in ("%TIME%") do (set time=%%a%%b)
set DATETIME=%date%_%time: =0%

if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

echo [INFO] Memulai backup database '%DB_NAME%'...
mysqldump -u%DB_USER% -p%DB_PASS% %DB_NAME% > "%BACKUP_DIR%\%DB_NAME%_%DATETIME%.sql"

echo [INFO] Backup berhasil disimpan: %BACKUP_DIR%\%DB_NAME%_%DATETIME%.sql

echo [INFO] Membersihkan file backup yang lebih tua dari 30 hari...
forfiles /p "%BACKUP_DIR%" /s /m *.sql /d -30 /c "cmd /c del @path" 2>nul

echo [INFO] Proses Selesai.
ENDLOCAL
