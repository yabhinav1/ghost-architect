import { startDeviceFlow } from "@/lib/device-auth";
import { seal } from "@/lib/session";

export async function POST() {
  try {
    const d = await startDeviceFlow();
    // The device code is a secret; hand the browser only an encrypted copy to return on poll.
    return Response.json({ handle: seal({ dc: d.device_code, exp: Date.now() + d.expires_in * 1000 }), userCode: d.user_code, verificationUri: d.verification_uri, interval: d.interval, expiresIn: d.expires_in });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
