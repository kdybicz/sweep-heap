import { ensureChoresTable } from "@/lib/chores";
import { pool } from "@/lib/db";

const toDateString = (value: string | null) => {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDateUtc = (date: Date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const normalizeDate = (value: unknown) => {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return formatDateUtc(value);
  }
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return formatDateUtc(parsed);
  }
  return null;
};

export async function GET(request: Request) {
  try {
    await ensureChoresTable();
    const requestUrl = new URL(request.url);
    const start = toDateString(requestUrl.searchParams.get("start"));
    const end = toDateString(requestUrl.searchParams.get("end"));

    const result = await pool.query(
      "select c.id, c.title, c.occurrence_date, coalesce(o.status, c.status) as status, coalesce(o.closed_reason, null) as closed_reason from chores c left join chore_occurrence_overrides o on o.chore_id = c.id and o.occurrence_date = c.occurrence_date where ($1::date is null or c.occurrence_date >= $1::date) and ($2::date is null or c.occurrence_date <= $2::date) order by c.occurrence_date asc, c.id asc",
      [start, end],
    );

    const chores = result.rows.map((row) => {
      const normalizedDate = normalizeDate(row.occurrence_date);
      return {
        id: row.id,
        title: row.title,
        status: row.status,
        closed_reason: row.closed_reason ?? null,
        occurrence_date: normalizedDate,
      };
    });

    return Response.json({
      ok: true,
      chores,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
