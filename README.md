# TaskMate public site

Static site for `taskmate.fun`, hosted by GitHub Pages from
`SatwikSakkirala/taskmate-site`. The site root declares the domain in `CNAME`.

## Universal Links release checklist

1. Run `node --test tests/universal-links.test.mjs` with Node 22 or newer.
   The HTTP test uses a local reference server with explicit MIME types;
   it does not validate GitHub Pages response headers.
2. After explicit deployment approval, verify in GitHub **Settings → Pages**
   that the source is **Deploy from a branch**, **main**, **/ (root)** and
   that `taskmate.fun` and HTTPS are configured. Review and publish the
   website changes to that source. The Jekyll include in `_config.yml`
   publishes the extensionless file inside `.well-known`.
3. When the Pages deployment completes, run
   `curl -sS -D - https://taskmate.fun/.well-known/apple-app-site-association`
   without following redirects. Require public HTTPS 200, no Location header,
   `Content-Type: application/json`, and the matching app ID and paths.
   [GitHub Pages does not provide per-file MIME overrides](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site#mime-types-on-github-pages).
   If it serves the extensionless file as another MIME type, leave the release
   blocked until an approved header-capable serving layer on the same hostname
   can return the file directly. Do not use a redirect to a JSON file.
4. Check `/invite` in a browser using a disposable invitation. Pages can
   redirect directory paths to `/invite/`; check that it preserves the query.
   Confirm the browser cleans the URL, the app opens only on click, and the app
   shows its invitation preview without accepting it. Check an invalid link
   does not offer Open TaskMate.
5. Confirm Apple's associated-domains CDN has the expected AASA, then test the
   canonical HTTPS invite from another app on a physical iPhone, including
   installed-app and browser fallback paths.

The browser validates only the token's format. Authenticity, expiry and
acceptance remain in TaskMate. The page does not log, persist or send the
token to an analytics or web API, and uses a no-referrer policy. A query token
is necessarily visible to the HTTPS serving layer on the initial request
(and any hosting redirect); GitHub Pages access-log handling is outside this
site's control. The shared URL is exactly `/invite?token=…`. The AASA also
reserves `/invite/*` as requested; the verified IPA handles the canonical
route, not arbitrary nested invite paths.
