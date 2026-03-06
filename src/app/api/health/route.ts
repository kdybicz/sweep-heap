import { API_ERROR_CODE, jsonError } from "@/lib/api-error";
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
    return jsonError({
      status: 500,
      code: API_ERROR_CODE.INTERNAL_SERVER_ERROR,
      error: "Health check failed",
    });
  }
}
