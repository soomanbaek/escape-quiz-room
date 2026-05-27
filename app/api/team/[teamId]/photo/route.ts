import { NextResponse } from "next/server"
import { getLatestSession, submitPhotoAnswer } from "@/lib/supabase/game-actions"
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

    const session = await getLatestSession()
    if (!session) {
      return NextResponse.json({ error: "활성 세션이 없습니다." }, { status: 404 })
    }

    // 일시정지 중에는 제출 차단
    if (session.paused_at) {
      return NextResponse.json({ isCorrect: false, score: 0, reason: "일시정지 중입니다.", paused: true })
    }

    const result = await submitPhotoAnswer(
      session.id,
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
