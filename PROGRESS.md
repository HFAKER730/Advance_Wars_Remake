# 开发进度 · DEVELOPMENT PROGRESS

> 最后更新：2026-10-18
> 主线工程：`field-command-main/`
> 状态：**M0–M5 已交付，四阵营像素美术管线开发中（尚未接入游戏）**

---

## 一、里程碑总览

| 阶段 | 内容 | 状态 | 验收记录 |
| :--- | :--- | :--- | :--- |
| M0 | 工程基线、规则范围、授权边界 | ✅ 完成 | [DEVELOPMENT-BASELINE.md](docs/DEVELOPMENT-BASELINE.md) |
| M1 | 陆战规则、指令协议、确定性引擎 | ✅ 完成 | [RULES-CONTRACT.md](docs/RULES-CONTRACT.md) |
| M2 | 联机可靠性：幂等、重试、重连快照、存档 | ✅ 完成 | `test/idempotency.test.mjs` |
| M3 | 可交付陆战版、真实浏览器 GUI 验收 | ✅ 完成（局域网仅单机验证） | [M3-ACCEPTANCE.md](docs/M3-ACCEPTANCE.md) |
| M4 | 战争迷雾：视野、隐蔽、按席位投影、埋伏 | ✅ 完成 | [M4-ACCEPTANCE.md](docs/M4-ACCEPTANCE.md) |
| M5 | 海空军、运输、机场/港口 | ✅ 完成 | [M5-ACCEPTANCE.md](docs/M5-ACCEPTANCE.md) |
| — | **四阵营像素美术管线** | 🚧 **进行中**（模块完成，未接入渲染器） | 见第四节 |
| M6 | 战役与地图编辑器 | ⏸ 未开始 | — |

---

## 二、已验证可玩的功能

### 规则与内容

- **13 种兵种**
  - 陆军 8：步兵、机动步兵、侦察车、轻型坦克、重型坦克、自行火炮、火箭炮、补给车
  - 空军 3：战斗机、轰炸机、运输直升机
  - 海军 2：驱逐舰、登陆舰
- **4 张地图**：晨曦平原（14×12）、双桥河谷（18×14）、十字要塞（18×16）、海峡对峙（18×14），均支持 2–4 人
- **2 名原创指挥官**：林岚（突击先锋）、周衡（战地工程师），各含普通与超级能力
- **地形** 12 种：平原、道路、森林、山地、河流、桥梁、海洋、城市、工厂、机场、港口、总部
- **完整循环**：移动 → 攻击/占领/补给 → 收入 → 生产 → 维修 → 淘汰 → 胜负

### 系统

- **确定性引擎**：伤害无随机数，同一指令序列必得同一状态，便于联机同步与回放。
- **联机**：Node HTTP + SSE，服务端校验指令、按房间广播状态；席位令牌、断线重连、请求幂等、版本冲突拒绝。
- **战争迷雾**（房间级开关）：按兵种视野、森林/山地隐蔽、队友共享视野、按席位裁剪快照、行军埋伏截断。
- **存档**：`data/autosave.json` 原子写入 + `.bak` 回退；手动快照另存。
- **AI**：单机对局可全程自动运行；能生产、运输、装载/卸载、合并残血单位。
- **表现层**：逐格移动、转向、双军交火、击毁与倒下特效、据点升降旗动画、可开关的合成提示音。
- **平台**：桌面与触屏布局；Chromium 内核已验证。

### 已知尚未实现

- 完整战役、地图编辑器（不在 M1–M5 承诺内）
- 房主自动迁移、公网匹配、旁观模式、跨设备找回席位
- 迷雾的「上次已知位置」记忆与残影
- 手动快照的玩家可操作回滚菜单
- 桌面打包与原生局域网自动发现

---

## 三、测试现状

命令：`npm test`（等价于 `node --test test/*.test.mjs`）

**结果：152 项通过 / 0 失败**，约 47 s。

| 套件 | 用例数 | 覆盖内容 |
| :--- | ---: | :--- |
| `engine.test.mjs` | 17 | 地图初始化、移动、战斗、占领、生产、维修、能力、AI 全流程 |
| `invariants.test.mjs` | 18 | 指令校验矩阵、状态不变量、可重放、校验器拒绝非法状态 |
| `contract.test.mjs` | 16 | 数据表、整数伤害公式、CO 修正、经济与充能 |
| `transport.test.mjs` | 18 | 海空移动、目标类别、每回合耗油、装载/卸载/合并、生产设施限制 |
| `idempotency.test.mjs` | 16 | 请求去重、重试回放、重连快照、存档迁移、AI 续跑 |
| `fog.test.mjs` | 18 | 视野半径、隐蔽地形、队伍共享视野、投影不泄漏、埋伏截断 |
| `fog-server.test.mjs` | 7 | 按席位下发快照与 SSE、迷雾开关权限、迷雾对局走完整 HTTP |
| `server.test.mjs` | 8 | 真实 HTTP 多客户端、席位鉴权、版本冲突、存档恢复 |
| `match.test.mjs` | 5 | 2/3/4 人 FFA 与 4 人 2v2 完整 HTTP 对局直至分出胜负 |
| `ai-baseline.test.mjs` | 4 | AI 行为回归：胜负、步数上界、无空转、无非法指令 |
| `combat-visual.test.mjs` | 6 | 战斗演出时序 |
| `save-store.test.mjs` | 3 | 原子写入、备份回退、版本拒绝 |
| `animation-timing.test.mjs` | 2 | 动画时间轴 |
| `capture-scene.test.mjs` | 2 | 占领动画状态 |
| `property-flag.test.mjs` | 2 | 据点旗帜升降 |
| `faction-art.test.mjs` | 10 | 阵营配色坡道、剪影可辨识度、四阵营几何差异、朝向 |

测试使用临时端口与临时存档，不会修改正式 `data/` 目录。

---

## 四、进行中：四阵营像素美术管线

目标：同一兵种在红军 / 蓝军 / 黄军 / 绿军下**几何剪影不同**，而不是只换颜色。

### 架构

「共用骨架 + 色板槽位 + kit 几何分支」三层：

- **骨架**：每个兵种一条共享轮廓，保证同类单位可辨认。
- **色板**：`faction-style.mjs` 的 7 个表面槽 + 7 个材质槽，四阵营明度结构一致，只改色相。
- **kit**：`LAND_KITS` / `AIR_KITS` / `SEA_KITS`，按阵营切换炮塔、履带、舱盖、机翼、舰桥、烟囱等几何分支。

### 已完成

| 模块 | 内容 | 状态 |
| :--- | :--- | :--- |
| `public/art/faction-style.mjs` | 四阵营色板、明度坡道校验、`SAMPLE_UNITS` 目录 | ✅ |
| `public/art/pixel-draw.mjs` | `box` / `poly` / `line` / `face` / `rivets` / `insignia` 像素原语 | ✅ |
| `public/art/faction-land.mjs` | 8 种陆军 + 2 种步兵，含履带、车体、炮塔、火箭架、舱盖分支 | ✅ |
| `public/art/faction-direction.mjs` | 陆战单位前 / 后朝向（up / down），与侧视共用 kit | ✅ |
| `public/art/faction-air.mjs` | 固定翼 + 旋翼，共享翼型分层、座舱、进气、起落架分支 | ✅ 重写完成 |
| `public/art/faction-sea.mjs` | 巡逻舰 + 登陆舰，共享甲板细节层（板缝、栏杆、系缆桩、舱口） | ✅ 重写完成 |
| `test/faction-art.test.mjs` | 10 项回归：配色坡道、面积、四阵营剪影 distinct、朝向、确定性 | ✅ 全绿 |

**当前指标**：12 个兵种变体 × 4 阵营，全部达到 **4 种不同剪影**；每单位平均 9.3–11.0 种颜色。

### 美术验证工具

全部零依赖，直接 `node` 运行：

```bash
node tools/art-report.mjs        # 每兵种四阵营剪影 distinct 数、颜色数、像素数
node tools/art-compare.mjs       # 与冻结版 unit-art.mjs 的细节密度对比（像素/颜色/边缘数）
node tools/art-stats.mjs         # 颜色槽使用率、轮廓着墨比例
node tools/art-ascii.mjs tank red   # 把单个精灵打成 ASCII，便于逐像素检查
node tools/render-faction-sheets.mjs # 输出 art-sheets/*.png（接触表）
node tools/zoom-sheets.mjs 8     # 每阵营 8× 大图
node tools/unit-sheets.mjs 13    # 每兵种四阵营 13× 对比图
node tools/preview-art.mjs       # 交互预览，默认 http://localhost:4174
```

`art-sheets/` 已在 `.gitignore` 中，属于本地审阅产物，不进入仓库。

### 尚未完成（重要）

1. **未接入游戏渲染器**。`public/renderer.mjs` 仍然 import `unit-art.mjs` 的 `paintUnitArtwork` 与 `TEAM_PALETTES`；四阵营模块目前是独立可运行、有测试的美术库，玩家在游戏里还看不到。
2. **空中兵种覆盖不全**。游戏有战斗机、轰炸机、运输直升机三种空中单位，美术模块只有 `fighter`（固定翼）与 `copter`（旋翼）两条骨架，`bomber` 与 `heli` 尚未专门绘制。
3. **舰船覆盖不全**。游戏有驱逐舰、登陆舰；美术模块的 `patrol` / `landing` 是通用舰型，尚未按兵种细化。
4. **阵营映射未定**。游戏当前用 `TEAM_COLORS` 的四色（红 / 蓝 / 黄 / 紫），美术用红 / 蓝 / 黄 / 绿；接入时需要统一命名与席位映射。
5. **动画层未适配**。`unit-motion.mjs` 的步兵步态、履带滚动、旋翼扫掠仍基于旧的精灵缓存与调色板数组，需要一并迁移。

---

## 五、已知限制

规则与联机方面：

1. 迷雾是开关式的，单位离开视野即从客户端消失，没有「上次已知位置」记忆。
2. 请求去重记录上限 64 条，长时间对局中的陈旧重试会被当作新请求。
3. `reachable()` 只回答「能走到哪」，行动合法性由 `applyAction` 判定，客户端须自行按 `acted` 过滤。
4. 伤害完全确定，无幸运值；与原作手感不同，但联机同步更简单。
5. 规则状态 `version` 为 1，存档外壳版本为 3，改动需提供迁移或明确拒绝。
6. 房间上限 128，超出需重启并清理旧存档；房主进程退出即中断服务。
7. 迷雾下的 AI 只读本队投影，未侦察时会主动摸索，推进慢于全图可见对局。
8. 只在 Chromium 内核验证，Safari / Firefox 未测。
9. 未做多设备真实局域网对局，也未观测长时间连续对局的内存与帧率。

美术方面：

10. 四阵营系统未接入，游戏内仍是单套 `TEAM_PALETTES`。
11. 轰炸机、运输直升机、驱逐舰、登陆舰尚未有专属骨架。
12. 空中与海上兵种只有侧视，没有前 / 后朝向（游戏内这两类也只走左右朝向，暂不冲突）。
13. `faction-air.mjs` 的双翼采用「绘制一次 + 垂直翻转」生成近翼，翻转时副翼与灯位会镜像，远看可接受，逐像素审查时能看出。

授权方面：

14. **上游仓库未声明开源许可证。** 公开可见与在 GitHub 内 fork 不等于获得重用、再分发或更改授权。发布前须联系原作者确认，见 [README](README.md) 与 [DEVELOPMENT-BASELINE.md](docs/DEVELOPMENT-BASELINE.md) 第五节。

---

## 六、下一步

按优先级：

1. **接入渲染器**：让 `renderer.mjs` 按 `unit.owner` 选择阵营样式，替换 `TEAM_PALETTES`；同步改造 `unit-motion.mjs` 的精灵缓存键（type + faction + gait）。
2. **补齐兵种骨架**：`bomber`、`heli`、`destroyer`、`lander` 四条专属轮廓，并加入 `faction-art.test.mjs` 的 4-signature 断言。
3. **动画层迁移**：步兵步态、履带滚动、旋翼扫掠改为读阵营色板；开火/受击特效颜色跟随阵营。
4. **AI 难度档位**：当前只有单一策略，计划按威胁评估精度分档。
5. **M6 战役与地图编辑器**：需要先确定存档 schema 与地图格式，再动工。

---

## 七、复现与验证

```bash
# 启动游戏（http://localhost:4173）
npm start

# 全量测试（152 项）
npm test

# 真实浏览器 GUI 验收（需先启动服务）
node tools/gui-check.mjs
node tools/gui-check-m5.mjs

# 美术回归与预览
node --test test/faction-art.test.mjs
node tools/render-faction-sheets.mjs
node tools/preview-art.mjs
```

环境：Node.js >= 20（开发验证使用 v24.19.0），**无 npm 运行时依赖**。

---

## 八、目录速查

```
field-command-main/
├── public/
│   ├── shared/engine.mjs        共享纯规则引擎（无 DOM / 网络 / 计时器）
│   ├── shared/animation-timing.mjs
│   ├── renderer.mjs             Canvas 像素绘制与坐标交互
│   ├── app.mjs                  房间与战场 UI
│   ├── unit-art.mjs             冻结版单位美术（当前游戏使用）
│   ├── unit-direction.mjs       四朝向绘制
│   ├── unit-motion.mjs          动作与精灵缓存
│   ├── unit-death.mjs           击毁特效
│   ├── combat-scene.mjs         交火演出
│   ├── capture-scene.mjs        占领演出
│   ├── property-flag.mjs        据点旗帜时序
│   └── art/                     四阵营美术管线（新，未接入）
│       ├── faction-style.mjs
│       ├── pixel-draw.mjs
│       ├── faction-land.mjs
│       ├── faction-direction.mjs
│       ├── faction-air.mjs
│       └── faction-sea.mjs
├── server.mjs                   HTTP + SSE，服务端校验与广播
├── save-store.mjs               版本化原子持久化
├── test/                        152 项测试
├── tools/                       美术与 GUI 验证脚本（零依赖）
└── docs/                        规则契约与各阶段验收记录
```
