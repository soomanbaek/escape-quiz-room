"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useParams } from "next/navigation"
import useSWR from "swr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TOTAL_QUESTIONS, HINT_PENALTY_SECONDS } from "@/lib/game-data"
import { Clock, Lightbulb, Trophy, CheckCircle2, XCircle, Gamepad2, Users, QrCode, Camera, X, Loader2 } from "lucide-react"

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
  const teamId = params.teamId as string

  const [hasJoined, setHasJoined] = useState(false)
  const [sessionId, setSessionId] = useState<string>("")
  const [nickname, setNickname] = useState<string>("")

  const { data, mutate } = useSWR(`/api/team/${teamId}`, fetcher, {
    refreshInterval: 1000
  })

  const [answer, setAnswer] = useState("")
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

  const team = data?.team
  const currentQuestion = data?.currentQuestion
  const questionType: "text" | "qr" | "photo" = currentQuestion?.type || "text"
  const isGameStarted = data?.isStarted
  const gameStartTime = data?.startTime

  // 세션(디바이스) ID 초기화
  useEffect(() => {
    const stored = sessionStorage.getItem(`team-${teamId}-session`)
    if (stored) {
      setSessionId(stored)
    } else {
      const newId = generateSessionId()
      sessionStorage.setItem(`team-${teamId}-session`, newId)
      setSessionId(newId)
    }
  }, [teamId])

  // 새로고침 시 이미 입장했던 디바이스면 자동 재입장
  useEffect(() => {
    if (!sessionId) return
    const joined = sessionStorage.getItem(`team-${teamId}-joined`) === "1"
    if (joined) {
      const nick = sessionStorage.getItem(`team-${teamId}-nick`) || ""
      setNickname(nick)
      setHasJoined(true)
      fetch(`/api/team/${teamId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join", sessionId, nickname: nick })
      }).catch(() => {})
    }
  }, [sessionId, teamId])

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

  // 타이머
  useEffect(() => {
    if (!isGameStarted || !gameStartTime || team?.isFinished) return
    const interval = setInterval(() => {
      setElapsedTime(Date.now() - gameStartTime)
    }, 100)
    return () => clearInterval(interval)
  }, [isGameStarted, gameStartTime, team?.isFinished])

  // 문제 변경 감지 → 카드 애니메이션 + 입력 상태 초기화
  useEffect(() => {
    const q = team?.currentQuestion
    if (q === undefined) return
    if (lastQuestionRef.current !== null && lastQuestionRef.current !== q) {
      setQuestionKey(k => k + 1)
      setShowHint(false)
      setPhotoResult(null)
      setAnswer("")
    }
    lastQuestionRef.current = q
  }, [team?.currentQuestion])

  // 팀 입장
  const handleJoin = useCallback(async () => {
    if (!sessionId) return
    await fetch(`/api/team/${teamId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "join", sessionId, nickname })
    })
    sessionStorage.setItem(`team-${teamId}-joined`, "1")
    sessionStorage.setItem(`team-${teamId}-nick`, nickname)
    setHasJoined(true)
  }, [teamId, sessionId, nickname])

  // 정답 제출 (text / qr 공용)
  const submitValue = useCallback(async (value: string) => {
    if (!value.trim() || !hasJoined) return
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
      setTimeout(() => {
        setIsFlashing(false)
        setFeedback({ type: null, message: "" })
      }, 1500)
    } else {
      setIsShaking(true)
      setFeedback({ type: "incorrect", message: "오답입니다. 다시 시도해주세요." })
      setTimeout(() => setFeedback({ type: null, message: "" }), 2000)
    }
    mutate()
  }, [teamId, hasJoined, mutate])

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
    if (!file || !hasJoined) return
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
  }, [teamId, hasJoined, mutate])

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

  if (!team) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <div className="animate-pulse text-muted-foreground text-xl">로딩 중...</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const totalTime = team.isFinished && team.endTime && gameStartTime
    ? (team.endTime - gameStartTime) + (team.penaltySeconds * 1000)
    : elapsedTime + (team.penaltySeconds * 1000)

  const memberCount = team.memberCount || 0

  // 입장 화면 (멀티 디바이스 - 누구나 입장)
  if (!hasJoined) {
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
            {memberCount > 0 && (
              <p className="text-sm text-primary mt-2 flex items-center justify-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-live-dot" />
                {memberCount}명 참여 중
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <Input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              placeholder="닉네임 (선택)"
              maxLength={12}
              className="h-12 text-center bg-input border-border focus:border-primary/60"
            />
            <Button
              onClick={handleJoin}
              className="w-full h-16 text-xl bg-primary hover:bg-primary/90 hover:shadow-[0_0_20px_oklch(0.75_0.18_145_/_0.4)] transition-all duration-300"
            >
              <Gamepad2 className="w-6 h-6 mr-3" />
              입장하기
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              팀원 모두 각자 폰으로 입장해 함께 풀 수 있어요
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // 게임 종료 화면
  if (!isGameStarted && gameStartTime) {
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
            <p className="text-sm text-muted-foreground">
              참여해주셔서 감사합니다!
            </p>
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
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary text-lg">
                <Users className="w-5 h-5 text-primary" />
                <span>{memberCount}명 참여 중</span>
              </div>
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
        const aTime = ((a.endTime || 0) - startTime) + (a.penaltySeconds * 1000)
        const bTime = ((b.endTime || 0) - startTime) + (b.penaltySeconds * 1000)
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

      {/* Sticky Header */}
      <div className="shrink-0 px-4 pt-4 pb-3 border-b border-border/50 bg-background/80 backdrop-blur-sm relative z-20 animate-fade-in-up" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-foreground truncate">Team {team.teamName}</h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs shrink-0 bg-primary/20 text-primary border border-primary/30">
                <Users className="w-3 h-3" />
                {memberCount}명
              </span>
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
              <div key={questionKey} className="animate-fade-in-up">
                <p className="text-xl md:text-2xl text-foreground leading-relaxed whitespace-pre-line">
                  {currentQuestion?.question}
                </p>
              </div>

              {/* Hint */}
              {currentQuestion?.hint && (
                <div>
                  {!showHint ? (
                    <Button
                      variant="outline"
                      onClick={handleUseHint}
                      disabled={!hasJoined || hintLoading}
                      className="w-full h-12 text-base border-accent/50 text-accent hover:bg-accent/10 hover:border-accent hover:shadow-[0_0_12px_oklch(0.85_0.2_85_/_0.2)] transition-all duration-300 disabled:opacity-50"
                    >
                      {hintLoading
                        ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        : <Lightbulb className="w-4 h-4 mr-2" />}
                      {hintLoading ? "처리 중..." : `힌트 사용하기 (+${HINT_PENALTY_SECONDS}초 패널티)`}
                    </Button>
                  ) : (
                    <div className="flex items-start gap-3 p-4 bg-accent/10 border border-accent/30 rounded-lg animate-fade-in">
                      <Lightbulb className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                      <p className="text-accent text-base">{currentQuestion.hint}</p>
                    </div>
                  )}
                </div>
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

      {/* Sticky Answer Area at bottom */}
      <div
        className="shrink-0 px-4 pt-3 pb-4 border-t border-border/50 bg-background/90 backdrop-blur-sm relative z-20"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      >
        <div className="max-w-3xl mx-auto space-y-3">
          {/* 텍스트/QR 정답 피드백 */}
          {feedback.type && (
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

          {/* 사진 채점 결과 */}
          {photoResult && (
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

          {/* 입력 컨트롤 (문제 유형별) */}
          {questionType === "photo" ? (
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
                className="w-full h-14 text-base bg-primary hover:bg-primary/90 text-primary-foreground hover:shadow-[0_0_20px_oklch(0.75_0.18_145_/_0.4)] transition-all duration-300"
              >
                <QrCode className="w-5 h-5 mr-2" />
                QR 코드 스캔하기
              </Button>
              <div
                className={isShaking ? "animate-shake" : ""}
                onAnimationEnd={() => setIsShaking(false)}
              >
                <form onSubmit={handleSubmit} className="flex gap-2">
                  <Input
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="또는 코드 직접 입력..."
                    className="h-12 text-base bg-input border-border focus:border-primary/60"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                  />
                  <Button type="submit" className="h-12 px-5 shrink-0" disabled={!answer.trim()}>
                    제출
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <div
              className={isShaking ? "animate-shake" : ""}
              onAnimationEnd={() => setIsShaking(false)}
            >
              <form onSubmit={handleSubmit} className="flex gap-2">
                <Input
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="정답 입력..."
                  className="h-14 text-base bg-input border-border focus:border-primary/60 focus:shadow-[0_0_12px_oklch(0.75_0.18_145_/_0.2)] transition-all duration-300"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                />
                <Button
                  type="submit"
                  className="h-14 px-6 text-base bg-primary hover:bg-primary/90 text-primary-foreground hover:shadow-[0_0_20px_oklch(0.75_0.18_145_/_0.4)] transition-all duration-300 disabled:opacity-40 shrink-0"
                  disabled={!answer.trim()}
                >
                  제출
                </Button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
