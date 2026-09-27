# 0003 把 earpath 的课程壳移植进 Web 端，排序题仍然只由 core 定规则

日期：2026-09-27
状态：已采纳

## 背景

到 0002 为止，Web 端只有一种练习：选「音数 + 难度档」开始一局 10 题的排序练习，
界面是三个页面（首页 / 练习页 / 结果页），会话由 core 的 `DrillRunner` 编排，
进度由 `DrillRecordRepository` 存成一局一局的记录。

实际用起来暴露出两个问题：

1. **只有排序，没有台阶。** 排序题要求同时握住 n 个音的相对位置，对刚起步的人太难，
   而能力比它低的练习（两个音比高低）在项目里根本不存在——用户要么会，要么放弃。
2. **没有可对照的课程形态。** 开源项目 [earpath-app](https://github.com/abeage1/earpath-app)（MIT）
   已经把「从两个音比高低一路到旋律听写」的课程、关卡解锁、薄弱项加权、统计与界面做成了一套完整的形态，
   并且它的起点正好是 yuegan 想补的那一级台阶。

于是这一版把 earpath 的课程与界面移植进 `apps/web`：保留 React 技术栈与 `@yuegan/core`，
把课程表、七种题型、进度模型与视觉全部搬过来，再把 yuegan 的排序题作为 Pitch 模块的后续关卡接进去，
同时做全站中英双语（默认中文）。

## 决定

1. **课程壳住在 `apps/web`，不进 core。** 模块、关卡、解锁规则、关卡完成口径（最近 window 题里对 need 题）、
   技能项权重、连续天数与统计，全部是产品层面的概念，放在 `apps/web/src/domain/curriculum.ts`
   与 `apps/web/src/infrastructure/progress.ts`。core 里不出现「模块」「关卡」这类词。

2. **排序题的规则一行都不复制。** Pitch 模块第 5–10 关（`kind: 'rank'`）的出题、正确答案与判分
   仍然只来自 core：`createDrillSpecForTier`（音数 + 难度档 → 音域 + 跨度规则）、
   `createExerciseGenerator`（出题）、`correctRanks`（唯一正确答案）、`createRankOrderJudge`（判分）。
   界面的档位互斥与「能不能提交」也走 core 的 `assignRank` / `isDraftSubmittable`。
   `apps/web/src/domain/questions/rank.ts` 只做翻译：把 core 的音高换成播放事件与音名。

3. **Web 端不再装配 `DrillRunner` 与 `buildDrillViewState`。** 练习会话由
   `apps/web/src/presentation/useSession.ts` 的一个 reducer 驱动：它沿用 earpath 的节奏
   （首次要点一下、答完给反馈与对比重放、达到目标弹庆祝、Daily 固定题数后给小结），
   一局的「题数」概念也随课程改成开放式练习。
   相应地，`LocalStorageDrillRecordRepository` 这个实现被删除，进度改用 app 层的存档模型
   （localStorage 键 `yuegan.progress.v1`，按技能项与关卡两级记录）。

4. **core 的编排能力保留不动。** `DrillRunner`、`application/view-model.ts`、三个端口都留在
   `packages/core` 里，并继续由 core 的行为测试覆盖（`tests/drill-runner.test.ts` 用桩替换端口）。
   它们是「一局固定题数的练习」这件事的参考实现，也是安卓端复用时最省事的入口；
   Web 端现在是**另一个消费者**：用同一套领域服务，但自己安排课程节奏。

5. **全站统一一套音频路径。** 所有题型（含排序题）都走 `apps/web/src/infrastructure/audio/piano-engine.ts`
   播放同一套 Salamander 采样。区别在接口：排序题经 core 的 `AudioPlayer` 端口播放
   （适配器 `infrastructure/audio/core-audio-player.ts`，时序由 core 的领域配置给出），
   移植来的题型直接给引擎一串带时间轴的事件（它们需要和弦、终止式与不等长的音）。
   采样的加载时机从「进练习页就加载」改成「用户点一下开始再加载」：既满足浏览器对 AudioContext 的手势要求，
   也让首屏不必为一个可能不开始的练习先下 1.8 MB。

6. **界面文案一律走 i18n。** 默认中文、可切英文；两份字典的 key 必须一致，
   源码里用到的 key 必须存在，这两条由 `apps/web/src/i18n/i18n.test.ts` 强制。

## 后果

- 排序题第一次有了「台阶」：Pitch 模块从两个音比高低（第 1–4 关）过渡到 3/4/5 个音的排序（第 5–10 关）。
- 「出题与判分只有一处」这条不变量仍然成立：改动排序规则仍然只改 `packages/core` 的两个服务，
  Web 端与将来的安卓端一起生效。
- 代价是 Web 端出现了两套「进度」概念的分工：core 的 `DrillRecord`（一局记录）
  与 app 层的技能项/关卡统计。前者在 Web 上暂时没有装配点，`packages/core` 的
  端口与记录实体因此暂时只被 core 自己的测试与将来的平台端使用。
- 代价之二是会话循环从 core 挪回了 app：`useSession.ts` 里的「什么时候算过关」「Daily 几题」
  是 app 层规则，改动它们不会影响 core 的测试。判据是清晰的——凡是「答案对不对、
  有没有排满、还能听几次」这类问题必须问 core；凡是「这一关要连对几题」这类问题属于课程。

## 考虑过的替代方案

- **把课程也搬进 core**：能让"关卡"在安卓端复用，但那会把产品课程表变成领域模型的一部分，
  每加一关都要动 core 的测试；而且 earpath 的课程与 UI 强耦合（提示文案、筹码、每日混合），
  搬进去只会得到一张很难复用的表。
- **保留 `DrillRunner`，把排序关卡做成独立页面**：一处应用出现两种练习流程（模块式与一次性 10 题），
  用户要在两种节奏间切换，统计也只能二选一。放弃。
- **不移植 earpath，自己补「两个音比高低」**：工作量小得多，但等于重新发明一套课程、
  解锁与统计；移植一套已经打磨过的课程（MIT 许可）对用户更划算。
- **不保留 core 的 `DrillRunner`，直接删掉**：会让「固定 10 题一局」这种形态失去唯一实现，
  也让 `packages/core` 的三个端口失去装配范例；保留它的成本只是一个文件与一组已经通过的测试。
