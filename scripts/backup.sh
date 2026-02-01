#!/bin/bash
# Chat-Beta 数据备份脚本
# 备份 MongoDB 数据库和用户文件结构

# 配置
BACKUP_DIR="/backups/chatbeta"
DATE=$(date +%Y%m%d_%H%M%S)
MONGO_DB="afs_db"
AWS_S3_BUCKET="afs-backup"
RETENTION_DAYS=7

# 创建备份目录
mkdir -p "$BACKUP_DIR/daily"
mkdir -p "$BACKUP_DIR/weekly"
mkdir -p "$BACKUP_DIR/logs"

# 日志函数
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$BACKUP_DIR/logs/backup_$DATE.log"
}

# 错误处理
error_exit() {
    log "ERROR: $1"
    exit 1
}

# 检查依赖
check_dependencies() {
    if ! command -v mongodump &> /dev/null; then
        error_exit "mongodump 未安装"
    fi
    
    if ! command -v mongorestore &> /dev/null; then
        error_exit "mongorestore 未安装"
    fi
    
    if ! command -v docker &> /dev/null; then
        error_exit "docker 未安装"
    fi
    
    backup_user_home=$(cd "$(dirname "$0")"; pwd)"/..
    if [ ! -d "$backup_user_home/userdata" ]; then
        error_exit "用户数据目录不存在：$backup_user_home/userdata"
    fi
}

# 备份 MongoDB
backup_mongodb() {
    log "开始备份 MongoDB 数据库..."
    
    # 获取 MongoDB 配置
    MONGO_HOST=${MONGO_HOST:-localhost}
    MONGO_PORT=${MONGO_PORT:-27017}
    MONGO_USER=${MONGO_USER:-}
    MONGO_PASSWORD=${MONGO_PASSWORD:-}
    
    # 构建 mongodump 命令
    MONGODUMP_CMD="mongodump --host $MONGO_HOST --port $MONGO_PORT --db $MONGO_DB --out $BACKUP_DIR/daily/mongodb_$DATE"
    
    if [ -n "$MONGO_USER" ] && [ -n "$MONGO_PASSWORD" ]; then
        MONGODUMP_CMD="$MONGODUMP_CMD --username $MONGO_USER --password $MONGO_PASSWORD --authenticationDatabase admin"
    fi
    
    # 执行备份
    if ! $MONGODUMP_CMD; then
        error_exit "MongoDB 备份失败"
    fi
    
    # 压缩备份
    log "压缩 MongoDB 备份..."
    tar czf "$BACKUP_DIR/daily/mongodb_$DATE.tar.gz" "$BACKUP_DIR/daily/mongodb_$Date"
    rm -rf "$BACKUP_DIR/daily/mongodb_$DATE"
    
    # 上传到 S3（如果配置了 AWS S3）
    if [ -n "$AWS_S3_BUCKET" ]; then
        log "上传到 AWS S3..."
        aws s3 cp "$BACKUP_DIR/daily/mongodb_$DATE.tar.gz" \
            "s3://$AWS_S3_BUCKET/chatbeta/mongodb_" 2>/dev/null || log "S3 上传失败，跳过"
    fi
    
    log "MongoDB 备份完成"
}

# 备份用户文件
backup_userdata() {
    log "开始备份用户文件结构..."
    
    USERDATA_DIR="$1/userdata"
    BACKUP_FILE="$BACKUP_DIR/daily/userdata_$DATE.tar.gz"
    
    # 备份 userdata 目录
    tar czf "$BACKUP_FILE" -C "$1" userdata 2>/dev/null
    
    if [ $? -ne 0 ]; then
        error_exit "用户数据备份失败"
    fi
    
    # 上传到 S3
    if [ -n "$AWS_S3_BUCKET" ]; then
        log "上传 userdata 到 AWS S3..."
        aws s3 cp "$BACKUP_FILE" \
            "s3://$AWS_S3_BUCKET/chatbeta/userdata_" 2>/dev/null || log "S3 上传失败，跳过"
    fi
    
    log "用户数据备份完成"
}

# 清理旧备份
cleanup_old_backups() {
    log "清理 $RETENTION_DAYS 天前的旧备份..."
    
    # 删除旧备份文件
    find "$BACKUP_DIR/daily" -type f -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete
    find "$BACKUP_DIR/weekly" -type f -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete
    
    # 删除旧日志
    find "$BACKUP_DIR/logs" -type f -name "*.log" -mtime +$RETENTION_DAYS -delete
    
    log "清理完成"
}

# 获取星期几（0-6，0=周日）
DAY_OF_WEEK=$(date +%u)

 主函数
main() {
    log "=== Chat-Beta 数据备份开始 ==="
    
    check_dependencies
    
    # 备份目录
    SCRIPT_DIR="$(cd "$(dirname "$0")"; pwd)"
    PROJECT_ROOT="$SCRIPT_DIR/../.."
    USERDATA_PATH="$PROJECT_ROOT/userdata"
    
    # 检查目录是否存在
    if [ ! -d "$USERDATA_PATH" ]; then
        log "警告：userdata 目录不存在，创建..."
        mkdir -p "$USERDATA_PATH"
    fi
    
    # 备份 MongoDB
    backup_mongodb
    
    # 备份用户文件
    backup_userdata "$PROJECT_ROOT"
    
    # 验证备份
    if [ -f "$BACKUP_DIR/daily/mongodb_$DATE.tar.gz" ] && [ -f "$BACKUP_DIR/daily/userdata_$DATE.tar.gz" ]; then
        log "备份验证成功"
        
        # 清理旧备份
        cleanup_old_backups
        
        log "备份大小："
        du -sh "$BACKUP_DIR/daily/"* | tail -n 2
        
        log "=== 备份完成 ==="
    else
        error_exit "备份验证失败，文件缺失"
    fi
    
    # 发送通知（可选）
    if command -v mail &> /dev/null; then
        echo "Chat-Beta 备份完成于 $(date)" | \
            mail -s "Chat-Beta 备份完成" admin@example.com 2>/dev/null || true
    fi
}

# 执行主函数
main "$@"