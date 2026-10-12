import { AsyncLocalStorage } from "node:async_hooks";
import type { Pool, PoolClient } from "pg";

type Scope = {
  client: PoolClient;
  closed: boolean;
  failure?: Error;
  connectionFailure: () => Error | undefined;
  queue: Promise<void>;
  nextSavepoint: number;
};
const scopes = new AsyncLocalStorage<Scope>();
const check = (scope: Scope) => {
  const failure = scope.connectionFailure() ?? scope.failure;
  if (failure) throw failure;
  if (scope.closed) throw new Error("Household mutation transaction is closed");
};

async function borrow(scope: Scope): Promise<PoolClient> {
  const prior = scope.queue;
  let unlock!: () => void;
  scope.queue = new Promise<void>((resolve) => {
    unlock = resolve;
  });
  await prior;
  try {
    check(scope);
  } catch (error) {
    unlock();
    throw error;
  }
  let released = false;
  const savepoints: string[] = [];
  const execute = async (...args: unknown[]) => {
    check(scope);
    if (released) throw new Error("Mutation client is released");
    const first = args[0];
    const text = typeof first === "string" ? first : (first as { text?: string })?.text;
    const sql = text?.trim().replace(/;$/, "").toLowerCase() ?? "";
    try {
      if (/^(begin|start transaction)\b/.test(sql)) {
        const name = `household_nested_${++scope.nextSavepoint}`;
        await scope.client.query(`savepoint ${name}`);
        savepoints.push(name);
        return { rows: [] };
      }
      if (sql === "commit" || sql === "rollback") {
        const name = savepoints.pop();
        if (!name)
          throw new Error("Cannot finish the outer household transaction from a borrowed client");
        if (sql === "rollback") await scope.client.query(`rollback to savepoint ${name}`);
        await scope.client.query(`release savepoint ${name}`);
        return { rows: [] };
      }
      return await Reflect.apply(scope.client.query, scope.client, args);
    } catch (error) {
      // A swallowed database error must not turn an aborted outer transaction into success.
      scope.failure = error instanceof Error ? error : new Error("Mutation query failed");
      throw error;
    }
  };
  const release = (error?: Error) => {
    if (released) return;
    released = true;
    if (error) scope.failure = error;
    if (savepoints.length)
      scope.failure = new Error("Nested mutation transaction was not finished");
    unlock();
  };
  return new Proxy(scope.client, {
    get(target, property) {
      if (property === "release") return release;
      if (property === "query")
        return (...args: unknown[]) => {
          const callback =
            typeof args.at(-1) === "function"
              ? (args.pop() as (error: unknown, result?: unknown) => void)
              : undefined;
          const promise = execute(...args);
          if (callback) {
            void promise.then(
              (result) => callback(null, result),
              (error) => callback(error),
            );
            return;
          }
          return promise;
        };
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

/** Routes repository and Better Auth pool calls through the guarded transaction. */
export const transactionAwarePool = (pool: Pool): Pool =>
  new Proxy(pool, {
    get(target, property) {
      if (property === "connect")
        return (...args: unknown[]) => {
          const scope = scopes.getStore();
          if (!scope) return Reflect.apply(target.connect, target, args);
          const callback = args[0] as
            | ((error: unknown, client?: PoolClient, release?: PoolClient["release"]) => void)
            | undefined;
          const promise = borrow(scope);
          if (callback) {
            void promise.then(
              (client) => callback(null, client, client.release),
              (error) => callback(error),
            );
            return;
          }
          return promise;
        };
      if (property === "query")
        return (...args: unknown[]) => {
          const scope = scopes.getStore();
          if (!scope) return Reflect.apply(target.query, target, args);
          const callback =
            typeof args.at(-1) === "function"
              ? (args.pop() as (error: unknown, result?: unknown) => void)
              : undefined;
          const promise = borrow(scope).then(async (client) => {
            try {
              return await Reflect.apply(client.query, client, args);
            } finally {
              client.release();
            }
          });
          if (callback) {
            void promise.then(
              (result) => callback(null, result),
              (error) => callback(error),
            );
            return;
          }
          return promise;
        };
      // Preserve constructor identity for adapter detection; bind actual pool methods.
      const value = Reflect.get(target, property, target);
      return typeof value === "function" && property !== "constructor" ? value.bind(target) : value;
    },
  });

export const runMutationTransaction = <T>(
  client: PoolClient,
  task: () => Promise<T>,
  connectionFailure: () => Error | undefined,
): Promise<T> => {
  const scope: Scope = {
    client,
    closed: false,
    connectionFailure,
    queue: Promise.resolve(),
    nextSavepoint: 0,
  };
  return scopes.run(scope, async () => {
    try {
      const result = await task();
      check(scope);
      return result;
    } finally {
      scope.closed = true;
    }
  });
};
