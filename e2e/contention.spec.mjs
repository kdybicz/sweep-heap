import { baseURL } from "./config.mjs";
import { expect, sleep, test } from "./support.mjs";

test("#20 a full queue of household mutations does not deadlock the app pool", async ({
  live,
  household,
}, testInfo) => {
  test.setTimeout(90000);
  const fixtureConnection = await live.db.connect();
  let backendIds = [];
  let requests = [];
  try {
    await fixtureConnection.query("select pg_advisory_lock($1)", [household]);
    requests = Array.from({ length: 10 }, (_, index) =>
      live
        .api(
          live.owner,
          "/api/households/members",
          "POST",
          { email: `${live.prefix}-burst-${index}@example.com` },
          20000,
        )
        .catch((error) => ({ error: error.message })),
    );
    for (let attempt = 0; attempt < 50; attempt++) {
      const locks = await live.db.query(
        "select pid from pg_locks where locktype='advisory' and classid=0 and objid=$1 and objsubid=1 and not granted",
        [household],
      );
      backendIds = locks.rows.map((row) => row.pid);
      if (backendIds.length >= 10) break;
      await sleep(100);
    }
    expect(
      backendIds,
      "The fixture must queue ten lock connections before checking pool health",
    ).toHaveLength(10);
    const waitingConnections = await live.db.query(
      "select application_name from pg_stat_activity where pid=any($1::int[])",
      [backendIds],
    );
    expect(
      waitingConnections.rows.every((row) => row.application_name === "sweep-heap-household-locks"),
    ).toBe(true);
    expect(
      (await fetch(`${baseURL}/api/health`, { signal: AbortSignal.timeout(3000) })).status,
    ).toBe(200);
    await fixtureConnection.query("select pg_advisory_unlock($1)", [household]);
    await sleep(1000);
    let status = "timeout";
    try {
      status = (await fetch(`${baseURL}/api/health`, { signal: AbortSignal.timeout(3000) })).status;
    } catch {
      /* Record the bounded health timeout without request credentials. */
    }
    await testInfo.attach("pool-contention", {
      body: JSON.stringify({ queuedLockConnections: backendIds.length, healthStatus: status }),
      contentType: "application/json",
    });
    expect(status).toBe(200);
    const results = await Promise.all(requests);
    expect(
      results.every((result) => result.status === 200 && result.body.inviteEmailSent === true),
    ).toBe(true);
    expect(
      (
        await live.db.query(
          "select id from household_member_invites where household_id=$1 and email like $2",
          [household, `${live.prefix}-burst-%`],
        )
      ).rowCount,
    ).toBe(10);
  } finally {
    await fixtureConnection.query("select pg_advisory_unlock_all()");
    fixtureConnection.release();
    // Cancel only backends identified by this disposable household's advisory lock.
    // Releasing queued requests frees slots so the holder's callback can finish.
    for (const pid of backendIds) await live.db.query("select pg_cancel_backend($1)", [pid]);
    await Promise.all(requests);
  }
});

test("#20 a busy household returns a bounded retryable conflict without creating an invite", async ({
  live,
  household,
}) => {
  const client = await live.db.connect();
  const email = `${live.prefix}-timeout@example.com`;
  try {
    await client.query("select pg_advisory_lock($1)", [household]);
    const response = await live.api(
      live.owner,
      "/api/households/members",
      "POST",
      { email },
      12000,
    );
    expect(response.status).toBe(409);
    expect(response.body.code).toBe("HOUSEHOLD_MUTATION_BUSY");
    expect(
      (
        await live.db.query(
          "select id from household_member_invites where household_id=$1 and email=$2",
          [household, email],
        )
      ).rowCount,
    ).toBe(0);
    expect(
      (await fetch(`${baseURL}/api/health`, { signal: AbortSignal.timeout(3000) })).status,
    ).toBe(200);
  } finally {
    await client.query("select pg_advisory_unlock_all()");
    client.release();
  }
  expect((await live.api(live.owner, "/api/households/members", "POST", { email })).status).toBe(
    200,
  );
});

test("#20 account deletion does not wait in the query pool or consume a busy token", async ({
  live,
  household,
}) => {
  const client = await live.db.connect();
  try {
    // A same-number single-key lock must not block the token's separate two-key namespace.
    await client.query("select pg_advisory_lock($1)", [live.owner.id]);
    expect(
      (await live.api(live.owner, "/api/me/delete-request", "POST", undefined, 5000)).status,
    ).toBe(200);
    await client.query("select pg_advisory_unlock_all()");
    const link = new URL(await live.emailLink(live.owner.email, "/user/delete/confirm?"));
    await client.query("select pg_advisory_lock($1)", [household]);
    const response = await live.api(
      live.owner,
      "/api/me/delete-confirm",
      "POST",
      {
        identifier: link.searchParams.get("identifier"),
        token: link.searchParams.get("token"),
      },
      5000,
    );
    expect(response.status).toBe(409);
    expect(response.body.code).toBe("HOUSEHOLD_MUTATION_BUSY");
    expect(
      (await live.db.query("select id from users where id=$1", [live.owner.id])).rowCount,
    ).toBe(1);
    expect(
      (
        await live.db.query("select id from delete_account_tokens where identifier=$1", [
          link.searchParams.get("identifier"),
        ])
      ).rowCount,
    ).toBe(1);
  } finally {
    await client.query("select pg_advisory_unlock_all()");
    client.release();
  }
});
