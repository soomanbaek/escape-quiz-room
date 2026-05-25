import { NextResponse } from "next/server"
// Game API - Supabase 연동
import { getGameState, startGame, resetGame } from "@/lib/supabase/game-actions"

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
    const { action } = await request.json()
    
    if (action === "start") {
      const gameState = await startGame()
      return NextResponse.json(gameState)
    } else if (action === "reset") {
      const gameState = await resetGame()
      return NextResponse.json(gameState)
    }
    
    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("Failed to handle game action:", error)
    return NextResponse.json({ error: "Failed to handle game action" }, { status: 500 })
  }
}
