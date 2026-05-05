const { test, before, describe } = require("node:test");
const assert = require("node:assert/strict");
const { withServer, jsonRequest } = require("./testHttp");
const { app, bootstrap } = require("../server");

const skipDb = !process.env.DB_USER;

describe("API contract (integration)", { skip: skipDb }, () => {
  before(async () => {
    await bootstrap();
  });

  test("GET /badges requires authentication", async () => {
    await withServer(app, async (p) => {
      const res = await jsonRequest(p, { path: "/badges" });
      assert.equal(res.status, 401);
    });
  });

  test("POST /auth/login returns token and user id", async () => {
    await withServer(app, async (p) => {
      const res = await jsonRequest(p, {
        method: "POST",
        path: "/auth/login",
        body: { username: "admin", password: "admin" },
      });
      assert.equal(res.status, 200);
      assert.ok(res.body?.token);
      assert.ok(res.body?.user?.id);
      assert.equal(res.body.user.username, "admin");
    });
  });

  test("duplicate upvote returns already_voted", async () => {
    await withServer(app, async (p) => {
      const tech = await jsonRequest(p, {
        method: "POST",
        path: "/auth/login",
        body: { username: "tech", password: "tech" },
      });
      const admin = await jsonRequest(p, {
        method: "POST",
        path: "/auth/login",
        body: { username: "admin", password: "admin" },
      });
      const tokenT = tech.body.token;
      const tokenA = admin.body.token;

      const tRes = await jsonRequest(p, {
        method: "POST",
        path: "/tickets",
        token: tokenT,
        body: {
          title: "Test ticket for votes",
          description: "Integration test body",
          priority: "Low",
        },
      });
      assert.equal(tRes.status, 201);
      const ticketId = tRes.body.id;

      await jsonRequest(p, {
        path: `/tickets/${ticketId}/thread`,
        token: tokenT,
      });

      const msgRes = await jsonRequest(p, {
        method: "POST",
        path: `/tickets/${ticketId}/thread/messages`,
        token: tokenT,
        body: {
          messageType: "answer",
          visibility: "public",
          body: "Proposed resolution steps.",
        },
      });
      assert.equal(msgRes.status, 201);
      const messageId = msgRes.body.id;

      const first = await jsonRequest(p, {
        method: "POST",
        path: `/thread/messages/${messageId}/upvote`,
        token: tokenA,
        body: {},
      });
      assert.equal(first.status, 200);
      assert.equal(first.body.ok, true);

      const second = await jsonRequest(p, {
        method: "POST",
        path: `/thread/messages/${messageId}/upvote`,
        token: tokenA,
        body: {},
      });
      assert.equal(second.status, 200);
      assert.equal(second.body.reason, "already_voted");
    });
  });

  test("requester cannot accept solution", async () => {
    await withServer(app, async (p) => {
      const tech = await jsonRequest(p, {
        method: "POST",
        path: "/auth/login",
        body: { username: "tech", password: "tech" },
      });
      const user = await jsonRequest(p, {
        method: "POST",
        path: "/auth/login",
        body: { username: "user", password: "user" },
      });
      const tokenT = tech.body.token;
      const tokenU = user.body.token;

      const tRes = await jsonRequest(p, {
        method: "POST",
        path: "/tickets",
        token: tokenT,
        body: {
          title: "Accept permission test",
          description: "Body",
          priority: "Medium",
        },
      });
      const ticketId = tRes.body.id;
      await jsonRequest(p, {
        path: `/tickets/${ticketId}/thread`,
        token: tokenT,
      });
      const msgRes = await jsonRequest(p, {
        method: "POST",
        path: `/tickets/${ticketId}/thread/messages`,
        token: tokenT,
        body: {
          messageType: "answer",
          visibility: "public",
          body: "Answer text.",
        },
      });
      const messageId = msgRes.body.id;

      const res = await jsonRequest(p, {
        method: "POST",
        path: `/thread/messages/${messageId}/accept`,
        token: tokenU,
        body: {},
      });
      assert.equal(res.status, 403);
    });
  });
});
