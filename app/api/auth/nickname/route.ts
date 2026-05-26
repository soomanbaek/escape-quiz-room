import { NextResponse } from "next/server"
import { validateNickname } from "@/lib/supabase/game-actions"

export async function POST(request: Request) {
  try {
    const { nickname } = await request.json()
    if (!nickname?.trim()) return NextResponse.json({ error: "닉네임을 입력하세요" }, { status: 400 })
    const result = await validateNickname(nickname)
    if (!result) return NextResponse.json({ error: "등록되지 않은 닉네임입니다" }, { status: 401 })
    return NextResponse.json({ teamId: result.teamId })
  } catch {
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 })
  }
}
