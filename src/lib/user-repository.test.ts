import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  pool: {
    query: queryMock,
  },
}));

import { updateUserNameById } from "@/lib/repositories";

describe("updateUserNameById", () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it("updates a user with a trimmed name", async () => {
    queryMock.mockResolvedValue({
      rows: [
        {
          id: 9,
          name: "Alex",
          email: "alex@example.com",
        },
      ],
    });

    const user = await updateUserNameById({
      userId: 9,
      name: "  Alex  ",
    });

    expect(queryMock).toHaveBeenCalledWith(
      "update users set name = $1 where id = $2 returning id, name, email",
      ["Alex", 9],
    );
    expect(user).toEqual({
      id: 9,
      name: "Alex",
      email: "alex@example.com",
    });
  });

  it("returns null when no user row is returned", async () => {
    queryMock.mockResolvedValue({ rows: [] });

    const user = await updateUserNameById({
      userId: 44,
      name: "Robin",
    });

    expect(user).toBeNull();
  });
});
