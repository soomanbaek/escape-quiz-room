import { NextResponse } from "next/server"
import { getNicknameList, addNickname, deleteNickname, updateNickname } from "@/lib/supabase/game-actions"

export async function GET() {
  try {
    const nicknames = await getNicknameList()
    return NextResponse.json({ nicknames })
  } catch {
    return NextResponse.json({ nicknames: [] })
  }
}

export async function POST(request: Request) {
  try {
    const { nickname, teamId } = await request.json()
    const result = await addNickname(nickname, parseInt(teamId))
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "서버 오류" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const { id, nickname, teamId } = await request.json()
    const result = await updateNickname(id, nickname, parseInt(teamId))
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "서버 오류" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json()
    await deleteNickname(id)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "서버 오류" }, { status: 500 })
  }
}
