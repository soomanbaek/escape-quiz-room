"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useParams } from "next/navigation"
import useSWR from "swr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TOTAL_QUESTIONS, HINT_PENALTY_SECONDS } from "@/lib/game-data"
import { Clock, Lightbulb, Trophy, CheckCircle2, XCircle, Gamepad2, Eye, Users } from "lucide-react"

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

type Role = "none" | "player" | "spectator"

export default function TeamPlayPage() {
  const params = useParams()
  const teamId = params.teamId as string

  const [role, setRole] = useState<Role>("none")
  const [sessionId, setSessionId] = useState<string>("")
  const [playerError, setPlayerError] = useState<string>("")

  const { data, mutate } = useSWR(`/api/team/${teamId}`, fetcher, {
    refreshInterval: 500
  })
  const { data: gameData } = useSWR("/api/game", fetcher, {
    refreshInterval: 500
  })

  const [answer, setAnswer] = useState("")
  const [showHint, setShowHint] = useState(false)
  const [feedback, setFeedback] = useState<{ type: "correct" | "incorrect" | null; message: string }>({ type: null, message: "" })
  const [elapsedTime, setElapsedTime] = useState(0)

  // Animation states
  const [isShaking, setIsShaking] = useState(false)
  const [isFlashing, setIsFlashing] = useState(false)
  const [questionKey, setQuestionKey] = useState(0)
  const lastQuestionRef = useRef<number | null>(null)

  const team = data?.team
  const currentQuestion = data?.currentQuestion
  const isGameStarted = gameData?.isStarted
  const gameStartTime = gameData?.startTime

  // 세션 ID 초기화
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

  // 타이머
  useEffect(() => {
    if (!isGameStarted || !gameStartTime || team?.isFinished) return
    const interval = setInterval(() => {
      setElapsedTime(Date.now() - gameStartTime)
    }, 100)
    return () => clearInterval(interval)
  }, [isGameStarted, gameStartTime, team?.isFinished])

  // 문제 변경 감지 → 질문 카드 fade-in 트리거
  useEffect(() => {
    const q = team?.currentQuestion
    if (q === undefined) return
    if (lastQuestionRef.current !== null && lastQuestionRef.current !== q) {
      setQuestionKey(k => k + 1)
    }
    lastQuestionRef.current = q
  }, [team?.currentQuestion])

  // 플레이어로 등록
  const handleSelectPlayer = useCallback(async () => {
    if (!sessionId) return
    const res = await fetch(`/api/team/${teamId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "register", sessionId })
    })
    const result = await res.json()
    if (result.success) {
      setRole("player")
      setPlayerError("")
    } else {
      setPlayerError("이미 다른 플레이어가 접속 중입니다!")
    }
  }, [teamId, sessionId])

  // 관전자로 접속
  const handleSelectSpectator = useCallback(() => {
    setRole("spectator")
  }, [])

  // 정답 제출
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!answer.trim() || role !== "player") return

    const res = await fetch(`/api/team/${teamId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "submit", answer })
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
  }, [answer, teamId, role, mutate])

  // 힌트 사용
  const handleUseHint = useCallback(async () => {
    if (role !== "player") return
    await fetch(`/api/team/${teamId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "hint" })
    })
    setShowHint(true)
    mutate()
  }, [teamId, role, mutate])

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

  // 역할 선택 화면
  if (role === "none") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-escape pointer-events-none" />
        <Card className="w-full max-w-lg border-border/50 animate-fade-in-up relative z-10">
          <CardHeader className="text-center pb-2">
            <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mb-4 animate-float">
              <Users className="w-10 h-10 text-primary" />
            </div>
            <CardTitle className="text-3xl font-bold">{team.teamName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-4">
            <p className="text-center text-muted-foreground text-lg">역할을 선택해주세요</p>
            <div className="grid gap-4">
              <Button
                onClick={handleSelectPlayer}
                className="h-20 text-xl bg-primary hover:bg-primary/90 hover:shadow-[0_0_20px_oklch(0.75_0.18_145_/_0.4)] transition-all duration-300"
                disabled={team.hasPlayer}
              >
                <Gamepad2 className="w-7 h-7 mr-3" />
                플레이어로 참가
                {team.hasPlayer && " (접속 중)"}
              </Button>
              <Button
                onClick={handleSelectSpectator}
                variant="secondary"
                className="h-20 text-xl hover:bg-secondary/80 transition-all duration-300"
              >
                <Eye className="w-7 h-7 mr-3" />
                관전자로 참가
              </Button>
            </div>
            {playerError && (
              <p className="text-center text-destructive text-lg font-medium animate-fade-in">
                {playerError}
              </p>
            )}
            <p className="text-center text-sm text-muted-foreground">
              플레이어는 팀당 1명만 가능합니다
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
                {role === "player" ? (
                  <>
                    <Gamepad2 className="w-5 h-5 text-primary" />
                    <span>플레이어</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-5 h-5 text-muted-foreground" />
                    <span>관전자</span>
                  </>
                )}
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
    const ranking = gameData?.teams
      ?.filter((t: { isFinished: boolean }) => t.isFinished)
      ?.sort((a: { endTime: number; penaltySeconds: number }, b: { endTime: number; penaltySeconds: number }) => {
        const aTime = (a.endTime - gameData.startTime) + (a.penaltySeconds * 1000)
        const bTime = (b.endTime - gameData.startTime) + (b.penaltySeconds * 1000)
        return aTime - bTime
      })
      ?.findIndex((t: { teamId: number }) => t.teamId === team.teamId) + 1 || 0

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-escape pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-primary/8 blur-3xl pointer-events-none" />
        <Card className="w-full max-w-xl border-primary/30 shadow-[0_0_40px_oklch(0.75_0.18_145_/_0.15)] animate-fade-in-up relative z-10">
          <CardContent className="p-10 text-center space-y-8">
            <div className="w-28 h-28 mx-auto rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center animate-float">
              <Trophy className="w-14 h-14 text-primary" />
            </div>
            <div>
              <h2 className="text-4xl font-bold text-primary animate-glow-text mb-3">탈출 성공!</h2>
              <p className="text-2xl text-foreground">Team {team.teamName}</p>
            </div>
            <div className="grid grid-cols-2 gap-6 py-4">
              <div className="bg-secondary/50 rounded-xl p-6 border border-border/50">
                <div className="text-lg text-muted-foreground mb-2">최종 시간</div>
                <div className="text-4xl font-mono font-bold text-foreground">{formatTime(totalTime)}</div>
              </div>
              <div className="bg-secondary/50 rounded-xl p-6 border border-border/50">
                <div className="text-lg text-muted-foreground mb-2">현재 순위</div>
                <div className="text-4xl font-bold text-accent">{ranking > 0 ? `${ranking}위` : "-"}</div>
              </div>
            </div>
            <div className="text-lg text-muted-foreground">
              힌트 사용: {team.hintsUsed}회 (패널티: +{team.penaltySeconds}초)
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // 게임 플레이 화면
  return (
    <div className="min-h-screen bg-background p-4 md:p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-grid-escape pointer-events-none" />
      <div className="max-w-3xl mx-auto space-y-6 relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between animate-fade-in-up">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-bold text-foreground">Team {team.teamName}</h1>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm transition-all ${
                role === "player"
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "bg-secondary text-muted-foreground"
              }`}>
                {role === "player" ? (
                  <>
                    <Gamepad2 className="w-4 h-4" />
                    플레이어
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4" />
                    관전자
                  </>
                )}
              </span>
            </div>
            <p className="text-lg text-muted-foreground">
              문제 {team.currentQuestion} / {TOTAL_QUESTIONS}
            </p>
          </div>
          <div className="text-right">
            <div className={`text-4xl md:text-5xl font-mono font-bold text-primary ${
              isGameStarted && !team.isFinished ? "animate-timer-blink" : ""
            }`}>
              {formatTime(totalTime)}
            </div>
            {team.penaltySeconds > 0 && (
              <div className="text-sm text-destructive mt-1 animate-fade-in">
                +{team.penaltySeconds}초 패널티
              </div>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-secondary rounded-full h-3 overflow-hidden animate-fade-in-up" style={{ animationDelay: "0.05s" }}>
          <div
            className="bg-primary h-3 rounded-full transition-all duration-700 ease-out shadow-[0_0_8px_oklch(0.75_0.18_145_/_0.5)]"
            style={{ width: `${((team.currentQuestion - 1) / TOTAL_QUESTIONS) * 100}%` }}
          />
        </div>

        {/* Question Card */}
        <Card
          className={`border-border/50 transition-all duration-500 animate-fade-in-up ${
            isFlashing
              ? "border-primary/70 shadow-[0_0_40px_oklch(0.75_0.18_145_/_0.25)] bg-primary/5"
              : ""
          }`}
          style={{ animationDelay: "0.1s" }}
        >
          <CardHeader className="pb-4">
            <CardTitle className="text-xl text-muted-foreground">
              문제 {currentQuestion?.id}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Question text — re-animates on question change */}
            <div key={questionKey} className="animate-fade-in-up">
              <p className="text-2xl md:text-3xl text-foreground leading-relaxed">
                {currentQuestion?.question}
              </p>
            </div>

            {/* Hint Section */}
            <div className="space-y-3">
              {!showHint ? (
                <Button
                  variant="outline"
                  onClick={handleUseHint}
                  disabled={role !== "player"}
                  className="w-full h-14 text-lg border-accent/50 text-accent hover:bg-accent/10 hover:border-accent hover:shadow-[0_0_12px_oklch(0.85_0.2_85_/_0.2)] transition-all duration-300"
                >
                  <Lightbulb className="w-5 h-5 mr-2" />
                  힌트 사용하기 (+{HINT_PENALTY_SECONDS}초 패널티)
                </Button>
              ) : (
                <div className="flex items-start gap-4 p-5 bg-accent/10 border border-accent/30 rounded-lg animate-fade-in">
                  <Lightbulb className="w-6 h-6 text-accent shrink-0 mt-0.5" />
                  <p className="text-accent text-lg">{currentQuestion?.hint}</p>
                </div>
              )}
            </div>

            {/* Answer Form — shakes on wrong answer */}
            {role === "player" ? (
              <div
                className={isShaking ? "animate-shake" : ""}
                onAnimationEnd={() => setIsShaking(false)}
              >
                <form onSubmit={handleSubmit} className="space-y-4">
                  <Input
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="정답을 입력하세요..."
                    className="text-xl h-16 bg-input border-border focus:border-primary/60 focus:shadow-[0_0_12px_oklch(0.75_0.18_145_/_0.2)] transition-all duration-300"
                    autoFocus
                  />

                  {feedback.type && (
                    <div className={`flex items-center gap-3 p-4 rounded-lg text-lg animate-fade-in ${
                      feedback.type === "correct"
                        ? "bg-primary/10 text-primary border border-primary/20"
                        : "bg-destructive/10 text-destructive border border-destructive/20"
                    }`}>
                      {feedback.type === "correct"
                        ? <CheckCircle2 className="w-6 h-6" />
                        : <XCircle className="w-6 h-6" />
                      }
                      <span className="font-medium">{feedback.message}</span>
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full h-16 text-xl bg-primary hover:bg-primary/90 text-primary-foreground hover:shadow-[0_0_20px_oklch(0.75_0.18_145_/_0.4)] transition-all duration-300 disabled:opacity-40"
                    disabled={!answer.trim()}
                  >
                    제출
                  </Button>
                </form>
              </div>
            ) : (
              <div className="text-center py-8 bg-secondary/30 rounded-lg border border-border/30">
                <Eye className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-xl text-muted-foreground">관전 모드</p>
                <p className="text-muted-foreground">플레이어가 문제를 풀고 있습니다</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="flex justify-center gap-8 text-lg text-muted-foreground animate-fade-in-up" style={{ animationDelay: "0.15s" }}>
          <span>힌트 사용: {team.hintsUsed}회</span>
          <span>패널티: +{team.penaltySeconds}초</span>
        </div>
      </div>
    </div>
  )
}
