import { readFile, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { DateTime } from "luxon";
import {
  MAX_CHORE_DURATION_DAYS,
  MAX_CHORE_EXCEPTION_MIGRATIONS,
  MAX_CHORE_QUERY_DAYS,
  MAX_CHORE_QUERY_ROWS,
} from "../src/lib/chore-date-validation.ts";
import { generateOccurrenceDayEntries, isOccurrenceStartInSeries } from "../src/lib/occurrences.ts";
import { listActiveChoreSeriesQuery } from "../src/lib/repositories/chore-series-query.ts";
import { baseURL, mailpitURL } from "./config.mjs";
import { generateOccurrencesByStepping } from "./legacy-occurrences.ts";
import { day, expect, monday, test, today } from "./support.mjs";

test.beforeEach(async ({ household }) => {
  expect(household).toBeGreaterThan(0);
});
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
  expect(response.status).toBe(404);
  expect(
    (
      await live.db.query(
        "select id from household_member_invites where household_id=$1 and email=$2",
        [household, live.alternate.email],
      )
    ).rowCount,
  ).toBe(0);
});

test("#19 public auth acceptance cannot bypass invitation secrets", async ({ live, household }) => {
  const invitationId = await live.invite(live.alternate);
  const response = await live.api(
    live.alternate,
    "/api/auth/organization/accept-invitation",
    "POST",
    { invitationId: String(invitationId) },
  );
  expect(response.status).toBe(404);
  expect(
    (
      await live.db.query(
        "select id from household_memberships where household_id=$1 and user_id=$2",
        [household, live.alternate.id],
      )
    ).rowCount,
  ).toBe(0);
  await live.accept(live.alternate, invitationId);
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
  expect(response.status).toBe(404);
  expect((await live.db.query("select id from households where id=$1", [household])).rowCount).toBe(
    1,
  );
});

test("#19 organization reads and remaining mutations are server-only", async ({
  live,
  household,
}) => {
  await live.join();
  const mutations = [
    "create",
    "update",
    "update-member-role",
    "remove-member",
    "leave",
    "set-active",
    "cancel-invitation",
    "reject-invitation",
  ];
  const reads = [
    "list",
    "list-members",
    "list-invitations",
    "list-user-invitations",
    "get-invitation",
    "get-active-member",
  ];
  for (const user of [live.owner, live.member]) {
    for (const endpoint of mutations) {
      const response = await live.api(user, `/api/auth/organization/${endpoint}`, "POST", {
        organizationId: String(household),
        name: "Bypass fixture",
        slug: live.prefix,
        timeZone: "not-a-time-zone",
        memberId: String(live.member.id),
        role: "owner",
      });
      expect(response.status, `${endpoint} as ${user.email}`).toBe(404);
    }
    for (const endpoint of reads)
      expect((await live.api(user, `/api/auth/organization/${endpoint}`)).status, endpoint).toBe(
        404,
      );
  }
  expect((await live.api(live.owner, "/api/households/members")).status).toBe(200);
  expect(
    (
      await live.api(live.owner, "/api/households", "PATCH", {
        name: `${live.prefix} valid settings`,
        timeZone: "not-a-time-zone",
      })
    ).status,
  ).toBe(400);
});

test("#19 guarded member and ownership workflows retain server-side SDK access", async ({
  live,
}) => {
  await live.join();
  expect(
    (
      await live.api(live.owner, "/api/households/members", "PATCH", {
        userId: live.owner.id,
        role: "member",
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await live.api(live.owner, "/api/households/members", "PATCH", {
        userId: live.member.id,
        role: "admin",
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await live.api(live.member, "/api/households/members", "PATCH", {
        userId: live.owner.id,
        role: "member",
      })
    ).status,
  ).toBe(403);
  expect(
    (await live.api(live.member, "/api/households/members", "DELETE", { userId: live.member.id }))
      .status,
  ).toBe(400);
  expect(
    (
      await live.api(live.owner, "/api/households/members/owner-transfer", "POST", {
        userId: live.member.id,
      })
    ).status,
  ).toBe(200);
  expect((await live.api(live.member, "/api/households/members/leave", "POST")).status).toBe(403);
  expect(
    (
      await live.api(live.member, "/api/households/members/owner-transfer", "POST", {
        userId: live.owner.id,
      })
    ).status,
  ).toBe(200);
  expect(
    (await live.api(live.owner, "/api/households/members", "DELETE", { userId: live.member.id }))
      .status,
  ).toBe(200);
});

test("#19 owner-role invitations remain protected through guarded APIs", async ({
  live,
  household,
}) => {
  await live.join();
  const invitationId = await live.invite(live.alternate);
  await live.db.query(
    "update household_member_invites set role='owner' where id=$1 and household_id=$2",
    [invitationId, household],
  );
  const path = `/api/households/members/invites/${invitationId}`;
  expect((await live.api(live.member, path, "POST")).status).toBe(403);
  expect(
    (
      await live.api(live.owner, "/api/households/members", "PATCH", {
        userId: live.member.id,
        role: "admin",
      })
    ).status,
  ).toBe(200);
  expect((await live.api(live.member, path, "POST")).status).toBe(403);
  expect((await live.api(live.member, path, "DELETE")).status).toBe(403);
  expect((await live.api(live.owner, path, "POST")).status).toBe(200);
  expect((await live.api(live.owner, path, "DELETE")).status).toBe(200);
});

test("#21 expired pending invitations stay visible and can be replaced", async ({
  live,
  household,
}) => {
  const email = live.member.email;
  const invite = await live.api(live.owner, "/api/households/members", "POST", { email });
  expect(invite.status).toBe(200);
  const originalLink = new URL(
    await live.emailLink(email, "/household/invite?", invite.body.invite.id),
  );
  await live.db.query(
    "update household_member_invites set expires_at=now()-interval '1 minute' where id=$1 and household_id=$2",
    [invite.body.invite.id, household],
  );
  const snapshot = await live.api(live.owner, "/api/households/members");
  expect(snapshot.body.pendingInvites.find((row) => row.id === invite.body.invite.id).expired).toBe(
    true,
  );
  const page = await live.owner.context.newPage();
  await page.goto(`${baseURL}/household/members`, { waitUntil: "networkidle" });
  const row = page.getByRole("row").filter({ hasText: email });
  await expect(row).toContainText("Expired invite");
  await row.getByRole("button", { name: "Open invite actions" }).click();
  await expect(page.getByRole("button", { name: "Resend invite", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Invite member", exact: true }).click();
  await page.getByLabel("Invite by email").fill(email.toUpperCase());
  const createdResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/households/members") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Send invite", exact: true }).click();
  const response = await createdResponse;
  expect(response.status()).toBe(200);
  const recreate = { body: await response.json() };
  expect(recreate.body.invite.id).not.toBe(invite.body.invite.id);
  await expect(page.getByRole("row").filter({ hasText: email })).toHaveCount(1);
  await expect(page.getByRole("row").filter({ hasText: email })).toContainText("Pending invite");
  await expect(page.getByRole("row").filter({ hasText: email })).not.toContainText(
    "Expired invite",
  );
  expect(
    (
      await live.db.query(
        "select status,accept_secret_hash from household_member_invites where id=$1",
        [invite.body.invite.id],
      )
    ).rows[0],
  ).toMatchObject({ status: "canceled", accept_secret_hash: null });
  expect(
    (
      await live.db.query(
        "select id from household_member_invites where household_id=$1 and lower(email)=lower($2) and status='pending'",
        [household, email],
      )
    ).rowCount,
  ).toBe(1);
  expect(
    (
      await live.api(live.member, "/api/households/invites/accept", "POST", {
        invitationId: invite.body.invite.id,
        secret: originalLink.searchParams.get("secret"),
      })
    ).status,
  ).toBe(400);
  await live.accept(live.member, recreate.body.invite.id);
});

test("#21 expired resend preserves id and role while rotating its secret", async ({
  live,
  household,
}) => {
  const invitationId = await live.invite(live.member);
  const original = new URL(
    await live.emailLink(live.member.email, "/household/invite?", invitationId),
  );
  await live.db.query(
    "update household_member_invites set role='admin', expires_at=clock_timestamp()-interval '1 minute' where id=$1 and household_id=$2",
    [invitationId, household],
  );
  const response = await live.api(
    live.owner,
    `/api/households/members/invites/${invitationId}`,
    "POST",
  );
  expect(response.status).toBe(200);
  expect(response.body.invite).toMatchObject({ id: invitationId, role: "admin" });
  expect(response.body.inviteEmailSent).toBe(true);
  expect(Date.parse(response.body.invite.expiresAt)).toBeGreaterThan(Date.now());
  const refreshed = new URL(
    await live.emailLink(live.member.email, "/household/invite?", invitationId),
  );
  expect(refreshed.searchParams.get("secret")).not.toBe(original.searchParams.get("secret"));
  expect(
    (
      await live.api(live.member, "/api/households/invites/accept", "POST", {
        invitationId,
        secret: original.searchParams.get("secret"),
      })
    ).status,
  ).toBe(400);
  await live.accept(live.member, invitationId);
  expect(
    (
      await live.db.query(
        "select role from household_memberships where household_id=$1 and user_id=$2",
        [household, live.member.id],
      )
    ).rows[0].role,
  ).toBe("admin");
});

test("#21 concurrent creation keeps one pending normalized email", async ({ live, household }) => {
  const email = `${live.prefix}-concurrent@example.com`;
  const responses = await Promise.all([
    live.api(live.owner, "/api/households/members", "POST", { email }),
    live.api(live.owner, "/api/households/members", "POST", { email: ` ${email.toUpperCase()} ` }),
  ]);
  expect(responses.map((row) => row.status).sort()).toEqual([200, 409]);
  expect(
    (
      await live.db.query(
        "select id from household_member_invites where household_id=$1 and lower(email)=lower($2) and status='pending'",
        [household, email],
      )
    ).rowCount,
  ).toBe(1);
});

test("#21 raw pending-index violations recover after rollback and do not leak partial rows", async ({
  live,
  household,
}) => {
  const name = `e2e_invite_conflict_${household}`;
  const email = `${live.prefix}-sql-conflict@example.com`;
  await live.db.query(
    `create function ${name}() returns trigger language plpgsql as $$ begin if pg_trigger_depth()=1 and NEW.household_id=${household} and NEW.email='${email}' then insert into household_member_invites (household_id,invited_by_user_id,email,role,status,expires_at) values (NEW.household_id,NEW.invited_by_user_id,NEW.email,'member','pending',clock_timestamp()+interval '7 days'); end if; return NEW; end $$`,
  );
  try {
    await live.db.query(
      `create trigger ${name} before insert on household_member_invites for each row execute function ${name}()`,
    );
    const response = await live.api(live.owner, "/api/households/members", "POST", { email });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe("USER_ALREADY_INVITED");
    expect(
      (
        await live.db.query(
          "select id from household_member_invites where household_id=$1 and email=$2",
          [household, email],
        )
      ).rowCount,
    ).toBe(0);
  } finally {
    await live.db.query(`drop trigger if exists ${name} on household_member_invites`);
    await live.db.query(`drop function if exists ${name}()`);
  }
  expect((await live.api(live.owner, "/api/households/members", "POST", { email })).status).toBe(
    200,
  );
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
  expect(stored.type).toBe("stay_open");
});

test("#22 partial edits preserve completion behavior across every scope", async ({ live }) => {
  const start = day(monday(), -7);
  const selected = monday();
  for (const scope of ["single", "following", "all"]) {
    for (const [field, changes] of [
      ["notes", { notes: "Updated notes" }],
      ["dates", { startDate: day(selected, 1), endDate: day(selected, 2) }],
      ["recurrence", { repeatRule: "biweek" }],
    ]) {
      const id = await live.chore({
        title: `${scope} ${field} type fixture`,
        type: "stay_open",
        startDate: start,
        endDate: day(start, 1),
        repeatRule: "week",
      });
      const edited = await live.mutate({
        action: "edit",
        scope,
        choreId: id,
        occurrenceStartDate: selected,
        ...changes,
      });
      expect(edited.status, `${scope} ${field}`).toBe(200);
      const targetId = edited.body.createdChoreId ?? id;
      expect((await live.choreRow(targetId)).type).toBe("stay_open");
      const instance = (await live.list(start, day(selected, 21))).find(
        (row) => row.id === targetId,
      );
      expect(instance).toBeDefined();
      const completed = await live.mutate({
        action: "set",
        choreId: targetId,
        occurrenceStartDate: instance.occurrence_start_date,
        status: "closed",
      });
      expect(completed.status).toBe(200);
      expect(completed.body).toMatchObject({
        type: "stay_open",
        status: "open",
        closed_reason: "done",
      });
    }
  }
});

test("#22 explicit type changes retain their intended completion semantics", async ({ live }) => {
  const start = day(monday(), -7);
  for (const scope of ["single", "following", "all"]) {
    for (const type of ["stay_open", "close_on_done"]) {
      const id = await live.chore({
        title: "Explicit type fixture",
        type: type === "stay_open" ? "close_on_done" : "stay_open",
        startDate: start,
        endDate: day(start, 1),
        repeatRule: "week",
      });
      const edited = await live.mutate({
        action: "edit",
        scope,
        choreId: id,
        occurrenceStartDate: monday(),
        type: ` ${type.toUpperCase()} `,
      });
      expect(edited.status).toBe(200);
      const targetId = edited.body.createdChoreId ?? id;
      expect((await live.choreRow(targetId)).type).toBe(type);
      const instance = (await live.list(start, day(monday(), 14))).find(
        (row) => row.id === targetId,
      );
      const completed = await live.mutate({
        action: "set",
        choreId: targetId,
        occurrenceStartDate: instance.occurrence_start_date,
        status: "closed",
      });
      expect(completed.body.status).toBe(type === "stay_open" ? "open" : "closed");
    }
  }
});

test("#22 creation defaults only omitted types and invalid edit types do not mutate storage", async ({
  live,
}) => {
  const created = await live.mutate({
    action: "create",
    title: "Default type fixture",
    startDate: today(),
    endDate: day(today(), 1),
    repeatRule: "none",
  });
  expect(created.status).toBe(200);
  expect((await live.choreRow(created.body.choreId)).type).toBe("close_on_done");
  const id = await live.chore({
    title: "Invalid type fixture",
    type: "stay_open",
    startDate: day(monday(), -7),
    endDate: day(monday(), -6),
    repeatRule: "week",
  });
  for (const scope of ["single", "following", "all"]) {
    for (const type of ["invalid", "", null, 12]) {
      const response = await live.mutate({
        action: "edit",
        scope,
        choreId: id,
        occurrenceStartDate: monday(),
        type,
      });
      expect(response.status).toBe(400);
      expect(response.body.fieldErrors.type).toBe("Invalid chore type");
    }
  }
  expect((await live.choreRow(id)).type).toBe("stay_open");
  expect((await live.list(monday())).filter((row) => row.id === id)).toHaveLength(1);
});

test("#22 inline notes editor keeps a stay-open chore open after logging", async ({ live }) => {
  const id = await live.chore({
    title: "Inline notes type fixture",
    type: "stay_open",
    startDate: today(),
    endDate: day(today(), 1),
  });
  const page = await live.board();
  await page.locator(`[data-chore-preview-id="${id}"]`).click();
  const preview = page.getByRole("dialog", { name: "Chore preview" });
  await preview.getByRole("button", { name: "Add Notes", exact: true }).click();
  const textarea = preview.getByPlaceholder("Add Notes");
  await textarea.fill("Only inline notes changed");
  const saved = page.waitForResponse(
    (response) => response.url().endsWith("/api/chores") && response.request().method() === "PATCH",
  );
  await textarea.evaluate((element) => element.blur());
  expect((await saved).status()).toBe(200);
  expect((await live.choreRow(id)).type).toBe("stay_open");
  // Saving notes can leave the preview open; reload before reopening the persisted chore.
  await page.reload();
  await page.locator(`[data-chore-preview-id="${id}"]`).click();
  await page.getByRole("button", { name: "Log completion", exact: true }).click();
  await expect
    .poll(async () => (await live.list(today())).find((row) => row.id === id)?.closed_reason)
    .toBe("done");
  expect((await live.list(today())).find((row) => row.id === id).status).toBe("open");
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
    expect(visible).toHaveLength(1);
  } finally {
    await live.db.query(`drop trigger if exists ${functionName} on chores`);
    await live.db.query(`drop function if exists ${functionName}()`);
  }
  const retry = await live.mutate({
    action: "edit",
    scope: "single",
    choreId: id,
    occurrenceStartDate: today(),
    title: replacementTitle,
  });
  expect(retry.status).toBe(200);
  expect((await live.choreRow(retry.body.createdChoreId)).title).toBe(replacementTitle);
});

test("#24 a suppressed insertion without a returned id cannot commit cancellation", async ({
  live,
  household,
}) => {
  const id = await live.chore({
    title: "Suppressed insert source",
    startDate: today(),
    endDate: day(today(), 1),
  });
  const title = `${live.prefix} suppressed replacement`;
  const name = `e2e_suppressed_${household}`;
  await live.db.query(
    `create function ${name}() returns trigger language plpgsql as $$ begin if NEW.household_id=${household} and NEW.title='${title}' then return null; end if; return NEW; end $$`,
  );
  try {
    await live.db.query(
      `create trigger ${name} before insert on chores for each row execute function ${name}()`,
    );
    expect(
      (
        await live.mutate({
          action: "edit",
          scope: "single",
          choreId: id,
          occurrenceStartDate: today(),
          title,
        })
      ).status,
    ).toBe(500);
    expect((await live.list(today())).filter((row) => row.id === id)).toHaveLength(1);
  } finally {
    await live.db.query(`drop trigger if exists ${name} on chores`);
    await live.db.query(`drop function if exists ${name}()`);
  }
});

test("#24 failed single/following inserts preserve the source bounds and completion state", async ({
  live,
  household,
}) => {
  const start = day(monday(), -7);
  for (const scope of ["single", "following"]) {
    const id = await live.chore({
      title: "Atomic completed source",
      startDate: start,
      endDate: day(start, 1),
      seriesEndDate: day(monday(), 21),
      repeatRule: "week",
    });
    expect(
      (
        await live.mutate({
          action: "set",
          choreId: id,
          occurrenceStartDate: monday(),
          status: "closed",
        })
      ).status,
    ).toBe(200);
    const before = (await live.db.query("select * from chores where id=$1", [id])).rows[0];
    const title = `${live.prefix} fail ${scope}`;
    const name = `e2e_atomic_insert_${household}_${scope}`;
    await live.db.query(
      `create function ${name}() returns trigger language plpgsql as $$ begin if NEW.household_id=${household} and NEW.title='${title}' then raise exception 'E2E atomic insert failure'; end if; return NEW; end $$`,
    );
    try {
      await live.db.query(
        `create trigger ${name} before insert on chores for each row execute function ${name}()`,
      );
      const response = await live.mutate({
        action: "edit",
        scope,
        choreId: id,
        occurrenceStartDate: monday(),
        title,
      });
      expect(response.status).toBe(500);
      expect((await live.db.query("select * from chores where id=$1", [id])).rows[0]).toEqual(
        before,
      );
      expect(
        (
          await live.db.query(
            "select kind,status,closed_reason from chore_occurrence_exceptions where chore_id=$1 and occurrence_start_date=$2",
            [id, monday()],
          )
        ).rows[0],
      ).toEqual({ kind: "state", status: "closed", closed_reason: "done" });
      expect(
        (
          await live.db.query("select id from chores where household_id=$1 and title=$2", [
            household,
            title,
          ])
        ).rowCount,
      ).toBe(0);
    } finally {
      await live.db.query(`drop trigger if exists ${name} on chores`);
      await live.db.query(`drop function if exists ${name}()`);
    }
    const retry = await live.mutate({
      action: "edit",
      scope,
      choreId: id,
      occurrenceStartDate: monday(),
      title,
    });
    expect(retry.status).toBe(200);
    expect(
      (await live.list(monday())).find((row) => row.id === retry.body.createdChoreId),
    ).toMatchObject({ status: "closed", closed_reason: "done" });
  }
});

test("#24 completion-copy failures roll back replacement creation and original edits", async ({
  live,
  household,
}) => {
  const start = day(monday(), -7);
  for (const scope of ["single", "following", "all"]) {
    const id = await live.chore({
      title: "Atomic state source",
      startDate: start,
      endDate: day(start, 1),
      repeatRule: "week",
    });
    expect(
      (
        await live.mutate({
          action: "set",
          choreId: id,
          occurrenceStartDate: monday(),
          status: "closed",
        })
      ).status,
    ).toBe(200);
    const before = (await live.db.query("select * from chores where id=$1", [id])).rows[0];
    const title = `${live.prefix} state ${scope}`;
    const name = `e2e_atomic_state_${household}_${scope}`;
    await live.db.query(
      `create function ${name}() returns trigger language plpgsql as $$ begin if NEW.kind='state' and exists(select 1 from chores where id=NEW.chore_id and household_id=${household} and title='${title}') then raise exception 'E2E atomic state failure'; end if; return NEW; end $$`,
    );
    try {
      await live.db.query(
        `create trigger ${name} before insert on chore_occurrence_exceptions for each row execute function ${name}()`,
      );
      const dates =
        scope === "all"
          ? { dateBasis: "occurrence", startDate: day(monday(), 1), endDate: day(monday(), 2) }
          : {};
      const response = await live.mutate({
        action: "edit",
        scope,
        choreId: id,
        occurrenceStartDate: monday(),
        title,
        ...dates,
      });
      expect(response.status).toBe(500);
      expect((await live.db.query("select * from chores where id=$1", [id])).rows[0]).toEqual(
        before,
      );
      expect(
        (
          await live.db.query(
            "select kind,status,closed_reason from chore_occurrence_exceptions where chore_id=$1 and occurrence_start_date=$2",
            [id, monday()],
          )
        ).rows[0],
      ).toEqual({ kind: "state", status: "closed", closed_reason: "done" });
      expect(
        (
          await live.db.query("select id from chores where household_id=$1 and title=$2", [
            household,
            title,
          ])
        ).rowCount,
      ).toBe(0);
    } finally {
      await live.db.query(`drop trigger if exists ${name} on chore_occurrence_exceptions`);
      await live.db.query(`drop function if exists ${name}()`);
    }
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
  expect(instances.map((chore) => chore.status)).toEqual(["closed", "closed"]);
});

for (const scope of ["all", "following"]) {
  test(`#25 ${scope} edits migrate mixed exceptions through collisions and cadence changes`, async ({
    live,
  }) => {
    const start = day(monday(), -7);
    const id = await live.chore({
      title: "Mixed exceptions source",
      startDate: start,
      endDate: day(start, 1),
      repeatRule: "day",
    });
    for (const offset of [0, 2, 4]) {
      expect(
        (
          await live.mutate({
            action: "set",
            choreId: id,
            occurrenceStartDate: day(start, offset),
            status: "closed",
          })
        ).status,
      ).toBe(200);
    }
    expect(
      (
        await live.mutate({
          action: "cancel",
          scope: "single",
          choreId: id,
          occurrenceStartDate: day(start, 3),
        })
      ).status,
    ).toBe(200);
    const from = scope === "all" ? start : day(start, 2);
    const target = day(from, 1);
    const shifted = await live.mutate({
      action: "edit",
      scope,
      choreId: id,
      occurrenceStartDate: from,
      startDate: target,
      endDate: day(target, 1),
    });
    expect(shifted.status).toBe(200);
    const targetId = scope === "all" ? id : shifted.body.createdChoreId;
    const rows = async (choreId) =>
      (
        await live.db.query(
          "select to_char(occurrence_start_date,'YYYY-MM-DD') as date,kind,status,closed_reason from chore_occurrence_exceptions where chore_id=$1 order by occurrence_start_date",
          [choreId],
        )
      ).rows;
    const offsets = scope === "all" ? [0, 2, 3, 4] : [0, 1, 2];
    expect((await rows(targetId)).map((row) => row.date)).toEqual(
      offsets.map((offset) => day(target, offset)),
    );
    if (scope === "following") expect((await rows(id)).map((row) => row.date)).toEqual([start]);
    const cadence = await live.mutate({
      action: "edit",
      scope: "all",
      choreId: targetId,
      occurrenceStartDate: target,
      repeatRule: "week",
      seriesEndDate: day(target, 21),
    });
    expect(cadence.status).toBe(200);
    const mapped = await rows(targetId);
    const remaining = offsets.filter((offset) => offset <= 3);
    expect(mapped.map((row) => row.date)).toEqual(
      remaining.map((offset) => day(target, offset * 7)),
    );
    expect(mapped.find((row) => row.kind === "canceled")).toMatchObject({
      status: null,
      closed_reason: null,
    });
    const visible = (await live.list(target, day(target, 21))).filter((row) => row.id === targetId);
    expect(
      visible.some(
        (row) => row.occurrence_start_date === mapped.find((row) => row.kind === "canceled").date,
      ),
    ).toBe(false);
    for (const row of mapped.filter((row) => row.kind === "state")) {
      expect(visible.find((entry) => entry.occurrence_start_date === row.date)).toMatchObject({
        status: "closed",
        closed_reason: "done",
      });
    }
  });

  test(`#25 ${scope} migration failures restore all source exceptions and allow retry`, async ({
    live,
    household,
  }) => {
    const start = day(monday(), -7);
    const id = await live.chore({
      title: "Migration rollback source",
      startDate: start,
      endDate: day(start, 1),
      repeatRule: "day",
    });
    for (const offset of [0, 2, 4])
      expect(
        (
          await live.mutate({
            action: "set",
            choreId: id,
            occurrenceStartDate: day(start, offset),
            status: "closed",
          })
        ).status,
      ).toBe(200);
    expect(
      (
        await live.mutate({
          action: "cancel",
          scope: "single",
          choreId: id,
          occurrenceStartDate: day(start, 3),
        })
      ).status,
    ).toBe(200);
    const before = (await live.db.query("select * from chores where id=$1", [id])).rows[0];
    const exceptions = (
      await live.db.query(
        "select * from chore_occurrence_exceptions where chore_id=$1 order by id",
        [id],
      )
    ).rows;
    const name = `e2e_migration_${household}_${scope}`;
    const title = `${live.prefix} migration ${scope}`;
    await live.db.query(
      `create function ${name}() returns trigger language plpgsql as $$ begin if NEW.kind='canceled' and exists(select 1 from chores where id=NEW.chore_id and household_id=${household} and title='${title}') then raise exception 'E2E migration failure after completion copy'; end if; return NEW; end $$`,
    );
    const payload = {
      action: "edit",
      scope,
      choreId: id,
      occurrenceStartDate: day(start, 2),
      startDate: day(start, 3),
      endDate: day(start, 4),
      title,
    };
    try {
      await live.db.query(
        `create trigger ${name} before insert on chore_occurrence_exceptions for each row execute function ${name}()`,
      );
      expect((await live.mutate(payload)).status).toBe(500);
      expect((await live.db.query("select * from chores where id=$1", [id])).rows[0]).toEqual(
        before,
      );
      expect(
        (
          await live.db.query(
            "select * from chore_occurrence_exceptions where chore_id=$1 order by id",
            [id],
          )
        ).rows,
      ).toEqual(exceptions);
      expect(
        (
          await live.db.query("select id from chores where household_id=$1 and title=$2", [
            household,
            title,
          ])
        ).rowCount,
      ).toBe(0);
    } finally {
      await live.db.query(`drop trigger if exists ${name} on chore_occurrence_exceptions`);
      await live.db.query(`drop function if exists ${name}()`);
    }
    expect((await live.mutate(payload)).status).toBe(200);
  });
}

const expectWeeklyProgress = async (page, { done, total, open, percent }) => {
  const sidebar = page
    .locator("aside")
    .getByText("Week progress", { exact: true })
    .locator("..")
    .locator("..");
  await expect(sidebar.getByText(`${done}/${total} done`, { exact: true })).toBeVisible();
  await expect(
    sidebar.getByText("Total", { exact: true }).locator("..").locator("div").first(),
  ).toHaveText(String(total));
  await expect(
    sidebar.getByText("Open", { exact: true }).locator("..").locator("div").first(),
  ).toHaveText(String(open));
  await expect(sidebar.getByText(`${percent}%`, { exact: true })).toBeVisible();
};

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
  const openId = await live.chore({
    title: "Open one-day fixture",
    startDate: today(),
    endDate: day(today(), 1),
  });
  const page = await live.board();
  await expect(page.locator("[data-chore-preview-id]")).toHaveCount(2);
  await expectWeeklyProgress(page, { done: 1, total: 2, open: 1, percent: 50 });
  await testInfo.attach("weekly-progress", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
  await page.locator(`[data-chore-preview-id="${openId}"]`).click();
  const completed = page.waitForResponse(
    (response) => response.url().endsWith("/api/chores") && response.request().method() === "PATCH",
  );
  await page
    .getByRole("dialog", { name: "Chore preview" })
    .getByRole("button", { name: "Complete & close", exact: true })
    .click();
  expect((await completed).status()).toBe(200);
  await expectWeeklyProgress(page, { done: 2, total: 2, open: 0, percent: 100 });
  await page.reload();
  await expectWeeklyProgress(page, { done: 2, total: 2, open: 0, percent: 100 });
});

test("#27 overlapping recurrences stay distinct and logged stay-open chores count as done", async ({
  live,
}) => {
  const start = monday();
  const seriesId = await live.chore({
    title: "Overlapping nine-day weekly fixture",
    startDate: day(start, -7),
    endDate: day(start, 2),
    repeatRule: "week",
    seriesEndDate: start,
  });
  expect(
    (
      await live.mutate({
        action: "set",
        choreId: seriesId,
        occurrenceStartDate: day(start, -7),
        status: "closed",
      })
    ).status,
  ).toBe(200);
  const loggedId = await live.chore({
    title: "Logged seven-day stay-open fixture",
    type: "stay_open",
    startDate: start,
    endDate: day(start, 7),
  });
  expect(
    (
      await live.mutate({
        action: "set",
        choreId: loggedId,
        occurrenceStartDate: start,
        status: "closed",
      })
    ).status,
  ).toBe(200);
  const rows = await live.list(start, day(start, 6));
  expect(rows.filter((row) => row.id === seriesId)).toHaveLength(9);
  expect(
    rows
      .filter((row) => row.id === loggedId)
      .every((row) => row.status === "open" && row.closed_reason === "done"),
  ).toBe(true);
  const page = await live.board();
  await expect(page.locator(`[data-chore-preview-id="${seriesId}"]`)).toHaveCount(2);
  await expect(page.locator("[data-chore-preview-id]")).toHaveCount(3);
  await expectWeeklyProgress(page, { done: 2, total: 3, open: 1, percent: 67 });
  expect(
    (
      await live.mutate({
        action: "cancel",
        scope: "single",
        choreId: seriesId,
        occurrenceStartDate: start,
      })
    ).status,
  ).toBe(200);
  await page.reload();
  await expectWeeklyProgress(page, { done: 2, total: 2, open: 0, percent: 100 });
  await expect(page.locator("[data-chore-preview-id]")).toHaveCount(2);
});

test("#27 clipped spans count once in each week they overlap", async ({ live }) => {
  const start = monday();
  const id = await live.chore({
    title: "Three-week clipped fixture",
    startDate: day(start, -3),
    endDate: day(start, 10),
  });
  expect(
    (
      await live.mutate({
        action: "set",
        choreId: id,
        occurrenceStartDate: day(start, -3),
        status: "closed",
      })
    ).status,
  ).toBe(200);
  await live.chore({
    title: "Current-week open fixture",
    startDate: day(start, 6),
    endDate: day(start, 7),
  });
  const page = await live.board();
  await expectWeeklyProgress(page, { done: 1, total: 2, open: 1, percent: 50 });
  await page.getByRole("button", { name: "Next week", exact: true }).click();
  await expectWeeklyProgress(page, { done: 1, total: 1, open: 0, percent: 100 });
  await page.getByRole("button", { name: "Previous week", exact: true }).click();
  await expectWeeklyProgress(page, { done: 1, total: 2, open: 1, percent: 50 });
  await page.getByRole("button", { name: "Previous week", exact: true }).click();
  await expectWeeklyProgress(page, { done: 1, total: 1, open: 0, percent: 100 });
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
  expect(stored.start_date).toBe(start);
  expect(stored.end_date).toBe(day(start, 2));
  const visible = await live.list(start, day(monday(), 7));
  expect(visible.some((row) => row.id === id && row.occurrence_start_date === start)).toBe(true);
  expect(visible.some((row) => row.id === id && row.occurrence_start_date === monday())).toBe(true);
});

test("#23 occurrence-relative all edits shift the original chain forward or backward", async ({
  live,
}) => {
  const start = day(monday(), -14);
  const selected = monday();
  for (const delta of [-2, 2]) {
    const id = await live.chore({
      title: "Relative shift fixture",
      startDate: start,
      endDate: day(start, 1),
      repeatRule: "week",
    });
    const response = await live.mutate({
      action: "edit",
      scope: "all",
      dateBasis: "occurrence",
      choreId: id,
      occurrenceStartDate: selected,
      startDate: day(selected, delta),
      endDate: day(selected, delta + 3),
    });
    expect(response.status).toBe(200);
    const stored = await live.choreRow(id);
    expect(stored.start_date).toBe(day(start, delta));
    expect(stored.end_date).toBe(day(start, delta + 3));
    const entries = (await live.list(day(start, -3), day(selected, 10))).filter(
      (row) => row.id === id,
    );
    const instances = new Set(entries.map((row) => row.occurrence_start_date));
    for (const offset of [0, 7, 14, 21])
      expect(instances.has(day(start, offset + delta))).toBe(true);
  }
});

test("#23 absolute series dates and other edit scopes retain their existing meaning", async ({
  live,
}) => {
  const start = day(monday(), -7);
  const selected = monday();
  const absolute = await live.chore({
    title: "Absolute date fixture",
    startDate: start,
    endDate: day(start, 1),
    repeatRule: "week",
  });
  expect(
    (
      await live.mutate({
        action: "edit",
        scope: "all",
        choreId: absolute,
        occurrenceStartDate: selected,
        startDate: day(selected, 1),
        endDate: day(selected, 3),
      })
    ).status,
  ).toBe(200);
  expect((await live.choreRow(absolute)).start_date).toBe(day(selected, 1));
  for (const scope of ["single", "following"]) {
    const id = await live.chore({
      title: "Scoped date fixture",
      startDate: start,
      endDate: day(start, 1),
      repeatRule: "week",
    });
    const response = await live.mutate({
      action: "edit",
      scope,
      dateBasis: "occurrence",
      choreId: id,
      occurrenceStartDate: selected,
      startDate: day(selected, 1),
      endDate: day(selected, 3),
    });
    expect(response.status).toBe(200);
    expect((await live.choreRow(response.body.createdChoreId)).start_date).toBe(day(selected, 1));
  }
  const first = await live.chore({
    title: "First following fixture",
    startDate: start,
    endDate: day(start, 1),
    repeatRule: "week",
  });
  const firstResponse = await live.mutate({
    action: "edit",
    scope: "following",
    dateBasis: "occurrence",
    choreId: first,
    occurrenceStartDate: start,
    startDate: day(start, 1),
    endDate: day(start, 3),
  });
  expect(firstResponse.status).toBe(200);
  expect(firstResponse.body.createdChoreId).toBeUndefined();
  expect((await live.choreRow(first)).start_date).toBe(day(start, 1));
});

test("#23 unsupported basis and invalid relative dates fail before changing the anchor", async ({
  live,
}) => {
  const start = day(monday(), -7);
  const id = await live.chore({
    title: "Relative validation fixture",
    startDate: start,
    endDate: day(start, 1),
    repeatRule: "week",
  });
  for (const changes of [
    { dateBasis: "invalid" },
    { dateBasis: "occurrence", startDate: "2026-02-30", endDate: "2026-03-02" },
    { dateBasis: "occurrence", startDate: monday(), endDate: monday() },
  ]) {
    expect(
      (
        await live.mutate({
          action: "edit",
          scope: "all",
          choreId: id,
          occurrenceStartDate: monday(),
          ...changes,
        })
      ).status,
    ).toBe(400);
  }
  expect((await live.choreRow(id)).start_date).toBe(start);
});

for (const scope of ["single", "following"]) {
  for (const field of ["title", "dates", "notes", "repeat"]) {
    test(`#26 ${scope} ${field} edits rebind the preview and subsequent mutations`, async ({
      live,
    }) => {
      const start = day(monday(), -7);
      const id = await live.chore({
        title: "Preview rebind fixture",
        startDate: start,
        endDate: day(start, 1),
        repeatRule: "week",
      });
      const page = await live.board();
      await page.locator(`[data-chore-preview-id="${id}"]`).click();
      const preview = page.getByRole("dialog", { name: "Chore preview" });
      const targetDate = field === "dates" ? day(monday(), 1) : monday();
      if (field === "title") {
        await preview.getByRole("button", { name: "Preview rebind fixture", exact: true }).click();
        await preview.getByPlaceholder("Chore title").fill("Preview replacement title");
        await preview.getByPlaceholder("Chore title").press("Enter");
      } else if (field === "notes") {
        await preview.getByRole("button", { name: "Add Notes", exact: true }).click();
        const textarea = preview.getByPlaceholder("Add Notes");
        await textarea.fill("Replacement notes");
        // Blur to a control inside the preview, so this save requests continuity rather than close.
        await preview.locator("button[aria-expanded]").click();
      } else {
        await preview.locator("button[aria-expanded]").click();
        if (field === "dates") await preview.locator("input[type=date]").nth(0).fill(targetDate);
        else
          await preview
            .locator("select")
            .filter({ has: page.locator('option[value="biweekly"]') })
            .selectOption("biweekly");
      }
      const responsePromise = page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/chores") && response.request().method() === "PATCH",
      );
      await page
        .getByRole("button", {
          name: scope === "single" ? "Only current chore" : "All future chores",
          exact: true,
        })
        .click();
      const response = await responsePromise;
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.data).toBeUndefined();
      expect(body.createdChoreId).toEqual(expect.any(Number));
      expect(body.choreId).toBe(id);
      const replacementId = body.createdChoreId;
      await expect(
        page.locator(
          `[data-chore-preview-id="${replacementId}"][data-chore-preview-start="${targetDate}"]`,
        ),
      ).toHaveCount(1);
      await expect(preview).toBeVisible();
      const replacementTitle =
        field === "title" ? "Preview replacement title" : "Preview rebind fixture";
      await expect(preview).toContainText(replacementTitle);
      // Use the still-open preview, without reopening its trigger, to verify its mutation identity.
      await preview.getByRole("button", { name: replacementTitle, exact: true }).click();
      await preview.getByPlaceholder("Chore title").fill("Second edit of replacement");
      const nextResponsePromise = page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/chores") && response.request().method() === "PATCH",
      );
      await preview.getByPlaceholder("Chore title").press("Enter");
      if (scope === "following")
        await page.getByRole("button", { name: "All chores", exact: true }).click();
      const nextResponse = await nextResponsePromise;
      expect(nextResponse.status()).toBe(200);
      expect(nextResponse.request().postDataJSON()).toMatchObject({
        choreId: replacementId,
        occurrenceStartDate: targetDate,
      });
      await expect(preview).toContainText("Second edit of replacement");
      expect((await live.choreRow(replacementId)).title).toBe("Second edit of replacement");
      expect((await live.choreRow(id)).title).toBe("Preview rebind fixture");
      const deletionPromise = page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/chores") && response.request().method() === "PATCH",
      );
      await preview.getByRole("button", { name: "Delete chore", exact: true }).click();
      if (scope === "following")
        await page.getByRole("button", { name: "All chores", exact: true }).click();
      const deletion = await deletionPromise;
      expect(deletion.status()).toBe(200);
      expect(deletion.request().postDataJSON()).toMatchObject({
        action: "cancel",
        choreId: replacementId,
        occurrenceStartDate: targetDate,
      });
      await expect(preview).not.toBeVisible();
      expect(
        (await live.list(targetDate, day(targetDate, 14))).some((row) => row.id === replacementId),
      ).toBe(false);
      expect((await live.list(start)).find((row) => row.id === id)).toMatchObject({
        title: "Preview rebind fixture",
        status: "open",
      });
    });
  }
}

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
  const replacementId = body.createdChoreId;
  await expect(page.locator(`[data-chore-preview-id="${replacementId}"]`)).toHaveCount(1);
  await expect(preview).toBeVisible({ timeout: 2000 });
  await expect(preview).toContainText("Preview replacement title");
});

for (const scope of ["single", "following"]) {
  test(`#26 ${scope} edits outside the visible week close the preview`, async ({ live }) => {
    const start = day(monday(), -7);
    const id = await live.chore({
      title: "Offscreen replacement fixture",
      startDate: start,
      endDate: day(start, 1),
      repeatRule: "week",
    });
    const page = await live.board();
    await page.locator(`[data-chore-preview-id="${id}"]`).click();
    const preview = page.getByRole("dialog", { name: "Chore preview" });
    await preview.locator("button[aria-expanded]").click();
    const targetDate = day(monday(), 14);
    await preview.locator("input[type=date]").nth(0).fill(targetDate);
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/chores") && response.request().method() === "PATCH",
    );
    await page
      .getByRole("button", {
        name: scope === "single" ? "Only current chore" : "All future chores",
        exact: true,
      })
      .click();
    const response = await responsePromise;
    expect(response.status()).toBe(200);
    const body = await response.json();
    await expect(preview).not.toBeVisible();
    expect(
      (await live.list(targetDate)).find((row) => row.id === body.createdChoreId),
    ).toMatchObject({ occurrence_start_date: targetDate });
  });

  test(`#26 ${scope} failed saves keep the source selection and allow retry`, async ({ live }) => {
    const start = day(monday(), -7);
    const id = await live.chore({
      title: "Retry preview fixture",
      startDate: start,
      endDate: day(start, 1),
      repeatRule: "week",
    });
    const page = await live.board();
    let rejectEdit = true;
    await page.route("**/api/chores", async (route) => {
      if (route.request().method() === "PATCH" && rejectEdit) {
        rejectEdit = false;
        await route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({
            ok: false,
            code: "HOUSEHOLD_MUTATION_BUSY",
            error: "Household is busy, retry this edit",
          }),
        });
      } else await route.continue();
    });
    await page.locator(`[data-chore-preview-id="${id}"]`).click();
    const preview = page.getByRole("dialog", { name: "Chore preview" });
    await preview.getByRole("button", { name: "Retry preview fixture", exact: true }).click();
    const titleInput = preview.getByPlaceholder("Chore title");
    await titleInput.fill("Retried replacement");
    await titleInput.press("Enter");
    await page
      .getByRole("button", {
        name: scope === "single" ? "Only current chore" : "All future chores",
        exact: true,
      })
      .click();
    await expect(preview).toContainText("Household is busy, retry this edit");
    expect((await live.choreRow(id)).title).toBe("Retry preview fixture");
    await titleInput.press("Enter");
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/chores") && response.request().method() === "PATCH",
    );
    await page
      .getByRole("button", {
        name: scope === "single" ? "Only current chore" : "All future chores",
        exact: true,
      })
      .click();
    const response = await responsePromise;
    expect(response.status()).toBe(200);
    const body = await response.json();
    await expect(page.locator(`[data-chore-preview-id="${body.createdChoreId}"]`)).toHaveCount(1);
    await expect(preview).toContainText("Retried replacement");
  });
}

test("#26 moving a one-off preview keeps subsequent actions on its new start", async ({ live }) => {
  const id = await live.chore({
    title: "Moved one-off preview",
    startDate: monday(),
    endDate: day(monday(), 1),
  });
  const page = await live.board();
  await page.locator(`[data-chore-preview-id="${id}"]`).click();
  const preview = page.getByRole("dialog", { name: "Chore preview" });
  await preview.locator("button[aria-expanded]").click();
  const responsePromise = page.waitForResponse(
    (response) => response.url().endsWith("/api/chores") && response.request().method() === "PATCH",
  );
  const targetDate = day(monday(), 1);
  await preview.locator("input[type=date]").nth(0).fill(targetDate);
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({ choreId: id, occurrenceStartDate: monday() });
  await expect(
    page.locator(`[data-chore-preview-id="${id}"][data-chore-preview-start="${targetDate}"]`),
  ).toHaveCount(1);
  await expect(preview).toBeVisible();
  const deletionPromise = page.waitForResponse(
    (response) => response.url().endsWith("/api/chores") && response.request().method() === "PATCH",
  );
  await preview.getByRole("button", { name: "Delete chore", exact: true }).click();
  const deletion = await deletionPromise;
  expect(deletion.status()).toBe(200);
  expect(deletion.request().postDataJSON()).toMatchObject({
    choreId: id,
    occurrenceStartDate: targetDate,
  });
  await expect(preview).not.toBeVisible();
});

const waitForChoreRange = (page, start, end = start) =>
  page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      response.request().method() === "GET" &&
      url.pathname === "/api/chores" &&
      url.searchParams.get("start") === start &&
      url.searchParams.get("end") === end &&
      response.status() === 200
    );
  });

const openClockBoard = async (live, instant, timeZone = "UTC") => {
  // Install after hydration, in an isolated context, so a fake calendar date cannot cause hydration drift.
  const context = await live.browser.newContext({
    storageState: await live.owner.context.storageState(),
    viewport: { width: 1440, height: 1100 },
  });
  live.contexts.push(context);
  const page = await context.newPage();
  await page.goto(`${baseURL}/household`, { waitUntil: "networkidle", timeout: 90000 });
  await expect(page.locator("aside")).not.toContainText("Loading chores...");
  await page.clock.install({ time: new Date(instant) });
  const date = DateTime.fromISO(instant).setZone(timeZone).toISODate();
  const refreshed = waitForChoreRange(page, date);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await refreshed;
  await expect(page.locator("aside")).toContainText(
    DateTime.fromISO(date, { zone: timeZone }).toFormat("ccc, LLL d"),
  );
  return page;
};

test("#28 Today advances across household-local midnight", async ({ live }) => {
  const date = today();
  const id = await live.chore({
    title: "Before midnight fixture",
    startDate: date,
    endDate: day(date, 1),
  });
  await live.chore({
    title: "After midnight fixture",
    startDate: day(date, 1),
    endDate: day(date, 2),
  });
  const page = await openClockBoard(live, `${date}T23:59:00Z`);
  await expect(page.locator("aside")).toContainText("Before midnight fixture");
  await page.locator(`[data-chore-preview-id="${id}"]`).click();
  const primaryAction = page
    .getByRole("dialog", { name: "Chore preview" })
    .getByRole("button", { name: "Complete & close", exact: true });
  await expect(primaryAction).toBeEnabled();
  const refreshed = waitForChoreRange(page, day(date, 1));
  await page.clock.fastForward(120000);
  await refreshed;
  const expectedLabel = DateTime.fromISO(day(date, 1), { zone: "UTC" }).toFormat("ccc, LLL d");
  await expect(page.locator("aside")).toContainText(expectedLabel);
  await expect(page.locator("aside")).toContainText("After midnight fixture");
  await expect(page.locator("aside")).not.toContainText("Before midnight fixture");
  // A Sunday rollover can remove the old card; otherwise its open preview becomes past-dated.
  if (DateTime.fromISO(date).weekday !== 7) await expect(primaryAction).toBeDisabled();
  await expect(page.locator('[aria-current="date"]')).toHaveText(
    String(DateTime.fromISO(day(date, 1)).day),
  );
});

test("#28 the default week follows Sunday midnight into the new week", async ({ live }) => {
  await live.chore({ title: "Old Sunday fixture", startDate: "2026-10-11", endDate: "2026-10-12" });
  await live.chore({ title: "New Monday fixture", startDate: "2026-10-12", endDate: "2026-10-13" });
  const page = await openClockBoard(live, "2026-10-11T23:59:00Z");
  await expect(page.locator("[data-chore-preview-id]")).toHaveText([/Old Sunday fixture/]);
  const refreshed = waitForChoreRange(page, "2026-10-12", "2026-10-18");
  await page.clock.fastForward(120000);
  await refreshed;
  await expect(page.locator("[data-chore-preview-id]")).toHaveText([/New Monday fixture/]);
  await expect(page.locator('[aria-current="date"]')).toHaveText("12");
});

for (const navigation of ["Previous week", "Next week"]) {
  test(`#28 ${navigation} stays pinned across midnight until Today is clicked`, async ({
    live,
  }) => {
    const pinnedStart = navigation === "Previous week" ? "2026-09-28" : "2026-10-12";
    const pinnedEnd = day(pinnedStart, 6);
    await live.chore({
      title: "Pinned week fixture",
      startDate: pinnedStart,
      endDate: day(pinnedStart, 1),
    });
    await live.chore({
      title: "Resumed Today fixture",
      startDate: "2026-10-12",
      endDate: "2026-10-13",
    });
    const page = await openClockBoard(live, "2026-10-11T23:59:00Z");
    const navigated = waitForChoreRange(page, pinnedStart, pinnedEnd);
    await page.getByRole("button", { name: navigation, exact: true }).click();
    await navigated;
    await expect(page.locator("main")).toContainText("Pinned week fixture");
    const refreshed = waitForChoreRange(page, pinnedStart, pinnedEnd);
    await page.clock.fastForward(120000);
    await refreshed;
    await expect(page.locator("main")).toContainText("Pinned week fixture");
    await expect(page.locator("aside")).toContainText("Mon, Oct 12");
    await expect(page.locator("aside")).toContainText("Resumed Today fixture");
    const reset =
      navigation === "Previous week" ? waitForChoreRange(page, "2026-10-12", "2026-10-18") : null;
    await page.getByRole("button", { name: "Today", exact: true }).click();
    // A pinned next week is already this calendar week after midnight, so no range fetch is needed.
    await reset;
    await expect(page.locator('[aria-current="date"]')).toHaveText("12");
    await expect(page.locator("main")).toContainText("Resumed Today fixture");
  });
}

for (const [date, hours] of [
  ["2026-03-08", 23],
  ["2026-11-01", 25],
]) {
  test(`#28 New York's ${hours}-hour DST day refreshes at local midnight`, async ({
    live,
    household,
  }) => {
    await live.db.query("update households set time_zone=$1 where id=$2", [
      "America/New_York",
      household,
    ]);
    const nextDate = day(date, 1);
    await live.chore({
      title: "DST next-day fixture",
      startDate: nextDate,
      endDate: day(nextDate, 1),
    });
    const instant = DateTime.fromISO(`${date}T00:00:00`, { zone: "America/New_York" }).toISO();
    const page = await openClockBoard(live, instant, "America/New_York");
    const label = DateTime.fromISO(date, { zone: "America/New_York" }).toFormat("ccc, LLL d");
    await page.clock.fastForward(hours * 60 * 60 * 1000 - 60000);
    await expect(page.locator("aside")).toContainText(label);
    const refreshed = waitForChoreRange(page, nextDate);
    await page.clock.fastForward(120000);
    await refreshed;
    await expect(page.locator("aside")).toContainText(
      DateTime.fromISO(nextDate, { zone: "America/New_York" }).toFormat("ccc, LLL d"),
    );
    await expect(page.locator("aside")).toContainText("DST next-day fixture");
    await expect(page.locator('[aria-current="date"]')).toHaveText(
      String(DateTime.fromISO(nextDate).day),
    );
  });
}

test("#28 Havana advances Today at the first occurrence of a repeated midnight", async ({
  live,
  household,
}) => {
  await live.db.query("update households set time_zone=$1 where id=$2", [
    "America/Havana",
    household,
  ]);
  await live.chore({
    title: "Repeated-midnight fixture",
    startDate: "2026-11-01",
    endDate: "2026-11-02",
  });
  const page = await openClockBoard(live, "2026-10-31T23:59:00-04:00", "America/Havana");
  const refreshed = waitForChoreRange(page, "2026-11-01");
  await page.clock.fastForward(120000);
  await refreshed;
  await expect(page.locator("aside")).toContainText("Sun, Nov 1");
  await expect(page.locator("aside")).toContainText("Repeated-midnight fixture");
  await expect(page.locator('[aria-current="date"]')).toHaveText("1");
  await page.clock.fastForward(60 * 60 * 1000);
  await expect(page.locator("aside")).toContainText("Sun, Nov 1");
});

for (const event of ["focus", "visibilitychange"]) {
  test(`#28 ${event} catches up a suspended tab and refreshes same-day data`, async ({ live }) => {
    await live.chore({
      title: "Resumed day fixture",
      startDate: "2026-10-29",
      endDate: "2026-10-30",
    });
    const page = await openClockBoard(live, "2026-10-11T23:59:00Z");
    await page.clock.setSystemTime(new Date("2026-10-29T12:00:00Z"));
    await expect(page.locator("aside")).toContainText("Sun, Oct 11");
    const refreshed = waitForChoreRange(page, "2026-10-29");
    await page.evaluate(
      (event) =>
        event === "focus"
          ? window.dispatchEvent(new Event(event))
          : document.dispatchEvent(new Event(event)),
      event,
    );
    await refreshed;
    await expect(page.locator("aside")).toContainText("Thu, Oct 29");
    await expect(page.locator("aside")).toContainText("Resumed day fixture");
    await expect(page.locator("[data-chore-preview-id]")).toHaveText([/Resumed day fixture/]);
    await live.chore({
      title: "New same-day fixture",
      startDate: "2026-10-29",
      endDate: "2026-10-30",
    });
    const todayRefetched = waitForChoreRange(page, "2026-10-29");
    const weekRefetched = waitForChoreRange(page, "2026-10-26", "2026-11-01");
    await page.evaluate(
      (event) =>
        event === "focus"
          ? window.dispatchEvent(new Event(event))
          : document.dispatchEvent(new Event(event)),
      event,
    );
    await Promise.all([todayRefetched, weekRefetched]);
    await expect(page.locator("aside")).toContainText("New same-day fixture");
    await expect(page.locator("[data-chore-preview-id]")).toHaveCount(2);
  });
}

for (const field of ["title", "notes", "dates", "repeat"]) {
  test(`#28 background status refresh preserves an unsaved ${field} edit`, async ({ live }) => {
    const id = await live.chore({
      title: "Draft refresh fixture",
      startDate: "2026-10-07",
      endDate: "2026-10-08",
      repeatRule: "week",
    });
    const page = await openClockBoard(live, "2026-10-14T23:59:00Z");
    await page.locator(`[data-chore-preview-id="${id}"]`).click();
    const preview = page.getByRole("dialog", { name: "Chore preview" });
    if (field === "title") {
      await preview.getByRole("button", { name: "Draft refresh fixture", exact: true }).click();
      await preview.getByPlaceholder("Chore title").fill("Unsaved title draft");
    } else if (field === "notes") {
      await preview.getByRole("button", { name: "Add Notes", exact: true }).click();
      await preview.getByPlaceholder("Add Notes").fill("Unsaved notes draft");
    } else {
      await preview.locator("button[aria-expanded]").click();
      if (field === "dates") await preview.locator("input[type=date]").nth(1).fill("2026-10-16");
      else
        await preview
          .locator("select")
          .filter({ has: page.locator('option[value="biweekly"]') })
          .selectOption("biweekly");
    }
    // Mutate outside this page's query client, as another household member would.
    expect(
      (
        await live.mutate({
          action: "set",
          choreId: id,
          occurrenceStartDate: "2026-10-14",
          status: "closed",
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await live.mutate({
          action: "edit",
          scope: "all",
          choreId: id,
          occurrenceStartDate: "2026-10-14",
          title: "Remote title",
          notes: "Remote notes",
        })
      ).status,
    ).toBe(200);
    const refreshed = waitForChoreRange(page, "2026-10-12", "2026-10-18");
    await page.clock.fastForward(120000);
    await refreshed;
    await expect(preview).toContainText("Completed");
    if (field !== "title")
      await expect(
        preview.getByRole("button", { name: "Remote title", exact: true }),
      ).toBeVisible();
    if (field !== "notes") await expect(preview).toContainText("Remote notes");
    if (field === "title") {
      await expect(preview.getByPlaceholder("Chore title")).toHaveValue("Unsaved title draft");
      await preview.getByPlaceholder("Chore title").press("Enter");
    } else if (field === "notes") {
      await expect(preview.getByPlaceholder("Add Notes")).toHaveValue("Unsaved notes draft");
      await preview.locator("button[aria-expanded]").click();
    } else if (field === "dates") {
      await expect(preview.locator("input[type=date]").nth(1)).toHaveValue("2026-10-16");
      await expect(page.getByText("Apply date changes", { exact: true })).toBeVisible();
    } else {
      await expect(
        preview.locator("select").filter({ has: page.locator('option[value="biweekly"]') }),
      ).toHaveValue("biweekly");
      await expect(page.getByText("Apply repeat changes", { exact: true })).toBeVisible();
    }
    const saved = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/chores") && response.request().method() === "PATCH",
    );
    await page
      .getByRole("button", {
        name: field === "repeat" ? "All future chores" : "Only current chore",
        exact: true,
      })
      .click();
    const response = await saved;
    expect(response.status()).toBe(200);
    const replacementId = (await response.json()).createdChoreId;
    const stored = (
      await live.db.query(
        "select title, notes, to_char(end_date,'YYYY-MM-DD') end_date, repeat_rule from chores where id=$1",
        [replacementId],
      )
    ).rows[0];
    expect(stored).toMatchObject(
      field === "title"
        ? { title: "Unsaved title draft" }
        : field === "notes"
          ? { notes: "Unsaved notes draft" }
          : field === "dates"
            ? { end_date: "2026-10-17" }
            : { repeat_rule: "biweek" },
    );
  });
}

for (const repeatRule of ["none", "week"]) {
  for (const field of ["title", "notes", "long-notes"]) {
    test(`#28 normalized ${field} saves on ${repeatRule} chores stay clean on remote refresh`, async ({
      live,
    }) => {
      const id = await live.chore({
        title: "Canonical preview fixture",
        notes: "Original notes",
        startDate: "2026-10-14",
        endDate: "2026-10-15",
        repeatRule,
      });
      const page = await openClockBoard(live, "2026-10-14T12:00:00Z");
      await page.locator(`[data-chore-preview-id="${id}"]`).click();
      const preview = page.getByRole("dialog", { name: "Chore preview" });
      const canonical =
        field === "title" ? "Saved title" : field === "notes" ? "Saved notes" : "x".repeat(500);
      const draft =
        field === "title" ? " Saved title " : field === "notes" ? " Saved notes " : "x".repeat(501);
      const save = async (label, value, sendsPatch) => {
        await preview.getByRole("button", { name: label, exact: true }).click();
        const input = preview.getByPlaceholder(field === "title" ? "Chore title" : "Add Notes");
        await input.fill(value);
        const saved = sendsPatch
          ? page.waitForResponse(
              (response) =>
                response.url().endsWith("/api/chores") && response.request().method() === "PATCH",
            )
          : null;
        if (field === "title") await input.press("Enter");
        else await preview.locator("button[aria-expanded]").click();
        if (sendsPatch && repeatRule === "week")
          await page.getByRole("button", { name: "All chores", exact: true }).click();
        if (saved) expect((await saved).status()).toBe(200);
        await expect(preview.getByRole("button", { name: canonical, exact: true })).toBeVisible();
      };
      await save(field === "title" ? "Canonical preview fixture" : "Original notes", draft, true);
      const persisted = (await live.db.query("select title, notes from chores where id=$1", [id]))
        .rows[0];
      expect(field === "title" ? persisted.title : persisted.notes).toBe(canonical);
      // Exercise an unchanged server value too: truncation still sends a save, while
      // whitespace-only edits take the no-op path. Neither should leave a dirty draft.
      await save(
        canonical,
        field === "long-notes" ? draft : `${canonical} `,
        field === "long-notes",
      );
      expect(
        (
          await live.mutate({
            action: "edit",
            scope: "all",
            choreId: id,
            occurrenceStartDate: "2026-10-14",
            title: "Remote final title",
            notes: "Remote final notes",
          })
        ).status,
      ).toBe(200);
      const refreshed = waitForChoreRange(page, "2026-10-12", "2026-10-18");
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
      await refreshed;
      await expect(
        preview.getByRole("button", { name: "Remote final title", exact: true }),
      ).toBeVisible();
      await expect(
        preview.getByRole("button", { name: "Remote final notes", exact: true }),
      ).toBeVisible();
      await preview.getByRole("button", { name: "Remote final notes", exact: true }).click();
      await expect(preview.getByPlaceholder("Add Notes")).toHaveValue("Remote final notes");
      await preview.locator("button[aria-expanded]").click();
      expect(
        (await live.db.query("select notes from chores where id=$1", [id])).rows[0].notes,
      ).toBe("Remote final notes");
    });
  }
}

for (const field of ["title", "notes"]) {
  test(`#28 status refresh preserves unfinished ${field} whitespace while typing`, async ({
    live,
  }) => {
    const id = await live.chore({
      title: "Buy milk",
      notes: "Remember milk",
      startDate: "2026-10-14",
      endDate: "2026-10-15",
    });
    const page = await openClockBoard(live, "2026-10-14T23:59:00Z");
    await page.locator(`[data-chore-preview-id="${id}"]`).click();
    const preview = page.getByRole("dialog", { name: "Chore preview" });
    await preview
      .getByRole("button", { name: field === "title" ? "Buy milk" : "Remember milk", exact: true })
      .click();
    const input = preview.getByPlaceholder(field === "title" ? "Chore title" : "Add Notes");
    const draft = field === "title" ? "Buy milk " : "Remember milk\n";
    await input.fill(draft);
    expect(
      (
        await live.mutate({
          action: "set",
          choreId: id,
          occurrenceStartDate: "2026-10-14",
          status: "closed",
        })
      ).status,
    ).toBe(200);
    const refreshed = waitForChoreRange(page, "2026-10-12", "2026-10-18");
    await page.clock.fastForward(120000);
    await refreshed;
    await expect(preview).toContainText("Completed");
    await expect(input).toHaveValue(draft);
    await expect(input).toBeFocused();
    await input.press("Control+End");
    await input.pressSequentially("and bread");
    await expect(input).toHaveValue(`${draft}and bread`);
    const saved = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/chores") && response.request().method() === "PATCH",
    );
    if (field === "title") await input.press("Enter");
    else await preview.locator("button[aria-expanded]").click();
    expect((await saved).status()).toBe(200);
    const stored = (await live.db.query("select title,notes from chores where id=$1", [id]))
      .rows[0];
    expect(stored[field]).toBe(`${draft}and bread`);
  });
}

for (const control of ["date", "repeat", "date-scope", "repeat-scope"]) {
  test(`#28 status refresh retains keyboard focus on the ${control} control`, async ({ live }) => {
    const id = await live.chore({
      title: "Keyboard refresh fixture",
      startDate: "2026-10-07",
      endDate: "2026-10-08",
      repeatRule: "week",
    });
    const page = await openClockBoard(live, "2026-10-14T23:59:00Z");
    await page.locator(`[data-chore-preview-id="${id}"]`).click();
    const preview = page.getByRole("dialog", { name: "Chore preview" });
    await preview.locator("button[aria-expanded]").click();
    let focused;
    if (control.startsWith("date")) {
      focused = preview.locator("input[type=date]").nth(1);
      if (control === "date-scope") await focused.fill("2026-10-16");
    } else {
      focused = preview.locator("select").filter({ has: page.locator('option[value="biweekly"]') });
      if (control === "repeat-scope") await focused.selectOption("biweekly");
    }
    if (control.endsWith("scope"))
      focused = page.getByRole("button", { name: "Only current chore", exact: true });
    await focused.focus();
    await expect(focused).toBeFocused();
    expect(
      (
        await live.mutate({
          action: "set",
          choreId: id,
          occurrenceStartDate: "2026-10-14",
          status: "closed",
        })
      ).status,
    ).toBe(200);
    const refreshed = waitForChoreRange(page, "2026-10-12", "2026-10-18");
    await page.clock.fastForward(120000);
    await refreshed;
    await expect(preview).toContainText("Completed");
    await expect(focused).toBeFocused();
  });
}

for (const repeatRule of ["none", "week"]) {
  test(`#28 no-op ${repeatRule} notes blur preserves whitespace at the storage cap`, async ({
    live,
  }) => {
    const label = "x".repeat(499);
    const storedNotes = `${label} `;
    const id = await live.chore({
      title: "Boundary notes fixture",
      notes: `${label} y`,
      startDate: "2026-10-14",
      endDate: "2026-10-15",
      repeatRule,
    });
    expect((await live.db.query("select notes from chores where id=$1", [id])).rows[0].notes).toBe(
      storedNotes,
    );
    const page = await openClockBoard(live, "2026-10-14T12:00:00Z");
    await page.locator(`[data-chore-preview-id="${id}"]`).click();
    const preview = page.getByRole("dialog", { name: "Chore preview" });
    await preview.locator("button[aria-expanded]").click();
    const typeControl = preview.getByRole("combobox", { name: "Chore type" });
    for (let blur = 0; blur < 2; blur += 1) {
      const notesButton = preview.getByRole("button", { name: label, exact: true });
      await notesButton.focus();
      await notesButton.press("Enter");
      await expect(preview.getByPlaceholder("Add Notes")).toHaveValue(storedNotes);
      // Keep the expanded editor open on blur, rather than resetting fields by collapsing it.
      await typeControl.focus();
    }
    expect(
      (
        await live.mutate({
          action: "edit",
          scope: "all",
          choreId: id,
          occurrenceStartDate: "2026-10-14",
          notes: "Remote boundary notes",
        })
      ).status,
    ).toBe(200);
    const refreshed = waitForChoreRange(page, "2026-10-12", "2026-10-18");
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await refreshed;
    const remoteNotes = preview.getByRole("button", { name: "Remote boundary notes", exact: true });
    await remoteNotes.focus();
    await remoteNotes.press("Enter");
    await expect(preview.getByPlaceholder("Add Notes")).toHaveValue("Remote boundary notes");
    await typeControl.focus();
    expect((await live.db.query("select notes from chores where id=$1", [id])).rows[0].notes).toBe(
      "Remote boundary notes",
    );
  });
}

test("#28 a successful type-change retry reconciles a failed raw title draft", async ({ live }) => {
  const id = await live.chore({
    title: "Type retry fixture",
    startDate: "2026-10-14",
    endDate: "2026-10-15",
  });
  const page = await openClockBoard(live, "2026-10-14T12:00:00Z");
  let rejectTitle = true;
  await page.route("**/api/chores", async (route) => {
    if (route.request().method() === "PATCH" && rejectTitle) {
      rejectTitle = false;
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          code: "INTERNAL_SERVER_ERROR",
          error: "Simulated title failure",
        }),
      });
    } else await route.continue();
  });
  await page.locator(`[data-chore-preview-id="${id}"]`).click();
  const preview = page.getByRole("dialog", { name: "Chore preview" });
  await preview.getByRole("button", { name: "Type retry fixture", exact: true }).click();
  await preview.getByPlaceholder("Chore title").fill(" Retried title ");
  const failed = page.waitForResponse(
    (response) => response.url().endsWith("/api/chores") && response.request().method() === "PATCH",
  );
  await preview.getByPlaceholder("Chore title").press("Enter");
  expect((await failed).status()).toBe(500);
  await expect(preview).toContainText("Simulated title failure");
  await preview.locator("button[aria-expanded]").click();
  const typeControl = preview.getByRole("combobox", { name: "Chore type" });
  const saved = page.waitForResponse(
    (response) => response.url().endsWith("/api/chores") && response.request().method() === "PATCH",
  );
  await typeControl.selectOption("stay_open");
  const response = await saved;
  expect(response.status()).toBe(200);
  expect(response.request().postDataJSON()).toMatchObject({
    title: " Retried title ",
    type: "stay_open",
  });
  await expect(typeControl).toBeEnabled();
  expect((await live.db.query("select title,type from chores where id=$1", [id])).rows[0]).toEqual({
    title: "Retried title",
    type: "stay_open",
  });
  expect(
    (
      await live.mutate({
        action: "edit",
        scope: "all",
        choreId: id,
        occurrenceStartDate: "2026-10-14",
        title: "Remote type title",
      })
    ).status,
  ).toBe(200);
  const refreshed = waitForChoreRange(page, "2026-10-12", "2026-10-18");
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await refreshed;
  await preview.getByRole("button", { name: "Remote type title", exact: true }).click();
  await expect(preview.getByPlaceholder("Chore title")).toHaveValue("Remote type title");
  await preview.getByPlaceholder("Chore title").press("Enter");
  expect((await live.db.query("select title from chores where id=$1", [id])).rows[0].title).toBe(
    "Remote type title",
  );
});

test("#29 SQL excludes expired one-offs and retains overlapping recurring and clipped spans", async ({
  live,
  household,
}) => {
  const start = "2026-10-12";
  const end = "2026-10-18";
  const fixtures = [
    { title: "Old one-off", startDate: "2026-01-01", endDate: "2026-01-02", included: false },
    { title: "Ends at left boundary", startDate: "2026-10-10", endDate: start, included: false },
    { title: "Clipped left", startDate: "2026-10-10", endDate: "2026-10-13", included: true },
    { title: "Clipped right", startDate: "2026-10-17", endDate: "2026-10-21", included: true },
    { title: "Starts at right boundary", startDate: end, endDate: "2026-10-19", included: true },
    {
      title: "Starts after range",
      startDate: "2026-10-19",
      endDate: "2026-10-20",
      included: false,
    },
    { title: "Spans entire range", startDate: "2026-10-01", endDate: "2026-10-24", included: true },
    {
      title: "Single day at left boundary",
      startDate: start,
      endDate: "2026-10-13",
      included: true,
    },
    {
      title: "Open-ended weekly",
      startDate: "2026-10-05",
      endDate: "2026-10-06",
      repeatRule: "week",
      included: true,
    },
    {
      title: "Expired finite weekly",
      startDate: "2026-10-05",
      endDate: "2026-10-06",
      repeatRule: "week",
      seriesEndDate: "2026-10-11",
      included: false,
    },
    {
      title: "Final recurring span overlaps",
      startDate: "2026-10-11",
      endDate: "2026-10-14",
      repeatRule: "week",
      seriesEndDate: "2026-10-11",
      included: true,
    },
    {
      title: "Final recurring span ends at boundary",
      startDate: "2026-10-09",
      endDate: start,
      repeatRule: "week",
      seriesEndDate: "2026-10-09",
      included: false,
    },
    {
      title: "Daily origin ended before range",
      startDate: "2026-10-05",
      endDate: "2026-10-06",
      repeatRule: "day",
      included: true,
    },
    {
      title: "Biweekly origin ended before range",
      startDate: "2026-09-28",
      endDate: "2026-09-29",
      repeatRule: "biweek",
      included: true,
    },
    {
      title: "Monthly origin ended before range",
      startDate: "2026-09-12",
      endDate: "2026-09-13",
      repeatRule: "month",
      included: true,
    },
    {
      title: "Yearly origin ended before range",
      startDate: "2025-10-12",
      endDate: "2025-10-13",
      repeatRule: "year",
      included: true,
    },
  ];
  const expectedIds = [];
  for (const { included, ...fields } of fixtures) {
    const id = await live.chore(fields);
    if (included) expectedIds.push(id);
  }
  const canceledId = await live.chore({
    title: "Canceled series",
    startDate: start,
    endDate: "2026-10-13",
  });
  expect(
    (
      await live.mutate({
        action: "cancel",
        scope: "all",
        choreId: canceledId,
        occurrenceStartDate: start,
      })
    ).status,
  ).toBe(200);
  const otherHousehold = await live.createHousehold("Other SQL overlap household");
  try {
    await live.chore({
      title: "Another household's overlapping chore",
      startDate: start,
      endDate: "2026-10-13",
    });
    await live.activate(live.owner, household);
    const selected = (await live.db.query(listActiveChoreSeriesQuery, [household, start, end]))
      .rows;
    expect(selected.map((row) => row.id).sort((a, b) => a - b)).toEqual(
      expectedIds.sort((a, b) => a - b),
    );
    const visible = await live.list(start, end);
    expect([...new Set(visible.map((row) => row.id))].sort((a, b) => a - b)).toEqual(expectedIds);
    expect(
      visible.filter((row) => row.title === "Clipped left").map((row) => row.occurrence_date),
    ).toEqual([start]);
    expect(
      visible.filter((row) => row.title === "Clipped right").map((row) => row.occurrence_date),
    ).toEqual(["2026-10-17", end]);
    expect(
      visible
        .filter((row) => row.title === "Final recurring span overlaps")
        .map((row) => row.occurrence_date),
    ).toEqual([start, "2026-10-13"]);
    expect(
      visible
        .filter((row) => row.title === "Starts at right boundary")
        .map((row) => row.occurrence_date),
    ).toEqual([end]);
  } finally {
    await live.db.query("delete from households where id=$1", [otherHousehold]);
  }
});

test("#29 before/after query plans exclude historical rows before serialization", async ({
  live,
}, testInfo) => {
  // Historical baseline from before #29. The fixed query is imported from production code.
  const beforeQuery =
    "select id, title, type, to_char(start_date, 'YYYY-MM-DD') as start_date, to_char(end_date, 'YYYY-MM-DD') as end_date, to_char(series_end_date, 'YYYY-MM-DD') as series_end_date, repeat_rule, status, notes from chores where status = 'active' and household_id = $1 and start_date <= $3::date and (coalesce(series_end_date, $3::date) + (end_date - start_date - 1)) >= $2::date";
  const params = [1, "2026-10-12", "2026-10-18"];
  const client = await live.db.connect();
  try {
    await client.query("begin");
    await client.query("set local statement_timeout = '30s'");
    // A session-private copy preserves the deployed table/index shape without adding fixture
    // volume or indexes to the shared app table. Explicit ids avoid consuming its serial sequence.
    await client.query(
      "create temporary table chores (like public.chores including all) on commit drop",
    );
    const indexes = (
      await client.query(
        "select indexdef from pg_indexes where schemaname = pg_my_temp_schema()::regnamespace::text and tablename = 'chores' order by indexname",
      )
    ).rows;
    await client.query(
      "insert into chores (id,household_id,title,type,start_date,end_date,repeat_rule,status) select n,case when n <= 20000 then 1 else 2 end,'Historical one-off fixture','close_on_done','2025-01-01'::date,'2025-01-02'::date,'none','active' from generate_series(1,100000) n",
    );
    await client.query(
      "insert into chores (id,household_id,title,type,start_date,end_date,repeat_rule,status) select 100005+n,1,'Canceled fixture','close_on_done','2026-10-12'::date,'2026-10-13'::date,'none','canceled' from generate_series(1,20000) n",
    );
    await client.query(
      "insert into chores (id,household_id,title,type,start_date,end_date,repeat_rule,status,series_end_date) values (100001,1,'Current single','close_on_done','2026-10-12','2026-10-13','none','active',null),(100002,1,'Left clipped','close_on_done','2026-10-10','2026-10-13','none','active',null),(100003,1,'Right boundary','close_on_done','2026-10-18','2026-10-19','none','active',null),(100004,1,'Open weekly','close_on_done','2026-10-05','2026-10-06','week','active',null),(100005,1,'Final clipped weekly','close_on_done','2026-10-11','2026-10-14','week','active','2026-10-11')",
    );
    await client.query("analyze chores");
    const explain = async (query) =>
      (await client.query(`explain (analyze, buffers, format json, timing off) ${query}`, params))
        .rows[0]["QUERY PLAN"][0];
    const before = [];
    const after = [];
    await explain(beforeQuery);
    await explain(listActiveChoreSeriesQuery);
    for (let sample = 0; sample < 3; sample += 1) {
      before.push(await explain(beforeQuery));
      after.push(await explain(listActiveChoreSeriesQuery));
    }
    // Assess household/status indexing independently of the predicate change, then roll it back.
    await client.query(
      "create index issue29_active_household_candidate on chores (household_id) where status = 'active'",
    );
    await client.query("analyze chores");
    const indexed = [];
    for (let sample = 0; sample < 3; sample += 1)
      indexed.push(await explain(listActiveChoreSeriesQuery));
    expect(before.every((plan) => plan.Plan["Actual Rows"] === 20005)).toBe(true);
    expect([...after, ...indexed].every((plan) => plan.Plan["Actual Rows"] === 5)).toBe(true);
    const evidence = {
      issue: 29,
      serverVersion: (await client.query("show server_version")).rows[0].server_version,
      fixture: {
        rows: 120005,
        targetHistoricalActiveOneOffs: 20000,
        otherHouseholdActiveOneOffs: 80000,
        canceledOneOffs: 20000,
        matchingSeries: 5,
      },
      params,
      indexes,
      beforeQuery,
      afterQuery: listActiveChoreSeriesQuery,
      candidateIndex: "(household_id) WHERE status = 'active' (temporary benchmark only)",
      before,
      after,
      indexed,
    };
    const path = testInfo.outputPath("issue29-query-plans.json");
    await writeFile(path, JSON.stringify(evidence, null, 2));
    await testInfo.attach("issue29-query-plans", { path, contentType: "application/json" });
  } finally {
    try {
      await client.query("rollback");
    } finally {
      client.release();
    }
  }
});

for (const repeatRule of ["day", "week", "biweek"]) {
  test(`#30 old ${repeatRule} series list and validate starts with overlap and finite cutoffs`, async ({
    live,
  }) => {
    const interval = repeatRule === "day" ? 1 : repeatRule === "week" ? 7 : 14;
    const origin = DateTime.fromISO("2000-01-03", { zone: "UTC" });
    const from = DateTime.fromISO("2026-10-12", { zone: "UTC" });
    const target = origin.plus({
      days: Math.floor(from.diff(origin, "days").days / interval) * interval,
    });
    const cutoff = target.plus({ days: interval });
    const id = await live.chore({
      title: `Old ${repeatRule} range fixture`,
      startDate: origin.toISODate(),
      endDate: origin.plus({ days: 3 }).toISODate(),
      repeatRule,
      seriesEndDate: cutoff.toISODate(),
    });
    const rows = (await live.list(target.toISODate(), cutoff.plus({ days: 3 }).toISODate())).filter(
      (row) => row.id === id,
    );
    expect(
      rows
        .filter((row) => row.occurrence_start_date === cutoff.toISODate())
        .map((row) => row.occurrence_date),
    ).toEqual([0, 1, 2].map((days) => cutoff.plus({ days }).toISODate()));
    expect(rows.every((row) => row.occurrence_start_date <= cutoff.toISODate())).toBe(true);
    expect(
      (
        await live.mutate({
          action: "set",
          choreId: id,
          occurrenceStartDate: cutoff.toISODate(),
          status: "closed",
        })
      ).status,
    ).toBe(200);
    const offSchedule = interval === 1 ? origin.minus({ days: 1 }) : target.plus({ days: 1 });
    for (const date of [offSchedule, cutoff.plus({ days: interval })]) {
      const rejected = await live.mutate({
        action: "set",
        choreId: id,
        occurrenceStartDate: date.toISODate(),
        status: "closed",
      });
      expect(rejected.status).toBe(409);
      expect(rejected.body.code).toBe("OCCURRENCE_OUTSIDE_SCHEDULE");
    }
    expect(
      (await live.list(cutoff.toISODate())).find(
        (row) => row.id === id && row.occurrence_start_date === cutoff.toISODate(),
      ),
    ).toMatchObject({ status: "closed", closed_reason: "done" });
  });
}

for (const timeZone of ["America/Havana", "Pacific/Apia"]) {
  test(`#30 ${timeZone} midnight history does not omit the requested civil day`, async ({
    live,
    household,
  }) => {
    await live.db.query("update households set time_zone=$1 where id=$2", [timeZone, household]);
    const id = await live.chore({
      title: "Old local-midnight fixture",
      startDate: "2000-01-01",
      endDate: "2000-01-04",
      repeatRule: "day",
      seriesEndDate: "2026-10-18",
    });
    const rows = (await live.list("2026-10-18")).filter((row) => row.id === id);
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.occurrence_start_date)).toEqual([
      "2026-10-16",
      "2026-10-17",
      "2026-10-18",
    ]);
    expect(rows.every((row) => row.occurrence_date === "2026-10-18")).toBe(true);
    expect(
      (
        await live.mutate({
          action: "set",
          choreId: id,
          occurrenceStartDate: "2026-10-18",
          status: "closed",
        })
      ).status,
    ).toBe(200);
    expect(
      (await live.list("2026-10-18")).find(
        (row) => row.id === id && row.occurrence_start_date === "2026-10-18",
      ),
    ).toMatchObject({ status: "closed", closed_reason: "done" });
  });
}

test("#30 records range and occurrence-validation benchmarks across series ages", async ({
  browser,
}, testInfo) => {
  const rangeStart = DateTime.fromISO("2026-10-12", { zone: "UTC" });
  const median = (samples) => [...samples].sort((a, b) => a - b)[Math.floor(samples.length / 2)];
  const measure = (run) => {
    const started = performance.now();
    const result = run();
    return { milliseconds: performance.now() - started, result };
  };
  const measurements = [];
  for (const repeatRule of ["day", "week", "biweek"]) {
    const interval = repeatRule === "day" ? 1 : repeatRule === "week" ? 7 : 14;
    for (const ageYears of [1, 10, 26, 75]) {
      const origin = rangeStart.minus({ years: ageYears });
      const point = origin
        .plus({ days: Math.floor(rangeStart.diff(origin, "days").days / interval) * interval })
        .toISODate();
      const input = {
        startDate: origin.toISODate(),
        endDate: origin.plus({ days: 1 }).toISODate(),
        rangeStart: rangeStart.toISODate(),
        rangeEnd: rangeStart.plus({ days: 6 }).toISODate(),
        repeatRule,
        seriesEndDate: null,
        timeZone: "UTC",
      };
      const lookup = { ...input, occurrenceStartDate: point };
      const legacyLookup = () =>
        generateOccurrencesByStepping({ ...input, rangeStart: point, rangeEnd: point }).some(
          (entry) => entry.occurrenceStartDate === point,
        );
      for (const [path, before, after] of [
        [
          "generation",
          () => generateOccurrencesByStepping(input),
          () => generateOccurrenceDayEntries(input),
        ],
        ["validation", legacyLookup, () => isOccurrenceStartInSeries(lookup)],
      ]) {
        const expected = before();
        expect(after()).toEqual(expected);
        const beforeMs = [];
        const afterMs = [];
        for (let sample = 0; sample < 3; sample += 1) {
          const original = measure(before);
          const optimized = measure(after);
          expect(optimized.result).toEqual(original.result);
          beforeMs.push(original.milliseconds);
          afterMs.push(optimized.milliseconds);
        }
        measurements.push({
          repeatRule,
          ageYears,
          path,
          input,
          point,
          result: path === "generation" ? { entries: expected.length } : { valid: expected },
          beforeMs,
          afterMs,
          beforeMedianMs: median(beforeMs),
          afterMedianMs: median(afterMs),
        });
      }
    }
  }
  const path = testInfo.outputPath("issue30-recurrence-benchmark.json");
  await writeFile(
    path,
    JSON.stringify(
      {
        issue: 30,
        nodeVersion: process.version,
        browserVersion: browser.version(),
        samples: 3,
        timeZone: "UTC",
        spanDays: 1,
        measurements,
      },
      null,
      2,
    ),
  );
  await testInfo.attach("issue30-recurrence-benchmark", { path, contentType: "application/json" });
});

const expectChoreDateError = (response, field) => {
  expect(response.status).toBe(400);
  expect(response.body).toMatchObject({
    ok: false,
    code: "VALIDATION_FAILED",
    fieldErrors: { [field]: expect.any(String) },
  });
};

test("#31 invalid calendar dates return validation errors", async ({ live, household }) => {
  const response = await live.mutate({
    action: "create",
    title: "Invalid date fixture",
    startDate: "2026-02-30",
    endDate: "2026-03-02",
    repeatRule: "none",
  });
  expectChoreDateError(response, "startDate");
  expect(
    (await live.db.query("select count(*) from chores where household_id=$1", [household])).rows[0]
      .count,
  ).toBe("0");
});

test("#31 malformed create fields never reach a chore insert", async ({ live, household }) => {
  for (const [field, value, errorField] of [
    ["endDate", "2026-04-31", "endDate"],
    ["seriesEndDate", "2026-02-29", "repeatEnd"],
    ["startDate", "0000-01-01", "startDate"],
    ["endDate", "+010000-01-01", "endDate"],
    ["startDate", "2026-01", "startDate"],
    ["startDate", 42, "startDate"],
    ["seriesEndDate", "", "repeatEnd"],
    ["startDate", "2026-02-30T12:00:00Z", "startDate"],
    ["startDate", "2026-01-01T12:00:00+99:00", "startDate"],
    ["endDate", "2026-01-02T12:00:00+01:99", "endDate"],
    ["startDate", "2026-01-01T12:00:00+99:00[UTC]", "startDate"],
    ["endDate", "2026-01-02T12:00:00+01:99[UTC]", "endDate"],
  ]) {
    expectChoreDateError(
      await live.mutate({
        action: "create",
        title: "Invalid create fixture",
        startDate: "2026-01-01",
        endDate: "2026-01-02",
        repeatRule: "day",
        [field]: value,
      }),
      errorField,
    );
  }
  expect(
    (await live.db.query("select count(*) from chores where household_id=$1", [household])).rows[0]
      .count,
  ).toBe("0");
});

test("#31 invalid targets and scoped edit dates preserve schedules and completion", async ({
  live,
  household,
}) => {
  const id = await live.chore({
    title: "Date validation source",
    startDate: "2026-01-01",
    endDate: "2026-01-02",
    repeatRule: "day",
    seriesEndDate: "2026-12-31",
  });
  expect(
    (
      await live.mutate({
        action: "set",
        choreId: id,
        occurrenceStartDate: "2026-01-02",
        status: "closed",
      })
    ).status,
  ).toBe(200);
  const original = (await live.db.query("select * from chores where id=$1", [id])).rows[0];
  const exceptions = (
    await live.db.query("select * from chore_occurrence_exceptions where chore_id=$1 order by id", [
      id,
    ])
  ).rows;
  for (const scope of ["single", "following", "all"]) {
    for (const [changes, field] of [
      [{ startDate: "2026-02-30" }, "startDate"],
      [{ endDate: "2026-04-31" }, "endDate"],
      [{ seriesEndDate: "bad" }, "repeatEnd"],
      [{ startDate: "2026-01-01T12:00:00+99:00[UTC]" }, "startDate"],
      [{ endDate: "2026-01-02T12:00:00+01:99[UTC]" }, "endDate"],
      [{ startDate: null }, "startDate"],
      [{ endDate: "2028-01-01" }, "endDate"],
    ]) {
      expectChoreDateError(
        await live.mutate({
          action: "edit",
          scope,
          dateBasis: "occurrence",
          choreId: id,
          occurrenceStartDate: "2026-01-02",
          title: "Must not persist",
          ...changes,
        }),
        field,
      );
      expect((await live.db.query("select * from chores where id=$1", [id])).rows[0]).toEqual(
        original,
      );
      expect(
        (
          await live.db.query(
            "select * from chore_occurrence_exceptions where chore_id=$1 order by id",
            [id],
          )
        ).rows,
      ).toEqual(exceptions);
    }
  }
  for (const action of ["set", "cancel", "edit"])
    expectChoreDateError(
      await live.mutate({
        action,
        scope: "all",
        status: "closed",
        choreId: id,
        occurrenceStartDate: "2026-02-30",
      }),
      "occurrenceStartDate",
    );
  expect(
    (await live.db.query("select count(*) from chores where household_id=$1", [household])).rows[0]
      .count,
  ).toBe("1");
});

test("#31 query ordering, pairing and widths return 400 while exact limits remain supported", async ({
  live,
  household,
}) => {
  await live.db.query("update households set time_zone='America/New_York' where id=$1", [
    household,
  ]);
  const id = await live.chore({
    title: "Leap-year duration fixture",
    startDate: "2024-01-01",
    endDate: "2025-01-01",
  });
  for (const [start, end, field] of [
    ["2026-02-30", "2026-03-01", "start"],
    ["2026-01-01T12:00:00+99:00[UTC]", "2026-01-02", "start"],
    ["2026-01-01", "2026-01-02T12:00:00+01:99[UTC]", "end"],
    ["2026-01-02", "2026-01-01", "end"],
    ["2026-01-01", "2026-02-01", "end"],
    ["0001-01-01", "9999-12-31", "end"],
    ["", "", "start"],
    ["2026-01-01", null, "end"],
    [null, "2026-01-01", "start"],
  ]) {
    const params = new URLSearchParams();
    if (start !== null) params.set("start", start);
    if (end !== null) params.set("end", end);
    const response = await live.api(live.owner, `/api/chores?${params}`);
    expectChoreDateError(response, field);
    expect(response.body.chores).toBeUndefined();
  }
  const valid = await live.api(live.owner, "/api/chores?start=2024-01-01&end=2024-01-31");
  expect(valid.status).toBe(200);
  expect(valid.body.chores.filter((row) => row.id === id)).toHaveLength(MAX_CHORE_QUERY_DAYS);
  expect(valid.body.chores[0].duration_days).toBe(MAX_CHORE_DURATION_DAYS);
  const timestamps = new URLSearchParams({
    start: "2024-01-01T23:00:00Z",
    end: "2024-02-01T00:00:00Z",
  });
  const normalized = await live.api(live.owner, `/api/chores?${timestamps}`);
  expect(normalized.status).toBe(200);
  expect(normalized.body).toMatchObject({
    rangeStart: "2024-01-01",
    rangeEnd: "2024-01-31",
    timeZone: "America/New_York",
  });
  expectChoreDateError(
    await live.mutate({
      action: "create",
      title: "Overlong leap fixture",
      startDate: "2024-01-01",
      endDate: "2025-01-02",
      repeatRule: "none",
    }),
    "endDate",
  );
});

test("#31 timestamp writes retain household normalization and reject resolved year overflow", async ({
  live,
  household,
}) => {
  await live.db.query("update households set time_zone='Asia/Tokyo' where id=$1", [household]);
  const id = await live.chore({
    title: "Timestamp fixture",
    startDate: "2026-01-01T23:30:00Z",
    endDate: "2026-01-02T23:30:00Z",
  });
  expect(await live.choreRow(id)).toMatchObject({
    start_date: "2026-01-02",
    end_date: "2026-01-03",
  });
  await live.db.query("update households set time_zone='Pacific/Kiritimati' where id=$1", [
    household,
  ]);
  expectChoreDateError(
    await live.mutate({
      action: "create",
      title: "Overflow fixture",
      startDate: "9999-12-31T23:00:00Z",
      endDate: "9999-12-31T23:30:00Z",
      repeatRule: "none",
    }),
    "startDate",
  );
  expect(
    (await live.db.query("select count(*) from chores where household_id=$1", [household])).rows[0]
      .count,
  ).toBe("1");
});

test("#31 interpreted defaults and translated series dates stay in supported years", async ({
  live,
  household,
}) => {
  const lower = await live.chore({
    title: "Lower-bound source",
    startDate: "0001-01-01",
    endDate: "0001-01-02",
    repeatRule: "day",
  });
  const upper = await live.chore({
    title: "Upper-bound source",
    startDate: "9999-12-30",
    endDate: "9999-12-31",
  });
  const before = (
    await live.db.query("select * from chores where household_id=$1 order by id", [household])
  ).rows;
  expectChoreDateError(
    await live.mutate({
      action: "edit",
      scope: "all",
      dateBasis: "occurrence",
      choreId: lower,
      occurrenceStartDate: "0001-01-02",
      startDate: "0001-01-01",
      endDate: "0001-01-02",
    }),
    "startDate",
  );
  expectChoreDateError(
    await live.mutate({
      action: "edit",
      scope: "all",
      choreId: upper,
      occurrenceStartDate: "9999-12-30",
      startDate: "9999-12-31",
    }),
    "endDate",
  );
  expect(
    (await live.db.query("select * from chores where household_id=$1 order by id", [household]))
      .rows,
  ).toEqual(before);
});

test("#31 aggregate generation and SQL selection limits reject overflow instead of truncating", async ({
  live,
  household,
}) => {
  const id = await live.chore({
    title: "Dense overlap fixture",
    startDate: "2024-01-01",
    endDate: "2025-01-01",
    repeatRule: "day",
  });
  const dense = await live.api(live.owner, "/api/chores?start=2026-01-01&end=2026-01-31");
  expectChoreDateError(dense, "range");
  expect(dense.body.fieldErrors.range).toContain("generated day entries");
  expect((await live.list("2026-01-01")).filter((row) => row.id === id)).toHaveLength(
    MAX_CHORE_DURATION_DAYS,
  );
  expect(
    (
      await live.mutate({
        action: "cancel",
        scope: "all",
        choreId: id,
        occurrenceStartDate: "2024-01-01",
      })
    ).status,
  ).toBe(200);
  await live.db.query(
    "insert into chores(household_id,title,type,start_date,end_date,repeat_rule,status) select $1,'Selection-limit fixture','close_on_done','2026-01-01'::date,'2026-01-02'::date,'none','active' from generate_series(1,$2)",
    [household, MAX_CHORE_QUERY_ROWS + 1],
  );
  const selected = await live.api(live.owner, "/api/chores?start=2026-01-01&end=2026-01-01");
  expectChoreDateError(selected, "range");
  expect(selected.body.fieldErrors.range).toContain("selection limit");
  expect(selected.body.chores).toBeUndefined();
});

test("#31 remaining calendar seek work is bounded for reads and target validation", async ({
  live,
}) => {
  const id = await live.chore({
    title: "Ancient calendar fixture",
    startDate: "0001-01-01",
    endDate: "0001-01-02",
    repeatRule: "month",
  });
  const read = await live.api(live.owner, "/api/chores?start=9999-01-02&end=9999-01-02");
  expectChoreDateError(read, "range");
  expect(read.body.fieldErrors.range).toContain("50000");
  const write = await live.mutate({
    action: "set",
    choreId: id,
    occurrenceStartDate: "9999-01-01",
    status: "closed",
  });
  expectChoreDateError(write, "occurrenceStartDate");
  expect(
    (
      await live.db.query("select count(*) from chore_occurrence_exceptions where chore_id=$1", [
        id,
      ])
    ).rows[0].count,
  ).toBe("0");
});

for (const scope of ["all", "following"]) {
  test(`#31 ${scope} migration work limits roll back source changes and replacements`, async ({
    live,
    household,
  }) => {
    const date = monday();
    const id = await live.chore({
      title: "Work-budget source",
      startDate: "1800-01-01",
      endDate: "1800-01-02",
      repeatRule: "day",
    });
    expect(
      (
        await live.mutate({
          action: "set",
          choreId: id,
          occurrenceStartDate: date,
          status: "closed",
        })
      ).status,
    ).toBe(200);
    const before = (await live.db.query("select * from chores where id=$1", [id])).rows[0];
    const exceptions = (
      await live.db.query(
        "select * from chore_occurrence_exceptions where chore_id=$1 order by id",
        [id],
      )
    ).rows;
    const result = await live.mutate({
      action: "edit",
      scope,
      choreId: id,
      occurrenceStartDate: date,
      title: "Must roll back work limit",
    });
    expectChoreDateError(result, "scope");
    expect(result.body.fieldErrors.scope).toContain("50000");
    expect((await live.db.query("select * from chores where id=$1", [id])).rows[0]).toEqual(before);
    expect(
      (
        await live.db.query(
          "select * from chore_occurrence_exceptions where chore_id=$1 order by id",
          [id],
        )
      ).rows,
    ).toEqual(exceptions);
    expect(
      (await live.db.query("select count(*) from chores where household_id=$1", [household]))
        .rows[0].count,
    ).toBe("1");
  });

  test(`#31 ${scope} exception-row limits roll back before partial migration`, async ({
    live,
    household,
  }) => {
    const date = monday();
    const id = await live.chore({
      title: "Exception-budget source",
      startDate: "2000-01-01",
      endDate: "2000-01-02",
      repeatRule: "day",
    });
    await live.db.query(
      "insert into chore_occurrence_exceptions(chore_id,occurrence_start_date,kind,status,closed_reason) select $1,$2::date+n,'state','closed','done' from generate_series(0,$3) n",
      [id, date, MAX_CHORE_EXCEPTION_MIGRATIONS],
    );
    const before = (await live.db.query("select * from chores where id=$1", [id])).rows[0];
    const summary = async () =>
      (
        await live.db.query(
          "select count(*),min(created_at) first_created,max(updated_at) last_updated from chore_occurrence_exceptions where chore_id=$1",
          [id],
        )
      ).rows[0];
    const originalExceptions = await summary();
    const result = await live.mutate({
      action: "edit",
      scope,
      choreId: id,
      occurrenceStartDate: date,
      title: "Must roll back exception limit",
    });
    expectChoreDateError(result, "scope");
    expect(result.body.fieldErrors.scope).toContain("10000");
    expect((await live.db.query("select * from chores where id=$1", [id])).rows[0]).toEqual(before);
    expect(await summary()).toEqual(originalExceptions);
    expect(
      (await live.db.query("select count(*) from chores where household_id=$1", [household]))
        .rows[0].count,
    ).toBe("1");
  });

  test(`#31 ${scope} cadence edits reject mapped exception dates beyond supported years atomically`, async ({
    live,
    household,
  }) => {
    const id = await live.chore({
      title: "Mapped-year source",
      startDate: "2026-01-01",
      endDate: "2026-01-02",
      repeatRule: "day",
    });
    expect(
      (
        await live.mutate({
          action: "set",
          choreId: id,
          occurrenceStartDate: "2026-01-03",
          status: "closed",
        })
      ).status,
    ).toBe(200);
    const before = (await live.db.query("select * from chores where id=$1", [id])).rows[0];
    const exceptions = (
      await live.db.query(
        "select * from chore_occurrence_exceptions where chore_id=$1 order by id",
        [id],
      )
    ).rows;
    const result = await live.mutate({
      action: "edit",
      scope,
      choreId: id,
      occurrenceStartDate: "2026-01-02",
      startDate: "9999-01-01",
      endDate: "9999-01-02",
      repeatRule: "year",
      title: "Must roll back mapped year",
    });
    expectChoreDateError(result, "repeatRule");
    expect((await live.db.query("select * from chores where id=$1", [id])).rows[0]).toEqual(before);
    expect(
      (
        await live.db.query(
          "select * from chore_occurrence_exceptions where chore_id=$1 order by id",
          [id],
        )
      ).rows,
    ).toEqual(exceptions);
    expect(
      (await live.db.query("select count(*) from chores where household_id=$1", [household]))
        .rows[0].count,
    ).toBe("1");
  });
}

test("#31 unbounded yearly edits preserve final supported-year exceptions", async ({ live }) => {
  for (const scope of ["all", "following"]) {
    const id = await live.chore({
      title: "Upper-year source",
      startDate: "9998-01-01",
      endDate: "9998-01-02",
      repeatRule: "year",
    });
    expect(
      (
        await live.mutate({
          action: "set",
          choreId: id,
          occurrenceStartDate: "9999-01-01",
          status: "closed",
        })
      ).status,
    ).toBe(200);
    const edited = await live.mutate({
      action: "edit",
      scope,
      choreId: id,
      occurrenceStartDate: scope === "all" ? "9998-01-01" : "9999-01-01",
      title: "Upper-year edited",
    });
    expect(edited.status).toBe(200);
    const targetId = edited.body.createdChoreId ?? id;
    expect((await live.list("9999-01-01")).find((row) => row.id === targetId)).toMatchObject({
      title: "Upper-year edited",
      status: "closed",
      closed_reason: "done",
    });
  }
});

test("#31 finite upper-year cutoffs discard exceptions outside the edited schedule", async ({
  live,
}) => {
  for (const scope of ["all", "following"]) {
    const id = await live.chore({
      title: "Finite upper-year source",
      startDate: scope === "all" ? "2026-01-01" : "2025-12-31",
      endDate: scope === "all" ? "2026-01-02" : "2026-01-01",
      repeatRule: "day",
    });
    expect(
      (
        await live.mutate({
          action: "set",
          choreId: id,
          occurrenceStartDate: "2026-01-02",
          status: "closed",
        })
      ).status,
    ).toBe(200);
    const edited = await live.mutate({
      action: "edit",
      scope,
      choreId: id,
      occurrenceStartDate: "2026-01-01",
      startDate: "9999-01-01",
      endDate: "9999-01-02",
      repeatRule: "year",
      seriesEndDate: "9999-12-31",
    });
    expect(edited.status).toBe(200);
    const targetId = edited.body.createdChoreId ?? id;
    expect((await live.list("9999-01-01")).find((row) => row.id === targetId)).toMatchObject({
      status: "open",
      closed_reason: null,
    });
    expect(
      (
        await live.db.query("select count(*) from chore_occurrence_exceptions where chore_id=$1", [
          targetId,
        ])
      ).rows[0].count,
    ).toBe("0");
  }
});

test("#31 edits preserve unsupported legacy exception dates for staged remediation", async ({
  live,
}) => {
  const id = await live.chore({
    title: "Legacy exception horizon source",
    startDate: "2026-01-01",
    endDate: "2026-01-02",
    repeatRule: "day",
  });
  await live.db.query(
    "insert into chore_occurrence_exceptions(chore_id,occurrence_start_date,kind,status,closed_reason) values($1,'10000-01-01'::date,'state','closed','done')",
    [id],
  );
  const before = (await live.db.query("select * from chores where id=$1", [id])).rows[0];
  const exceptions = (
    await live.db.query(
      "select id,to_char(occurrence_start_date,'YYYY-MM-DD') as occurrence_date,kind,status,closed_reason from chore_occurrence_exceptions where chore_id=$1",
      [id],
    )
  ).rows;
  expectChoreDateError(
    await live.mutate({
      action: "edit",
      scope: "all",
      choreId: id,
      occurrenceStartDate: "2026-01-01",
      title: "Must not discard legacy state",
    }),
    "scope",
  );
  expect((await live.db.query("select * from chores where id=$1", [id])).rows[0]).toEqual(before);
  expect(
    (
      await live.db.query(
        "select id,to_char(occurrence_start_date,'YYYY-MM-DD') as occurrence_date,kind,status,closed_reason from chore_occurrence_exceptions where chore_id=$1",
        [id],
      )
    ).rows,
  ).toEqual(exceptions);
});

test("#31 legacy long one-offs remain readable and can be completed or canceled", async ({
  live,
  household,
}) => {
  const id = (
    await live.db.query(
      "insert into chores(household_id,title,type,start_date,end_date,repeat_rule,status) values($1,'Legacy long-span fixture','close_on_done','1950-01-01','2050-01-01','none','active') returning id",
      [household],
    )
  ).rows[0].id;
  expect((await live.list("2026-10-12", "2026-10-18")).filter((row) => row.id === id)).toHaveLength(
    7,
  );
  expect(
    (
      await live.mutate({
        action: "set",
        choreId: id,
        occurrenceStartDate: "1950-01-01",
        status: "closed",
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await live.mutate({
        action: "cancel",
        scope: "all",
        choreId: id,
        occurrenceStartDate: "1950-01-01",
      })
    ).status,
  ).toBe(200);
  expect(await live.list("2026-10-12", "2026-10-18")).toEqual([]);
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
  expect(march).toEqual([`${year}-03-31`]);
});

test("#34 yearly leap-day recurrences restore leap days and reject drifted targets", async ({
  live,
}) => {
  const id = await live.chore({
    title: "Leap-day anchor",
    startDate: "2024-02-29",
    endDate: "2024-03-01",
    repeatRule: "year",
  });
  for (const [date, expected] of [
    ["2025-02-28", true],
    ["2028-02-28", false],
    ["2028-02-29", true],
    ["2100-02-28", true],
    ["2400-02-29", true],
  ]) {
    const response = await live.mutate({
      action: "set",
      choreId: id,
      occurrenceStartDate: date,
      status: "closed",
    });
    expect(response.status).toBe(expected ? 200 : 409);
    if (expected)
      expect((await live.list(date)).find((row) => row.id === id)).toMatchObject({
        closed_reason: "done",
      });
  }
});

for (const repeatRule of ["month", "year"]) {
  test(`#34 ${repeatRule} following splits and repeated edits retain inherited anchors and exceptions`, async ({
    live,
  }) => {
    const monthly = repeatRule === "month";
    const origin = monthly ? "2026-01-31" : "2024-02-29";
    const selected = monthly ? "2026-02-28" : "2025-02-28";
    const future = monthly ? "2026-03-31" : "2028-02-29";
    const canceled = monthly ? "2026-04-30" : "2029-02-28";
    const id = await live.chore({
      title: "Anchored source",
      startDate: origin,
      endDate: day(origin, 1),
      repeatRule,
    });
    expect(
      (
        await live.mutate({
          action: "set",
          choreId: id,
          occurrenceStartDate: future,
          status: "closed",
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await live.mutate({
          action: "cancel",
          scope: "single",
          choreId: id,
          occurrenceStartDate: canceled,
        })
      ).status,
    ).toBe(200);
    const split = await live.mutate({
      action: "edit",
      scope: "following",
      choreId: id,
      occurrenceStartDate: selected,
      notes: "Split at the clamped instance",
    });
    expect(split.status).toBe(200);
    const target = split.body.createdChoreId;
    expect(
      (await live.db.query("select recurrence_anchor_day from chores where id=$1", [target]))
        .rows[0].recurrence_anchor_day,
    ).toBe(monthly ? 31 : 29);
    expect((await live.list(future)).find((row) => row.id === target)).toMatchObject({
      status: "closed",
      closed_reason: "done",
    });
    expect((await live.list(canceled)).some((row) => row.id === target)).toBe(false);
    expect((await live.list(origin)).some((row) => row.id === id)).toBe(true);
    expect(
      (
        await live.mutate({
          action: "edit",
          scope: "all",
          choreId: target,
          occurrenceStartDate: future,
          dateBasis: "occurrence",
          notes: "Retain anchor again",
        })
      ).status,
    ).toBe(200);
    expect((await live.list(future)).find((row) => row.id === target)).toMatchObject({
      notes: "Retain anchor again",
      closed_reason: "done",
    });
    const single = await live.mutate({
      action: "edit",
      scope: "single",
      choreId: target,
      occurrenceStartDate: future,
      title: "Detached anchored occurrence",
    });
    expect(single.status).toBe(200);
    expect(
      (await live.list(future)).find((row) => row.id === single.body.createdChoreId),
    ).toMatchObject({
      title: "Detached anchored occurrence",
      closed_reason: "done",
      is_repeating: false,
    });
    const replacementStart = day(selected, -1);
    expect(
      (
        await live.mutate({
          action: "edit",
          scope: "all",
          choreId: target,
          occurrenceStartDate: selected,
          startDate: replacementStart,
          endDate: day(replacementStart, 1),
        })
      ).status,
    ).toBe(200);
    expect(
      (await live.db.query("select recurrence_anchor_day from chores where id=$1", [target]))
        .rows[0].recurrence_anchor_day,
    ).toBeNull();
    expect(
      (await live.list(monthly ? "2026-03-27" : "2028-02-27")).some((row) => row.id === target),
    ).toBe(false); // detached/canceled ordinal remains canceled after re-anchoring
  });
}

const withLegacyCalendarTables = async (live, task) => {
  const client = await live.db.connect();
  try {
    await client.query("begin");
    await client.query(
      "create temp table chores (like public.chores including all) on commit drop",
    );
    await client.query("alter table chores drop column recurrence_anchor_day");
    await client.query(
      "create temp table chore_occurrence_exceptions (like public.chore_occurrence_exceptions including all) on commit drop",
    );
    const migration = await readFile(
      new URL("../drizzle/0001_polite_korvac.sql", import.meta.url),
      "utf8",
    );
    await task(client, migration);
  } finally {
    await client.query("rollback");
    client.release();
  }
};

test("#34 deployment migration preserves sparse legacy exception ordinals and metadata across a Gregorian cycle", async ({
  live,
}) => {
  await withLegacyCalendarTables(live, async (client, migration) => {
    const expectedDates = [];
    let nextId = 1;
    for (const [id, origin, repeatRule, count] of [
      [1, "2000-01-31", "month", 4801],
      [2, "2000-02-29", "year", 401],
      [3, "2000-01-30", "month", 36],
    ]) {
      await client.query(
        "insert into chores(id,household_id,title,type,start_date,end_date,repeat_rule,status) values($1,0,'Legacy fixture','stay_open',$2::date,$2::date+1,$3,'active')",
        [id, origin, repeatRule],
      );
      const start = DateTime.fromISO(origin, { zone: "UTC" });
      const end = start
        .plus(repeatRule === "month" ? { months: count - 1 } : { years: count - 1 })
        .toISODate();
      const old = generateOccurrencesByStepping({
        startDate: origin,
        endDate: day(origin, 1),
        rangeStart: origin,
        rangeEnd: end,
        repeatRule,
        seriesEndDate: null,
        timeZone: "UTC",
      }).map((row) => row.occurrenceStartDate);
      const expected = Array.from({ length: count }, (_, ordinal) =>
        start.plus(repeatRule === "month" ? { months: ordinal } : { years: ordinal }).toISODate(),
      );
      await client.query(
        "insert into chore_occurrence_exceptions(id,chore_id,occurrence_start_date,kind,status,closed_reason) select $1::integer+ordinal::integer-1,$2::integer,date::date,case when ordinal%3=0 then 'canceled' else 'state' end,case when ordinal%3=0 then null when ordinal%3=1 then 'closed' else 'open' end,case when ordinal%3=0 then null else 'done' end from unnest($3::text[]) with ordinality as dates(date,ordinal)",
        [nextId, id, old],
      );
      nextId += old.length;
      expectedDates.push(...expected);
    }
    // Orphan and unsupported keys are retained for the staged invariant audit, not guessed at.
    await client.query(
      "insert into chore_occurrence_exceptions(id,chore_id,occurrence_start_date,kind) values($1,1,'2000-03-30','canceled'),($1+1,1,'10000-01-01','canceled')",
      [nextId],
    );
    expectedDates.push("2000-03-30", "10000-01-01");
    const query =
      "select id,chore_id,to_char(occurrence_start_date,'YYYY-MM-DD') as date,kind,status,closed_reason,created_at,updated_at from chore_occurrence_exceptions order by id";
    const before = (await client.query(query)).rows;
    await client.query(migration);
    expect((await client.query(query)).rows).toEqual(
      before.map((row, index) => ({ ...row, date: expectedDates[index] })),
    );
    expect(
      (await client.query("select recurrence_anchor_day from chores")).rows.every(
        (row) => row.recurrence_anchor_day === null,
      ),
    ).toBe(true);
  });
});

test("#34 deployment migration collisions roll back without merging completion or cancellation state", async ({
  live,
}) => {
  await withLegacyCalendarTables(live, async (client, migration) => {
    await client.query(
      "insert into chores(id,household_id,title,type,start_date,end_date,repeat_rule,status) values(1,0,'Collision fixture','close_on_done','2026-01-31','2026-02-01','month','active')",
    );
    await client.query(
      "insert into chore_occurrence_exceptions(id,chore_id,occurrence_start_date,kind,status,closed_reason) values(1,1,'2026-03-28','state','closed','done'),(2,1,'2026-03-31','canceled',null,null)",
    );
    const before = (await client.query("select * from chore_occurrence_exceptions order by id"))
      .rows;
    await client.query("savepoint migration_attempt");
    await expect(client.query(migration)).rejects.toMatchObject({ code: "23505" });
    await client.query("rollback to savepoint migration_attempt");
    expect(
      (await client.query("select * from chore_occurrence_exceptions order by id")).rows,
    ).toEqual(before);
    expect(
      (
        await client.query(
          "select count(*) from pg_attribute where attrelid='pg_temp.chores'::regclass and attname='recurrence_anchor_day' and not attisdropped",
        )
      ).rows[0].count,
    ).toBe("0");
  });
});

test("#35 React Email delivers HTML and plain text for all transactional templates", async ({
  live,
}) => {
  expect(
    (
      await live.api(live.owner, "/api/auth/sign-in/magic-link", "POST", {
        email: live.owner.email,
        callbackURL: "/household",
      })
    ).status,
  ).toBe(200);
  await live.invite();
  expect((await live.api(live.alternate, "/api/me/delete-request", "POST")).status).toBe(200);
  for (const [email, path, action] of [
    [live.owner.email, "/magic-link/verify", "Open sign-in link"],
    [live.member.email, "/household/invite?", "Accept household invite"],
    [live.alternate.email, "/user/delete/confirm?", "Confirm deletion"],
  ]) {
    // Assert booleans so failed checks cannot print live sign-in/invitation/deletion tokens.
    await expect
      .poll(
        async () => {
          const list = await (
            await fetch(`${mailpitURL}/api/v1/messages?limit=100`, {
              signal: AbortSignal.timeout(10000),
            })
          ).json();
          for (const message of list.messages.filter((item) =>
            item.To.some((to) => to.Address === email),
          )) {
            const detail = await (
              await fetch(`${mailpitURL}/api/v1/message/${message.ID}`, {
                signal: AbortSignal.timeout(10000),
              })
            ).json();
            if (!detail.HTML.includes(path) || !detail.Text.includes(path)) continue;
            return (
              detail.HTML.includes("The Sweep Heap") &&
              detail.Text.includes("The Sweep Heap") &&
              detail.HTML.includes(action) &&
              detail.Text.includes(action) &&
              detail.HTML.includes("<html") &&
              !detail.Text.includes("<html")
            );
          }
          return false;
        },
        { message: `Both MIME parts contain the ${action} action` },
      )
      .toBe(true);
  }
  // Consume the extra verification token instead of leaving an unused sign-in record behind.
  const magicLink = new URL(await live.emailLink(live.owner.email, "/magic-link/verify"));
  let status;
  try {
    status = (await live.owner.context.request.get(magicLink.href, { maxRedirects: 0 })).status();
  } catch {
    // Request errors can contain the token URL; report only a fixed message.
    throw new Error("Could not verify the delivered magic link");
  }
  expect(status).toBe(302);
});

const failChoreRead = (route) =>
  route.fulfill({
    status: 500,
    contentType: "application/json",
    body: JSON.stringify({
      ok: false,
      code: "INTERNAL_SERVER_ERROR",
      error: "Failed to load chores",
    }),
  });
const isTodayRead = (request) => {
  const params = new URL(request.url()).searchParams;
  return params.get("start") === params.get("end");
};

for (const failure of ["server", "network", "invalid-json"]) {
  test(`#32 fresh ${failure} failures show separate errors and retry to real data`, async ({
    live,
  }, testInfo) => {
    await live.chore({ title: "Recovered chore", startDate: today(), endDate: day(today(), 1) });
    const page = await live.owner.context.newPage();
    const attempts = { week: 0, today: 0 };
    let failing = true;
    await page.route("**/api/chores?**", (route) => {
      attempts[isTodayRead(route.request()) ? "today" : "week"] += 1;
      if (!failing) return route.continue();
      if (failure === "network") return route.abort("failed");
      if (failure === "invalid-json")
        return route.fulfill({ status: 500, contentType: "application/json", body: "{broken" });
      return failChoreRead(route);
    });
    await page.goto(`${baseURL}/household`, { waitUntil: "networkidle", timeout: 90000 });
    const weekError = page.getByRole("alert", { name: "Week chores load error" });
    const todayError = page.getByRole("alert", { name: "Today chores load error" });
    await expect(weekError).toBeVisible();
    await expect(todayError).toBeVisible();
    await expect(page.getByText("No chores scheduled", { exact: true })).toHaveCount(0);
    await expect(page.locator("aside")).toContainText("Week progress unavailable");
    await expect(page.locator("aside")).not.toContainText("0/0 done");
    // A second failed attempt must restore its retry affordance.
    const firstWeekAttempts = attempts.week;
    await weekError.getByRole("button", { name: "Retry week" }).click();
    await expect.poll(() => attempts.week).toBeGreaterThan(firstWeekAttempts);
    await expect(weekError.getByRole("button", { name: "Retry week" })).toBeVisible();
    if (failure === "server") {
      await page.setViewportSize({ width: 390, height: 844 });
      const screenshotPath = testInfo.outputPath("load-errors-mobile.png");
      await page.screenshot({ path: screenshotPath, fullPage: true });
      await testInfo.attach("fresh-load-errors-mobile", {
        path: screenshotPath,
        contentType: "image/png",
      });
      await page.setViewportSize({ width: 1440, height: 1100 });
    }
    failing = false;
    const todayAttempts = attempts.today;
    const weekAttempts = attempts.week;
    await weekError.getByRole("button", { name: "Retry week" }).click();
    await expect(weekError).toHaveCount(0);
    await expect(page.locator("[data-chore-preview-id]")).toContainText(["Recovered chore"]);
    await expect(page.locator("aside")).toContainText("0/1 done");
    await expect(todayError).toBeVisible();
    expect(attempts.today).toBe(todayAttempts);
    await todayError.getByRole("button", { name: "Retry today" }).click();
    await expect(todayError).toHaveCount(0);
    await expect(page.locator("aside")).toContainText("Recovered chore");
    expect(attempts.week).toBeGreaterThan(weekAttempts);
  });
}

for (const scope of ["week", "today"]) {
  test(`#32 failed ${scope} refresh preserves last-known data and recovers independently`, async ({
    live,
  }) => {
    await live.chore({ title: "Cached chore", startDate: today(), endDate: day(today(), 1) });
    const page = await live.board();
    await expect(page.locator("aside")).toContainText("Cached chore");
    await expect(page.locator("[data-chore-preview-id]")).toContainText(["Cached chore"]);
    let failing = true;
    let releaseRetry;
    const retryGate = new Promise((resolve) => {
      releaseRetry = resolve;
    });
    let holdRetry = false;
    await page.route("**/api/chores?**", async (route) => {
      if (failing && isTodayRead(route.request()) === (scope === "today"))
        return failChoreRead(route);
      if (holdRetry && isTodayRead(route.request()) === (scope === "today")) await retryGate;
      return route.continue();
    });
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    const error = page.getByRole("alert", {
      name: scope === "week" ? "Week chores load error" : "Today chores load error",
    });
    await expect(error).toContainText("Showing last-known chores");
    await expect(page.locator("main").getByRole("alert")).toHaveCount(1);
    await expect(page.locator("[data-chore-preview-id]")).toContainText(["Cached chore"]);
    await expect(page.locator("aside")).toContainText("Cached chore");
    await expect(page.locator("aside")).toContainText("0/1 done");
    if (scope === "week") await expect(page.locator("aside")).toContainText("Last-known progress");
    await live.chore({ title: "New after refresh", startDate: today(), endDate: day(today(), 1) });
    failing = false;
    holdRetry = true;
    await error
      .getByRole("button", { name: scope === "week" ? "Retry week" : "Retry today" })
      .click();
    await expect(error.getByRole("button", { name: "Retrying..." })).toBeDisabled();
    releaseRetry();
    await expect(error).toHaveCount(0);
    if (scope === "week") {
      await expect(page.locator("[data-chore-preview-id]")).toHaveCount(2);
      await expect(page.locator("aside")).toContainText("0/2 done");
    } else await expect(page.locator("aside")).toContainText("New after refresh");
  });
}

test("#32 empty schedules appear only after successful reads and recover after failed refreshes", async ({
  live,
}) => {
  const page = await live.board();
  await expect(page.getByText("No chores scheduled", { exact: true })).toHaveCount(8);
  await expect(page.locator("aside")).toContainText("0/0 done");
  let failing = true;
  await page.route("**/api/chores?**", (route) =>
    failing ? failChoreRead(route) : route.continue(),
  );
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.locator("main").getByRole("alert")).toHaveCount(2);
  await expect(page.getByText("No chores scheduled", { exact: true })).toHaveCount(0);
  await expect(page.locator("aside")).toContainText("Last-known progress");
  failing = false;
  await page.getByRole("button", { name: "Retry week" }).click();
  await page.getByRole("button", { name: "Retry today" }).click();
  await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
  await expect(page.getByText("No chores scheduled", { exact: true })).toHaveCount(8);
});

test("#32 a failed new week does not reuse the previous week's chores or progress", async ({
  live,
}) => {
  await live.chore({ title: "This week only", startDate: today(), endDate: day(today(), 1) });
  await live.chore({
    title: "Next week only",
    startDate: day(monday(), 7),
    endDate: day(monday(), 8),
  });
  const page = await live.board();
  await expect(page.locator("[data-chore-preview-id]")).toContainText(["This week only"]);
  let failing = true;
  await page.route("**/api/chores?**", (route) => {
    if (failing && new URL(route.request().url()).searchParams.get("start") === day(monday(), 7))
      return failChoreRead(route);
    return route.continue();
  });
  await page.getByRole("button", { name: "Next week" }).click();
  const error = page.getByRole("alert", { name: "Week chores load error" });
  await expect(error).toBeVisible();
  await expect(error).not.toContainText("Showing last-known chores");
  await expect(page.locator("[data-chore-preview-id]")).toHaveCount(0);
  await expect(page.locator("aside")).toContainText("Week progress unavailable");
  await expect(page.locator("aside")).toContainText("This week only");
  failing = false;
  await error.getByRole("button", { name: "Retry week" }).click();
  await expect(error).toHaveCount(0);
  await expect(page.locator("[data-chore-preview-id]")).toContainText(["Next week only"]);
  await expect(page.locator("aside")).toContainText("0/1 done");
});

for (const scope of ["week", "today"]) {
  for (const [code, path, status] of [
    ["UNAUTHORIZED", "/auth", 401],
    ["HOUSEHOLD_REQUIRED", "/household/setup", 403],
    ["HOUSEHOLD_NOT_FOUND", "/household/select", 404],
    ["HOUSEHOLD_SELECTION_REQUIRED", "/household/select", 409],
  ]) {
    test(`#32 ${scope} ${code} responses retain context recovery redirects`, async ({ live }) => {
      const page = await live.owner.context.newPage();
      await page.route("**/api/chores?**", (route) => {
        if (isTodayRead(route.request()) !== (scope === "today")) return route.continue();
        return route.fulfill({
          status,
          contentType: "application/json",
          body: JSON.stringify({ ok: false, code, error: "Context recovery required" }),
        });
      });
      // Record navigation even when the auth page immediately redirects an authenticated fixture.
      const recovery = page.waitForRequest(
        (request) => request.isNavigationRequest() && new URL(request.url()).pathname === path,
      );
      await page.goto(`${baseURL}/household`, { waitUntil: "domcontentloaded", timeout: 90000 });
      await recovery;
    });
  }
}
