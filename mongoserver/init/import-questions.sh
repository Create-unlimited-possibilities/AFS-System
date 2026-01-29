set -euo pipefail

FILE="/docker-entrypoint-initdb.d/questions.json"
DB="$MONGO_INITDB_DATABASE"
COLLECTION="questions"

if [[ ! -f "$FILE" ]]; then
  echo "错误：未找到 $FILE，跳过导入"
  exit 0
fi

echo "正在导入 $COLLECTION 到数据库 $DB ..."

mongoimport \
  --db "$DB" \
  --collection "$COLLECTION" \
  --file "$FILE" \
  --jsonArray \
  --drop                # 可选：每次初始化都先清空（开发时常用）
  # --mode upsert       # 或者改成 upsert，根据 _id 更新（生产更常见）
  # --verbose

echo "导入完成：$COLLECTION"