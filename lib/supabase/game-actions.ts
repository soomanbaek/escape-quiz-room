"use server"

// Supabase 게임 액션 - DB 연동
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { SAMPLE_QUESTIONS, TEAM_NAMES, PHOTO_PASS_THRESHOLD } from "../game-data"
import { judgePhoto } from "../anthropic/photo-judge"

// 팀원 접속 활성 판정 시간 (이 시간 내 하트비트가 있으면 접속 중)
const ACTIVE_WINDOW_MS = 15000

// Supabase 클라이언트 생성 (서버 사이드용)
function createClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// 세션 ID만 빠르게 조회 (auto-create 없음 — heartbeat/join 전용)
export async function getLatestSession() {
  const supabase = createClient()
  const { data } = await supabase
    .from("game_sessions")
    .select("id, is_started, start_time")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

// 팀 페이지 GET에 필요한 모든 데이터를 최소 쿼리로 조회
export async function getTeamPageData(teamId: number) {
  const session = await getOrCreateGameSession()
  const supabase = createClient()
  const since = new Date(Date.now() - ACTIVE_WINDOW_MS).toISOString()

  // 팀 정보 + 멤버 수 병렬 조회
  const [{ data: team }, { count: memberCount }] = await Promise.all([
    supabase.from("teams").select("*").eq("session_id", session.id).eq("team_id", teamId).single(),
    supabase.from("team_members").select("*", { count: "exact", head: true })
      .eq("session_id", session.id).eq("team_id", teamId).gte("last_seen", since)
  ])

  if (!team) return null

  const { data: question } = await supabase
    .from("questions")
    .select("question_number, type, question, hint")
    .eq("session_id", session.id)
    .eq("question_number", team.current_question)
    .single()

  let finishedTeams: { teamId: number; teamName: string; endTime: number | null; penaltySeconds: number }[] | null = null
  if (team.is_finished) {
    const { data: ft } = await supabase
      .from("teams")
      .select("team_id, team_name, end_time, penalty_seconds")
      .eq("session_id", session.id)
      .eq("is_finished", true)
    finishedTeams = (ft || []).map(t => ({
      teamId: t.team_id,
      teamName: t.team_name,
      endTime: t.end_time ? new Date(t.end_time).getTime() : null,
      penaltySeconds: t.penalty_seconds
    }))
  }

  return {
    sessionId: session.id,
    isStarted: session.is_started,
    startTime: session.start_time ? new Date(session.start_time).getTime() : null,
    team: { ...transformTeam(team), memberCount: memberCount || 0 },
    currentQuestion: question ? {
      id: question.question_number,
      type: (question.type || "text") as "text" | "qr" | "photo",
      question: question.question,
      hint: question.hint
    } : null,
    finishedTeams
  }
}

// 현재 활성 게임 세션 가져오기 (없으면 생성)
export async function getOrCreateGameSession() {
  const supabase = createClient()

  // 가장 최근 세션 가져오기
  const { data: sessions } = await supabase
    .from("game_sessions")
    .select("id, is_started, start_time, created_at")
    .order("created_at", { ascending: false })
    .limit(1)
  
  if (sessions && sessions.length > 0) {
    return sessions[0]
  }
  
  // 새 세션 생성
  const { data: newSession, error } = await supabase
    .from("game_sessions")
    .insert({ is_started: false })
    .select()
    .single()
  
  if (error) throw error
  
  // 기본 문제 및 팀 생성
  await initializeGameData(newSession.id)
  
  return newSession
}

// 게임 데이터 초기화 (문제, 팀)
async function initializeGameData(sessionId: string) {
  const supabase = createClient()
  
  // 샘플 문제 추가
  const questionsToInsert = SAMPLE_QUESTIONS.map(q => ({
    session_id: sessionId,
    question_number: q.id,
    type: q.type,
    question: q.question,
    hint: q.hint,
    answer: q.answer
  }))
  
  await supabase.from("questions").insert(questionsToInsert)
  
  // 6개 팀 생성
  const teamsToInsert = TEAM_NAMES.map((name, index) => ({
    session_id: sessionId,
    team_id: index + 1,
    team_name: name,
    current_question: 1,
    hints_used: 0,
    penalty_seconds: 0,
    is_finished: false,
    has_player: false
  }))
  
  await supabase.from("teams").insert(teamsToInsert)
}

// DB 팀 데이터를 클라이언트 형식으로 변환
function transformTeam(team: {
  team_id: number
  team_name: string
  current_question: number
  hints_used: number
  penalty_seconds: number
  start_time: string | null
  end_time: string | null
  is_finished: boolean
  has_player: boolean
  player_session_id: string | null
}) {
  return {
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
  }
}

// 전체 게임 상태 가져오기
export async function getGameState() {
  const supabase = createClient()
  
  const session = await getOrCreateGameSession()
  
  const { data: teams } = await supabase
    .from("teams")
    .select("*")
    .eq("session_id", session.id)
    .order("team_id", { ascending: true })

  const memberCounts = await getActiveMemberCounts(session.id)

  return {
    sessionId: session.id,
    isStarted: session.is_started,
    startTime: session.start_time ? new Date(session.start_time).getTime() : null,
    teams: (teams || []).map(t => ({
      ...transformTeam(t),
      memberCount: memberCounts[t.team_id] || 0
    }))
  }
}

// 세션 내 팀별 활성 접속 인원 수 집계
export async function getActiveMemberCounts(sessionId: string): Promise<Record<number, number>> {
  const supabase = createClient()
  const since = new Date(Date.now() - ACTIVE_WINDOW_MS).toISOString()

  const { data } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("session_id", sessionId)
    .gte("last_seen", since)

  const counts: Record<number, number> = {}
  for (const row of data || []) {
    counts[row.team_id] = (counts[row.team_id] || 0) + 1
  }
  return counts
}

// 특정 팀의 활성 접속 인원 수 (COUNT 쿼리로 최적화)
export async function getActiveMemberCount(sessionId: string, teamId: number): Promise<number> {
  const supabase = createClient()
  const since = new Date(Date.now() - ACTIVE_WINDOW_MS).toISOString()
  const { count } = await supabase
    .from("team_members")
    .select("*", { count: "exact", head: true })
    .eq("session_id", sessionId)
    .eq("team_id", teamId)
    .gte("last_seen", since)
  return count || 0
}

// 팀 입장 (멀티 디바이스 - 누구나 입장 가능)
export async function joinTeam(sessionId: string, teamId: number, deviceId: string, nickname: string) {
  const supabase = createClient()
  if (!deviceId) return { success: false }

  await supabase
    .from("team_members")
    .upsert(
      {
        session_id: sessionId,
        team_id: teamId,
        device_id: deviceId,
        nickname: nickname?.trim() || null,
        last_seen: new Date().toISOString(),
      },
      { onConflict: "session_id,team_id,device_id" }
    )

  return { success: true }
}

// 하트비트 (접속 유지)
export async function heartbeat(sessionId: string, teamId: number, deviceId: string) {
  const supabase = createClient()
  if (!deviceId) return false

  await supabase
    .from("team_members")
    .update({ last_seen: new Date().toISOString() })
    .eq("session_id", sessionId)
    .eq("team_id", teamId)
    .eq("device_id", deviceId)

  return true
}

// 게임 시작
export async function startGame() {
  const supabase = createClient()
  
  const session = await getOrCreateGameSession()
  const now = new Date().toISOString()
  
  // 세션 업데이트
  await supabase
    .from("game_sessions")
    .update({ is_started: true, start_time: now })
    .eq("id", session.id)
  
  // 모든 팀 초기화 및 시작 시간 설정
  await supabase
    .from("teams")
    .update({
      start_time: now,
      current_question: 1,
      hints_used: 0,
      penalty_seconds: 0,
      end_time: null,
      is_finished: false,
      has_player: false,
      player_session_id: null
    })
    .eq("session_id", session.id)
  
  return getGameState()
}

// 게임 리셋
export async function resetGame() {
  const supabase = createClient()
  
  // 새 세션 생성
  const { data: newSession, error } = await supabase
    .from("game_sessions")
    .insert({ is_started: false })
    .select()
    .single()
  
  if (error) throw error
  
  await initializeGameData(newSession.id)
  
  return getGameState()
}

// 팀 상태 가져오기
export async function getTeamState(sessionId: string, teamId: number) {
  const supabase = createClient()
  
  const { data: team } = await supabase
    .from("teams")
    .select("*")
    .eq("session_id", sessionId)
    .eq("team_id", teamId)
    .single()
  
  return team
}

// 현재 문제 가져오기
export async function getCurrentQuestion(sessionId: string, questionNumber: number) {
  const supabase = createClient()
  
  const { data: question } = await supabase
    .from("questions")
    .select("*")
    .eq("session_id", sessionId)
    .eq("question_number", questionNumber)
    .single()
  
  return question
}

// 힌트 사용
export async function useHint(sessionId: string, teamId: number) {
  const supabase = createClient()
  
  const team = await getTeamState(sessionId, teamId)
  if (!team) return null
  
  await supabase
    .from("teams")
    .update({
      hints_used: team.hints_used + 1,
      penalty_seconds: team.penalty_seconds + 30
    })
    .eq("session_id", sessionId)
    .eq("team_id", teamId)
  
  return getTeamState(sessionId, teamId)
}

// 정답 처리 후 다음 문제로 진행 (또는 탈출 완료)
async function advanceTeam(sessionId: string, teamId: number, currentQuestion: number, totalQuestions: number) {
  const supabase = createClient()

  if (currentQuestion >= totalQuestions) {
    // 탈출 완료
    await supabase
      .from("teams")
      .update({
        is_finished: true,
        end_time: new Date().toISOString()
      })
      .eq("session_id", sessionId)
      .eq("team_id", teamId)
  } else {
    // 다음 문제로
    await supabase
      .from("teams")
      .update({
        current_question: currentQuestion + 1
      })
      .eq("session_id", sessionId)
      .eq("team_id", teamId)
  }
}

// 정답 제출 (text / qr)
export async function submitAnswer(sessionId: string, teamId: number, answer: string, totalQuestions: number) {
  const team = await getTeamState(sessionId, teamId)
  if (!team || team.is_finished) return { team, isCorrect: false }

  const question = await getCurrentQuestion(sessionId, team.current_question)
  if (!question) return { team, isCorrect: false }

  const isCorrect = answer.toLowerCase().trim() === question.answer.toLowerCase().trim()

  if (isCorrect) {
    await advanceTeam(sessionId, teamId, team.current_question, totalQuestions)
  }

  const updatedTeam = await getTeamState(sessionId, teamId)
  return { team: updatedTeam, isCorrect }
}

// 사진 미션 제출 (Claude 비전 채점)
export async function submitPhotoAnswer(
  sessionId: string,
  teamId: number,
  imageBase64: string,
  mediaType: string,
  totalQuestions: number
) {
  const team = await getTeamState(sessionId, teamId)
  if (!team || team.is_finished) {
    return { team, isCorrect: false, score: 0, reason: "이미 완료된 팀입니다." }
  }

  const question = await getCurrentQuestion(sessionId, team.current_question)
  if (!question) {
    return { team, isCorrect: false, score: 0, reason: "문제를 찾을 수 없습니다." }
  }
  if (question.type !== "photo") {
    return { team, isCorrect: false, score: 0, reason: "사진 문제가 아닙니다." }
  }

  const { score, reason } = await judgePhoto(question.answer, imageBase64, mediaType)
  const isCorrect = score >= PHOTO_PASS_THRESHOLD

  if (isCorrect) {
    await advanceTeam(sessionId, teamId, team.current_question, totalQuestions)
  }

  const updatedTeam = await getTeamState(sessionId, teamId)
  return { team: updatedTeam, isCorrect, score, reason }
}

// 플레이어 등록
export async function registerPlayer(sessionId: string, teamId: number, playerSessionId: string) {
  const supabase = createClient()
  
  const team = await getTeamState(sessionId, teamId)
  if (!team) return { success: false }
  
  // 이미 플레이어가 있고 다른 세션이면 실패
  if (team.has_player && team.player_session_id !== playerSessionId) {
    return { success: false, team }
  }
  
  // 같은 세션이면 성공 (재접속)
  if (team.player_session_id === playerSessionId) {
    return { success: true, team }
  }
  
  // 새 플레이어 등록
  await supabase
    .from("teams")
    .update({
      has_player: true,
      player_session_id: playerSessionId
    })
    .eq("session_id", sessionId)
    .eq("team_id", teamId)
  
  const updatedTeam = await getTeamState(sessionId, teamId)
  return { success: true, team: updatedTeam }
}

// 팀 접속 세션 강제 초기화 (어드민용) - 모든 팀원 접속 해제
export async function resetTeamPlayer(sessionId: string, teamId: number) {
  const supabase = createClient()

  await supabase
    .from("team_members")
    .delete()
    .eq("session_id", sessionId)
    .eq("team_id", teamId)

  await supabase
    .from("teams")
    .update({ has_player: false, player_session_id: null })
    .eq("session_id", sessionId)
    .eq("team_id", teamId)

  return true
}

// 팀 이름 변경
export async function updateTeamName(sessionId: string, teamId: number, newName: string) {
  const supabase = createClient()

  const trimmed = newName.trim()
  if (!trimmed) return false

  await supabase
    .from("teams")
    .update({ team_name: trimmed })
    .eq("session_id", sessionId)
    .eq("team_id", teamId)

  return true
}

// 플레이어 해제
export async function unregisterPlayer(sessionId: string, teamId: number, playerSessionId: string) {
  const supabase = createClient()
  
  const team = await getTeamState(sessionId, teamId)
  if (!team || team.player_session_id !== playerSessionId) return false
  
  await supabase
    .from("teams")
    .update({
      has_player: false,
      player_session_id: null
    })
    .eq("session_id", sessionId)
    .eq("team_id", teamId)
  
  return true
}
