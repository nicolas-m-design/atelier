/** Whether a project's preview server is reachable, judged by its manifest. */
import { MANIFEST_PATH, parseManifest, type Manifest } from "./manifest";

export type Status =
  /** Registered without a preview address: nothing to load yet. */
  | { state: "empty" }
  | { state: "checking" }
  | { state: "online"; manifest: Manifest }
  /** Nothing answers at the address. */
  | { state: "offline" }
  /** A server answers, but without a readable, valid manifest. */
  | { state: "unconnected"; reason: string };

type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

export async function checkProject(origin: string, fetcher: Fetcher = fetch, timeout = 2500): Promise<Status> {
  const url = origin + MANIFEST_PATH;
  let response: Response;
  try {
    response = await fetcher(url, { cache: "no-store", signal: AbortSignal.timeout(timeout) });
  } catch {
    // A response this page may not read (no CORS header, as on a 404) fails
    // exactly like a stopped server. An opaque request tells the two apart.
    try {
      await fetcher(url, { mode: "no-cors", cache: "no-store", signal: AbortSignal.timeout(timeout) });
      return { state: "unconnected", reason: `It answers, but ${MANIFEST_PATH} is missing or not readable from Atelier.` };
    } catch {
      return { state: "offline" };
    }
  }
  if (!response.ok) return { state: "unconnected", reason: `${MANIFEST_PATH} answered ${response.status}.` };
  try {
    return { state: "online", manifest: parseManifest(await response.json()) };
  } catch (error) {
    return { state: "unconnected", reason: `${MANIFEST_PATH} is not a valid manifest: ${error instanceof Error ? error.message : "unreadable"}.` };
  }
}
