@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo   AFS System - 演示功能自动化测试
echo ========================================
echo.

set total_tests=0
set passed_tests=0
set failed_tests=0

echo [测试 1/10] Docker 服务检查...
set /a total_tests+=1
docker ps >nul 2>&1
if %errorlevel% equ 0 (
    echo ✓ Docker 运行正常
    set /a passed_tests+=1
) else (
    echo ✗ Docker 未运行
    set /a failed_tests+=1
)

echo.
echo [测试 2/10] MongoDB 容器检查...
set /a total_tests+=1
docker ps | findstr mongoserver >nul
if %errorlevel% equ 0 (
    echo ✓ MongoDB 容器运行正常
    set /a passed_tests+=1
) else (
    echo ✗ MongoDB 容器未运行
    set /a failed_tests+=1
)

echo.
echo [测试 3/10] 数据库连接检查...
set /a total_tests+=1
docker exec afs-system-mongoserver-1 mongosh afs_db ^
  --eval "db.getMongo()" >nul 2>&1
if %errorlevel% equ 0 (
    echo ✓ 数据库连接成功
    set /a passed_tests+=1
) else (
    echo ✗ 数据库连接失败
    set /a failed_tests+=1
)

echo.
echo [测试 4/10] 数据库集合检查...
set /a total_tests+=1
docker exec afs-system-mongoserver-1 mongosh afs_db ^
  --quiet --eval "db.getCollectionNames()" | findstr users >nul
if %errorlevel% equ 0 (
    echo ✓ 数据库集合存在
    set /a passed_tests+=1
) else (
    echo ✗ 数据库集合缺失
    set /a failed_tests+=1
)

echo.
echo [测试 5/10] 用户数据检查...
set /a total_tests+=1
for /f %%i in ('docker exec afs-system-mongoserver-1 mongosh afs_db --quiet --eval "db.users.countDocuments()"') do set user_count=%%i
if !user_count! gtr 0 (
    echo ✓ 用户数据存在 (!user_count! 个用户)
    set /a passed_tests+=1
) else (
    echo ✗ 没有用户数据
    set /a failed_tests+=1
)

echo.
echo [测试 6/10] 回答数据检查...
set /a total_tests+=1
for /f %%i in ('docker exec afs-system-mongoserver-1 mongosh afs_db --quiet --eval "db.answers.countDocuments()"') do set answer_count=%%i
if !answer_count! gtr 0 (
    echo ✓ 回答数据存在 (!answer_count! 条回答)
    set /a passed_tests+=1
) else (
    echo ✗ 没有回答数据
    set /a failed_tests+=1
)

echo.
echo [测试 7/10] 问题数据检查...
set /a total_tests+=1
docker exec afs-system-mongoserver-1 mongosh afs_db ^
  --quiet --eval "db.questions.countDocuments()" | findstr /[0-9]/ >nul
if %errorlevel% equ 0 (
    for /f %%i in ('docker exec afs-system-mongoserver-1 mongosh afs_db --quiet --eval "db.questions.countDocuments()"') do set question_count=%%i
    echo ✓ 问题数据存在 (!question_count! 个问题)
    set /a passed_tests+=1
) else (
    echo ✗ 问题数据缺失
    set /a failed_tests+=1
)

echo.
echo [测试 8/10] Web 服务测试...
set /a total_tests+=1
curl -s http://localhost:8080 >nul 2>&1
if %errorlevel% equ 0 (
    echo ✓ Web 服务可访问
    set /a passed_tests+=1
) else (
    echo ✗ Web 服务无法访问
    set /a failed_tests+=1
)

echo.
echo [测试 9/10] API 服务测试...
set /a total_tests+=1
curl -s http://localhost:3001/api/health >nul 2>&1
if %errorlevel% equ 0 (
    echo ✓ API 服务可访问
    set /a passed_tests+=1
) else (
    echo ✗ API 服务无法访问
    set /a failed_tests+=1
)

echo.
echo [测试 10/10] 演示环境完整性...
set /a total_tests+=1
if not exist "afs-demo-backup.tar.gz" (
    echo ✗ 备份文件不存在
    set /a failed_tests+=1
) else if not exist "scripts\verify-backup.bat" (
    echo ✗ 验证脚本不存在
    set /a failed_tests+=1
) else (
    echo ✓ 演示环境完整
    set /a passed_tests+=1
)

echo.
echo ========================================
echo   测试结果汇总
echo ========================================
echo   总计: !total_tests! 项测试
echo   通过: !passed_tests! 项
echo   失败: !failed_tests! 项
echo.
if !passed_tests! equ !total_tests! (
    echo ✓ 所有测试通过，系统可用于演示
) else (
    echo ⚠ 部分测试失败，请检查系统状态
)
echo ========================================
pause