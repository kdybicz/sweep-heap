import { requireApiHousehold } from "@/lib/api-access";
import { parseJsonObjectBody } from "@/lib/http";
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
    const householdAccess = await requireApiHousehold();
    if (!householdAccess.ok) {
      return householdAccess.response;
    }

    const requestUrl = new URL(request.url);
    const weekOffset = parseWeekOffset(requestUrl.searchParams.get("weekOffset"));
    const listResult = await listChores({
      householdId: householdAccess.household.id,
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
    const householdAccess = await requireApiHousehold();
    if (!householdAccess.ok) {
      return householdAccess.response;
    }

    const payload = await parseJsonObjectBody(request);
    if (payload === null) {
      return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const result = await mutateChore({ householdId: householdAccess.household.id, payload });
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
