/**
 * 练习记录仓储的 localStorage 实现（基础设施层）。
 * 仓储接口定义在 core 的 domain/ports 里，换存储只换这个文件。
 */

import type { DrillRecord, DrillRecordRepository } from '@yuegan/core';

const STORAGE_KEY = 'yuegan.drill-records.v1';
const MAX_RECORDS = 200;

function readAll(): DrillRecord[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DrillRecord[]) : [];
  } catch {
    // 存储被禁用或数据损坏时，练习本身不该受影响。
    return [];
  }
}

export class LocalStorageDrillRecordRepository implements DrillRecordRepository {
  async save(record: DrillRecord): Promise<void> {
    const records = [record, ...readAll()].slice(0, MAX_RECORDS);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }

  async listRecent(limit: number): Promise<readonly DrillRecord[]> {
    return readAll().slice(0, limit);
  }

  async clear(): Promise<void> {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}
