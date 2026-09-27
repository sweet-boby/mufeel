/**
 * 练习记录仓储端口：只声明领域需要的能力，不关心存到哪。
 * v1 用浏览器 localStorage 实现；以后换账号/服务端只换实现。
 */

import type { DrillSpec } from '../entities/drill-spec';

/** 一次练习的存档：规格 + 逐题对错。 */
export interface DrillRecord {
  readonly id: string;
  readonly finishedAt: string;
  readonly spec: DrillSpec;
  readonly correctCount: number;
  readonly totalCount: number;
  /** 逐题是否答对，用于以后画趋势曲线。 */
  readonly results: readonly boolean[];
}

export interface DrillRecordRepository {
  save(record: DrillRecord): Promise<void>;
  listRecent(limit: number): Promise<readonly DrillRecord[]>;
  clear(): Promise<void>;
}
