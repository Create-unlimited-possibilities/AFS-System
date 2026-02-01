@echo off
chcp 65001 >nul
echo ========================================
echo   AFS System - 演示数据导出工具
echo ========================================
echo.

REM 检查 Docker 是否运行
docker ps >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] Docker 未运行，请先启动 Docker
    echo 请启动 Docker Desktop 后再试
    pause
    exit /b 1
)

echo [步骤 1/5] 检查 MongoDB 容器...
docker ps | findstr mongoserver >nul
if %errorlevel% neq 0 (
    echo [错误] MongoDB 容器未运行
    echo 正在尝试启动容器...
    docker-compose up -d mongoserver
    timeout /t 15 /nobreak >nul
)
docker ps | findstr mongoserver >nul
if %errorlevel% neq 0 (
    echo [错误] MongoDB 容器启动失败
    pause
    exit /b 1
)
echo ✓ MongoDB 容器正在运行

echo.
echo [步骤 2/5] 检查数据库...
docker exec afs-system-mongoserver-1 mongosh afs_db ^
  --eval "db.getCollectionNames()" >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 数据库 afs_db 无法连接
    pause
    exit /b 1
)
echo ✓ 数据库连接正常

echo.
echo [步骤 3/5] 创建备份目录...
if exist "demo-backup" rmdir /s /q demo-backup
if not exist "demo-backup" mkdir demo-backup
echo ✓ 备份目录已创建

echo.
echo [步骤 4/5] 导出数据库数据...
docker exec afs-system-mongoserver-1 mongodump ^
  --db afs_db ^
  --out /tmp/afs-demo-backup ^
  --quiet
  
docker cp afs-system-mongoserver-1:/tmp/afs-demo-backup ./demo-backup/
echo ✓ MongoDB 数据导出完成

echo.
echo [步骤 5/5] 打包压缩备份文件...
if exist "afs-demo-backup.tar.gz" del afs-demo-backup.tar.gz
powershell -Command "Compress-Archive -Path demo-backup -DestinationPath afs-demo-backup.tar.gz -CompressionLevel Optimal"
echo ✓ 压缩完成

echo.
echo ========================================
echo   导出完成！
echo.
echo   文件位置: afs-demo-backup.tar.gz
echo   项目根目录: %CD%
echo.
for %%A in (afs-demo-backup.tar.gz) do (
    echo   文件大小: %%~zA 字节 (约 %%~zA / 1048576 MB)
)
echo.
echo   后续操作：
echo   1. 将 afs-demo-backup.tar.gz 复制到移动磁盘
echo   2. 复制整个项目目录到移动磁盘
echo   3. 在演示现场运行 import-demo-data.bat 导入数据
echo ========================================
pause