import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestAuditState {
  requestId: string;
  method: string;
  path: string;
  actorId?: string;
  sessionId?: string;
  requestBody?: unknown;
  reason?: string;
  idempotencyKey?: string;
  requestHash?: string;
  expectedVersion?: number | '*';
}

const storage = new AsyncLocalStorage<RequestAuditState>();

export const RequestAuditContext = {
  run<T>(state: RequestAuditState, callback: () => T): T {
    return storage.run(state, callback);
  },

  current(): RequestAuditState | undefined {
    return storage.getStore();
  },

  setActor(
    actorId: string,
    sessionId: string,
    requestBody: unknown,
    reason: string | undefined,
    idempotencyKey: string | undefined,
    requestHash: string | undefined,
    expectedVersion: number | '*' | undefined,
  ): void {
    const state = storage.getStore();
    if (state) {
      state.actorId = actorId;
      state.sessionId = sessionId;
      state.requestBody = requestBody;
      if (reason) state.reason = reason;
      if (idempotencyKey && requestHash) {
        state.idempotencyKey = idempotencyKey;
        state.requestHash = requestHash;
      }
      if (expectedVersion !== undefined) state.expectedVersion = expectedVersion;
    }
  },
};
