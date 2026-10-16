// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { choreCompletionMutationKey } from "@/app/household/board/chores-query";
import type { ChoreItem } from "@/app/household/board/types";
import useHouseholdBoard, {
  type UseHouseholdBoardModel,
} from "@/app/household/board/useHouseholdBoard";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
};
const response = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
let root: Root | undefined;
let client: QueryClient;
let board: UseHouseholdBoardModel;
const Harness = () => {
  board = useHouseholdBoard();
  return null;
};
const flush = async () => {
  for (let step = 0; step < 4; step += 1)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-15T12:00:00Z"));
  client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
});
afterEach(async () => {
  await act(async () => root?.unmount());
  root = undefined;
  client.clear();
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("background refresh during chore completion", () => {
  it.each([true, false])(
    "cancels stale reads, pauses refresh, and reconciles a completion with success=%s",
    async (success) => {
      const staleRead = deferred<Response>();
      const patch = deferred<Response>();
      let holdWeek = false;
      let staleSignal: AbortSignal | undefined;
      let serverDone = false;
      const chore = (): ChoreItem => ({
        id: 1,
        title: "Completion race",
        type: "close_on_done",
        status: serverDone ? "closed" : "open",
        closed_reason: serverDone ? "done" : null,
        occurrence_start_date: "2026-10-15",
        occurrence_date: "2026-10-15",
      });
      const queryResponse = (url: URL) =>
        response({
          ok: true,
          timeZone: "UTC",
          rangeStart: url.searchParams.get("start"),
          rangeEnd: url.searchParams.get("end"),
          chores: [chore()],
        });
      const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        if (init?.method === "PATCH") return patch.promise;
        const url = new URL(String(input), "http://localhost");
        if (holdWeek && url.searchParams.get("start") === "2026-10-12") {
          holdWeek = false;
          staleSignal = init?.signal ?? undefined;
          return staleRead.promise;
        }
        return Promise.resolve(queryResponse(url));
      });
      const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
      vi.stubGlobal("fetch", fetchMock);
      const container = document.createElement("div");
      document.body.append(container);
      root = createRoot(container);
      await act(async () =>
        root?.render(
          <QueryClientProvider client={client}>
            <Harness />
          </QueryClientProvider>,
        ),
      );
      await flush();
      expect(board.week.chores).toHaveLength(1);
      expect(board.sidebar.doneChores).toBe(0);

      // Start a real query-cache refetch with a stale response held before completion begins.
      holdWeek = true;
      await act(async () => {
        window.dispatchEvent(new Event("focus"));
      });
      await flush();
      expect(staleSignal).toBeDefined();
      const oldResponse = queryResponse(
        new URL("http://localhost/api/chores?start=2026-10-12&end=2026-10-18"),
      );
      await act(async () => {
        board.chorePreviewPopover.onPrimaryAction(board.week.chores[0]);
      });
      await flush();
      expect(client.isMutating({ mutationKey: choreCompletionMutationKey })).toBe(1);
      expect(staleSignal?.aborted).toBe(true);
      expect(board.sidebar.doneChores).toBe(1);

      // Even a fetch implementation that delivers after cancellation must not undo optimism.
      staleRead.resolve(oldResponse);
      await flush();
      expect(board.sidebar.doneChores).toBe(1);
      const readsBeforeFocus = fetchMock.mock.calls.filter(
        ([, init]) => init?.method !== "PATCH",
      ).length;
      await act(async () => {
        window.dispatchEvent(new Event("focus"));
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await flush();
      expect(fetchMock.mock.calls.filter(([, init]) => init?.method !== "PATCH")).toHaveLength(
        readsBeforeFocus,
      );

      serverDone = success;
      const callsBeforeSettlement = fetchMock.mock.calls.length;
      patch.resolve(
        response(
          success
            ? { ok: true, choreId: 1 }
            : { ok: false, code: "INTERNAL_SERVER_ERROR", error: "Completion failed" },
        ),
      );
      await flush();
      expect(client.isMutating({ mutationKey: choreCompletionMutationKey })).toBe(0);
      expect(board.sidebar.doneChores).toBe(success ? 1 : 0);
      expect(board.sidebar.todayChores[0].closed_reason).toBe(success ? "done" : null);
      const reconciledStarts = fetchMock.mock.calls
        .slice(callsBeforeSettlement)
        .filter(([, init]) => init?.method !== "PATCH")
        .map(([input]) => new URL(String(input), "http://localhost").searchParams.get("start"));
      expect(reconciledStarts).toContain("2026-10-12");
      expect(reconciledStarts).toContain("2026-10-15");
      expect(
        fetchMock.mock.calls.filter(([, init]) => init?.method !== "PATCH").length,
      ).toBeGreaterThan(readsBeforeFocus);
      expect(errorLog).toHaveBeenCalledTimes(success ? 0 : 1);
    },
  );
});
