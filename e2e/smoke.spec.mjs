import { day, expect, test, today } from "./support.mjs";

test("magic-link onboarding, invite, chore lifecycle and account deletion", async ({
  live,
  household,
}) => {
  test.setTimeout(120000);
  const page = await live.board();
  await expect(
    page.getByRole("heading", { name: "Weekly board", exact: true }).first(),
  ).toBeVisible();
  await page.close();
  await live.join();
  const me = await live.api(live.member, "/api/me");
  expect(me.body.memberships).toContainEqual({
    householdId: household,
    role: "member",
    status: "active",
  });
  const id = await live.chore({
    title: "E2E smoke chore",
    startDate: today(),
    endDate: day(today(), 1),
  });
  expect((await live.list(today())).some((chore) => chore.id === id)).toBe(true);
  expect(
    (
      await live.mutate({
        action: "set",
        choreId: id,
        occurrenceStartDate: today(),
        status: "closed",
      })
    ).status,
  ).toBe(200);
  expect((await live.list(today())).find((chore) => chore.id === id).status).toBe("closed");
  expect(
    (
      await live.mutate({
        action: "cancel",
        scope: "single",
        choreId: id,
        occurrenceStartDate: today(),
      })
    ).status,
  ).toBe(200);
  expect((await live.list(today())).some((chore) => chore.id === id)).toBe(false);
  expect((await live.api(live.owner, "/api/households", "DELETE")).status).toBe(409);
  expect((await live.api(live.member, "/api/households/members/leave", "POST")).status).toBe(200);
  expect((await live.api(live.owner, "/api/households", "DELETE")).status).toBe(200);
  expect((await live.api(live.alternate, "/api/me/delete-request", "POST")).status).toBe(200);
  const link = new URL(await live.emailLink(live.alternate.email, "/user/delete/confirm?"));
  const deleted = await live.api(live.alternate, "/api/me/delete-confirm", "POST", {
    identifier: link.searchParams.get("identifier"),
    token: link.searchParams.get("token"),
  });
  expect(deleted.status).toBe(200);
  expect(
    (await live.db.query("select id from users where id=$1", [live.alternate.id])).rowCount,
  ).toBe(0);
});
