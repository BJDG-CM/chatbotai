// @cloudflare/workers-types를 쓰지 않으므로 LoginGuard가 사용하는 부분만 선언한다.
// (런타임 타입 전체는 Next 코드의 DOM lib과 충돌한다.)

interface SqlStorageCursor<T> {
  toArray(): T[];
  one(): T;
}

interface SqlStorage {
  exec<T = Record<string, unknown>>(query: string, ...bindings: unknown[]): SqlStorageCursor<T>;
}

interface DurableObjectState {
  storage: {
    sql: SqlStorage;
    getAlarm(): Promise<number | null>;
    setAlarm(scheduledTime: number): Promise<void>;
  };
}

interface DurableObjectId {
  toString(): string;
}

type DurableObjectStub<T> = {
  [K in keyof T as T[K] extends (...args: never[]) => unknown ? K : never]: T[K] extends (
    ...args: infer A
  ) => infer R
    ? (...args: A) => Promise<Awaited<R>>
    : never;
};

interface DurableObjectNamespace<T = unknown> {
  idFromName(name: string): DurableObjectId;
  get(id: DurableObjectId): DurableObjectStub<T>;
}

declare module "cloudflare:workers" {
  export const env: Cloudflare.Env;
  export abstract class DurableObject<E = Cloudflare.Env> {
    protected ctx: DurableObjectState;
    protected env: E;
    constructor(ctx: DurableObjectState, env: E);
  }
}
