import { describe, expect, it, vi } from "vitest";

import type { ChoreItem } from "@/app/household/board/types";
import { loadWeekChoresRequest } from "@/app/household/board/useHouseholdChoresData";
import type {
  LoadWeekChoresRequestParams,
  RefValue,
} from "@/app/household/board/useHouseholdChoresData.types";

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });
  return {
    promise,
    resolve,
    reject,
  };
};

const createChore = (id: number, occurrenceDate: string): ChoreItem => ({
  id,
  title: `Chore ${id}`,
  type: "close_on_done",
  occurrence_date: occurrenceDate,
  status: "open",
  closed_reason: null,
  undo_until: null,
  can_undo: false,
  notes: null,
});

const createResponse = (body: unknown): Pick<Response, "json"> => ({
  json: vi.fn().mockResolvedValue(body),
});

type SharedRefs = {
  lastLoadedOffsetRef: RefValue<string | null>;
  requestIdRef: RefValue<number>;
  activeControllerRef: RefValue<AbortController | null>;
};

const createSharedRefs = (): SharedRefs => ({
  lastLoadedOffsetRef: { current: null },
  requestIdRef: { current: 0 },
  activeControllerRef: { current: null },
});

type BaseRequestOverrides = Partial<
  Omit<LoadWeekChoresRequestParams, keyof SharedRefs | "weekOffset">
>;

const createBaseRequest = (
  refs: SharedRefs,
  weekOffset: number,
  overrides: BaseRequestOverrides = {},
): LoadWeekChoresRequestParams => ({
  weekOffset,
  ...refs,
  fetchImpl:
    overrides.fetchImpl ?? vi.fn().mockResolvedValue(createResponse({ ok: true, chores: [] })),
  setLoading: overrides.setLoading ?? vi.fn(),
  setChores: overrides.setChores ?? vi.fn(),
  setTimeZone: overrides.setTimeZone ?? vi.fn(),
  setRangeStart: overrides.setRangeStart ?? vi.fn(),
  setRangeEnd: overrides.setRangeEnd ?? vi.fn(),
  onHouseholdRequired: overrides.onHouseholdRequired ?? vi.fn(),
  onError: overrides.onError ?? vi.fn(),
  force: overrides.force,
});

describe("loadWeekChoresRequest", () => {
  it("applies only the latest overlapping response", async () => {
    const refs = createSharedRefs();
    const setLoading = vi.fn();
    const setChores = vi.fn();
    const setRangeStart = vi.fn();
    const setRangeEnd = vi.fn();
    const firstFetch = deferred<Pick<Response, "json">>();
    const secondFetch = deferred<Pick<Response, "json">>();
    const latestChores = [createChore(2, "2026-03-03")];
    const staleChores = [createChore(1, "2026-02-24")];
    let firstSignal: AbortSignal | undefined;

    const fetchImpl = vi
      .fn()
      .mockImplementationOnce((_input: RequestInfo | URL, init?: RequestInit) => {
        firstSignal = init?.signal ?? undefined;
        return firstFetch.promise;
      })
      .mockImplementationOnce((_input: RequestInfo | URL, _init?: RequestInit) => {
        return secondFetch.promise;
      });

    const firstRequest = loadWeekChoresRequest(
      createBaseRequest(refs, 0, {
        fetchImpl,
        setLoading,
        setChores,
        setRangeStart,
        setRangeEnd,
      }),
    );
    const secondRequest = loadWeekChoresRequest(
      createBaseRequest(refs, 1, {
        fetchImpl,
        setLoading,
        setChores,
        setRangeStart,
        setRangeEnd,
      }),
    );

    secondFetch.resolve(
      createResponse({
        ok: true,
        chores: latestChores,
        rangeStart: "2026-03-03",
        rangeEnd: "2026-03-09",
      }),
    );
    await secondRequest;

    firstFetch.resolve(
      createResponse({
        ok: true,
        chores: staleChores,
        rangeStart: "2026-02-24",
        rangeEnd: "2026-03-02",
      }),
    );
    await firstRequest;

    expect(firstSignal?.aborted).toBe(true);
    expect(setChores).toHaveBeenCalledTimes(1);
    expect(setChores).toHaveBeenCalledWith(latestChores);
    expect(setRangeStart).toHaveBeenCalledTimes(1);
    expect(setRangeStart).toHaveBeenCalledWith("2026-03-03");
    expect(setRangeEnd).toHaveBeenCalledTimes(1);
    expect(setRangeEnd).toHaveBeenCalledWith("2026-03-09");
    expect(refs.lastLoadedOffsetRef.current).toBe("1");
    expect(setLoading.mock.calls).toEqual([[true], [true], [false]]);
  });

  it("ignores stale success when switching back to a cached week", async () => {
    const refs = createSharedRefs();
    refs.lastLoadedOffsetRef.current = "0";
    const setLoading = vi.fn();
    const setChores = vi.fn();
    const setRangeStart = vi.fn();
    const setRangeEnd = vi.fn();
    const staleFetch = deferred<Pick<Response, "json">>();
    let staleSignal: AbortSignal | undefined;

    const fetchImpl = vi
      .fn()
      .mockImplementationOnce((_input: RequestInfo | URL, init?: RequestInit) => {
        staleSignal = init?.signal ?? undefined;
        return staleFetch.promise;
      });

    const staleRequest = loadWeekChoresRequest(
      createBaseRequest(refs, 1, {
        fetchImpl,
        setLoading,
        setChores,
        setRangeStart,
        setRangeEnd,
      }),
    );

    await loadWeekChoresRequest(
      createBaseRequest(refs, 0, {
        fetchImpl,
        setLoading,
        setChores,
        setRangeStart,
        setRangeEnd,
      }),
    );

    staleFetch.resolve(
      createResponse({
        ok: true,
        chores: [createChore(3, "2026-03-17")],
        rangeStart: "2026-03-17",
        rangeEnd: "2026-03-23",
      }),
    );
    await staleRequest;

    expect(staleSignal?.aborted).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(setChores).not.toHaveBeenCalled();
    expect(setRangeStart).not.toHaveBeenCalled();
    expect(setRangeEnd).not.toHaveBeenCalled();
    expect(refs.lastLoadedOffsetRef.current).toBe("0");
  });

  it("ignores stale failures when switching back to a cached week", async () => {
    const refs = createSharedRefs();
    refs.lastLoadedOffsetRef.current = "0";
    const onError = vi.fn();
    const staleFetch = deferred<Pick<Response, "json">>();
    const fetchImpl = vi.fn().mockImplementationOnce(() => staleFetch.promise);

    const staleRequest = loadWeekChoresRequest(
      createBaseRequest(refs, 1, {
        fetchImpl,
        onError,
      }),
    );

    await loadWeekChoresRequest(
      createBaseRequest(refs, 0, {
        fetchImpl,
        onError,
      }),
    );

    staleFetch.reject(new Error("stale request failed"));
    await staleRequest;

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it("clears loading state when switching back to a cached week", async () => {
    const refs = createSharedRefs();
    refs.lastLoadedOffsetRef.current = "0";
    const setLoading = vi.fn();
    const staleFetch = deferred<Pick<Response, "json">>();
    const fetchImpl = vi.fn().mockImplementationOnce(() => staleFetch.promise);

    const staleRequest = loadWeekChoresRequest(
      createBaseRequest(refs, 1, {
        fetchImpl,
        setLoading,
      }),
    );

    await loadWeekChoresRequest(
      createBaseRequest(refs, 0, {
        fetchImpl,
        setLoading,
      }),
    );

    expect(setLoading.mock.calls).toEqual([[true], [false]]);

    staleFetch.resolve(
      createResponse({
        ok: true,
        chores: [createChore(9, "2026-04-01")],
      }),
    );
    await staleRequest;

    expect(setLoading.mock.calls).toEqual([[true], [false]]);
  });

  it("does not cache failed loads and retries the same week", async () => {
    const refs = createSharedRefs();
    const setChores = vi.fn();
    const successChores = [createChore(4, "2026-03-10")];
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(createResponse({ ok: false, error: "Temporary failure" }))
      .mockResolvedValueOnce(createResponse({ ok: true, chores: successChores }));

    const request = createBaseRequest(refs, 2, {
      fetchImpl,
      setChores,
    });

    await loadWeekChoresRequest(request);
    await loadWeekChoresRequest(request);

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(setChores).toHaveBeenCalledTimes(1);
    expect(setChores).toHaveBeenCalledWith(successChores);
    expect(refs.lastLoadedOffsetRef.current).toBe("2");
  });

  it("skips already loaded week unless forced", async () => {
    const refs = createSharedRefs();
    const fetchImpl = vi.fn().mockResolvedValue(createResponse({ ok: true, chores: [] }));

    const request = createBaseRequest(refs, 7, { fetchImpl });

    await loadWeekChoresRequest(request);
    await loadWeekChoresRequest(request);
    await loadWeekChoresRequest({
      ...request,
      force: true,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
