/**
 * GitHub device flow: no OAuth app secret, no callback URL. The user types a short
 * code on github.com and we poll for the token. Uses the app's own client id when
 * one is configured with Device Flow enabled, else the GitHub CLI's public client id.
 */
export const DEVICE_CLIENT_ID = process.env.GITHUB_CLIENT_ID || "178c6fc778ccc68e1d6a";

export type DeviceStart = { device_code: string; user_code: string; verification_uri: string; expires_in: number; interval: number };

export async function startDeviceFlow(): Promise<DeviceStart> {
  const res = await fetch("https://github.com/login/device/code", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: DEVICE_CLIENT_ID, scope: "repo read:user" }),
  });
  if (!res.ok) throw new Error(`GitHub device flow failed (${res.status})`);
  const data = (await res.json()) as Partial<DeviceStart> & { error_description?: string };
  if (!data.device_code || !data.user_code) throw new Error(data.error_description ?? "GitHub did not return a device code");
  return data as DeviceStart;
}

export type DevicePoll =
  | { status: "ok"; token: string }
  | { status: "pending"; slowDown?: boolean }
  | { status: "error"; message: string };

export async function pollDeviceFlow(deviceCode: string): Promise<DevicePoll> {
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: DEVICE_CLIENT_ID, device_code: deviceCode, grant_type: "urn:ietf:params:oauth:grant-type:device_code" }),
  });
  const data = (await res.json()) as { access_token?: string; error?: string; error_description?: string };
  if (data.access_token) return { status: "ok", token: data.access_token };
  if (data.error === "authorization_pending") return { status: "pending" };
  if (data.error === "slow_down") return { status: "pending", slowDown: true };
  if (data.error === "expired_token") return { status: "error", message: "The code expired. Start again." };
  if (data.error === "access_denied") return { status: "error", message: "You cancelled the login on GitHub." };
  return { status: "error", message: data.error_description ?? data.error ?? "Unknown error" };
}
