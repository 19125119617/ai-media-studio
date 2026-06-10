#!/bin/bash
# 阿里云部署脚本 - AI 创作工坊
# 服务器: 101.200.84.23  端口: 3001
# 用法: bash deploy.sh

SERVER="root@101.200.84.23"
REMOTE_DIR="/www/ai-media-studio"

# 如果没有 sshpass，用普通 ssh（需要手动输密码）
if command -v sshpass &> /dev/null; then
  echo "提示: 需要输入 root 密码"
  read -s -p "SSH 密码: " SSHPASS
  echo ""
  SSH_CMD="sshpass -p $SSHPASS ssh"
  SCP_CMD="sshpass -p $SSHPASS scp"
else
  echo "提示: 运行时会要求输入 root 密码"
  SSH_CMD="ssh"
  SCP_CMD="scp"
fi

echo "=== 部署 AI 创作工坊到阿里云 (101.200.84.23) ==="

# 1. 在服务器创建目录
$SSH_CMD $SERVER "mkdir -p $REMOTE_DIR/uploads/tmp $REMOTE_DIR/frontend/public"

# 2. 上传文件
echo "正在上传后端..."
$SCP_CMD -r backend/ $SERVER:$REMOTE_DIR/
echo "正在上传前端..."
$SCP_CMD -r frontend/ $SERVER:$REMOTE_DIR/

# 3. 检查并安装 Node.js 和 PM2
$SSH_CMD $SERVER '
  # 检查 Node.js
  if ! command -v node &> /dev/null; then
    echo "安装 Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
  fi
  echo "Node.js 版本:" $(node -v)

  # 检查 PM2
  if ! command -v pm2 &> /dev/null; then
    echo "安装 PM2..."
    npm install -g pm2
  fi
'

# 4. 安装依赖并启动
$SSH_CMD $SERVER "
  cd $REMOTE_DIR/backend && npm install --production

  cd $REMOTE_DIR
  # 如果有旧进程先停掉
  pm2 stop ai-media-studio 2>/dev/null || true
  pm2 delete ai-media-studio 2>/dev/null || true

  # 启动服务
  PORT=3001 pm2 start backend/server.js --name ai-media-studio
  pm2 save

  # 显示状态
  pm2 status
"

echo "=== 部署完成 ==="
echo "访问地址: http://101.200.84.23:3001"
echo ""
echo "提示: 如果 3001 端口无法访问，需要在阿里云安全组放行该端口。"
