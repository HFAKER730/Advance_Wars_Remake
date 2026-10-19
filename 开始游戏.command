#!/bin/zsh
set -e
cd "${0:A:h}"
if command -v node >/dev/null 2>&1; then
  GAME_NODE="$(command -v node)"
else
  for GAME_CANDIDATE in /opt/homebrew/bin/node /usr/local/bin/node "$HOME"/.local/share/pi-node/node-*/bin/node(N); do
    if [[ -x "$GAME_CANDIDATE" ]]; then GAME_NODE="$GAME_CANDIDATE"; break; fi
  done
fi
if [[ -z "${GAME_NODE:-}" ]]; then
  echo '未找到 Node.js。请安装 Node.js 20 或更新版本，再双击此文件。'
  read '?按回车关闭窗口…'
  exit 1
fi
GAME_PORT="${PORT:-4173}"
(
  for GAME_ATTEMPT in {1..30}; do
    if curl -fsS "http://localhost:${GAME_PORT}/api/rooms" >/dev/null 2>&1; then
      open "http://localhost:${GAME_PORT}"
      break
    fi
    sleep 1
  done
) &
echo '前线指令 · 保持此窗口运行，即可让朋友通过局域网加入。'
"$GAME_NODE" server.mjs
