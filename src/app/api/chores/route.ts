import { getSession } from "@/auth";
import { parseJsonObjectBody } from "@/lib/http";
import { getActiveHouseholdId } from "@/lib/repositories";
import { listChores, mutateChore } from "@/lib/services";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const weekOffsetPattern = /^-?\d+$/;
const maxWeekOffset = 520;

const parseWeekOffset = (value: string | null) => {
  if (!value || !weekOffsetPattern.test(value)) {
    return 0;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(-maxWeekOffset, Math.min(maxWeekOffset, parsed));
};

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
    const weekOffset = parseWeekOffset(requestUrl.searchParams.get("weekOffset"));
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
