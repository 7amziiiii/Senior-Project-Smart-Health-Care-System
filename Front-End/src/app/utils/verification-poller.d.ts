// Type declarations for verification-poller.js
export default class VerificationPoller {
  constructor(sessionId: number, updateInterval?: number, authToken?: string | null);
  start(): void;
  stop(): void;
  fetchStatus(performScan?: boolean): void;
  setAuthToken(token: string | null): void;
  onUpdate(callback: (data: any, lastUpdate: Date) => void): void;
  forceUpdate(): void;
  getLastUpdateTime(): Date | null;
}
