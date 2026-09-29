# 乐感练习（yuegan）

乐感练习（`yuegan`）是一个练耳网页应用。它从「两个音谁更高」开始，一路练到「把一串音排成正确的相对高低」，
再加上音程、和弦、音阶与调式、音级、和弦进行与旋律听写。界面与课程移植自
[abeage1/earpath-app](https://github.com/abeage1/earpath-app)（MIT），全站中英双语、默认中文。

它练的核心是**相对位置判断**：听出若干音彼此的高低关系，不要求听出这些音具体是哪些音。
真实音高与音名只在反馈阶段出现。

## 运行

需要 Node >= 20.19.0 与 pnpm@11.7.0。

```sh
pnpm install
pnpm dev
```

`pnpm dev` 在 http://localhost:5173 启动 Vite（`server.port` 5173，不自动打开浏览器）。

进入练习页后点一下「开始」，才会加载 `apps/web/public/samples/piano/` 下全部 28 个钢琴采样（约 1.8 MB），
之后不再加载；采样随仓库打包，运行时不访问外网。PWA 的 Service Worker 会在首次访问后缓存应用壳与采样，
断网也能继续练。

## 仓库结构

```text
packages/core/               平台无关的领域核心（@yuegan/core）：纯 TypeScript，无运行时依赖
  src/domain/value-objects/  音高、音名、音程、档位、稀疏采样映射
  src/domain/content/        音乐内容：音程/和弦/音阶/音级/级数的半音结构（只有事实，没有名字）
  src/domain/entities/       题目、作答、判分结果、练习规格、一局练习
  src/domain/services/       出题器与判分器（排序题的全部规则）、声部安排、旋律出题规则
  src/domain/ports/          音频播放、练习记录仓储、随机源（只有接口）
  src/application/           一局练习的编排（DrillRunner）与 view state
  tests/                     5 个测试文件、67 个用例
apps/web/                    浏览器端（@yuegan/web）：React 界面 + 采样播放 + 课程
  src/app/                   hash 路由与应用外壳
  src/course/                课程表：模块、关卡、解锁路径
  src/questions/             四种题型的协议与生成器、播放事件构造器（含排序题接 core 的适配）
  src/i18n/                  中英字典、翻译运行时、领域 id → 文案的映射（含一致性门禁测试）
  src/infrastructure/        采样播放引擎、进度存档
  src/presentation/          七个页面、练习会话状态机与组件
  src/styles/global.css      深色主题样式（移植自 earpath 的样式表，末尾是本仓库新增部分）
  public/samples/piano/      28 个 Salamander 钢琴采样
docs/adr/                    架构决策记录：0001 领域核心与平台分离、0002 原生 Web Audio、
                             0003 课程壳与排序题的分工、0004 音乐内容进 core 而显示名留平台
CONTEXT.md                   领域术语的唯一定义处
AGENTS.md                    面向 agent 的工作约定
```

仓库用 pnpm 管理，workspace 只有 `packages/core` 与 `apps/web` 两个包；根包 `yuegan` 是 private 的，只放脚本与 `tsconfig.base.json`。

`packages/core` 里不出现任何浏览器 API：播放、存储、随机数一律通过 `packages/core/src/domain/ports/` 的接口注入。
音乐事实（有哪些音程/和弦/音阶/音级、每种怎么排列）与两条纯算法（声部安排、旋律出题规则）也住在 core；
面向用户的名字与参考曲目住在 `apps/web/src/i18n/`——这条分工见 [ADR 0004](docs/adr/0004-music-content-lives-in-core.md)。
`apps/web` 单向依赖 `@yuegan/core`，import 一律走包入口。课程与进度这类产品概念住在 `apps/web`，
排序题的出题与判分规则只住在 `packages/core`——这条分工见 [ADR 0003](docs/adr/0003-earpath-curriculum-in-web.md)。

## 命令

| 命令 | 展开后 | 作用 |
| --- | --- | --- |
| `pnpm dev` | `pnpm --filter @yuegan/web run dev` | 启动 Vite 开发服务器 |
| `pnpm build` | `pnpm --filter @yuegan/web run build` | Vite 构建，输出到 apps/web/dist |
| `pnpm preview` | `pnpm --filter @yuegan/web run preview` | 预览已构建的产物 |
| `pnpm typecheck` | `pnpm -r run typecheck` | 两个包各跑 `tsc -p tsconfig.json` |
| `pnpm test` | `pnpm -r run test` | core 的行为测试 + web 的 i18n 门禁 |
| `pnpm test:docs` | `node scripts/verify-docs.mjs` | 文档门禁：路径、命令、链接，以及 core 的平台边界与包入口依赖 |

实测：`pnpm test` 在 `packages/core` 的 5 个测试文件里通过 67 个用例，`apps/web` 通过 7 个 i18n 用例；
`pnpm typecheck` 两个包都通过；`pnpm build` 产出 JS 主包约 339 KB（gzip 105 KB）、CSS 约 22 KB（gzip 5.3 KB），
另有 28 个采样共 1.8 MB 与 manifest / Service Worker。

## 发布

线上地址：**https://sweet-boby.github.io/mufeel/**（GitHub Pages，公开仓库免费）。

`main` 上每推一次，[.github/workflows/deploy-pages.yml](.github/workflows/deploy-pages.yml) 就自动跑
`pnpm typecheck` → `pnpm test` → `pnpm test:docs` → `pnpm build`，四项全绿才把 `apps/web/dist` 发上去
（任何一项红就不发布，线上留上一版）。也可以在仓库的 Actions 页面手动触发一次重新发布。

发布靠的是 GitHub 原生的 Pages 部署，**没有 `gh-pages` 分支**，构建产物不进 git 历史。代价是项目站挂在
`/<仓库名>/` 这个子路径下，所以有两处必须跟着仓库走：

- `apps/web/vite.config.ts` 的 `base: '/mufeel/'`。改了仓库名，这里也要改，否则页面白屏（资源 404）。
- 仓库 Settings → Pages → Source 必须选 **GitHub Actions**。选成 "Deploy from a branch" 时，
  workflow 里的 `actions/configure-pages` 会以 `HttpError: Not Found` 失败，构建产物也就发不出去。

好在运行时用到 `import.meta.env.BASE_URL` 的地方（Service Worker 注册、钢琴采样路径）会自动跟随 `base`，
不需要第二处改动；路由全部是 hash，静态托管不需要 404 回退。

> 私有仓库要用 Pages，账号得是 GitHub Pro 及以上；本仓库是公开的，不受这条限制。

## 文档地图

每份文档只负责一类事实，改东西时先看对应那一份：

| 想找什么 | 读哪里 |
| --- | --- |
| 怎么跑、命令、目录结构 | 本文件 |
| 某个词在本项目里到底指什么（题目 / 档位 / 作答 / 跨度……） | [CONTEXT.md](CONTEXT.md) |
| 为什么这样分层、为什么不用 Tone.js、为什么课程不住在 core 里 | [docs/adr/](docs/adr/0001-domain-core-separated-from-platform.md) |
| 想加功能：有哪些扩展点、各自要不要动领域模型 | [docs/extension-cookbook.md](docs/extension-cookbook.md) |
| 按步骤加一个难度档（含验证） | [docs/cookbook/adding-a-difficulty-tier.md](docs/cookbook/adding-a-difficulty-tier.md) |
| 领域核心的契约、不变量与已知边界 | [packages/core/README.md](packages/core/README.md) |
| 界面、课程与 i18n 的组织方式 | [apps/web/README.md](apps/web/README.md) |
| 面向 agent 的工作约定与验证要求 | [AGENTS.md](AGENTS.md) |

`pnpm test:docs` 校验这些文档里的路径、`pnpm` 命令与相对链接是否仍然有效。

## 能力与边界

**七个模块**（每个模块若干关卡，按顺序解锁；已解锁的关卡随时能练）：

| 模块 | 练什么 | 关卡数 |
| --- | --- | --- |
| 音高 | 两个音比高低 → **n 个音排序**（yuegan 的核心练习） | 10 |
| 音程 | 十二个音程的上行、下行与和声 | 13 |
| 和弦 | 三和弦到九和弦、转位与各种色彩 | 11 |
| 音阶与调式 | 大小调、五声、教会调式与对称音阶 | 8 |
| 音级 | 终止式立调后，说出单音在调里的位置 | 6 |
| 和弦进行 | 用级数按顺序说出进行里的每个和弦 | 6 |
| 旋律 | 听一小段旋律，在键盘上弹回来 | 6 |

**排序题**（音高模块第 5–10 关）：系统依次弹出 3～5 个钢琴音，一列一个音、列从左到右是播放顺序，
把每个音放到它该在的高低位置（数字越大 = 音越高）。难度沿两条轴拉开：音数（3 → 5）与跨度
（中音区 C3–C5 不限跨度 → 八度内 ≤ 12 个半音 → 全音域 C1–A7）。每题最多主动重听 3 次，首次自动播放不算。
判分只判方向：每个音的名次都对，整题才算对。这些规则全部实现在 `packages/core`，见 [CONTEXT.md](CONTEXT.md)。

**进度与统计**：按技能项与关卡两级记录，关卡完成口径是「最近 12 题里对 10 题」（进行与旋律为 10 题里对 7 题），
首页给出「继续练习」与每日混合（15 题，偏向薄弱项），统计页有连续天数、正确率、十二周活动热力图与最容易混淆的对比。
存档在 localStorage 的 `yuegan.progress.v1` 键下，可在设置里导出 / 导入 JSON。

**语言**：默认中文，设置里可切 English；两份字典的一致性由 `apps/web/src/i18n/i18n.test.ts` 把关。

**尚未实现**：绝对音高识别、参考音、以音程作答的判断、账号 / 排行 / 跨设备同步（记录只在浏览器本地）。
这些术语的定义见 [CONTEXT.md](CONTEXT.md)，包级的不变量与已知约束见 [packages/core/README.md](packages/core/README.md)。

## 扩展点

| 想做的事 | 改哪里 |
| --- | --- |
| 加一个模块或关卡 | `apps/web/src/course/curriculum.ts` 加模块/关卡，`apps/web/src/questions/` 加生成器，`apps/web/src/i18n/` 两份字典补文案 |
| 改排序题的难度档（音域 + 跨度规则 + 显示名） | `packages/core/src/domain/entities/drill-spec.ts` 的 `DIFFICULTY_TIERS` 与 `DIFFICULTY_TIER_ORDER`，再在 `apps/web/src/course/curriculum.ts` 里把新档安排成关卡；要新的跨度/音程约束才动 `packages/core/src/domain/services/exercise-generator.ts` |
| 改排序题的判分口径（音程、音级、部分得分） | 另写一个 `Judge` 实现，替换 `packages/core/src/domain/services/judge.ts` 的注入点 |
| 换音色或换播放方式 | `apps/web/src/infrastructure/audio/piano-engine.ts`；要给 `packages/core` 的 `AudioPlayer` 端口换实现就改 `apps/web/src/infrastructure/audio/core-audio-player.ts` |
| 换进度存储（账号、服务端） | `apps/web/src/infrastructure/progress.ts` 的读写与订阅；core 的 `DrillRecordRepository` 端口仍在，但要先有装配点 |
| 改界面、加页面 | `apps/web/src/presentation/`；业务状态取自题型协议与进度存档，界面里不推算规则 |
| 加一条音乐内容（新音程/和弦/音阶/音级） | 先加进 `packages/core/src/domain/content/`（半音结构），再在 `apps/web/src/i18n/domain-labels.ts` 与两份字典补名字；`pnpm test` 会比对两边的 id 集合 |
| 加一门语言 | 在 `apps/web/src/i18n/` 加字典并登记 `LANGUAGES`，跑 `pnpm test` 让门禁检查 key 完整性 |
| 把领域核心用到别的平台 | 原样复用 `packages/core`（`DrillRunner` 是一局固定题数练习的参考编排），另写端口适配器与界面 |

## 开发

工具链：TypeScript 7.0.2、Vite 8.3.1、Vitest 5.0.2、React 19.3.0、@vitejs/plugin-react 6.1.1、@types/node 24.x。
没有 lint 脚本，也没有 Prettier / ESLint 配置。

`tsconfig.base.json` 开 strict、noUncheckedIndexedAccess、exactOptionalPropertyTypes、noImplicitOverride、
noFallthroughCasesInSwitch、noUnusedLocals、noUnusedParameters、isolatedModules、verbatimModuleSyntax、noEmit，
target ES2022、module ESNext、moduleResolution bundler；`packages/core` 额外 `types: ["node"]`（测试要读文件系统），
`apps/web` 加 DOM lib、`jsx: react-jsx`、`types: ["vite/client"]`。

排序题的播放参数集中在 `packages/core/src/domain/config.ts`：每音 1200 ms、音间停 400 ms，播放器不写死节奏。
钢琴采样每 3 个半音一个（C / D# / F# / A），覆盖 C1–A7，中间的音取最近的采样变速变调补齐；
采样映射是 core 里的纯逻辑，播放器只负责执行，理由见 [ADR 0002](docs/adr/0002-native-web-audio-over-tonejs.md)。

开发期后门：浏览器控制台里 `window.__yueganSession` 是当前练习会话（仅 DEV 构建暴露），
`window.__yueganSession.getState()` 给出会话状态，`window.__yueganSession.truth()` 给出当前排序题的真实音高与正确答案
（`{ pitches, correct }`）。排查时以它为准，不要从 DOM 反推。

已知环境坑：改 `packages/core` 的源码时 Vite 的 HMR 有时不会重新加载该模块，浏览器里跑的仍是旧逻辑
（表现为「代码明明改了、界面没变」，甚至整页空白），此时重启 `pnpm dev` 并删除 `node_modules/.vite` 缓存再验证；
pnpm 在这台机器上把 store 建在仓库内的 `.pnpm-store/`（已 gitignore）。

## 致谢与许可

课程结构、七种题型的思路、界面与样式表移植自 [abeage1/earpath-app](https://github.com/abeage1/earpath-app)
（MIT License，Copyright (c) abeage1）；本仓库在其基础上加入了 n 音排序练习、中英双语与采样播放路径。
音频采样来自 Salamander Grand Piano（CC-BY 3.0）。

术语以 [CONTEXT.md](CONTEXT.md) 为准，架构决定见 [docs/adr/](docs/adr/0001-domain-core-separated-from-platform.md)，
工作约定见 [AGENTS.md](AGENTS.md)。
