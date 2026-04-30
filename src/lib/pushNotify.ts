import "server-only"
import webpush from "web-push"
import { kv } from "@vercel/kv"
import { pushSubKey } from "./userKeys"

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

interface PushPayload {
  title: string
  body: string
  tag?: string
  url?: string
}

export async function sendPushToUser(email: string, payload: PushPayload): Promise<void> {
  const sub = await kv.get<webpush.PushSubscription>(pushSubKey(email))
  if (!sub) return
  try {
    await webpush.sendNotification(sub, JSON.stringify(payload))
  } catch (err: unknown) {
    if ((err as { statusCode?: number }).statusCode === 410) {
      await kv.del(pushSubKey(email))
    }
  }
}

