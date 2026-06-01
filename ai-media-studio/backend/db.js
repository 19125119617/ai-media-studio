const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/studio.db');

// 确保 data 目录存在
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) console.error('SQLite 连接失败:', err.message);
  else console.log('SQLite 连接成功:', DB_PATH);
});

// ─── 初始化表结构 ───────────────────────────────────────────────
db.serialize(() => {
  // 用户表
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    nickname TEXT,
    balance REAL DEFAULT 0,
    createdAt TEXT
  )`);

  // 任务表
  db.run(`CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    type TEXT NOT NULL,
    planKey TEXT,
    planLabel TEXT,
    prompt TEXT,
    aspectRatio TEXT,
    duration INTEGER,
    costYuan REAL,
    status TEXT,
    result TEXT,       -- JSON 数组
    error TEXT,
    galleryId TEXT,
    createdAt TEXT,
    FOREIGN KEY (userId) REFERENCES users(id)
  )`);

  // 作品库表
  db.run(`CREATE TABLE IF NOT EXISTS gallery (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    type TEXT,
    planLabel TEXT,
    prompt TEXT,
    result TEXT,       -- JSON 数组
    costYuan REAL,
    createdAt TEXT,
    tags TEXT,         -- JSON 数组
    FOREIGN KEY (userId) REFERENCES users(id)
  )`);

  // 充值记录表
  db.run(`CREATE TABLE IF NOT EXISTS recharge_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT NOT NULL,
    amount REAL NOT NULL,
    balanceBefore REAL,
    balanceAfter REAL,
    method TEXT DEFAULT 'wechat',
    status TEXT DEFAULT 'success',
    createdAt TEXT,
    FOREIGN KEY (userId) REFERENCES users(id)
  )`, (err) => {
    if (err) console.error('建表失败:', err.message);
    else console.log('SQLite 初始化完成');
  });
});

module.exports = db;
