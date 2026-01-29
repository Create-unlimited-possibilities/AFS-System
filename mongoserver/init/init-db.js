// mongoserver/init/init-db.js
db = db.getSiblingDB('afs_db');

db.createCollection('users');
db.createCollection('memories');
db.createCollection('questions');
db.createCollection('chathistories');
db.createCollection('trainingjobs');


print("AFS 数据库初始化完成！");