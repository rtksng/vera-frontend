const DEFAULT_API_URL = "http://10.145.26.238:8000";

export const API_URL = (process.env.EXPO_PUBLIC_API_URL?.trim() || DEFAULT_API_URL).replace(/\/+$/, "");

type ApiHeaders = Record<string, string | undefined>;

function buildApiUrl(path: string): string {
  return `${API_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unknown network error";
}

function compactHeaders(headers: ApiHeaders): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

async function parseJsonResponse<T = unknown>(response: Response, url: string): Promise<T> {
  const rawBody = await response.text();

  if (!response.ok) {
    const details = rawBody || response.statusText || "Request failed";
    throw new Error(`${response.status} ${details}`.trim());
  }

  if (!rawBody) {
    return {} as T;
  }

  try {
    return JSON.parse(rawBody) as T;
  } catch {
    throw new Error(`Expected JSON response from ${url}`);
  }
}

export async function getJson<T = unknown>(
  path: string,
  headers: ApiHeaders = {},
): Promise<T> {
  const url = buildApiUrl(path);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...compactHeaders(headers),
      },
    });
  } catch (error) {
    throw new Error(`Could not reach ${url}. ${getErrorMessage(error)}`);
  }

  return parseJsonResponse<T>(response, url);
}

export async function postJson<T = unknown>(
  path: string,
  body: unknown,
  headers: ApiHeaders = {},
): Promise<T> {
  const url = buildApiUrl(path);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...compactHeaders(headers),
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw new Error(`Could not reach ${url}. ${getErrorMessage(error)}`);
  }

  return parseJsonResponse<T>(response, url);
}

export async function putJson<T = unknown>(
  path: string,
  body: unknown,
  headers: ApiHeaders = {},
): Promise<T> {
  const url = buildApiUrl(path);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...compactHeaders(headers),
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw new Error(`Could not reach ${url}. ${getErrorMessage(error)}`);
  }

  return parseJsonResponse<T>(response, url);
}

export async function transcribeAudio(
  audioUri: string,
  headers: ApiHeaders = {},
  fileName = "audio.m4a",
): Promise<{ text: string }> {
  const url = buildApiUrl("/transcribe");
  const formData = new FormData();

  formData.append("file", {
    uri: audioUri,
    name: fileName,
    type: "audio/m4a",
  } as never);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        ...compactHeaders(headers),
      },
      body: formData,
    });
  } catch (error) {
    throw new Error(`Could not upload audio to ${url}. ${getErrorMessage(error)}`);
  }

  const data = await parseJsonResponse<{ text?: string }>(response, url);
  return { text: data.text?.trim() ?? "" };
}
