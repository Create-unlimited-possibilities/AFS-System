@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo   AFS System - 演示数据导入工具
echo ========================================
echo.

REM 检查参数
if "%~1"=="" (
    echo [错误] 请指定备份文件路径
    echo 使用方法: import-demo-data.bat afs-demo-backup.tar.gz
    echo.
    echo 或直接回车使用默认名称...
    set /p choice="按 Enter 使用默认名称，或 Ctrl+C 取消: "
    set "BACKUP_FILE=afs-demo-backup.tar.gz"
) else (
    set "BACKUP_FILE=%~1"
)

REM 检查文件存在性
if not exist "%BACKUP_FILE%" (
    echo [错误] 备份文件不存在: %BACKUP_FILE%
    echo 请确认文件路径是否正确
    pause
    exit /b 1
)

echo ✓ 找到备份文件: %BACKUP_FILE%

echo.
echo [步骤 1/7] 检查 Docker 是否运行...
docker ps >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] Docker 未运行
    echo 请启动 Docker Desktop 后再试
    pause
    exit /b 1
)
echo ✓ Docker 正在运行

echo.
echo [步骤 2/7] 检查 MongoDB 容器...
docker ps | findstr mongoserver >nul
if %errorlevel% neq 0 (
    echo [警告] MongoDB 容器未运行，正在启动...
    docker-compose up -d mongoserver
    timeout /t 10 /nobreak >nul
    docker ps | findstr mongoserver >nul
    if %errorlevel% neq 0 (
        echo [错误] MongoDB 容器启动失败
        pause
        exit /b 1
    )
)
echo ✓ MongoDB 容器运行正常

echo.
echo [步骤 3/7] 解压备份文件...
if exist "demo-data-temp" rmdir /s /q demo-data-temp
mkdir demo-data-temp
powershell -Command "try { Expand-Archive -Path '%BACKUP_FILE%' -DestinationPath demo-data-temp -Force; exit 0 } catch { exit 1 }"
if %errorlevel% neq 0 (
    echo [错误] 解压失败，备份文件可能已损坏
    pause
    exit /b 1
)
echo ✓ 解压完成

echo.
echo [步骤 4/7] 询问是否清除现有数据...
echo 警告：此操作将删除现有的演示数据
choice /C YN /M "是否清除现有数据库"
if %errorlevel% equ 2 (
    echo 跳过清除步骤
) else (
    echo 正在清除现有数据...
    docker exec afs-system-mongoserver-1 mongosh afs_db ^
      --eval "db.users.deleteMany({}); db.answers.deleteMany({}); db.memories.deleteMany({}); db.chathistories.deleteMany({});" >nul 2>&1
    echo ✓ 现有数据已清除
)

echo.
echo [步骤 5/7] 导入演示数据到容器...
docker cp demo-data-temp\afs-demo-backup /tmp/ 2>&1 | findstr /i error >nul
if %errorlevel% equ 0 (
    echo [错误] 复制数据到容器失败
    rmdir /s /q demo-data-temp
    pause
    exit /b 1
)
docker exec afs-system-mongoserver-1 mongorestore ^
  /tmp/afs-demo-backup/afs_db ^
  --drop ^
  >nul 2>&1
echo ✓ 数据导入完成

echo.
echo [步骤 6/7] 验证数据导入...
set user_count=0
for /f %%i in ('docker exec afs-system-mongoserver-1 mongosh afs_db --quiet --eval "db.users.countDocuments()"') do set user_count=%%i
set answer_count=0
for /f %%i in ('docker exec afs-system-mongoserver-1 mongosh afs_db --quiet --eval "db.answers.countDocuments()"') do set answer_count=%%i
echo 用户数: !user_count!
echo 回答数: !answer_count!

echo.
echo [步骤 7/7] 清理临时文件...
rmdir /s /q demo-data-temp

echo.
echo ========================================
echo   导入完成！
echo   演示数据已成功恢复到数据库
echo ========================================
pause