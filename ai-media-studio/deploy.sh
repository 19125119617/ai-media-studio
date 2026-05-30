#!/bin/bash
# 阿里云部署脚本 - AI 创作工坊
# 服务器: 8.148.224.72  端口: 3001

SERVER="root@8.148.224.72"
REMOTE_DIR="/www/wwwroot/ai-media-studio"

echo "=== 部署 AI 创作工坊到阿里云 ==="

# 1. 在服务器创建目录
ssh $SERVER "mkdir -p $REMOTE_DIR/uploads/tmp $REMOTE_DIR/frontend/public"

# 2. 上传文件
scp -r backend/ $SERVER:$REMOTE_DIR/
scp -r frontend/ $SERVER:$REMOTE_DIR/

# 3. 安装依赖
ssh $SERVER "cd $REMOTE_DIR/backend && npm install --production"

# 4. 用 PM2 启动
ssh $SERVER "
  cd $REMOTE_DIR
  pm2 stop ai-media-studio 2>/dev/null || true
  pm2 start backend/server.js --name ai-media-studio --env production
  pm2 save
"

echo "=== 部署完成 ==="
echo "访问地址: http://8.148.224.72:3001"
