import { getSession } from "@/auth";
import { parseJsonObjectBody } from "@/lib/http";
import { getActiveHouseholdId } from "@/lib/repositories";
import { listChores, mutateChore } from "@/lib/services";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const userId = Number(session.user.id);
    if (!Number.isFinite(userId)) {
      return Response.json({ ok: false, error: "Invalid user" }, { status: 400 });
    }
    const requestUrl = new URL(request.url);
    const householdId = await getActiveHouseholdId(userId);
    if (!householdId) {
      return Response.json({ ok: false, error: "Household required" }, { status: 403 });
    }
    const rawWeekOffset = Number(requestUrl.searchParams.get("weekOffset") ?? "0");
    const weekOffset = Number.isFinite(rawWeekOffset) ? rawWeekOffset : 0;
    const listResult = await listChores({
      householdId,
      weekOffset,
      start: requestUrl.searchParams.get("start"),
      end: requestUrl.searchParams.get("end"),
    });

    return Response.json({
      ok: true,
      timeZone: listResult.timeZone,
      rangeStart: listResult.rangeStart,
      rangeEnd: listResult.rangeEnd,
      chores: listResult.chores,
    });
  } catch (error) {
    console.error("Failed to load chores", error);
    return Response.json(
      {
        ok: false,
        error: "Failed to load chores",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const userId = Number(session.user.id);
    if (!Number.isFinite(userId)) {
      return Response.json({ ok: false, error: "Invalid user" }, { status: 400 });
    }

    const householdId = await getActiveHouseholdId(userId);
    if (!householdId) {
      return Response.json({ ok: false, error: "Household required" }, { status: 403 });
    }
    const payload = await parseJsonObjectBody(request);
    if (payload === null) {
      return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const result = await mutateChore({ householdId, payload });
    if (!result.ok) {
      return Response.json(result.body, { status: result.status });
    }

    return Response.json(result.body);
  } catch (error) {
    console.error("Failed to update chore", error);
    return Response.json(
      {
        ok: false,
        error: "Failed to update chore",
      },
      { status: 500 },
    );
  }
}
