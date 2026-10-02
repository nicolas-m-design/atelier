/** What Atelier's server needs to know about a request to one of its own endpoints. */
export interface EndpointRequest {
  method: string | undefined;
  /** The address after the endpoint's own path, such as `/my-project`. */
  path: string;
  /** The browser's `Sec-Fetch-Site` header. A page cannot set it itself. */
  site: string | undefined;
}

export interface Answer<Body> {
  status: number;
  body: Body | { error: string };
}

/**
 * Only Atelier's own page may ask, and only to read. A framed preview is
 * another origin, and is refused before anything on this machine is read.
 */
export function refusal(request: Pick<EndpointRequest, "method" | "site">): Answer<never> | null {
  if (request.method !== "GET") return { status: 405, body: { error: "Only GET is answered." } };
  if (request.site !== "same-origin") return { status: 403, body: { error: "Only Atelier's own page may ask." } };
  return null;
}
