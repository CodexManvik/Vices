/**
 * urlFetcher.ts
 *
 * Client-side URL content extractor using the Tauri native fetch (or standard
 * browser fetch when running in web mode). Replaces the server-side
 * trafilatura + aiohttp process_url() pipeline, preventing the server's host IP
 * from leaking on outbound HTTP requests.
 *
 * Text extraction uses DOMParser for HTML pages — semantically lighter than
 * trafilatura but sufficient for injecting link context into the prompt.
 */

// Word limit mirrors server MEDIA_MAX_TEXT_LENGTH = 400
const MAX_WORDS = 400;

// Fetch timeout — abort after 8 s to avoid stalling the chat submit path
const FETCH_TIMEOUT_MS = 8_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractTextFromHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");

  // Remove noise nodes
  for (const selector of ["script", "style", "nav", "header", "footer", "aside", "noscript"]) {
    doc.querySelectorAll(selector).forEach((el) => el.remove());
  }

  // Prefer semantic article containers; fall back to body
  const container =
    doc.querySelector("article") ??
    doc.querySelector("main") ??
    doc.querySelector('[role="main"]') ??
    doc.body;

  const raw = container?.innerText ?? container?.textContent ?? "";

  // Collapse whitespace and limit to MAX_WORDS
  const words = raw.replace(/\s+/g, " ").trim().split(" ");
  return words.slice(0, MAX_WORDS).join(" ");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const IS_TAURI = typeof window !== "undefined" && "__TAURI__" in window;

/**
 * Fetches the textual content of a URL using the client's network stack.
 * Returns extracted, whitespace-normalised text (≤ MAX_WORDS words), or null
 * on timeout / non-200 / network error.
 */
export async function fetchUrlContent(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    let fetchFn: typeof fetch = window.fetch;
    if (IS_TAURI) {
      try {
        const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");
        fetchFn = tauriFetch;
      } catch (e) {
        console.warn("[UrlFetcher] Failed to load Tauri HTTP plugin, falling back to browser fetch", e);
      }
    }

    const res = await fetchFn(url, {
      signal: controller.signal,
      headers: {
        // Request plain text/html to avoid binary responses
        Accept: "text/html,application/xhtml+xml;q=0.9,text/plain;q=0.8",
        // Mimic a browser to avoid bot-blocking on simple pages
        "User-Agent":
          "Mozilla/5.0 (compatible; VicesBot/1.0; +https://vices.ai)",
      },
    });

    clearTimeout(timer);

    if (!res.ok) {
      console.warn(`[UrlFetcher] Non-OK response from ${url}: ${res.status}`);
      return null;
    }

    const contentType = res.headers.get("content-type") ?? "";

    if (contentType.includes("text/html") || contentType.includes("xhtml")) {
      const html = await res.text();
      const extracted = extractTextFromHtml(html);
      return extracted.length > 0 ? extracted : null;
    }

    if (contentType.includes("text/plain")) {
      const text = await res.text();
      const words = text.replace(/\s+/g, " ").trim().split(" ");
      return words.slice(0, MAX_WORDS).join(" ") || null;
    }

    // Binary content (images, video) — skip
    console.debug(`[UrlFetcher] Skipping non-text content-type: ${contentType}`);
    return null;
  } catch (err: unknown) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === "AbortError") {
      console.warn(`[UrlFetcher] Fetch timed out for ${url}`);
    } else {
      console.warn(`[UrlFetcher] Fetch error for ${url}:`, err);
    }
    return null;
  }
}

// ---------------------------------------------------------------------------
// URL detection utility
// ---------------------------------------------------------------------------

const URL_PATTERN = /https?:\/\/[^\s]+/g;

/**
 * Extracts all http/https URLs from a string.
 */
export function extractUrls(text: string): string[] {
  return text.match(URL_PATTERN) ?? [];
}
