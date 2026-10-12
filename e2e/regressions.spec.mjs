import { DateTime } from "luxon";
import { baseURL } from "./config.mjs";
import { day, expect, monday, test, today } from "./support.mjs";

test.beforeEach(async ({ household }) => {
  expect(household).toBeGreaterThan(0);
});
const knownFailure = (issue) =>
  test.fail(true, `https://github.com/kdybicz/sweep-heap/issues/${issue}`);

test("#19 ordinary members cannot invite administrators through public auth", async ({
  live,
  household,
}) => {
  await live.join();
  const guarded = await live.api(live.member, "/api/households/members", "PATCH", {
    userId: live.owner.id,
    role: "member",
  });
  expect(guarded.status).toBe(403);
  const response = await live.api(live.member, "/api/auth/organization/invite-member", "POST", {
    organizationId: String(household),
    email: live.alternate.email,
    role: "admin",
  });
  knownFailure(19);
  expect(response.status).toBeGreaterThanOrEqual(400);
  expect(response.status).toBeLessThan(500);
});

test("#19 public auth acceptance cannot bypass invitation secrets", async ({ live }) => {
  const invitationId = await live.invite(live.alternate);
  const response = await live.api(
    live.alternate,
    "/api/auth/organization/accept-invitation",
    "POST",
    { invitationId: String(invitationId) },
  );
  knownFailure(19);
  expect(response.status).toBeGreaterThanOrEqual(400);
  expect(response.status).toBeLessThan(500);
});

test("#19 public auth deletion cannot bypass the other-member guard", async ({
  live,
  household,
}) => {
  await live.join();
  expect((await live.api(live.owner, "/api/households", "DELETE")).status).toBe(409);
  const response = await live.api(live.owner, "/api/auth/organization/delete", "POST", {
    organizationId: String(household),
  });
  knownFailure(19);
  expect(response.status).toBeGreaterThanOrEqual(400);
  expect(response.status).toBeLessThan(500);
});

test("#21 expired pending invitations can be replaced without a server error", async ({
  live,
  household,
}, testInfo) => {
  const email = `${live.prefix}-expired@example.com`;
  const invite = await live.api(live.owner, "/api/households/members", "POST", { email });
  expect(invite.status).toBe(200);
  await live.db.query(
    "update household_member_invites set expires_at=now()-interval '1 minute' where id=$1 and household_id=$2",
    [invite.body.invite.id, household],
  );
  const recreate = await live.api(live.owner, "/api/households/members", "POST", { email });
  const resend = await live.api(
    live.owner,
    `/api/households/members/invites/${invite.body.invite.id}`,
    "POST",
  );
  await testInfo.attach("expired-invitation-responses", {
    body: JSON.stringify({ recreate, resend }),
    contentType: "application/json",
  });
  knownFailure(21);
  expect(recreate.status).toBeLessThan(400);
});

test("#22 notes-only edits preserve stay-open behavior", async ({ live }) => {
  const id = await live.chore({
    title: "Stay-open notes fixture",
    type: "stay_open",
    startDate: today(),
    endDate: day(today(), 1),
  });
  const response = await live.mutate({
    action: "edit",
    scope: "all",
    choreId: id,
    occurrenceStartDate: today(),
    notes: "Changed notes only",
  });
  expect(response.status).toBe(200);
  const stored = await live.choreRow(id);
  expect(stored).toBeDefined();
  knownFailure(22);
  expect(stored.type).toBe("stay_open");
});

test("#24 failed replacement insertion preserves the original occurrence", async ({
  live,
  household,
}) => {
  const id = await live.chore({
    title: "Atomic edit original",
    startDate: today(),
    endDate: day(today(), 1),
  });
  const replacementTitle = `${live.prefix} reject replacement`;
  const functionName = `e2e_reject_${household}`;
  // The trigger rejects only this fixture household/title, including after date validation is fixed.
  await live.db.query(
    `create function ${functionName}() returns trigger language plpgsql as $$ begin if NEW.household_id = ${household} and NEW.title = '${replacementTitle}' then raise exception 'E2E replacement insert failure'; end if; return NEW; end $$`,
  );
  try {
    await live.db.query(
      `create trigger ${functionName} before insert on chores for each row execute function ${functionName}()`,
    );
    const response = await live.mutate({
      action: "edit",
      scope: "single",
      choreId: id,
      occurrenceStartDate: today(),
      title: replacementTitle,
    });
    expect(response.status).toBe(500);
    const visible = (await live.list(today())).filter((chore) => chore.id === id);
    knownFailure(24);
    expect(visible).toHaveLength(1);
  } finally {
    await live.db.query(`drop trigger if exists ${functionName} on chores`);
    await live.db.query(`drop function if exists ${functionName}()`);
  }
});

test("#25 following edits retain future cancellation and completion exceptions", async ({
  live,
}) => {
  const start = day(monday(), -7);
  const id = await live.chore({
    title: "Following exceptions fixture",
    startDate: start,
    endDate: day(start, 1),
    repeatRule: "week",
  });
  expect(
    (
      await live.mutate({
        action: "cancel",
        scope: "single",
        choreId: id,
        occurrenceStartDate: day(start, 14),
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await live.mutate({
        action: "set",
        choreId: id,
        occurrenceStartDate: day(start, 21),
        status: "closed",
      })
    ).status,
  ).toBe(200);
  const split = await live.mutate({
    action: "edit",
    scope: "following",
    choreId: id,
    occurrenceStartDate: day(start, 7),
    title: "Following replacement",
  });
  expect(split.status).toBe(200);
  const replacementId = split.body.createdChoreId ?? split.body.data?.createdChoreId;
  const instances = (await live.list(day(start, 14), day(start, 21))).filter(
    (chore) => chore.id === replacementId,
  );
  knownFailure(25);
  expect(instances.some((chore) => chore.occurrence_start_date === day(start, 14))).toBe(false);
  expect(instances.find((chore) => chore.occurrence_start_date === day(start, 21))?.status).toBe(
    "closed",
  );
});

test("#25 whole-series shifts preserve every completion", async ({ live }) => {
  const start = day(monday(), -7);
  const id = await live.chore({
    title: "Shifted exceptions fixture",
    startDate: start,
    endDate: day(start, 1),
    repeatRule: "week",
  });
  for (const occurrenceStartDate of [start, day(start, 7)])
    expect(
      (await live.mutate({ action: "set", choreId: id, occurrenceStartDate, status: "closed" }))
        .status,
    ).toBe(200);
  expect(
    (
      await live.mutate({
        action: "edit",
        scope: "all",
        choreId: id,
        occurrenceStartDate: start,
        startDate: day(start, 1),
        endDate: day(start, 2),
      })
    ).status,
  ).toBe(200);
  const instances = (await live.list(day(start, 1), day(start, 8))).filter(
    (chore) => chore.id === id,
  );
  knownFailure(25);
  expect(instances.map((chore) => chore.status)).toEqual(["closed", "closed"]);
});

test("#27 progress counts occurrences once regardless of span", async ({ live }, testInfo) => {
  const start = monday();
  const id = await live.chore({
    title: "Completed seven-day fixture",
    startDate: start,
    endDate: day(start, 7),
  });
  expect(
    (
      await live.mutate({
        action: "set",
        choreId: id,
        occurrenceStartDate: start,
        status: "closed",
      })
    ).status,
  ).toBe(200);
  await live.chore({ title: "Open one-day fixture", startDate: today(), endDate: day(today(), 1) });
  const page = await live.board();
  await expect(page.locator("[data-chore-preview-id]")).toHaveCount(2);
  const text = (await page.locator("aside").innerText()).replace(/\s+/g, " ");
  await testInfo.attach("weekly-progress", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
  knownFailure(27);
  expect(text).toContain("1/2 done");
  expect(text).toContain("50%");
});

test("#23 extending a later occurrence does not move the series anchor", async ({ live }) => {
  const start = day(monday(), -7);
  const id = await live.chore({
    title: "Whole-series date fixture",
    startDate: start,
    endDate: day(start, 1),
    repeatRule: "week",
  });
  const page = await live.board();
  await page.locator(`[data-chore-preview-id="${id}"]`).click();
  const preview = page.getByRole("dialog", { name: "Chore preview" });
  await preview.locator("button[aria-expanded]").click();
  await preview.locator("input[type=date]").nth(1).fill(day(monday(), 1));
  const responsePromise = page.waitForResponse(
    (response) => response.url().endsWith("/api/chores") && response.request().method() === "PATCH",
  );
  await page.getByRole("button", { name: "All chores", exact: true }).click();
  expect((await responsePromise).status()).toBe(200);
  const stored = await live.choreRow(id);
  expect(stored).toBeDefined();
  knownFailure(23);
  expect(stored.start_date).toBe(start);
});

test("#26 single edits keep the preview attached to the replacement", async ({ live }) => {
  const id = await live.chore({
    title: "Preview rebind fixture",
    startDate: monday(),
    endDate: day(monday(), 1),
    repeatRule: "week",
  });
  const page = await live.board();
  await page.locator(`[data-chore-preview-id="${id}"]`).click();
  const preview = page.getByRole("dialog", { name: "Chore preview" });
  await preview.getByRole("button", { name: "Preview rebind fixture", exact: true }).click();
  await page.getByPlaceholder("Chore title").fill("Preview replacement title");
  await page.getByPlaceholder("Chore title").press("Enter");
  const responsePromise = page.waitForResponse(
    (response) => response.url().endsWith("/api/chores") && response.request().method() === "PATCH",
  );
  await page.getByRole("button", { name: "Only current chore", exact: true }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  const body = await response.json();
  const replacementId = body.createdChoreId ?? body.data?.createdChoreId;
  await expect(page.locator(`[data-chore-preview-id="${replacementId}"]`)).toHaveCount(1);
  knownFailure(26);
  await expect(preview).toBeVisible({ timeout: 2000 });
  await expect(preview).toContainText("Preview replacement title");
});

test("#28 Today advances across household-local midnight", async ({ live }) => {
  const date = today();
  // Playwright clocks affect their browser context, so isolate this clock from later tests.
  const context = await live.browser.newContext({
    storageState: await live.owner.context.storageState(),
  });
  live.contexts.push(context);
  const page = await context.newPage();
  await page.clock.install({ time: new Date(`${date}T23:59:00Z`) });
  await page.goto(`${baseURL}/household`, { waitUntil: "networkidle", timeout: 90000 });
  await page.clock.fastForward(120000);
  const expectedLabel = DateTime.fromISO(day(date, 1), { zone: "UTC" }).toFormat("ccc, LLL d");
  knownFailure(28);
  await expect(page.locator("aside")).toContainText(expectedLabel, { timeout: 2000 });
});

test("#31 invalid calendar dates return validation errors", async ({ live }) => {
  const response = await live.mutate({
    action: "create",
    title: "Invalid date fixture",
    startDate: "2026-02-30",
    endDate: "2026-03-02",
    repeatRule: "none",
  });
  knownFailure(31);
  expect(response.status).toBe(400);
});

test("#34 monthly recurrence restores the anchor after a short month", async ({ live }) => {
  const year = DateTime.now().year;
  const id = await live.chore({
    title: "Monthly anchor fixture",
    startDate: `${year}-01-31`,
    endDate: `${year}-02-01`,
    repeatRule: "month",
  });
  const march = (await live.list(`${year}-03-01`, `${year}-03-31`))
    .filter((chore) => chore.id === id)
    .map((chore) => chore.occurrence_start_date);
  knownFailure(34);
  expect(march).toEqual([`${year}-03-31`]);
});

test("#32 failed loads show an error instead of an empty schedule", async ({ live }) => {
  const page = await live.owner.context.newPage();
  await page.route("**/api/chores?**", (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({
        ok: false,
        code: "INTERNAL_SERVER_ERROR",
        error: "Failed to load chores",
      }),
    }),
  );
  await page.goto(`${baseURL}/household`, { waitUntil: "networkidle", timeout: 90000 });
  knownFailure(32);
  await expect(page.locator("main").getByRole("alert")).toBeVisible({ timeout: 2000 });
});
