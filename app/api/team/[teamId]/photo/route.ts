import { NextResponse } from "next/server"
import { getGameState, submitPhotoAnswer } from "@/lib/supabase/game-actions"
import { TOTAL_QUESTIONS } from "@/lib/game-data"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    const { image, mediaType } = await request.json()

    if (!image) {
      return NextResponse.json({ error: "이미지가 없습니다." }, { status: 400 })
    }

    const gameState = await getGameState()
    const result = await submitPhotoAnswer(
      gameState.sessionId,
      parseInt(teamId),
      image,
      mediaType || "image/jpeg",
      TOTAL_QUESTIONS
    )

    return NextResponse.json({
      isCorrect: result.isCorrect,
      score: result.score,
      reason: result.reason,
    })
  } catch (error) {
    console.error("Failed to handle photo submission:", error)
    return NextResponse.json({ error: "사진 제출 처리에 실패했습니다." }, { status: 500 })
  }
}
