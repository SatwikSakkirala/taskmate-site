import assert from "node:assert/strict";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import test from "node:test";
import { runInNewContext } from "node:vm";

const aasaPath = "/.well-known/apple-app-site-association";
const aasa = readFileSync(new URL(".." + aasaPath, import.meta.url), "utf8");
const page = readFileSync(new URL("../invite/index.html", import.meta.url), "utf8");
const script = page.match(/<script>([\s\S]*?)<\/script>/)[1];
const fixture = "a".repeat(64);

test("local HTTP contract: AASA is public JSON without redirects, invite is HTML", async (t) => {
  // Reference server for the required response contract; it does not model
  // GitHub Pages' production MIME selection or directory redirects.
  const server = createServer((req, res) => {
    const { pathname } = new URL(req.url, "http://localhost");
    if (pathname === aasaPath) {
      res.writeHead(200, { "Content-Type": "application/json" }).end(aasa);
    } else if (pathname === "/invite" || pathname === "/invite/") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(page);
    } else res.writeHead(404).end();
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => server.close());
  const base = "http://127.0.0.1:" + server.address().port;
  const association = await fetch(base + aasaPath, { redirect: "manual" });
  assert.equal(association.status, 200);
  assert.equal(association.headers.get("content-type"), "application/json");
  assert.equal(association.headers.get("location"), null);
  assert.deepEqual(await association.json(), {
    applinks: {
      details: [{
        appIDs: ["4NR9GM5S5M.com.satwiksakkirala.taskmate"],
        components: [{ "/": "/invite" }, { "/": "/invite/*" }],
      }],
    },
  });
  const fallback = await fetch(base + "/invite?token=" + fixture);
  assert.equal(fallback.status, 200);
  assert.match(fallback.headers.get("content-type"), /^text\/html/);
  const html = await fallback.text();
  assert.match(html, /Invitation to TaskMate/);
  assert.match(html, /invitation to join a shared Space/);
  assert.ok(!html.includes(fixture));
  assert.ok(html.indexOf('content="no-referrer"') < html.indexOf("<script>"));
});

function render(search, { hash = "", pathname = "/invite/", scrubFails = false } = {}) {
  const cleanPaths = [], opened = [];
  const valid = { hidden: true }, invalid = { hidden: false };
  let click;
  const open = { addEventListener(name, cb) { assert.equal(name, "click"); click = cb; } };
  runInNewContext(script, {
    URLSearchParams, encodeURIComponent,
    window: {
      location: { search, hash, pathname, assign(url) { opened.push(url); } },
      history: { replaceState(state, title, path) {
        if (scrubFails) throw Error("History unavailable");
        cleanPaths.push(path);
      } },
    },
    document: {
      addEventListener(name, cb) { assert.equal(name, "DOMContentLoaded"); cb(); },
      getElementById(id) {
        return { "open-app": open, "valid-invite": valid, "invalid-invite": invalid }[id];
      },
    },
  });
  return { cleanPaths, opened, valid, invalid, click };
}

test("valid token is scrubbed from the browser URL and opened only on click", () => {
  const r = render("?token=" + fixture, { hash: "#discard" });
  assert.deepEqual(r.cleanPaths, ["/invite/"]);
  assert.equal(r.valid.hidden, false);
  assert.equal(r.invalid.hidden, true);
  assert.deepEqual(r.opened, []);
  r.click();
  assert.deepEqual(r.opened, ["taskmate:///invite?token=" + fixture]);
});

test("missing, malformed, duplicate, or un-scrubbable tokens offer no launch", () => {
  for (const search of ["", "?token=", "?token=javascript%3Aalert(1)",
    "?token=" + fixture + "%0A", "?token=" + fixture + "&token=" + fixture]) {
    const r = render(search);
    assert.equal(r.valid.hidden, true);
    assert.equal(r.invalid.hidden, false);
    assert.equal(r.click, undefined);
    assert.deepEqual(r.opened, []);
    assert.deepEqual(r.cleanPaths, search ? ["/invite/"] : []);
  }
  assert.equal(render("?token=" + fixture, { scrubFails: true }).click, undefined);
});

test("redirect and destination parameters cannot change the fixed launch URL", () => {
  const r = render("?token=" + fixture + "&redirect=https://example.invalid/");
  r.click();
  assert.deepEqual(r.opened, ["taskmate:///invite?token=" + fixture]);
  assert.deepEqual(r.cleanPaths, ["/invite/"]);
});
