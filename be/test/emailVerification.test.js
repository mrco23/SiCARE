import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import authRoutes from "../src/routes/auth.routes.js";
import { errorHandler } from "../src/middleware/errorHandler.js";

function invokeApp(app, { method, url, body = {}, headers = {} }) {
  return new Promise((resolve) => {
    const req = {
      method,
      url,
      headers: { "content-type": "application/json", ...headers },
      body,
    };
    let statusCode = 200;
    const resHeaders = {};
    let responseBody = null;

    const res = {
      status(code) {
        statusCode = code;
        return res;
      },
      setHeader(name, val) {
        resHeaders[name.toLowerCase()] = val;
        return res;
      },
      getHeader(name) {
        return resHeaders[name.toLowerCase()];
      },
      json(data) {
        responseBody = data;
        resolve({ status: statusCode, body: responseBody });
        return res;
      },
      send(data) {
        responseBody = data;
        resolve({ status: statusCode, body: responseBody });
        return res;
      },
      end() {
        resolve({ status: statusCode, body: responseBody });
      },
    };

    app.handle(req, res);
  });
}

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/auth", authRoutes);
  app.use(errorHandler);
  return app;
}

test("resend-confirmation validates email or identifier requirement", async () => {
  const app = createTestApp();
  const res = await invokeApp(app, {
    method: "POST",
    url: "/api/v1/auth/resend-confirmation",
    body: {},
  });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, "VALIDATION_ERROR");
});

test("resend-confirmation rejects invalid email format", async () => {
  const app = createTestApp();
  const res = await invokeApp(app, {
    method: "POST",
    url: "/api/v1/auth/resend-confirmation",
    body: { email: "not-an-email" },
  });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, "VALIDATION_ERROR");
});

test("resend-confirmation rejects non-string or oversized email", async () => {
  const app = createTestApp();
  const res = await invokeApp(app, {
    method: "POST",
    url: "/api/v1/auth/resend-confirmation",
    body: { email: "a".repeat(250) + "@example.com" },
  });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, "VALIDATION_ERROR");
});

test("registration requires valid student or staff payload", async () => {
  const app = createTestApp();
  const res = await invokeApp(app, {
    method: "POST",
    url: "/api/v1/auth/register",
    body: {
      email: "invalid-email",
      password: "short",
      full_name: "",
    },
  });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, "VALIDATION_ERROR");
});

test("login requires valid identifier and password", async () => {
  const app = createTestApp();
  const res = await invokeApp(app, {
    method: "POST",
    url: "/api/v1/auth/login",
    body: {
      identifier: "",
      password: "",
    },
  });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, "VALIDATION_ERROR");
});
