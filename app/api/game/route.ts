import { NextResponse } from "next/server"
// Game API - Supabase 연동
import { getGameState, startGame, endGame, resetGame, updateTeamName, resetTeamPlayer, skipTeamQuestion, rewindTeamQuestion, pauseGame, resumeGame } from "@/lib/supabase/game-actions"
import { TOTAL_QUESTIONS } from "@/lib/game-data"

export async function GET() {
  try {
    const gameState = await getGameState()
    return NextResponse.json(gameState)
  } catch (error) {
    console.error("Failed to get game state:", error)
    return NextResponse.json({ error: "Failed to get game state" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { action } = body

    if (action === "start") {
      const gameState = await startGame()
      return NextResponse.json(gameState)
    } else if (action === "end") {
      const gameState = await endGame()
      return NextResponse.json(gameState)
    } else if (action === "reset") {
      const gameState = await resetGame()
      return NextResponse.json(gameState)
    } else if (action === "resetTeamPlayer") {
      const { sessionId, teamId } = body as { sessionId: string; teamId: number }
      await resetTeamPlayer(sessionId, teamId)
      const gameState = await getGameState()
      return NextResponse.json(gameState)
    } else if (action === "skipQuestion") {
      const { sessionId, teamId } = body as { sessionId: string; teamId: number }
      await skipTeamQuestion(sessionId, teamId, TOTAL_QUESTIONS)
      const gameState = await getGameState()
      return NextResponse.json(gameState)
    } else if (action === "rewindQuestion") {
      const { sessionId, teamId } = body as { sessionId: string; teamId: number }
      await rewindTeamQuestion(sessionId, teamId)
      const gameState = await getGameState()
      return NextResponse.json(gameState)
    } else if (action === "pause") {
      const gameState = await pauseGame()
      return NextResponse.json(gameState)
    } else if (action === "resume") {
      const gameState = await resumeGame()
      return NextResponse.json(gameState)
    } else if (action === "updateTeamName") {
      const { sessionId, teamId, newName } = body as { sessionId: string; teamId: number; newName: string }
      await updateTeamName(sessionId, teamId, newName)
      const gameState = await getGameState()
      return NextResponse.json(gameState)
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("Failed to handle game action:", error)
    return NextResponse.json({ error: "Failed to handle game action" }, { status: 500 })
  }
}
