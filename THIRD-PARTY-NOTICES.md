# 第三方 notices（third-party notices）

本仓库包含移植自其他开源项目的代码与资源。下面逐项列出出处与许可。

## abeage1/earpath-app（MIT）

课程结构（模块、关卡、解锁路径与完成口径）、四种题型中的三种（选项 / 级数序列 / 旋律听写）的实现思路、
界面文案与样式表、入门引导与统计页的形态，移植自
[abeage1/earpath-app](https://github.com/abeage1/earpath-app)。对应文件：

- `apps/web/src/styles/global.css`（顶部注明出处，末尾的排序题样式为本仓库新增）
- `apps/web/src/course/curriculum.ts`
- `apps/web/src/questions/`（`rank.ts` 为本仓库新增）
- `apps/web/src/infrastructure/progress.ts`
- `apps/web/src/presentation/`（排序题作答 UI 与中英双语为本仓库新增）
- `apps/web/src/i18n/en.ts` 中的英文文案
- `packages/core/src/domain/content/`（音程/和弦/音阶/音级/级数的半音结构，由 earpath 的 `js/theory.js` 整理而来）
- `packages/core/src/domain/services/voicing.ts`、`melody.ts`（声部安排与旋律出题规则，同上）
- `apps/web/src/i18n/domain-labels.ts`（同上，名字与参考曲目）

```
MIT License

Copyright (c) 2026 abeage1

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Salamander Grand Piano（CC-BY 3.0）

`apps/web/public/samples/piano/` 下的 28 个 mp3 是 Salamander Grand Piano 采样
（每 3 个半音一个：C / D# / F# / A，覆盖 C1–A7），由 Alexander Holm 录制，以
Creative Commons Attribution 3.0 许可发布。
