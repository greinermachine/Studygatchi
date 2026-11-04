const API_URL: string =
  import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";

export interface ProhibitedSite {
  id: number;
  url: string;
}

export function hasExtensionStorage(): boolean {
  return typeof chrome !== "undefined" && chrome.storage?.local !== undefined;
}

function getCsrfToken(): string | undefined {
  return document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith("csrftoken="))
    ?.split("=")[1];
}

async function request<T>(init?: RequestInit): Promise<T> {
  const csrfToken = getCsrfToken();
  const response = await fetch(`${API_URL}/prohibited_sites/`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(csrfToken ? { "X-CSRFToken": decodeURIComponent(csrfToken) } : {}),
      ...init?.headers,
    },
    credentials: "include",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message = body?.url?.[0] ?? `Request failed with status ${response.status}`;
    throw new Error(message);
  }
  return response.json();
}

export function getProhibitedSites(): Promise<ProhibitedSite[]> {
  return request<ProhibitedSite[]>();
}

export function addProhibitedSite(url: string): Promise<ProhibitedSite> {
  return request<ProhibitedSite>({
    method: "POST",
    body: JSON.stringify({ url }),
  });
}

export async function syncProhibitedSites(): Promise<ProhibitedSite[]> {
  const sites = await getProhibitedSites();
  if (hasExtensionStorage()) {
    await chrome.storage.local.set({
      prohibitedSites: sites.map((site) => site.url),
    });
  }
  return sites;
}
