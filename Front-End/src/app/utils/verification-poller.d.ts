// Type declarations for verification-poller.js
export default class VerificationPoller {
  constructor(sessionId: number, updateInterval?: number);
  start(): void;
  stop(): void;
  fetchStatus(performScan?: boolean): void;
  onUpdate(callback: (data: any, lastUpdate: Date) => void): void;
  forceUpdate(): void;
  getLastUpdateTime(): Date | null;
}
