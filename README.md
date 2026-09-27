# 乐感练习（yuegan）

系统依次弹出一串钢琴音，用户在滑块上把这些音按高低排序。用来练「听出音的高低关系」这件事。

当前是**基础版**：每题弹 2～5 个音，每个音一个滑块，滑块有 n 个档位（n = 本题音数），
把每个滑块放到它该在的位置（数字越大 = 音越高），全部放对才算这题答对。

## 快速开始

```bash
pnpm install
pnpm dev          # 打开 http://localhost:5173
```

首次进入练习会加载 28 个钢琴采样（约 2.4 MB，打包在仓库里，不走外网），之后不再加载。

```bash
pnpm test         # 领域核心的全部自动化测试
pnpm typecheck    # 两个包的 TypeScript 检查
pnpm build        # 产出 apps/web/dist
```

## 目录结构

```
packages/core/            ← 平台无关的领域核心（纯 TS，不含任何浏览器 API）
  src/domain/
    value-objects/        音高、音名、音程、档位名次、稀疏采样映射
    entities/             题目、作答、判分结果、练习规格、一局练习
    services/             出题器、判分器 —— 所有规则都在这里
    ports/                音频播放、练习记录仓储、随机源（只有接口）
  src/application/        用例编排：开一局、听、提交、重听、下一题、结算
  tests/                  42 个测试：出题性质、判分口径、流程与不变量
apps/web/                 ← Web 应用（React + 原生 Web Audio）
  src/infrastructure/     钢琴采样加载、Web Audio 播放器、localStorage 仓储
  src/presentation/       React 页面、组件、与 core 的连接
  public/samples/piano/   28 个 Salamander 钢琴采样（C1–A7）
docs/adr/                 架构决策记录
CONTEXT.md                领域术语表（唯一真相：某个词在这个项目里指什么）
```

设计约束只有一条，但它很硬：**`packages/core` 里不许出现任何浏览器 API**。
只要守住这条，以后出安卓 app 时领域核心可以原样复用，只需要换播放器适配器和界面。

## 这一版的能力边界

已经做的：

- 每道题 2～5 个音，音高在 C3–C5 内随机、互不相同，播放顺序打乱
- 两种难度：`全音域`（跨度不限）、`八度内`（整题所有音落在一个八度内）
- 一局 10 题，规格在开始前选定；每题最多重听 3 次
- 提交后立刻给出对错、逐音对照（你填第几位 / 正确第几位 / 真实音高）并重放真实音频
- 结算页给出正确率与逐题明细，成绩存本地（localStorage）

刻意没做的（但结构上留了口子）：

- **绝对音高识别**：需要参考音与音级刻度，是另一种能力，见 `CONTEXT.md`
- **音程判断**：判分器的扩展点；作答结构（档位序列）不需要改
- **单音重播**：只提供整题重听
- 账号、排行、跨设备同步

## 扩展时看哪里

| 想做的事 | 改哪里 |
| --- | --- |
| 加难度档（音域、跨度、音数） | `domain/entities/drill-spec.ts` 与 `domain/services/exercise-generator.ts` |
| 改判分口径（音程、音级、部分得分） | 新写一个 `Judge` 实现，替换 `domain/services/judge.ts` 的注入 |
| 换音色或换播放方式 | 实现 `domain/ports/audio-player.ts` 的端口（参考 `apps/web/src/infrastructure/`） |
| 上安卓端 | 复用 `packages/core`，另写播放器适配器与界面 |
| 改界面 / 加页面 | `apps/web/src/presentation/`，业务状态一律从 core 的 view state 取 |
