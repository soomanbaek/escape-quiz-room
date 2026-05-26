"use server"

// Supabase 게임 액션 - DB 연동
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { SAMPLE_QUESTIONS, TEAM_NAMES, PHOTO_PASS_THRESHOLD } from "../game-data"
import { judgePhoto } from "../anthropic/photo-judge"

// 팀원 접속 활성 판정 시간 (이 시간 내 하트비트가 있으면 접속 중)
const ACTIVE_WINDOW_MS = 15000

// ─── In-memory cache (Vercel warm instance 재사용 최적화) ─────────────────────
// 서버리스 환경에서 같은 인스턴스가 여러 요청을 처리할 때 DB 쿼리를 줄여줍니다.
type SessionRow = { id: string; is_started: boolean; start_time: string | null }
let _session: SessionRow | null = null
let _sessionExp = 0

// 세션-문제 캐시: key = `${sessionId}-${questionNumber}`
const _questionCache = new Map<string, Record<string, unknown>>()

// 팀별 멤버 수 캐시
let _memberCountsCache: { counts: Record<number, number>; sessionId: string; exp: number } | null = null

function bustSessionCache() {
  _session = null
  _sessionExp = 0
}

function bustAllCaches(sessionId?: string) {
  bustSessionCache()
  if (sessionId) {
    for (const key of _questionCache.keys()) {
      if (key.startsWith(sessionId + "-")) _questionCache.delete(key)
    }
  } else {
    _questionCache.clear()
  }
  _memberCountsCache = null
}
// ─────────────────────────────────────────────────────────────────────────────

// Supabase 클라이언트 생성 (서버 사이드용)
function createClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// 세션 ID만 빠르게 조회 (auto-create 없음 — heartbeat/join 전용, 5s 캐시)
export async function getLatestSession() {
  if (_session && Date.now() < _sessionExp) return _session
  const supabase = createClient()
  const { data } = await supabase
    .from("game_sessions")
    .select("id, is_started, start_time")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (data) { _session = data; _sessionExp = Date.now() + 5000 }
  return data
}

// 팀 페이지 GET에 필요한 모든 데이터를 최소 쿼리로 조회
export async function getTeamPageData(teamId: number) {
  const session = await getOrCreateGameSession()
  const supabase = createClient()

  // 팀 정보만 조회 (멤버 수는 팀 화면에서 미사용 → 쿼리 제거)
  const { data: team } = await supabase
    .from("teams").select("*").eq("session_id", session.id).eq("team_id", teamId).single()

  if (!team) return null

  // 문제는 세션 동안 변하지 않으므로 캐시 활용
  const qKey = `${session.id}-${team.current_question}`
  let question = _questionCache.get(qKey) ?? null
  if (!question) {
    const { data: q } = await supabase
      .from("questions")
      .select("*")
      .eq("session_id", session.id)
      .eq("question_number", team.current_question)
      .single()
    if (q) { question = q; _questionCache.set(qKey, q) }
  }

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
    team: transformTeam(team),
    currentQuestion: question ? {
      id: question.question_number,
      type: (question.type || "text") as "text" | "qr" | "photo",
      question: question.question,
      hint: question.hint,
      imageUrl: question.image_url || undefined,
    } : null,
    finishedTeams
  }
}

// 현재 활성 게임 세션 가져오기 (없으면 생성, 5s 캐시)
export async function getOrCreateGameSession() {
  if (_session && Date.now() < _sessionExp) return _session
  const supabase = createClient()

  const { data: sessions } = await supabase
    .from("game_sessions")
    .select("id, is_started, start_time, created_at")
    .order("created_at", { ascending: false })
    .limit(1)

  if (sessions && sessions.length > 0) {
    _session = sessions[0]
    _sessionExp = Date.now() + 5000
    return sessions[0]
  }

  // 새 세션 생성 (최초 1회만 실행됨)
  const { data: newSession, error } = await supabase
    .from("game_sessions")
    .insert({ is_started: false })
    .select()
    .single()

  if (error) throw error

  await initializeGameData(newSession.id)
  bustSessionCache()
  return newSession
}

// 게임 데이터 초기화 (문제, 팀)
async function initializeGameData(sessionId: string) {
  const supabase = createClient()
  
  // 샘플 문제 추가 (type 컬럼이 없는 환경에도 대응)
  const questionsToInsert = SAMPLE_QUESTIONS.map(q => ({
    session_id: sessionId,
    question_number: q.id,
    type: q.type,
    question: q.question,
    hint: q.hint,
    answer: q.answer,
    image_url: q.imageUrl || null,
  }))

  const { error: insertError } = await supabase.from("questions").insert(questionsToInsert)
  if (insertError) {
    // type 컬럼 없는 경우 fallback: type 제외하고 재시도
    const questionsWithoutType = SAMPLE_QUESTIONS.map(q => ({
      session_id: sessionId,
      question_number: q.id,
      question: q.question,
      hint: q.hint,
      answer: q.answer,
      image_url: q.imageUrl || null,
    }))
    await supabase.from("questions").insert(questionsWithoutType)
  }
  
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

// 세션 내 팀별 활성 접속 인원 수 집계 (3s 캐시)
export async function getActiveMemberCounts(sessionId: string): Promise<Record<number, number>> {
  if (_memberCountsCache && _memberCountsCache.sessionId === sessionId && Date.now() < _memberCountsCache.exp) {
    return _memberCountsCache.counts
  }
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
  _memberCountsCache = { counts, sessionId, exp: Date.now() + 3000 }
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

  await supabase
    .from("game_sessions")
    .update({ is_started: true, start_time: now })
    .eq("id", session.id)

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

  bustSessionCache()  // is_started 변경됨
  return getGameState()
}

// 게임 종료 (세션/데이터 유지, is_started만 false로)
export async function endGame() {
  const supabase = createClient()
  const session = await getOrCreateGameSession()
  const now = new Date().toISOString()

  await supabase
    .from("game_sessions")
    .update({ is_started: false })
    .eq("id", session.id)

  // 미완료 팀에도 종료 시각 기록 (시간 보존용)
  await supabase
    .from("teams")
    .update({ end_time: now })
    .eq("session_id", session.id)
    .eq("is_finished", false)
    .is("end_time", null)

  bustSessionCache()
  return getGameState()
}

// 게임 리셋
export async function resetGame() {
  const supabase = createClient()

  const { data: newSession, error } = await supabase
    .from("game_sessions")
    .insert({ is_started: false })
    .select()
    .single()

  if (error) throw error

  await initializeGameData(newSession.id)
  bustAllCaches()  // 새 세션 ID, 모든 캐시 무효화
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

// 힌트 사용 (낙관적 잠금으로 멀티 디바이스 중복 적용 방지)
export async function useHint(sessionId: string, teamId: number) {
  const supabase = createClient()

  const { data: team } = await supabase
    .from("teams")
    .select("hints_used, penalty_seconds")
    .eq("session_id", sessionId)
    .eq("team_id", teamId)
    .single()

  if (!team) return false

  // WHERE hints_used = 현재값 조건으로 동시 요청 중 하나만 반영됨
  const { data: updated } = await supabase
    .from("teams")
    .update({
      hints_used: team.hints_used + 1,
      penalty_seconds: team.penalty_seconds + 30
    })
    .eq("session_id", sessionId)
    .eq("team_id", teamId)
    .eq("hints_used", team.hints_used)
    .select("hints_used")
    .maybeSingle()

  return !!updated
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

// 개인별 정답 기록 저장
async function recordCorrectAnswer(
  sessionId: string, teamId: number, deviceId: string,
  nickname: string | null, questionNumber: number
) {
  if (!deviceId) return
  const supabase = createClient()
  await supabase.from("answer_submissions").insert({
    session_id: sessionId,
    team_id: teamId,
    device_id: deviceId,
    nickname: nickname || null,
    question_number: questionNumber,
  }).then(() => {})  // 테이블 없어도 게임에 영향 없음
}

// 개인 통계 조회
export async function getMemberStats(sessionId: string, startTimeMs: number | null) {
  const supabase = createClient()
  const { data: submissions } = await supabase
    .from("answer_submissions")
    .select("device_id, nickname, team_id, question_number, submitted_at")
    .eq("session_id", sessionId)
    .order("submitted_at", { ascending: true })

  if (!submissions?.length) return []

  const map = new Map<string, {
    nickname: string | null
    teamId: number
    count: number
    firstAt: number
    lastAt: number
  }>()

  for (const s of submissions) {
    const t = new Date(s.submitted_at).getTime()
    if (!map.has(s.device_id)) {
      map.set(s.device_id, { nickname: s.nickname, teamId: s.team_id, count: 0, firstAt: t, lastAt: t })
    }
    const e = map.get(s.device_id)!
    e.count++
    e.lastAt = t
    if (s.nickname) e.nickname = s.nickname
  }

  const gameStart = startTimeMs || 0
  return Array.from(map.entries())
    .map(([deviceId, e]) => ({
      deviceId,
      nickname: e.nickname || `익명-${deviceId.slice(-4)}`,
      teamId: e.teamId,
      count: e.count,
      firstAnswerSec: gameStart ? Math.round((e.firstAt - gameStart) / 1000) : null,
      lastAnswerSec: gameStart ? Math.round((e.lastAt - gameStart) / 1000) : null,
    }))
    .sort((a, b) => b.count - a.count || (a.lastAnswerSec ?? 0) - (b.lastAnswerSec ?? 0))
}

// 정답 제출 (text / qr)
export async function submitAnswer(
  sessionId: string, teamId: number, answer: string,
  totalQuestions: number, deviceId?: string, nickname?: string
) {
  const supabase = createClient()

  const { data: team } = await supabase
    .from("teams")
    .select("current_question, is_finished")
    .eq("session_id", sessionId)
    .eq("team_id", teamId)
    .single()

  if (!team || team.is_finished) return { isCorrect: false }

  const { data: question } = await supabase
    .from("questions")
    .select("answer")
    .eq("session_id", sessionId)
    .eq("question_number", team.current_question)
    .single()

  if (!question) return { isCorrect: false }

  const isCorrect = answer.toLowerCase().trim() === question.answer.toLowerCase().trim()

  if (isCorrect) {
    await Promise.all([
      advanceTeam(sessionId, teamId, team.current_question, totalQuestions),
      recordCorrectAnswer(sessionId, teamId, deviceId || "", nickname || null, team.current_question),
    ])
  }

  return { isCorrect }
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

  return { isCorrect, score, reason }
}

// 플레이어 등록
export async function registerPlayer(sessionId: string, teamId: number, playerSessionId: string) {
  const supabase = createClient()

  const { data: team } = await supabase
    .from("teams")
    .select("has_player, player_session_id")
    .eq("session_id", sessionId)
    .eq("team_id", teamId)
    .single()

  if (!team) return { success: false }

  if (team.has_player && team.player_session_id !== playerSessionId) {
    return { success: false }
  }

  if (team.player_session_id === playerSessionId) {
    return { success: true }
  }

  await supabase
    .from("teams")
    .update({ has_player: true, player_session_id: playerSessionId })
    .eq("session_id", sessionId)
    .eq("team_id", teamId)

  return { success: true }
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

// 닉네임 자격 증명 검증
export async function validateNickname(nickname: string): Promise<{ teamId: number } | null> {
  if (!nickname.trim()) return null
  const supabase = createClient()
  const { data } = await supabase
    .from("nickname_credentials")
    .select("team_id")
    .eq("nickname", nickname.trim())
    .maybeSingle()
  if (!data) return null
  return { teamId: data.team_id }
}

// 닉네임 목록 조회 (관리자용)
export async function getNicknameList(): Promise<Array<{ id: number; nickname: string; teamId: number }>> {
  const supabase = createClient()
  const { data } = await supabase
    .from("nickname_credentials")
    .select("id, nickname, team_id")
    .order("team_id", { ascending: true })
    .order("nickname", { ascending: true })
  return (data || []).map(r => ({ id: r.id, nickname: r.nickname, teamId: r.team_id }))
}

// 닉네임 추가 (관리자용)
export async function addNickname(nickname: string, teamId: number): Promise<{ success: boolean; error?: string }> {
  if (!nickname.trim()) return { success: false, error: "닉네임을 입력하세요" }
  const supabase = createClient()
  const { error } = await supabase
    .from("nickname_credentials")
    .insert({ nickname: nickname.trim(), team_id: teamId })
  if (error) return { success: false, error: error.code === "23505" ? "이미 존재하는 닉네임입니다" : error.message }
  return { success: true }
}

// 닉네임 삭제 (관리자용)
export async function deleteNickname(id: number): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from("nickname_credentials")
    .delete()
    .eq("id", id)
  return !error
}

// 닉네임 수정 (관리자용)
export async function updateNickname(id: number, newNickname: string, newTeamId: number): Promise<{ success: boolean; error?: string }> {
  if (!newNickname.trim()) return { success: false, error: "닉네임을 입력하세요" }
  const supabase = createClient()
  const { error } = await supabase
    .from("nickname_credentials")
    .update({ nickname: newNickname.trim(), team_id: newTeamId })
    .eq("id", id)
  if (error) return { success: false, error: error.code === "23505" ? "이미 존재하는 닉네임입니다" : error.message }
  return { success: true }
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
