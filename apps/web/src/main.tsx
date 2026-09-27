/**
 * 入口：读存档 → 挂载 React → 注册 Service Worker。
 *
 * 故意不用 <StrictMode>：开发模式下它会重复执行 effect，而这个应用有状态机
 * （练习会话）与音频调度，双跑会出一道题出两次、放两遍音的假象，掩盖真实问题。
 */

import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { I18nProvider } from './i18n';
import { pianoEngine } from './infrastructure/audio/piano-engine';
import * as Progress from './infrastructure/progress';
import './styles/global.css';

Progress.load();
pianoEngine.setVolume(Progress.getState().settings.volume);

const container = document.getElementById('root');
if (container === null) {
  throw new Error('找不到 #root 挂载点');
}

createRoot(container).render(
  <I18nProvider
    initialLang={Progress.getState().settings.language}
    onLangChange={(language) => Progress.updateSettings({ language })}
  >
    <App />
  </I18nProvider>,
);

// 离线支持：本地 file:// 打开时跳过。
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      // 注册失败不影响使用，只是没有离线缓存
    });
  });
}
