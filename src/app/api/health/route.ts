import { pool } from "@/lib/db";

export async function GET() {
  try {
    const result = await pool.query("select now() as now");
    return Response.json({
      ok: true,
      now: result.rows[0]?.now ?? null,
    });
  } catch (error) {
    console.error("Health check failed", error);
    return Response.json(
      {
        ok: false,
        error: "Health check failed",
      },
      { status: 500 },
    );
  }
}
