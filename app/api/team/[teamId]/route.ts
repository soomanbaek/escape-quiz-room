import { NextResponse } from "next/server"
import { 
  getTeamState, 
  getCurrentQuestion, 
  useHint, 
  submitAnswer, 
  registerPlayer, 
  unregisterPlayer,
  getGameState
} from "@/lib/supabase/game-actions"
import { TOTAL_QUESTIONS } from "@/lib/game-data"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    const gameState = await getGameState()
    const team = await getTeamState(gameState.sessionId, parseInt(teamId))
    
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }
    
    const currentQuestion = await getCurrentQuestion(gameState.sessionId, team.current_question)
    
    return NextResponse.json({
      team: {
        ...team,
        // 클라이언트 호환성을 위해 camelCase로 변환
        teamId: team.team_id,
        teamName: team.team_name,
        currentQuestion: team.current_question,
        hintsUsed: team.hints_used,
        penaltySeconds: team.penalty_seconds,
        startTime: team.start_time ? new Date(team.start_time).getTime() : null,
        endTime: team.end_time ? new Date(team.end_time).getTime() : null,
        isFinished: team.is_finished,
        hasPlayer: team.has_player,
        playerSessionId: team.player_session_id
      },
      currentQuestion: currentQuestion ? {
        id: currentQuestion.question_number,
        question: currentQuestion.question,
        hint: currentQuestion.hint
      } : null,
      sessionId: gameState.sessionId,
      isStarted: gameState.isStarted
    })
  } catch (error) {
    console.error("Failed to get team state:", error)
    return NextResponse.json({ error: "Failed to get team state" }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    const body = await request.json()
    const { action, answer, sessionId: playerSessionId } = body
    const teamIdNum = parseInt(teamId)
    
    const gameState = await getGameState()
    
    if (action === "hint") {
      const team = await useHint(gameState.sessionId, teamIdNum)
      return NextResponse.json({ 
        team: team ? {
          ...team,
          teamId: team.team_id,
          teamName: team.team_name,
          currentQuestion: team.current_question,
          hintsUsed: team.hints_used,
          penaltySeconds: team.penalty_seconds,
          startTime: team.start_time ? new Date(team.start_time).getTime() : null,
          endTime: team.end_time ? new Date(team.end_time).getTime() : null,
          isFinished: team.is_finished,
          hasPlayer: team.has_player,
          playerSessionId: team.player_session_id
        } : null
      })
    }
    
    if (action === "submit") {
      const result = await submitAnswer(gameState.sessionId, teamIdNum, answer, TOTAL_QUESTIONS)
      
      return NextResponse.json({ 
        team: result.team ? {
          ...result.team,
          teamId: result.team.team_id,
          teamName: result.team.team_name,
          currentQuestion: result.team.current_question,
          hintsUsed: result.team.hints_used,
          penaltySeconds: result.team.penalty_seconds,
          startTime: result.team.start_time ? new Date(result.team.start_time).getTime() : null,
          endTime: result.team.end_time ? new Date(result.team.end_time).getTime() : null,
          isFinished: result.team.is_finished,
          hasPlayer: result.team.has_player,
          playerSessionId: result.team.player_session_id
        } : null, 
        isCorrect: result.isCorrect
      })
    }
    
    // 플레이어 등록
    if (action === "register") {
      const result = await registerPlayer(gameState.sessionId, teamIdNum, playerSessionId || "")
      return NextResponse.json({
        success: result.success,
        team: result.team ? {
          ...result.team,
          teamId: result.team.team_id,
          teamName: result.team.team_name,
          currentQuestion: result.team.current_question,
          hintsUsed: result.team.hints_used,
          penaltySeconds: result.team.penalty_seconds,
          startTime: result.team.start_time ? new Date(result.team.start_time).getTime() : null,
          endTime: result.team.end_time ? new Date(result.team.end_time).getTime() : null,
          isFinished: result.team.is_finished,
          hasPlayer: result.team.has_player,
          playerSessionId: result.team.player_session_id
        } : null
      })
    }
    
    // 플레이어 해제
    if (action === "unregister") {
      const success = await unregisterPlayer(gameState.sessionId, teamIdNum, playerSessionId || "")
      return NextResponse.json({ success })
    }
    
    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("Failed to handle team action:", error)
    return NextResponse.json({ error: "Failed to handle team action" }, { status: 500 })
  }
}
