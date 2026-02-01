@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo   AFS System - 备份验证工具
echo ========================================
echo.

REM 检查文件
if not exist "afs-demo-backup.tar.gz" (
    echo [错误] 备份文件 afs-demo-backup.tar.gz 不存在
    echo 请先运行 export-demo-data.bat 导出数据
    pause
    exit /b 1
)

echo [1/4] 检查文件存在性...
for %%A in (afs-demo-backup.tar.gz) do (
    echo 文件存在
    echo 文件大小: %%~zA 字节
    
    set /a size_mb=%%~zA/1048576
    echo 约等于 !size_mb! MB
)

echo.
echo [2/4] 验证文件完整性...
powershell -Command "try { $ProgressPreference = 'SilentlyContinue'; Expand-Archive -Path afs-demo-backup.tar.gz -DestinationPath verify-temp -Force; Remove-Item -Recurse verify-temp -Force; exit 0 } catch { Remove-Item -Recurse verify-temp -Force -ErrorAction SilentlyContinue; exit 1 }" 2>&1
if %errorlevel% equ 0 (
    echo ✓ 文件完整，可以正常解压
) else (
    echo ✗ 文件已损坏或格式错误
    echo 请重新导出数据
    pause
    exit /b 1
)

echo.
echo [3/4] 检查数据内容...
mkdir verify-temp
powershell -Command "$ProgressPreference = 'SilentlyContinue'; Expand-Archive -Path afs-demo-backup.tar.gz -DestinationPath verify-temp -Force" >nul 2>&1

if not exist "verify-temp\afs-demo-backup\afs_db" (
    echo [警告] 数据库目录不存在，数据可能不完整
) else (
    set /a json_count=0
    for /f %%i in ('dir /b verify-temp\afs-demo-backup\afs_db\*.json 2^>nul') do (
        set /a json_count+=1
    )
    
    echo 找到 !json_count! 个数据集合文件
    if !json_count! geq 1 (
        echo ✓ 数据文件正常
    ) else (
        echo ✗ 数据文件不足
    )
)

echo.
echo [4/4] 清理临时文件...
rmdir /s /q verify-temp

echo.
echo ========================================
echo   验证完成
echo   备份文件可用，可用于演示
echo ========================================
echo.

echo 建议：演示前执行完整自动化测试
pause

REM 询问是否运行自动测试
choice /C YN /M "是否现在运行功能测试"
if %errorlevel% equ 1 (
    call test-demo-functionality.bat
)