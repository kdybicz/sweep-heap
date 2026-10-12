import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test as base, expect } from "@playwright/test";
import { DateTime } from "luxon";
import { Pool } from "pg";
import { baseURL, databaseURL, mailpitURL } from "./config.mjs";

export { expect };
export const today = () => DateTime.now().setZone("UTC").toISODate();
export const day = (date, offset) =>
  DateTime.fromISO(date, { zone: "UTC" }).plus({ days: offset }).toISODate();
export const monday = () => DateTime.now().setZone("UTC").startOf("week").toISODate();
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function mailRequest(path, options = {}) {
  const response = await fetch(`${mailpitURL}${path}`, {
    ...options,
    signal: AbortSignal.timeout(10000),
  });
  assert(response.ok, `Mailpit ${path} returned ${response.status}`);
  return response;
}

class LiveFixtures {
  prefix = `e2e-${randomUUID()}`;
  contexts = [];
  households = new Set();
  db = new Pool({ connectionString: databaseURL, connectionTimeoutMillis: 5000 });

  constructor(browser) {
    this.browser = browser;
  }

  async api(user, path, method = "GET", data, timeout = 20000) {
    try {
      const response = await user.context.request.fetch(`${baseURL}${path}`, {
        method,
        data,
        headers: { Origin: baseURL },
        timeout,
        maxRedirects: 0,
      });
      const body = response.headers()["content-type"]?.includes("application/json")
        ? await response.json()
        : await response.text();
      return { status: response.status(), body };
    } catch (error) {
      // Playwright's full request errors contain Cookie headers. Never attach them to reports.
      throw new Error(String(error.message).split("\n")[0]);
    }
  }

  async emailLink(email, fragment, invitationId) {
    for (let attempt = 0; attempt < 60; attempt++) {
      const list = await (await mailRequest("/api/v1/messages?limit=100")).json();
      for (const message of list.messages.filter((item) =>
        item.To.some((to) => to.Address === email),
      )) {
        const detail = await (await mailRequest(`/api/v1/message/${message.ID}`)).json();
        const content = `${detail.Text}\n${detail.HTML}`.replaceAll("&amp;", "&");
        const links = content.match(/https?:\/\/[^\s<>"']+/g) ?? [];
        const link = links.find(
          (value) =>
            value.includes(fragment) &&
            (!invitationId ||
              new URL(value).searchParams.get("invitationId") === String(invitationId)),
        );
        if (link) return link;
      }
      await sleep(250);
    }
    throw new Error(`No ${fragment} email delivered to fixture ${email}`);
  }

  async login(label) {
    const context = await this.browser.newContext({ viewport: { width: 1440, height: 1100 } });
    this.contexts.push(context);
    const user = { context, email: `${this.prefix}-${label}@example.com` };
    const sent = await this.api(user, "/api/auth/sign-in/magic-link", "POST", {
      email: user.email,
      name: `E2E ${label}`,
      callbackURL: "/auth",
    });
    assert.equal(sent.status, 200, JSON.stringify(sent.body));
    const link = await this.emailLink(user.email, "/magic-link/verify");
    assert.equal(new URL(link).origin, baseURL, "App and fixture auth origins must match");
    const verified = await context.request.get(link, { maxRedirects: 0 });
    assert.equal(verified.status(), 302);
    const me = await this.api(user, "/api/me");
    assert.equal(me.status, 200);
    user.id = Number(me.body.user.id);
    return user;
  }

  async start() {
    await this.db.query("select 1");
    await mailRequest("/api/v1/info");
    this.owner = await this.login("owner");
    this.member = await this.login("member");
    this.alternate = await this.login("alternate");
  }

  async createHousehold(label = "fixture") {
    const result = await this.api(this.owner, "/api/households", "POST", {
      name: `${this.prefix} ${label}`,
      timeZone: "UTC",
    });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    this.households.add(result.body.householdId);
    return result.body.householdId;
  }

  async activate(user, householdId) {
    const response = await this.api(user, "/api/households/active", "POST", { householdId });
    assert.equal(response.status, 200);
  }

  async invite(user = this.member) {
    const response = await this.api(this.owner, "/api/households/members", "POST", {
      email: user.email,
    });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.inviteEmailSent, true);
    return response.body.invite.id;
  }

  async accept(user, invitationId) {
    const link = new URL(await this.emailLink(user.email, "/household/invite?", invitationId));
    const response = await this.api(user, "/api/households/invites/accept", "POST", {
      invitationId,
      secret: link.searchParams.get("secret"),
    });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    return response;
  }

  async join(user = this.member) {
    await this.accept(user, await this.invite(user));
  }

  async chore(fields) {
    const result = await this.mutate({
      action: "create",
      type: "close_on_done",
      repeatRule: "none",
      ...fields,
    });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    return result.body.choreId;
  }

  async mutate(fields) {
    return this.api(this.owner, "/api/chores", "PATCH", fields);
  }

  async list(start, end = start) {
    const response = await this.api(this.owner, `/api/chores?start=${start}&end=${end}`);
    assert.equal(response.status, 200, JSON.stringify(response.body));
    return response.body.chores;
  }

  async choreRow(choreId) {
    return (
      await this.db.query(
        "select id, title, type, to_char(start_date, 'YYYY-MM-DD') start_date, to_char(end_date, 'YYYY-MM-DD') end_date from chores where id=$1",
        [choreId],
      )
    ).rows[0];
  }

  async board() {
    const page = await this.owner.context.newPage();
    await page.goto(`${baseURL}/household`, { waitUntil: "networkidle", timeout: 90000 });
    return page;
  }

  async cleanup() {
    const errors = [];
    const attempt = async (task) => {
      try {
        await task();
      } catch (error) {
        errors.push(String(error.message).split("\n")[0]);
      }
    };
    for (const context of this.contexts) await attempt(() => context.close());
    await attempt(async () => {
      // Prefix matching also covers a create/login that succeeded before its response failed.
      await this.db.query("delete from households where id=any($1::int[]) or name like $2", [
        [...this.households],
        `${this.prefix} %`,
      ]);
      await this.db.query("delete from users where email like $1", [`${this.prefix}-%`]);
      const remaining = await this.db.query(
        "select (select count(*) from households where name like $1) households, (select count(*) from users where email like $2) users",
        [`${this.prefix} %`, `${this.prefix}-%`],
      );
      assert.equal(Number(remaining.rows[0].households), 0);
      assert.equal(Number(remaining.rows[0].users), 0);
    });
    await attempt(async () => {
      const ids = [];
      let start = 0;
      while (true) {
        const list = await (await mailRequest(`/api/v1/messages?limit=100&start=${start}`)).json();
        ids.push(
          ...list.messages
            .filter((message) => message.To.some((to) => to.Address.startsWith(`${this.prefix}-`)))
            .map((message) => message.ID),
        );
        start += list.messages.length;
        if (start >= list.total || list.messages.length === 0) break;
      }
      if (ids.length)
        await mailRequest("/api/v1/messages", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ IDs: ids }),
        });
    });
    await this.db.end();
    assert.deepEqual(errors, [], `Fixture cleanup failed: ${errors.join("; ")}`);
  }
}

export const test = base.extend({
  live: [
    async ({ browser }, use) => {
      const live = new LiveFixtures(browser);
      try {
        await live.start();
        await use(live);
      } finally {
        await live.cleanup();
      }
    },
    { scope: "worker", timeout: 120000 },
  ],
  household: async ({ live }, use, testInfo) => {
    const id = await live.createHousehold(testInfo.title);
    try {
      await use(id);
    } finally {
      for (const context of live.contexts) for (const page of context.pages()) await page.close();
      await live.db.query("delete from households where id=$1", [id]);
    }
  },
});
