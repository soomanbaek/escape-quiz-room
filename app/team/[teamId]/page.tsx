"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import Image from "next/image"
import useSWR from "swr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TOTAL_QUESTIONS, HINT_PENALTY_SECONDS, PASS_PENALTY_SECONDS, WRONG_ANSWER_DELAY_MS, computeElapsedMs } from "@/lib/game-data"
import { Clock, Lightbulb, Trophy, CheckCircle2, XCircle, Users, QrCode, Camera, X, Loader2, LogOut, Crown, Eye, Pause, SkipForward, ArrowUp, ArrowDown } from "lucide-react"

const CRED_NICKNAME_KEY = "escape_nickname"
const CRED_TEAM_KEY = "escape_team_id"

const fetcher = (url: string) => fetch(url).then(res => res.json())

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
}

function generateSessionId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

// 사진을 최대 1024px로 축소하고 JPEG base64로 변환
async function fileToResizedBase64(file: File, maxDim = 1024, quality = 0.8): Promise<{ data: string; mediaType: string }> {
  const bitmap = await createImageBitmap(file)
  let width = bitmap.width
  let height = bitmap.height
  if (width > maxDim || height > maxDim) {
    if (width >= height) {
      height = Math.round((height * maxDim) / width)
      width = maxDim
    } else {
      width = Math.round((width * maxDim) / height)
      height = maxDim
    }
  }
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")!
  ctx.drawImage(bitmap, 0, 0, width, height)
  const dataUrl = canvas.toDataURL("image/jpeg", quality)
  return { data: dataUrl.split(",")[1], mediaType: "image/jpeg" }
}

// QR 스캐너 모달
function QrScanner({ onResult, onClose }: { onResult: (text: string) => void; onClose: () => void }) {
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null)
  const lockRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    import("html5-qrcode").then(({ Html5Qrcode }) => {
      if (cancelled) return
      const scanner = new Html5Qrcode("qr-reader")
      scannerRef.current = scanner
      scanner
        .start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decodedText: string) => {
            if (lockRef.current) return
            lockRef.current = true
            onResult(decodedText)
          },
          () => {}
        )
        .catch(() => {})
    })
    return () => {
      cancelled = true
      const s = scannerRef.current
      if (s) {
        s.stop().then(() => s.clear()).catch(() => {})
        scannerRef.current = null
      }
    }
  }, [onResult])

  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-sm bg-card rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <QrCode className="w-5 h-5 text-primary" />
            QR 코드 스캔
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div id="qr-reader" className="w-full rounded-lg overflow-hidden bg-black" />
        <p className="text-sm text-muted-foreground text-center">QR 코드를 카메라에 비춰주세요</p>
      </div>
    </div>
  )
}

export default function TeamPlayPage() {
  const params = useParams()
  const router = useRouter()
  const teamId = params.teamId as string

  const [hasJoined, setHasJoined] = useState(false)
  const [role, setRole] = useState<"writer" | "reader" | null>(null)
  const [sessionId, setSessionId] = useState<string>("")
  const [nickname, setNickname] = useState<string>("")
  const [credChecked, setCredChecked] = useState(false)

  const { data, mutate } = useSWR(`/api/team/${teamId}`, fetcher, {
    refreshInterval: 2000
  })

  const [answer, setAnswer] = useState("")
  const [pendingRole, setPendingRole] = useState<"writer" | "reader" | null>(null)
  const [showWriterConfirm, setShowWriterConfirm] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const [feedback, setFeedback] = useState<{ type: "correct" | "incorrect" | null; message: string }>({ type: null, message: "" })
  const [elapsedTime, setElapsedTime] = useState(0)

  // QR / 사진 상태
  const [qrOpen, setQrOpen] = useState(false)
  const [photoLoading, setPhotoLoading] = useState(false)
  const [hintLoading, setHintLoading] = useState(false)
  const [photoResult, setPhotoResult] = useState<{ score: number; reason: string; isCorrect: boolean } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Animation states
  const [isShaking, setIsShaking] = useState(false)
  const [isFlashing, setIsFlashing] = useState(false)
  const [questionKey, setQuestionKey] = useState(0)
  const lastQuestionRef = useRef<number | null>(null)

  // 오답 후 재시도 잠금 (10초)
  const [wrongLockUntil, setWrongLockUntil] = useState(0)
  const [wrongRemaining, setWrongRemaining] = useState(0)

  // 문제 패쓰
  const [showPassConfirm, setShowPassConfirm] = useState(false)
  const [passLoading, setPassLoading] = useState(false)

  // 힌트 확인
  const [showHintConfirm, setShowHintConfirm] = useState(false)

  // 업/다운 힌트
  const [updownHint, setUpdownHint] = useState<{ guess: string; dir: "up" | "down" } | null>(null)

  const team = data?.team
  const currentQuestion = data?.currentQuestion
  const questionType: "text" | "qr" | "photo" | "updown" = currentQuestion?.type || "text"
  const isGameStarted = data?.isStarted
  const gameStartTime = data?.startTime
  const pausedAt: number | null = data?.pausedAt ?? null
  const totalPausedMs: number = data?.totalPausedMs ?? 0
  const isPaused = pausedAt !== null

  // 자격 증명 확인 + 세션 ID 초기화 + 자동 재입장
  useEffect(() => {
    const storedNickname = localStorage.getItem(CRED_NICKNAME_KEY)
    const storedTeamId = localStorage.getItem(CRED_TEAM_KEY)

    // 자격 증명 없으면 홈으로 리다이렉트
    if (!storedNickname || storedTeamId === null) {
      router.replace("/")
      return
    }

    // 다른 팀 자격 증명이면 홈으로 리다이렉트
    if (parseInt(storedTeamId) !== parseInt(teamId)) {
      router.replace("/")
      return
    }

    // 자격 증명 OK → 닉네임 세팅
    setNickname(storedNickname)
    setCredChecked(true)

    // 세션(디바이스) ID 초기화
    let sid = sessionStorage.getItem(`team-${teamId}-session`)
    if (!sid) {
      sid = generateSessionId()
      sessionStorage.setItem(`team-${teamId}-session`, sid)
    }
    setSessionId(sid)

    // 이미 입장했던 디바이스면 자동 재입장
    const joined = sessionStorage.getItem(`team-${teamId}-joined`) === "1"
    const storedRole = sessionStorage.getItem(`team-${teamId}-role`) as "writer" | "reader" | null
    if (joined && storedRole) {
      setRole(storedRole)
      setHasJoined(true)
      fetch(`/api/team/${teamId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join", sessionId: sid, nickname: storedNickname })
      }).catch(() => {})
    }
  }, [teamId, router])

  // 하트비트 (접속 유지)
  useEffect(() => {
    if (!hasJoined || !sessionId) return
    const send = () => {
      fetch(`/api/team/${teamId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "heartbeat", sessionId })
      }).catch(() => {})
    }
    send()
    const interval = setInterval(send, 5000)
    return () => clearInterval(interval)
  }, [hasJoined, sessionId, teamId])

  // 타이머 (일시정지 중에는 정지 시점 기준으로 고정)
  useEffect(() => {
    if (!isGameStarted || !gameStartTime || team?.isFinished) return
    if (isPaused) {
      setElapsedTime(computeElapsedMs(gameStartTime, pausedAt!, totalPausedMs))
      return
    }
    setElapsedTime(computeElapsedMs(gameStartTime, Date.now(), totalPausedMs))
    const interval = setInterval(() => {
      setElapsedTime(computeElapsedMs(gameStartTime, Date.now(), totalPausedMs))
    }, 100)
    return () => clearInterval(interval)
  }, [isGameStarted, gameStartTime, team?.isFinished, isPaused, pausedAt, totalPausedMs])

  // 문제 변경 감지 → 카드 애니메이션 + 입력 상태 초기화
  useEffect(() => {
    const q = team?.currentQuestion
    if (q === undefined) return
    if (lastQuestionRef.current !== null && lastQuestionRef.current !== q) {
      setQuestionKey(k => k + 1)
      setShowHint(false)
      setPhotoResult(null)
      setAnswer("")
      setWrongLockUntil(0)
      setWrongRemaining(0)
      setUpdownHint(null)
    }
    lastQuestionRef.current = q
  }, [team?.currentQuestion])

  // 오답 잠금 카운트다운
  useEffect(() => {
    if (wrongLockUntil <= 0) {
      setWrongRemaining(0)
      return
    }
    const tick = () => {
      const left = Math.max(0, wrongLockUntil - Date.now())
      setWrongRemaining(Math.ceil(left / 1000))
      if (left <= 0) setWrongLockUntil(0)
    }
    tick()
    const interval = setInterval(tick, 200)
    return () => clearInterval(interval)
  }, [wrongLockUntil])

  // 팀 입장 (역할 선택)
  const handleJoinAs = useCallback(async (selectedRole: "writer" | "reader") => {
    if (!sessionId) return
    if (selectedRole === "writer") {
      const res = await fetch(`/api/team/${teamId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "register", sessionId, nickname })
      })
      const result = await res.json().catch(() => ({ success: false }))
      if (!result.success) {
        // 이미 다른 참여자가 슬롯을 차지함
        setPendingRole(null)
        mutate()
        alert("이미 다른 참여자가 입장했습니다. 뷰어로 참여해주세요.")
        return
      }
    }
    await fetch(`/api/team/${teamId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "join", sessionId, nickname })
    })
    sessionStorage.setItem(`team-${teamId}-joined`, "1")
    sessionStorage.setItem(`team-${teamId}-role`, selectedRole)
    setRole(selectedRole)
    setHasJoined(true)
  }, [teamId, sessionId, nickname, mutate])

  // 정답 제출 (text / qr / updown 공용)
  const submitValue = useCallback(async (value: string) => {
    if (!value.trim() || !hasJoined || isPaused) return
    if (Date.now() < wrongLockUntil) return
    const res = await fetch(`/api/team/${teamId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "submit", answer: value, sessionId, nickname })
    })
    const result = await res.json()

    if (result.isCorrect) {
      setIsFlashing(true)
      setFeedback({ type: "correct", message: "정답입니다!" })
      setAnswer("")
      setShowHint(false)
      setUpdownHint(null)
      setTimeout(() => {
        setIsFlashing(false)
        setFeedback({ type: null, message: "" })
      }, 1500)
    } else if (result.hint === "up" || result.hint === "down") {
      // 업다운 문제: 잠금/흔들기 없이 힌트만 표시
      setUpdownHint({ guess: value.trim(), dir: result.hint })
      setAnswer("")
    } else {
      setIsShaking(true)
      setWrongLockUntil(Date.now() + WRONG_ANSWER_DELAY_MS)
      setFeedback({ type: "incorrect", message: "오답입니다. 잠시 후 다시 시도해주세요." })
      setTimeout(() => setFeedback({ type: null, message: "" }), 2000)
    }
    mutate()
  }, [teamId, hasJoined, isPaused, wrongLockUntil, sessionId, nickname, mutate])

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    submitValue(answer)
  }, [answer, submitValue])

  const handleQrResult = useCallback((text: string) => {
    setQrOpen(false)
    submitValue(text)
  }, [submitValue])

  // 사진 제출 (Claude 채점)
  const handlePhotoChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file || !hasJoined || isPaused) return
    setPhotoLoading(true)
    setPhotoResult(null)
    try {
      const { data: imgData, mediaType } = await fileToResizedBase64(file)
      const res = await fetch(`/api/team/${teamId}/photo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imgData, mediaType })
      })
      const result = await res.json()
      setPhotoResult({ score: result.score ?? 0, reason: result.reason ?? "", isCorrect: !!result.isCorrect })
      if (result.isCorrect) {
        setIsFlashing(true)
        setTimeout(() => setIsFlashing(false), 1500)
      }
      mutate()
    } catch {
      setPhotoResult({ score: 0, reason: "사진 처리 중 오류가 발생했습니다.", isCorrect: false })
    } finally {
      setPhotoLoading(false)
    }
  }, [teamId, hasJoined, isPaused, mutate])

  // 문제 패쓰 (5분 패널티)
  const handlePass = useCallback(async () => {
    if (!hasJoined || passLoading || isPaused) return
    setPassLoading(true)
    try {
      const res = await fetch(`/api/team/${teamId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pass" })
      })
      const result = await res.json().catch(() => ({ success: false }))
      if (!result.success) {
        alert(result.paused ? "일시정지 중에는 패쓰할 수 없습니다." : "패쓰에 실패했습니다. 다시 시도해주세요.")
      } else {
        setShowPassConfirm(false)
        setWrongLockUntil(0)
      }
      mutate()
    } finally {
      setPassLoading(false)
    }
  }, [teamId, hasJoined, isPaused, passLoading, mutate])

  // 힌트 사용
  const handleUseHint = useCallback(async () => {
    if (!hasJoined || hintLoading) return
    setHintLoading(true)
    await fetch(`/api/team/${teamId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "hint" })
    })
    setShowHint(true)
    mutate()
    setHintLoading(false)
  }, [teamId, hasJoined, mutate, hintLoading])

  if (!credChecked || !team) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  const totalTime = team.isFinished && team.endTime && gameStartTime
    ? computeElapsedMs(gameStartTime, team.endTime, totalPausedMs) + (team.penaltySeconds * 1000)
    : elapsedTime + (team.penaltySeconds * 1000)

  const handleChangeNickname = () => {
    localStorage.removeItem(CRED_NICKNAME_KEY)
    localStorage.removeItem(CRED_TEAM_KEY)
    sessionStorage.removeItem(`team-${teamId}-joined`)
    router.replace("/")
  }

  // 입장 화면 (역할 선택)
  if (!hasJoined) {
    const isWriterTaken = team.hasPlayer && team.playerSessionId !== sessionId
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-escape pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-primary/5 blur-3xl pointer-events-none" />
        <Card className="w-full max-w-sm border-border/50 animate-fade-in-up relative z-10">
          <CardHeader className="text-center pb-2">
            <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mb-4 animate-float">
              <Users className="w-10 h-10 text-primary" />
            </div>
            <CardTitle className="text-3xl font-bold">Team {team.teamName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="h-12 flex items-center justify-center rounded-md bg-secondary border border-border text-foreground font-medium">
              {nickname}
            </div>
            <p className="text-sm text-muted-foreground text-center">역할을 선택하세요</p>
            <button
              onClick={() => !isWriterTaken && setPendingRole("writer")}
              disabled={!!isWriterTaken}
              className={`w-full h-16 rounded-lg border-2 flex items-center px-4 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                pendingRole === "writer"
                  ? "border-primary bg-primary/10 shadow-[0_0_16px_oklch(0.75_0.18_145_/_0.25)]"
                  : "border-border/60 hover:border-primary/40"
              }`}
            >
              <Crown className={`w-5 h-5 mr-2.5 ${pendingRole === "writer" ? "text-primary" : "text-muted-foreground"}`} />
              <span className="flex flex-col items-start leading-tight text-left">
                <span className="text-lg font-medium text-foreground">참여자</span>
                <span className="text-xs text-muted-foreground font-normal">{isWriterTaken ? "이미 선택됨 (1명만 가능)" : "정답 제출 가능 · 1명만"}</span>
              </span>
              {pendingRole === "writer" && <CheckCircle2 className="w-5 h-5 text-primary ml-auto" />}
            </button>
            <button
              onClick={() => setPendingRole("reader")}
              className={`w-full h-14 rounded-lg border-2 flex items-center px-4 transition-all duration-200 ${
                pendingRole === "reader"
                  ? "border-primary bg-primary/10"
                  : "border-border/60 hover:border-primary/40"
              }`}
            >
              <Eye className={`w-5 h-5 mr-2.5 ${pendingRole === "reader" ? "text-primary" : "text-muted-foreground"}`} />
              <span className="flex flex-col items-start leading-tight text-left">
                <span className="text-lg font-medium text-foreground">뷰어</span>
                <span className="text-xs text-muted-foreground font-normal">관람만 가능</span>
              </span>
              {pendingRole === "reader" && <CheckCircle2 className="w-5 h-5 text-primary ml-auto" />}
            </button>
            <Button
              onClick={() => {
                if (!pendingRole) return
                if (pendingRole === "writer") setShowWriterConfirm(true)
                else handleJoinAs("reader")
              }}
              disabled={!pendingRole}
              className="w-full h-12 text-base bg-primary hover:bg-primary/90 transition-all duration-300 disabled:opacity-40"
            >
              확인
            </Button>
            <button
              onClick={handleChangeNickname}
              className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              다른 닉네임으로 입장
            </button>
          </CardContent>
        </Card>

        {/* 참여자 입장 확인 팝업 */}
        {showWriterConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setShowWriterConfirm(false)}>
            <Card className="w-full max-w-xs border-primary/30 animate-fade-in-up" onClick={e => e.stopPropagation()}>
              <CardContent className="p-6 text-center space-y-4">
                <div className="w-14 h-14 mx-auto rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Crown className="w-7 h-7 text-primary" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-lg font-bold text-foreground">참여자로 입장</h3>
                  <p className="text-sm text-muted-foreground">
                    정답을 제출하는 참여자는 팀당 <span className="text-foreground font-semibold">1명만</span> 접속할 수 있습니다.<br />
                    참여자로 입장하시겠습니까?
                  </p>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    onClick={() => setShowWriterConfirm(false)}
                    className="flex-1 h-11 border-border/60"
                  >
                    취소
                  </Button>
                  <Button
                    onClick={() => { setShowWriterConfirm(false); handleJoinAs("writer") }}
                    className="flex-1 h-11 bg-primary hover:bg-primary/90"
                  >
                    확인
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    )
  }

  // 게임 종료 화면
  if (!isGameStarted && gameStartTime) {
    const finishTime = team.endTime
      ? computeElapsedMs(gameStartTime, team.endTime, totalPausedMs) + (team.penaltySeconds * 1000)
      : totalTime
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-escape pointer-events-none" />
        <Card className="w-full max-w-lg border-border/50 animate-fade-in-up relative z-10">
          <CardContent className="p-8 text-center space-y-6">
            <div className="w-24 h-24 mx-auto rounded-full bg-secondary flex items-center justify-center">
              <Trophy className="w-12 h-12 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-foreground mb-2">Team {team.teamName}</h2>
              <p className="text-xl text-muted-foreground">게임이 종료되었습니다</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-secondary/50 rounded-xl p-4 border border-border/50">
                <div className="text-sm text-muted-foreground mb-1">소요 시간</div>
                <div className="text-2xl font-mono font-bold text-foreground tabular-nums">{formatTime(finishTime)}</div>
              </div>
              <div className="bg-secondary/50 rounded-xl p-4 border border-border/50">
                <div className="text-sm text-muted-foreground mb-1">완료 문제</div>
                <div className="text-2xl font-bold text-foreground">
                  {team.isFinished ? TOTAL_QUESTIONS : team.currentQuestion - 1}
                  <span className="text-base font-normal text-muted-foreground"> / {TOTAL_QUESTIONS}</span>
                </div>
              </div>
            </div>
            {team.penaltySeconds > 0 && (
              <p className="text-sm text-muted-foreground">힌트 {team.hintsUsed}회 (+{team.penaltySeconds}초 패널티 포함)</p>
            )}
            <p className="text-sm text-muted-foreground">참여해주셔서 감사합니다!</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // 게임 시작 대기 화면
  if (!isGameStarted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-escape pointer-events-none" />
        <Card className="w-full max-w-lg border-border/50 animate-fade-in-up relative z-10">
          <CardContent className="p-8 text-center space-y-6">
            <div className="w-24 h-24 mx-auto rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Clock className="w-12 h-12 text-primary animate-pulse" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-foreground mb-2">Team {team.teamName}</h2>
            </div>
            <p className="text-xl text-muted-foreground">게임 시작을 기다리는 중...</p>
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-primary animate-live-dot" />
              관리자가 게임을 시작하면 자동으로 진행됩니다
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // 탈출 성공 화면
  if (team.isFinished) {
    const startTime = data?.startTime || 0
    const ranking = data?.finishedTeams
      ?.sort((a: { endTime: number | null; penaltySeconds: number }, b: { endTime: number | null; penaltySeconds: number }) => {
        const aTime = computeElapsedMs(startTime, a.endTime || 0, totalPausedMs) + (a.penaltySeconds * 1000)
        const bTime = computeElapsedMs(startTime, b.endTime || 0, totalPausedMs) + (b.penaltySeconds * 1000)
        return aTime - bTime
      })
      ?.findIndex((t: { teamId: number }) => t.teamId === team.teamId) + 1 || 0

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-escape pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-primary/8 blur-3xl pointer-events-none" />
        <Card className="w-full max-w-xl border-primary/30 shadow-[0_0_40px_oklch(0.75_0.18_145_/_0.15)] animate-fade-in-up relative z-10">
          <CardContent className="p-6 sm:p-10 text-center space-y-6">
            <div className="w-20 h-20 sm:w-28 sm:h-28 mx-auto rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center animate-float">
              <Trophy className="w-10 h-10 sm:w-14 sm:h-14 text-primary" />
            </div>
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-primary animate-glow-text mb-2">탈출 성공!</h2>
              <p className="text-xl sm:text-2xl text-foreground">Team {team.teamName}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-6 py-2">
              <div className="bg-secondary/50 rounded-xl p-4 sm:p-6 border border-border/50 min-w-0">
                <div className="text-sm sm:text-lg text-muted-foreground mb-1 sm:mb-2">최종 시간</div>
                <div className="text-2xl sm:text-4xl font-mono font-bold text-foreground tabular-nums truncate">{formatTime(totalTime)}</div>
              </div>
              <div className="bg-secondary/50 rounded-xl p-4 sm:p-6 border border-border/50 min-w-0">
                <div className="text-sm sm:text-lg text-muted-foreground mb-1 sm:mb-2">현재 순위</div>
                <div className="text-2xl sm:text-4xl font-bold text-accent">{ranking > 0 ? `${ranking}위` : "-"}</div>
              </div>
            </div>
            <div className="text-sm sm:text-lg text-muted-foreground">
              힌트 사용: {team.hintsUsed}회 (패널티: +{team.penaltySeconds}초)
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // 게임 플레이 화면
  return (
    <div className="h-dvh bg-background flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 bg-grid-escape pointer-events-none" />

      {qrOpen && <QrScanner onResult={handleQrResult} onClose={() => setQrOpen(false)} />}

      {/* 패쓰 확인 팝업 */}
      {showPassConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-fade-in" onClick={() => !passLoading && setShowPassConfirm(false)}>
          <Card className="w-full max-w-xs border-destructive/40 animate-fade-in-up" onClick={e => e.stopPropagation()}>
            <CardContent className="p-6 text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-destructive/10 border border-destructive/30 flex items-center justify-center">
                <SkipForward className="w-7 h-7 text-destructive" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-lg font-bold text-foreground">문제 패쓰</h3>
                <p className="text-sm text-muted-foreground">
                  이 문제를 건너뜁니다.<br />
                  <span className="text-destructive font-semibold">+{PASS_PENALTY_SECONDS}초 패널티</span>가 부여됩니다.<br />
                  정말 패쓰하시겠습니까?
                </p>
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  onClick={() => setShowPassConfirm(false)}
                  disabled={passLoading}
                  className="flex-1 h-11 border-border/60"
                >
                  취소
                </Button>
                <Button
                  onClick={handlePass}
                  disabled={passLoading}
                  className="flex-1 h-11 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                >
                  {passLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "패쓰"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 힌트 확인 팝업 */}
      {showHintConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-fade-in" onClick={() => !hintLoading && setShowHintConfirm(false)}>
          <Card className="w-full max-w-xs border-accent/40 animate-fade-in-up" onClick={e => e.stopPropagation()}>
            <CardContent className="p-6 text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center">
                <Lightbulb className="w-7 h-7 text-accent" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-lg font-bold text-foreground">힌트 사용</h3>
                <p className="text-sm text-muted-foreground">
                  이 문제의 힌트를 확인합니다.<br />
                  <span className="text-accent font-semibold">+{HINT_PENALTY_SECONDS}초 패널티</span>가 부여됩니다.<br />
                  힌트를 보시겠습니까?
                </p>
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  onClick={() => setShowHintConfirm(false)}
                  disabled={hintLoading}
                  className="flex-1 h-11 border-border/60"
                >
                  취소
                </Button>
                <Button
                  onClick={async () => { await handleUseHint(); setShowHintConfirm(false) }}
                  disabled={hintLoading}
                  className="flex-1 h-11 bg-accent hover:bg-accent/90 text-accent-foreground"
                >
                  {hintLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "힌트 보기"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 일시정지 오버레이 */}
      {isPaused && (
        <div className="absolute inset-0 z-50 bg-background/90 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
          <div className="text-center space-y-4">
            <div className="w-20 h-20 mx-auto rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center">
              <Pause className="w-10 h-10 text-accent" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">일시정지</h2>
            <p className="text-muted-foreground">관리자가 게임을 잠시 멈췄습니다.<br />잠시만 기다려주세요!</p>
          </div>
        </div>
      )}

      {/* Sticky Header */}
      <div className="shrink-0 px-4 pt-4 pb-3 border-b border-border/50 bg-background/80 backdrop-blur-sm relative z-20 animate-fade-in-up" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-foreground truncate">Team {team.teamName}</h1>
              {role === "reader" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs shrink-0 bg-secondary text-muted-foreground border border-border/50">
                  <Eye className="w-3 h-3" />
                  뷰어
                </span>
              )}
              {role === "writer" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs shrink-0 bg-accent/20 text-accent border border-accent/30">
                  <Crown className="w-3 h-3" />
                  참여자
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              문제 {team.currentQuestion} / {TOTAL_QUESTIONS}
            </p>
          </div>
          <div className="text-right shrink-0">
            <div className={`text-3xl font-mono font-bold text-primary ${
              isGameStarted && !team.isFinished ? "animate-timer-blink" : ""
            }`}>
              {formatTime(totalTime)}
            </div>
            {team.penaltySeconds > 0 && (
              <div className="text-xs text-destructive animate-fade-in">
                +{team.penaltySeconds}초 패널티
              </div>
            )}
          </div>
        </div>
        {/* Progress Bar */}
        <div className="max-w-3xl mx-auto mt-3 w-full bg-secondary rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-primary h-1.5 rounded-full transition-all duration-700 ease-out shadow-[0_0_6px_oklch(0.75_0.18_145_/_0.5)]"
            style={{ width: `${((team.currentQuestion - 1) / TOTAL_QUESTIONS) * 100}%` }}
          />
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto relative z-10">
        <div className="max-w-3xl mx-auto px-4 py-5 space-y-4">
          {/* Question Card */}
          <Card
            className={`border-border/50 transition-all duration-500 animate-fade-in-up ${
              isFlashing
                ? "border-primary/70 shadow-[0_0_40px_oklch(0.75_0.18_145_/_0.25)] bg-primary/5"
                : ""
            }`}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-muted-foreground flex items-center gap-2">
                문제 {currentQuestion?.id}
                {questionType === "qr" && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-chart-3/20 text-chart-3 border border-chart-3/30">
                    <QrCode className="w-3 h-3" /> QR
                  </span>
                )}
                {questionType === "photo" && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-accent/20 text-accent border border-accent/30">
                    <Camera className="w-3 h-3" /> 사진 미션
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div key={questionKey} className="animate-fade-in-up space-y-4">
                {currentQuestion?.imageUrl && (
                  <div className="rounded-xl overflow-hidden border border-border/30 bg-secondary/20 relative w-full" style={{ minHeight: "8rem" }}>
                    <Image
                      src={currentQuestion.imageUrl}
                      alt="문제 이미지"
                      width={800}
                      height={400}
                      className="w-full object-contain max-h-72"
                      priority
                    />
                  </div>
                )}
                <p className="text-xl md:text-2xl text-foreground leading-relaxed whitespace-pre-line">
                  {currentQuestion?.question}
                </p>
              </div>

              {/* Hint — 사용 시 뷰어도 함께 노출 */}
              {currentQuestion?.hint && (() => {
                const hintRevealed = showHint || (team?.hintsUsed ?? 0) > 0
                if (hintRevealed) {
                  return (
                    <div className="flex items-start gap-3 p-4 bg-accent/10 border border-accent/30 rounded-lg animate-fade-in">
                      <Lightbulb className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                      <p className="text-accent text-base">{currentQuestion.hint}</p>
                    </div>
                  )
                }
                if (role === "reader") return null
                return (
                  <Button
                    variant="outline"
                    onClick={() => setShowHintConfirm(true)}
                    disabled={!hasJoined || hintLoading}
                    className="w-full h-12 text-base border-accent/50 text-accent hover:bg-accent/10 hover:border-accent hover:shadow-[0_0_12px_oklch(0.85_0.2_85_/_0.2)] transition-all duration-300 disabled:opacity-50"
                  >
                    {hintLoading
                      ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      : <Lightbulb className="w-4 h-4 mr-2" />}
                    {hintLoading ? "처리 중..." : `힌트 사용하기 (+${HINT_PENALTY_SECONDS}초 패널티)`}
                  </Button>
                )
              })()}

              {/* 문제 패쓰 */}
              {role !== "reader" && (
                <Button
                  variant="outline"
                  onClick={() => setShowPassConfirm(true)}
                  disabled={!hasJoined || passLoading || isPaused}
                  className="w-full h-12 text-base border-destructive/40 text-destructive hover:bg-destructive/10 hover:border-destructive/70 transition-all duration-300 disabled:opacity-50"
                >
                  <SkipForward className="w-4 h-4 mr-2" />
                  {`문제 패쓰 (+${PASS_PENALTY_SECONDS}초 패널티)`}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Stats */}
          <div className="flex justify-center gap-6 text-sm text-muted-foreground pb-2">
            <span>힌트 {team.hintsUsed}회</span>
            <span>패널티 +{team.penaltySeconds}초</span>
          </div>
        </div>
      </div>

      {/* Answer Area */}
      <div
        className="shrink-0 px-4 pt-4 border-t border-border/40 bg-background/95 backdrop-blur-xl relative z-20 shadow-[0_-8px_32px_oklch(0_0_0_/_0.15)]"
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
      >
        <div className="max-w-3xl mx-auto space-y-3">
          {/* 뷰어 모드 표시 */}
          {role === "reader" ? (
            <div className="flex items-center justify-center gap-2 h-14 rounded-xl bg-secondary/60 border border-border/40 text-muted-foreground text-sm">
              <Eye className="w-4 h-4" />
              뷰어 모드 — 참여자가 정답을 제출합니다
            </div>
          ) : null}

          {/* 텍스트/QR 정답 피드백 */}
          {role !== "reader" && feedback.type && (
            <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm animate-fade-in ${
              feedback.type === "correct"
                ? "bg-primary/10 text-primary border border-primary/20"
                : "bg-destructive/10 text-destructive border border-destructive/20"
            }`}>
              {feedback.type === "correct"
                ? <CheckCircle2 className="w-4 h-4 shrink-0" />
                : <XCircle className="w-4 h-4 shrink-0" />
              }
              <span className="font-medium">{feedback.message}</span>
            </div>
          )}

          {/* 오답 재시도 잠금 안내 */}
          {role !== "reader" && wrongRemaining > 0 && !feedback.type && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm bg-destructive/10 text-destructive border border-destructive/20 animate-fade-in">
              <XCircle className="w-4 h-4 shrink-0" />
              <span className="font-medium">{wrongRemaining}초 후 다시 제출할 수 있습니다.</span>
            </div>
          )}

          {/* 업/다운 힌트 */}
          {role !== "reader" && updownHint && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-accent/10 border border-accent/30 animate-fade-in">
              {updownHint.dir === "up" ? (
                <ArrowUp className="w-5 h-5 text-accent shrink-0" />
              ) : (
                <ArrowDown className="w-5 h-5 text-accent shrink-0" />
              )}
              <div className="text-sm">
                <span className="font-mono font-bold text-foreground">{updownHint.guess}</span>
                <span className="text-muted-foreground"> — 정답은 </span>
                <span className="text-accent font-semibold">{updownHint.dir === "up" ? "더 큰 값(↑)" : "더 작은 값(↓)"}</span>
                <span className="text-muted-foreground">입니다.</span>
              </div>
            </div>
          )}

          {/* 사진 채점 결과 */}
          {role !== "reader" && photoResult && (
            <div className={`px-4 py-3 rounded-lg animate-fade-in ${
              photoResult.isCorrect
                ? "bg-primary/10 border border-primary/20"
                : "bg-destructive/10 border border-destructive/20"
            }`}>
              <div className={`font-bold ${photoResult.isCorrect ? "text-primary" : "text-destructive"}`}>
                {photoResult.score}% 일치 {photoResult.isCorrect ? "🎉 통과!" : "— 다시 도전!"}
              </div>
              {photoResult.reason && (
                <div className="text-sm text-muted-foreground mt-1">{photoResult.reason}</div>
              )}
            </div>
          )}

          {/* 입력 컨트롤 (문제 유형별, 참여자만) */}
          {role !== "reader" && (questionType === "photo" ? (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handlePhotoChange}
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={photoLoading}
                className="w-full h-14 text-base bg-accent hover:bg-accent/90 text-accent-foreground hover:shadow-[0_0_20px_oklch(0.85_0.2_85_/_0.4)] transition-all duration-300 disabled:opacity-60"
              >
                {photoLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    AI가 채점 중...
                  </>
                ) : (
                  <>
                    <Camera className="w-5 h-5 mr-2" />
                    사진 촬영하기
                  </>
                )}
              </Button>
            </>
          ) : questionType === "qr" ? (
            <>
              <Button
                onClick={() => setQrOpen(true)}
                disabled={wrongRemaining > 0}
                className="w-full h-14 text-base bg-primary hover:bg-primary/90 text-primary-foreground hover:shadow-[0_0_20px_oklch(0.75_0.18_145_/_0.4)] transition-all duration-300 disabled:opacity-60"
              >
                <QrCode className="w-5 h-5 mr-2" />
                {wrongRemaining > 0 ? `${wrongRemaining}초 후 재시도 가능` : "QR 코드 스캔하기"}
              </Button>
              <div
                className={isShaking ? "animate-shake" : ""}
                onAnimationEnd={() => setIsShaking(false)}
              >
                <form onSubmit={handleSubmit} className="flex gap-2">
                  <Input
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder={wrongRemaining > 0 ? `${wrongRemaining}초 대기 중...` : "또는 코드 직접 입력..."}
                    disabled={wrongRemaining > 0}
                    className="h-12 text-base bg-input border-border focus:border-primary/60 disabled:opacity-60"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                  />
                  <Button type="submit" className="h-12 px-5 shrink-0" disabled={!answer.trim() || wrongRemaining > 0}>
                    {wrongRemaining > 0 ? `${wrongRemaining}s` : "제출"}
                  </Button>
                </form>
              </div>
            </>
          ) : questionType === "updown" ? (
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                value={answer}
                onChange={(e) => setAnswer(e.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder="YYYYMMDD (8자리)"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                className="h-14 text-base font-mono tracking-wider bg-input border-border focus:border-primary/60 focus:shadow-[0_0_12px_oklch(0.75_0.18_145_/_0.2)] transition-all duration-300"
                autoComplete="off"
              />
              <Button
                type="submit"
                className="h-14 px-6 text-base bg-primary hover:bg-primary/90 text-primary-foreground hover:shadow-[0_0_20px_oklch(0.75_0.18_145_/_0.4)] transition-all duration-300 disabled:opacity-40 shrink-0"
                disabled={answer.length !== 8}
              >
                제출
              </Button>
            </form>
          ) : (
            <div
              className={isShaking ? "animate-shake" : ""}
              onAnimationEnd={() => setIsShaking(false)}
            >
              <form onSubmit={handleSubmit} className="flex gap-2">
                <Input
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder={wrongRemaining > 0 ? `${wrongRemaining}초 대기 중...` : "정답 입력..."}
                  disabled={wrongRemaining > 0}
                  className="h-14 text-base bg-input border-border focus:border-primary/60 focus:shadow-[0_0_12px_oklch(0.75_0.18_145_/_0.2)] transition-all duration-300 disabled:opacity-60"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                />
                <Button
                  type="submit"
                  className="h-14 px-6 text-base bg-primary hover:bg-primary/90 text-primary-foreground hover:shadow-[0_0_20px_oklch(0.75_0.18_145_/_0.4)] transition-all duration-300 disabled:opacity-40 shrink-0"
                  disabled={!answer.trim() || wrongRemaining > 0}
                >
                  {wrongRemaining > 0 ? `${wrongRemaining}s` : "제출"}
                </Button>
              </form>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
