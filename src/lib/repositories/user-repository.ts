import { pool } from "@/lib/db";

export const updateUserNameById = async ({ userId, name }: { userId: number; name: string }) => {
  const result = await pool.query<{
    id: number;
    name: string | null;
    email: string | null;
  }>("update users set name = $1 where id = $2 returning id, name, email", [name.trim(), userId]);
  return result.rows[0] ?? null;
};
