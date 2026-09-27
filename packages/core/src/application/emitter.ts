/**
 * 事件发射器：应用层用它把状态变化推给界面。
 * 刻意不依赖任何前端框架，React 只是订阅者之一，换成别的 UI 也能用。
 */

export type Unsubscribe = () => void;

export interface Emitter<Event> {
  emit(event: Event): void;
  subscribe(listener: (event: Event) => void): Unsubscribe;
}

export function createEmitter<Event>(): Emitter<Event> {
  const listeners = new Set<(event: Event) => void>();
  return {
    emit(event: Event): void {
      for (const listener of [...listeners]) {
        listener(event);
      }
    },
    subscribe(listener: (event: Event) => void): Unsubscribe {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
