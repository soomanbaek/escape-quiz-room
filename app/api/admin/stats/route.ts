import { NextResponse } from "next/server"
import { getLatestSession, getMemberStats } from "@/lib/supabase/game-actions"

export async function GET() {
  try {
    const session = await getLatestSession()
    if (!session) return NextResponse.json({ stats: [] })

    const startTimeMs = session.start_time ? new Date(session.start_time).getTime() : null
    const stats = await getMemberStats(session.id, startTimeMs)
    return NextResponse.json({ stats })
  } catch {
    return NextResponse.json({ stats: [] })
  }
}
