import { NextResponse } from "next/server"
import {
  getTeamPageData,
  getLatestSession,
  useHint,
  submitAnswer,
  registerPlayer,
  unregisterPlayer,
  joinTeam,
  heartbeat,
} from "@/lib/supabase/game-actions"
import { TOTAL_QUESTIONS } from "@/lib/game-data"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    const data = await getTeamPageData(parseInt(teamId))
    if (!data) return NextResponse.json({ error: "Team not found" }, { status: 404 })
    return NextResponse.json(data)
  } catch (error) {
    console.error("Failed to get team state:", error)
    return NextResponse.json({ error: "Failed to get team state" }, { status: 500 })
  }
}

function transformTeamRow(team: Record<string, unknown>) {
  return {
    ...team,
    teamId: team.team_id,
    teamName: team.team_name,
    currentQuestion: team.current_question,
    hintsUsed: team.hints_used,
    penaltySeconds: team.penalty_seconds,
    startTime: team.start_time ? new Date(team.start_time as string).getTime() : null,
    endTime: team.end_time ? new Date(team.end_time as string).getTime() : null,
    isFinished: team.is_finished,
    hasPlayer: team.has_player,
    playerSessionId: team.player_session_id
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    const body = await request.json()
    const { action, answer, sessionId: playerSessionId, nickname } = body
    const teamIdNum = parseInt(teamId)

    // heartbeat / join은 경량 세션 조회만 사용
    if (action === "heartbeat") {
      const session = await getLatestSession()
      if (session) await heartbeat(session.id, teamIdNum, playerSessionId || "")
      return NextResponse.json({ ok: true })
    }

    if (action === "join") {
      const session = await getLatestSession()
      if (!session) return NextResponse.json({ error: "No active session" }, { status: 404 })
      const result = await joinTeam(session.id, teamIdNum, playerSessionId || "", nickname || "")
      return NextResponse.json(result)
    }

    // 나머지 액션은 세션 조회 1회
    const session = await getLatestSession()
    if (!session) return NextResponse.json({ error: "No active session" }, { status: 404 })

    if (action === "hint") {
      await useHint(session.id, teamIdNum)
      return NextResponse.json({ ok: true })
    }

    if (action === "submit") {
      const result = await submitAnswer(session.id, teamIdNum, answer, TOTAL_QUESTIONS, playerSessionId, nickname)
      return NextResponse.json({ isCorrect: result.isCorrect })
    }

    if (action === "register") {
      const result = await registerPlayer(session.id, teamIdNum, playerSessionId || "")
      return NextResponse.json({
        success: result.success,
        team: result.team ? transformTeamRow(result.team as Record<string, unknown>) : null
      })
    }

    if (action === "unregister") {
      const success = await unregisterPlayer(session.id, teamIdNum, playerSessionId || "")
      return NextResponse.json({ success })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("Failed to handle team action:", error)
    return NextResponse.json({ error: "Failed to handle team action" }, { status: 500 })
  }
}
