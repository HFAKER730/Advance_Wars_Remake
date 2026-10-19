@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo 未找到 Node.js。请先安装 Node.js 20 或更新版本。
  pause
  exit /b 1
)
echo 前线指令：服务启动后，在浏览器打开 http://localhost:4173
node server.mjs
pause
