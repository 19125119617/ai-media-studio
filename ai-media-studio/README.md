# AI 创作工坊 - 图像与视频生成 SaaS 平台

## 功能
- **文生图**：输入文字 → WanX 2.1 生成图片（消耗 10 积分）
- **文生视频**：输入文字 → WanX 2.1 生成视频（消耗 50 积分）
- **图生视频**：上传图片 → AI 让图片动起来（消耗 50 积分）
- **用户系统**：注册/登录/JWT 鉴权/积分管理
- **历史记录**：查看所有生成任务
- **统计概览**：使用次数统计

## 快速启动（本地调试）

```bash
# 1. 填写 API Key
cd backend
# 编辑 .env 文件，填入你的百炼 API Key
# BAILIAN_API_KEY=sk-xxxxxx

# 2. 启动后端
node server.js

# 3. 浏览器打开
# http://localhost:3001
```

## 部署到阿里云

```bash
# 方式一：一键脚本（需先配置 SSH 免密登录）
bash deploy.sh

# 方式二：手动上传
# 把整个项目上传到 /www/wwwroot/ai-media-studio/
# 然后用 PM2 启动：
pm2 start backend/server.js --name ai-media-studio
```

## 配置说明

编辑 `backend/.env`：

| 变量 | 说明 | 示例 |
|------|------|------|
| `BAILIAN_API_KEY` | 阿里云百炼 API Key | `sk-xxxxxxxx` |
| `JWT_SECRET` | JWT 签名密钥（自定义）| `my_secret_key` |
| `PORT` | 后端端口 | `3001` |

## 百炼 API Key 获取

1. 登录 [百炼控制台](https://bailian.console.aliyun.com/)
2. 进入「模型广场」→「API Key 管理」
3. 创建 API Key，复制填入 `.env`

## 注意
- 默认用内存存储用户数据，重启后清空。生产环境建议接入 MySQL。
- 新注册用户默认获得 100 积分。
- 视频生成耗时 1~3 分钟，前端会自动轮询状态。
