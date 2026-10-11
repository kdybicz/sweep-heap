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
    test.fail(true, "https://github.com/kdybicz/sweep-heap/issues/20");
    expect(status).toBe(200);
  } finally {
    await fixtureConnection.query("select pg_advisory_unlock_all()");
    fixtureConnection.release();
    // Cancel only backends identified by this disposable household's advisory lock.
    // Releasing queued requests frees slots so the holder's callback can finish.
    for (const pid of backendIds) await live.db.query("select pg_cancel_backend($1)", [pid]);
    await Promise.all(requests);
  }
});
