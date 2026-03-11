@echo off
setlocal enabledelayedexpansion

REM AFS-System 数据迁移脚本 (Windows)
REM 用于在电脑之间迁移 Docker 数据

set SCRIPT_DIR=%~dp0
set PROJECT_ROOT=%SCRIPT_DIR%..
set BACKUP_DIR=%2
if "%BACKUP_DIR%"=="" set BACKUP_DIR=.\afs_data_backup

if "%1"=="" goto help
if "%1"=="help" goto help
if "%1"=="--help" goto help
if "%1"=="-h" goto help
if "%1"=="backup" goto backup
if "%1"=="restore" goto restore

echo 未知命令: %1
goto help

:help
echo.
echo AFS-System 数据迁移工具 (Windows)
echo.
echo 用法:
echo   %~nx0 backup [备份目录]    - 备份数据
echo   %~nx0 restore [备份目录]   - 恢复数据
echo   %~nx0 help                 - 显示帮助
echo.
echo 示例:
echo   %~nx0 backup D:\afs_backup
echo   %~nx0 restore D:\afs_backup
echo.
goto end

:backup
echo.
echo === 开始备份数据到: %BACKUP_DIR% ===

if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

REM 备份 MongoDB 数据
if exist "%PROJECT_ROOT%\mongoserver\mongodb_data" (
    echo 备份: mongoserver\mongodb_data
    if not exist "%BACKUP_DIR%\mongoserver" mkdir "%BACKUP_DIR%\mongoserver"
    xcopy "%PROJECT_ROOT%\mongoserver\mongodb_data" "%BACKUP_DIR%\mongoserver\mongodb_data" /E /I /Y /Q
) else (
    echo 跳过 (不存在): mongoserver\mongodb_data
)

REM 备份 server/storage
if exist "%PROJECT_ROOT%\server\storage" (
    echo 备份: server\storage
    if not exist "%BACKUP_DIR%\server" mkdir "%BACKUP_DIR%\server"
    xcopy "%PROJECT_ROOT%\server\storage" "%BACKUP_DIR%\server\storage" /E /I /Y /Q
) else (
    echo 跳过 (不存在): server\storage
)

REM 备份 modelserver/models
if exist "%PROJECT_ROOT%\modelserver\models" (
    echo 备份: modelserver\models
    if not exist "%BACKUP_DIR%\modelserver" mkdir "%BACKUP_DIR%\modelserver"
    xcopy "%PROJECT_ROOT%\modelserver\models" "%BACKUP_DIR%\modelserver\models" /E /I /Y /Q
) else (
    echo 跳过 (不存在): modelserver\models
)

REM 备份 .env 配置
if exist "%PROJECT_ROOT%\.env" (
    echo 备份配置: .env
    copy "%PROJECT_ROOT%\.env" "%BACKUP_DIR%\.env" /Y >nul
)

REM 备份 data 目录
if exist "%PROJECT_ROOT%\data" (
    echo 备份: data
    xcopy "%PROJECT_ROOT%\data" "%BACKUP_DIR%\data" /E /I /Y /Q
) else (
    echo 跳过 (不存在): data
)

echo.
echo === 备份完成! ===
echo 备份位置: %BACKUP_DIR%
echo.
echo 请将此备份目录复制到新电脑，然后运行:
echo   %~nx0 restore %BACKUP_DIR%
echo.
goto end

:restore
if not exist "%BACKUP_DIR%" (
    echo 错误: 备份目录不存在: %BACKUP_DIR%
    exit /b 1
)

echo.
echo === 从备份恢复数据: %BACKUP_DIR% ===
echo 警告: 这将覆盖现有数据!
echo.
set /p confirm="确认继续? (y/N): "
if /i not "%confirm%"=="y" (
    echo 已取消
    goto end
)

REM 恢复 MongoDB 数据
if exist "%BACKUP_DIR%\mongoserver\mongodb_data" (
    echo 恢复: mongoserver\mongodb_data
    if not exist "%PROJECT_ROOT%\mongoserver" mkdir "%PROJECT_ROOT%\mongoserver"
    if exist "%PROJECT_ROOT%\mongoserver\mongodb_data" rmdir /s /q "%PROJECT_ROOT%\mongoserver\mongodb_data"
    xcopy "%BACKUP_DIR%\mongoserver\mongodb_data" "%PROJECT_ROOT%\mongoserver\mongodb_data" /E /I /Y /Q
) else (
    echo 跳过 (备份中不存在): mongoserver\mongodb_data
)

REM 恢复 server/storage
if exist "%BACKUP_DIR%\server\storage" (
    echo 恢复: server\storage
    if not exist "%PROJECT_ROOT%\server" mkdir "%PROJECT_ROOT%\server"
    if exist "%PROJECT_ROOT%\server\storage" rmdir /s /q "%PROJECT_ROOT%\server\storage"
    xcopy "%BACKUP_DIR%\server\storage" "%PROJECT_ROOT%\server\storage" /E /I /Y /Q
) else (
    echo 跳过 (备份中不存在): server\storage
)

REM 恢复 modelserver/models
if exist "%BACKUP_DIR%\modelserver\models" (
    echo 恢复: modelserver\models
    if not exist "%PROJECT_ROOT%\modelserver" mkdir "%PROJECT_ROOT%\modelserver"
    if exist "%PROJECT_ROOT%\modelserver\models" rmdir /s /q "%PROJECT_ROOT%\modelserver\models"
    xcopy "%BACKUP_DIR%\modelserver\models" "%PROJECT_ROOT%\modelserver\models" /E /I /Y /Q
) else (
    echo 跳过 (备份中不存在): modelserver\models
)

REM 恢复 .env 配置
if exist "%BACKUP_DIR%\.env" (
    echo 恢复配置: .env
    copy "%BACKUP_DIR%\.env" "%PROJECT_ROOT%\.env" /Y >nul
)

REM 恢复 data 目录
if exist "%BACKUP_DIR%\data" (
    echo 恢复: data
    if exist "%PROJECT_ROOT%\data" rmdir /s /q "%PROJECT_ROOT%\data"
    xcopy "%BACKUP_DIR%\data" "%PROJECT_ROOT%\data" /E /I /Y /Q
) else (
    echo 跳过 (备份中不存在): data
)

echo.
echo === 恢复完成! ===
echo 现在可以运行: docker compose up -d --build
echo.
goto end

:end
endlocal
