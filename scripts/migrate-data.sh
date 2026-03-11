#!/bin/bash

# AFS-System 数据迁移脚本
# 用于在电脑之间迁移 Docker 数据

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${1:-./afs_data_backup}"

# 需要备份的数据目录
DATA_DIRS=(
    "mongoserver/mongodb_data"
    "server/storage"
    "modelserver/models"
)

# 需要备份的配置文件
CONFIG_FILES=(
    ".env"
)

show_help() {
    echo "AFS-System 数据迁移工具"
    echo ""
    echo "用法:"
    echo "  $0 backup [备份目录]    - 备份数据"
    echo "  $0 restore [备份目录]   - 恢复数据"
    echo "  $0 help                 - 显示帮助"
    echo ""
    echo "示例:"
    echo "  $0 backup D:/afs_backup"
    echo "  $0 restore D:/afs_backup"
}

backup_data() {
    local backup_path="$1"
    echo "=== 开始备份数据到: $backup_path ==="

    mkdir -p "$backup_path"

    # 备份数据目录
    for dir in "${DATA_DIRS[@]}"; do
        if [ -d "$PROJECT_ROOT/$dir" ]; then
            echo "备份: $dir"
            mkdir -p "$backup_path/$(dirname "$dir")"
            cp -r "$PROJECT_ROOT/$dir" "$backup_path/$dir"
        else
            echo "跳过 (不存在): $dir"
        fi
    done

    # 备份配置文件
    for file in "${CONFIG_FILES[@]}"; do
        if [ -f "$PROJECT_ROOT/$file" ]; then
            echo "备份配置: $file"
            cp "$PROJECT_ROOT/$file" "$backup_path/$file"
        fi
    done

    echo ""
    echo "=== 备份完成! ==="
    echo "备份位置: $backup_path"
    echo ""
    echo "请将此备份目录复制到新电脑，然后运行:"
    echo "  $0 restore $backup_path"
}

restore_data() {
    local backup_path="$1"

    if [ ! -d "$backup_path" ]; then
        echo "错误: 备份目录不存在: $backup_path"
        exit 1
    fi

    echo "=== 从备份恢复数据: $backup_path ==="
    echo "警告: 这将覆盖现有数据!"
    read -p "确认继续? (y/N): " confirm

    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        echo "已取消"
        exit 0
    fi

    # 恢复数据目录
    for dir in "${DATA_DIRS[@]}"; do
        if [ -d "$backup_path/$dir" ]; then
            echo "恢复: $dir"
            mkdir -p "$PROJECT_ROOT/$(dirname "$dir")"
            rm -rf "$PROJECT_ROOT/$dir"
            cp -r "$backup_path/$dir" "$PROJECT_ROOT/$dir"
        else
            echo "跳过 (备份中不存在): $dir"
        fi
    done

    # 恢复配置文件
    for file in "${CONFIG_FILES[@]}"; do
        if [ -f "$backup_path/$file" ]; then
            echo "恢复配置: $file"
            cp "$backup_path/$file" "$PROJECT_ROOT/$file"
        fi
    done

    echo ""
    echo "=== 恢复完成! ==="
    echo "现在可以运行: docker compose up -d --build"
}

# 主逻辑
case "${1:-help}" in
    backup)
        backup_data "${2:-./afs_data_backup}"
        ;;
    restore)
        restore_data "${2:-./afs_data_backup}"
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo "未知命令: $1"
        show_help
        exit 1
        ;;
esac
