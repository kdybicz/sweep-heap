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
      const instance = (await live.list(start, day(selected, 28))).find(
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
