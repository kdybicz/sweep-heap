import { pool } from "@/lib/db";

export async function GET() {
  try {
    const result = await pool.query("select now() as now");
    return Response.json({
      ok: true,
      now: result.rows[0]?.now ?? null,
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
