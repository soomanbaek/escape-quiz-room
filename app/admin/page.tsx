"use client"

import { useState, useEffect, useRef } from "react"
import useSWR from "swr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TOTAL_QUESTIONS, TEAM_NAMES } from "@/lib/game-data"
import type { TeamState } from "@/lib/game-data"
import { Play, RotateCcw, Square, Trophy, Clock, Users, Lightbulb, CheckCircle2, Gamepad2, Pencil, Check, X, Lock, UserX, Zap, Star, Plus, Trash2, KeyRound } from "lucide-react"

interface NicknameEntry {
  id: number
  nickname: string
  teamId: number
}

interface MemberStat {
  deviceId: string
  nickname: string
  teamId: number
  count: number
  firstAnswerSec: number | null
  lastAnswerSec: number | null
}

const ADMIN_PASSWORD = "workshop-admin-fighting"

const fetcher = (url: string) => fetch(url).then(res => res.json())

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
}

function TeamNameEditor({
  team,
  sessionId,
  onSave,
}: {
  team: TeamState
  sessionId: string
  onSave: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(team.teamName)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const save = async () => {
    if (!value.trim() || value.trim() === team.teamName) {
      setValue(team.teamName)
      setEditing(false)
      return
    }
    await fetch("/api/game", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "updateTeamName", sessionId, teamId: team.teamId, newName: value.trim() }),
    })
    setEditing(false)
    onSave()
  }

  const cancel = () => {
    setValue(team.teamName)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          ref={inputRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") save()
            if (e.key === "Escape") cancel()
          }}
          className="h-7 w-32 text-sm px-2 py-0 bg-secondary border-primary/40"
        />
        <button onClick={save} className="text-primary hover:text-primary/80 transition-colors">
          <Check className="w-4 h-4" />
        </button>
        <button onClick={cancel} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return (
    <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 group">
      <span className="text-lg font-semibold text-foreground">Team {team.teamName}</span>
      <Pencil className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  )
}

function PasswordGate({ onAuth }: { onAuth: () => void }) {
  const [input, setInput] = useState("")
  const [shaking, setShaking] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const attempt = () => {
    if (input === ADMIN_PASSWORD) {
      sessionStorage.setItem("admin_auth", "1")
      onAuth()
    } else {
      setShaking(true)
      setInput("")
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-grid-escape pointer-events-none" />
      <div className="relative z-10 w-full max-w-sm px-6 animate-fade-in-up">
        <div className="flex flex-col items-center gap-6">
          <div className="p-4 rounded-full bg-primary/10 border border-primary/20">
            <Lock className="w-8 h-8 text-primary animate-float" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">관리자 접속</h1>
            <p className="text-sm text-muted-foreground mt-1">비밀번호를 입력하세요</p>
          </div>
          <div
            className={`w-full space-y-3 ${shaking ? "animate-shake" : ""}`}
            onAnimationEnd={() => setShaking(false)}
          >
            <Input
              ref={inputRef}
              type="password"
              placeholder="비밀번호"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && attempt()}
              className="text-center bg-secondary border-border/50 focus:border-primary/50"
            />
            <Button
              onClick={attempt}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              입장
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

const TEAM_OPTIONS = [
  { value: 0, label: "관리자" },
  ...TEAM_NAMES.map((name, i) => ({ value: i + 1, label: `Team ${name}` }))
]

function NicknameManager({ nicknames, onMutate }: { nicknames: NicknameEntry[]; onMutate: () => void }) {
  const [newNickname, setNewNickname] = useState("")
  const [newTeamId, setNewTeamId] = useState(1)
  const [addError, setAddError] = useState("")
  const [addLoading, setAddLoading] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editNickname, setEditNickname] = useState("")
  const [editTeamId, setEditTeamId] = useState(0)

  const handleAdd = async () => {
    if (!newNickname.trim()) return
    setAddLoading(true)
    setAddError("")
    const res = await fetch("/api/admin/nicknames", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname: newNickname.trim(), teamId: newTeamId }),
    })
    const data = await res.json()
    if (!res.ok) { setAddError(data.error || "오류 발생"); setAddLoading(false); return }
    setNewNickname("")
    setAddLoading(false)
    onMutate()
  }

  const handleDelete = async (id: number) => {
    if (!confirm("이 닉네임을 삭제하시겠습니까?")) return
    await fetch("/api/admin/nicknames", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    onMutate()
  }

  const startEdit = (entry: NicknameEntry) => {
    setEditingId(entry.id)
    setEditNickname(entry.nickname)
    setEditTeamId(entry.teamId)
  }

  const saveEdit = async () => {
    if (!editNickname.trim() || editingId === null) return
    const res = await fetch("/api/admin/nicknames", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editingId, nickname: editNickname.trim(), teamId: editTeamId }),
    })
    const data = await res.json()
    if (!res.ok) { alert(data.error || "오류 발생"); return }
    setEditingId(null)
    onMutate()
  }

  const groupedByTeam = TEAM_OPTIONS.map(opt => ({
    ...opt,
    entries: nicknames.filter(n => n.teamId === opt.value)
  }))

  return (
    <Card className="border-border/50 animate-fade-in-up" style={{ animationDelay: "0.8s" }}>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-primary" />
          닉네임 관리
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add form */}
        <div className="flex gap-2 flex-wrap">
          <Input
            value={newNickname}
            onChange={e => { setNewNickname(e.target.value); setAddError("") }}
            onKeyDown={e => e.key === "Enter" && handleAdd()}
            placeholder="새 닉네임"
            maxLength={30}
            className="h-9 flex-1 min-w-32 bg-secondary border-border/50 focus:border-primary/50 text-sm"
          />
          <select
            value={newTeamId}
            onChange={e => setNewTeamId(parseInt(e.target.value))}
            className="h-9 px-3 rounded-md bg-secondary border border-border/50 text-sm text-foreground focus:outline-none focus:border-primary/50"
          >
            {TEAM_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <Button
            onClick={handleAdd}
            disabled={!newNickname.trim() || addLoading}
            size="sm"
            className="h-9 bg-primary hover:bg-primary/90"
          >
            <Plus className="w-4 h-4 mr-1" />
            추가
          </Button>
        </div>
        {addError && <p className="text-sm text-destructive">{addError}</p>}

        {/* Nickname list grouped by team */}
        <div className="space-y-4">
          {groupedByTeam.map(group => group.entries.length > 0 && (
            <div key={group.value}>
              <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                {group.label}
              </div>
              <div className="space-y-1">
                {group.entries.map(entry => (
                  <div key={entry.id} className="flex items-center gap-2 px-3 py-2 rounded-md bg-secondary/40 border border-border/30">
                    {editingId === entry.id ? (
                      <>
                        <Input
                          value={editNickname}
                          onChange={e => setEditNickname(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditingId(null) }}
                          className="h-7 flex-1 text-sm px-2 py-0 bg-background border-primary/40"
                          autoFocus
                        />
                        <select
                          value={editTeamId}
                          onChange={e => setEditTeamId(parseInt(e.target.value))}
                          className="h-7 px-2 rounded bg-background border border-border/50 text-xs text-foreground focus:outline-none"
                        >
                          {TEAM_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                        <button onClick={saveEdit} className="text-primary hover:text-primary/80 transition-colors">
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={() => setEditingId(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-sm font-mono text-foreground">{entry.nickname}</span>
                        <button onClick={() => startEdit(entry)} className="text-muted-foreground hover:text-primary transition-colors p-1">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(entry.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {nicknames.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              등록된 닉네임이 없습니다
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null)

  useEffect(() => {
    setAuthed(sessionStorage.getItem("admin_auth") === "1")
  }, [])

  const { data: gameData, mutate } = useSWR(authed ? "/api/game" : null, fetcher, {
    refreshInterval: 2000,
  })
  const { data: statsData } = useSWR(authed ? "/api/admin/stats" : null, fetcher, {
    refreshInterval: 10000,
  })
  const { data: nicknameData, mutate: mutateNicknames } = useSWR(authed ? "/api/admin/nicknames" : null, fetcher)
  const memberStats: MemberStat[] = statsData?.stats || []
  const nicknameList: NicknameEntry[] = nicknameData?.nicknames || []

  const [elapsedTime, setElapsedTime] = useState(0)

  const isStarted = gameData?.isStarted
  const startTime = gameData?.startTime
  const sessionId = gameData?.sessionId
  const teams: TeamState[] = gameData?.teams || []

  useEffect(() => {
    if (!isStarted || !startTime) {
      setElapsedTime(0)
      return
    }
    const interval = setInterval(() => {
      setElapsedTime(Date.now() - startTime)
    }, 100)
    return () => clearInterval(interval)
  }, [isStarted, startTime])

  if (authed === null) return null

  if (!authed) {
    return <PasswordGate onAuth={() => setAuthed(true)} />
  }

  const handleStart = async () => {
    await fetch("/api/game", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start" }),
    })
    mutate()
  }

  const handleEnd = async () => {
    if (confirm("게임을 종료하시겠습니까? 진행 데이터와 통계는 유지됩니다.")) {
      await fetch("/api/game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "end" }),
      })
      mutate()
    }
  }

  const handleReset = async () => {
    if (confirm("게임을 초기화하시겠습니까? 모든 진행 상황이 리셋됩니다.")) {
      await fetch("/api/game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" }),
      })
      mutate()
    }
  }

  const sortedTeams = [...teams].sort((a, b) => {
    if (a.isFinished && b.isFinished) {
      const aTime = (a.endTime! - startTime!) + (a.penaltySeconds * 1000)
      const bTime = (b.endTime! - startTime!) + (b.penaltySeconds * 1000)
      return aTime - bTime
    }
    if (a.isFinished) return -1
    if (b.isFinished) return 1
    if (a.currentQuestion !== b.currentQuestion) return b.currentQuestion - a.currentQuestion
    return a.penaltySeconds - b.penaltySeconds
  })

  const finishedCount = teams.filter(t => t.isFinished).length

  return (
    <div className="min-h-screen bg-background p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-grid-escape pointer-events-none" />
      <div className="max-w-6xl mx-auto space-y-8 relative z-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in-up">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-foreground">방탈출 게임</h1>
              {isStarted && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full text-primary text-sm">
                  <span className="w-2 h-2 rounded-full bg-primary animate-live-dot" />
                  LIVE
                </span>
              )}
            </div>
            <p className="text-muted-foreground">관리자 대시보드</p>
          </div>
          <div className="flex items-center gap-4">
            {isStarted && (
              <div className="text-right">
                <div className="text-sm text-muted-foreground">경과 시간</div>
                <div className="text-3xl font-mono font-bold text-primary animate-timer-blink">
                  {formatTime(elapsedTime)}
                </div>
              </div>
            )}
            <div className="flex gap-2">
              {!isStarted && !startTime ? (
                <Button
                  onClick={handleStart}
                  size="lg"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground hover:shadow-[0_0_20px_oklch(0.75_0.18_145_/_0.4)] transition-all duration-300"
                >
                  <Play className="w-5 h-5 mr-2" />
                  게임 시작
                </Button>
              ) : isStarted ? (
                <>
                  <Button
                    onClick={handleEnd}
                    variant="outline"
                    size="lg"
                    className="border-muted-foreground/50 text-muted-foreground hover:bg-secondary hover:text-foreground transition-all duration-300"
                  >
                    <Square className="w-5 h-5 mr-2" />
                    게임 종료
                  </Button>
                  <Button
                    onClick={handleReset}
                    variant="outline"
                    size="lg"
                    className="border-destructive text-destructive hover:bg-destructive/10 transition-all duration-300"
                  >
                    <RotateCcw className="w-5 h-5 mr-2" />
                    초기화
                  </Button>
                </>
              ) : (
                <Button
                  onClick={handleReset}
                  variant="outline"
                  size="lg"
                  className="border-destructive text-destructive hover:bg-destructive/10 transition-all duration-300"
                >
                  <RotateCcw className="w-5 h-5 mr-2" />
                  초기화
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: <Users className="w-6 h-6 text-primary" />, bg: "bg-primary/10", label: "참가 팀", value: teams.length },
            { icon: <CheckCircle2 className="w-6 h-6 text-accent" />, bg: "bg-accent/10", label: "탈출 완료", value: finishedCount },
            { icon: <Clock className="w-6 h-6 text-muted-foreground" />, bg: "bg-secondary", label: "총 문제", value: TOTAL_QUESTIONS },
            { icon: <Lightbulb className="w-6 h-6 text-destructive" />, bg: "bg-destructive/10", label: "총 힌트 사용", value: teams.reduce((sum, t) => sum + t.hintsUsed, 0) },
          ].map((stat, i) => (
            <Card
              key={i}
              className="border-border/50 hover:border-border transition-all duration-300 animate-fade-in-up"
              style={{ animationDelay: `${i * 0.07}s` }}
            >
              <CardContent className="p-4 flex items-center gap-4">
                <div className={`p-3 rounded-full ${stat.bg}`}>{stat.icon}</div>
                <div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                  <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Team Cards */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground flex items-center gap-2 animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
            <Trophy className="w-5 h-5 text-accent" />
            팀 순위 및 현황
          </h2>
          <div className="grid gap-4">
            {sortedTeams.map((team, index) => {
              const teamTime = team.endTime && startTime
                ? (team.endTime - startTime) + (team.penaltySeconds * 1000)
                : elapsedTime + (team.penaltySeconds * 1000)

              const progress = ((team.currentQuestion - 1) / TOTAL_QUESTIONS) * 100
              const isRanked = team.isFinished

              return (
                <Card
                  key={team.teamId}
                  className={`border-border/50 transition-all duration-500 animate-fade-in-up ${
                    team.isFinished
                      ? "border-primary/40 bg-primary/5 shadow-[0_0_20px_oklch(0.75_0.18_145_/_0.08)]"
                      : "hover:border-border"
                  }`}
                  style={{ animationDelay: `${0.35 + index * 0.06}s` }}
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                      {/* Rank */}
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shrink-0 transition-all duration-300 ${
                        isRanked
                          ? index === 0
                            ? "bg-accent text-accent-foreground shadow-[0_0_12px_oklch(0.85_0.2_85_/_0.4)]"
                            : index === 1
                              ? "bg-muted-foreground/30 text-foreground"
                              : index === 2
                                ? "bg-chart-4/30 text-chart-4"
                                : "bg-primary/20 text-primary"
                          : "bg-secondary text-muted-foreground"
                      }`}>
                        {isRanked ? index + 1 : "-"}
                      </div>

                      {/* Team Info */}
                      <div className="flex-1 space-y-3">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                          <div className="flex items-center gap-3">
                            {sessionId ? (
                              <TeamNameEditor team={team} sessionId={sessionId} onSave={mutate} />
                            ) : (
                              <span className="text-lg font-semibold text-foreground">Team {team.teamName}</span>
                            )}
                            {(team.memberCount ?? 0) > 0 && (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-primary/20 text-primary text-xs rounded-full border border-primary/20">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-live-dot" />
                                <Gamepad2 className="w-3 h-3" />
                                {team.memberCount}명 접속
                              </span>
                            )}
                            {(team.memberCount ?? 0) > 0 && sessionId && (
                              <button
                                onClick={async () => {
                                  if (!confirm(`Team ${team.teamName}의 모든 접속을 초기화하시겠습니까?`)) return
                                  await fetch("/api/game", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ action: "resetTeamPlayer", sessionId, teamId: team.teamId }),
                                  })
                                  mutate()
                                }}
                                title="팀 접속 초기화"
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-destructive/10 text-destructive text-xs rounded-full border border-destructive/20 hover:bg-destructive/20 transition-colors"
                              >
                                <UserX className="w-3 h-3" />
                                세션 초기화
                              </button>
                            )}
                            {team.isFinished && (
                              <span className="px-2 py-0.5 bg-accent/20 text-accent text-xs rounded-full border border-accent/20">
                                탈출 완료
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-muted-foreground">
                              문제 {team.currentQuestion}/{TOTAL_QUESTIONS}
                            </span>
                            <span className="text-muted-foreground">
                              힌트 {team.hintsUsed}회
                            </span>
                            {team.penaltySeconds > 0 && (
                              <span className="text-destructive">
                                +{team.penaltySeconds}초
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-2 rounded-full transition-all duration-700 ease-out ${
                              team.isFinished
                                ? "bg-primary shadow-[0_0_6px_oklch(0.75_0.18_145_/_0.6)]"
                                : "bg-primary/60"
                            }`}
                            style={{ width: `${team.isFinished ? 100 : progress}%` }}
                          />
                        </div>
                      </div>

                      {/* Time */}
                      <div className="text-right shrink-0">
                        <div className={`text-2xl font-mono font-bold transition-colors ${
                          team.isFinished ? "text-primary" : "text-foreground"
                        }`}>
                          {startTime && (isStarted || team.endTime) ? formatTime(teamTime) : "--:--"}
                        </div>
                        {team.isFinished && team.penaltySeconds > 0 && (
                          <div className="text-xs text-muted-foreground">
                            (패널티 포함)
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>

        {/* Game Results Summary (게임 종료 후) */}
        {!isStarted && startTime && teams.length > 0 && (
          <div className="space-y-4 animate-fade-in-up" style={{ animationDelay: "0.5s" }}>
            <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <Trophy className="w-5 h-5 text-accent" />
              최종 결과
            </h2>
            <Card className="border-border/50">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50 bg-secondary/30">
                        <th className="text-center p-3 text-muted-foreground font-medium w-12">순위</th>
                        <th className="text-left p-3 text-muted-foreground font-medium">팀</th>
                        <th className="text-center p-3 text-muted-foreground font-medium">소요 시간</th>
                        <th className="text-center p-3 text-muted-foreground font-medium">완료 문제</th>
                        <th className="text-center p-3 text-muted-foreground font-medium">힌트</th>
                        <th className="text-center p-3 text-muted-foreground font-medium">패널티</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...teams]
                        .sort((a, b) => {
                          if (a.isFinished && !b.isFinished) return -1
                          if (!a.isFinished && b.isFinished) return 1
                          if (a.isFinished && b.isFinished) {
                            const aTime = ((a.endTime || 0) - startTime) + (a.penaltySeconds * 1000)
                            const bTime = ((b.endTime || 0) - startTime) + (b.penaltySeconds * 1000)
                            return aTime - bTime
                          }
                          return (b.currentQuestion - 1) - (a.currentQuestion - 1)
                        })
                        .map((team, i) => {
                          const finishTime = team.isFinished && team.endTime
                            ? ((team.endTime - startTime) + (team.penaltySeconds * 1000))
                            : null
                          const rank = team.isFinished ? i + 1 : null
                          return (
                            <tr key={team.teamId} className={`border-b border-border/30 transition-colors hover:bg-secondary/20 ${i === 0 && team.isFinished ? "bg-accent/5" : ""}`}>
                              <td className="p-3 text-center">
                                {rank ? (
                                  <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                                    rank === 1 ? "bg-accent text-accent-foreground" :
                                    rank === 2 ? "bg-muted-foreground/30 text-foreground" :
                                    rank === 3 ? "bg-chart-4/30 text-chart-4" :
                                    "bg-secondary text-muted-foreground"
                                  }`}>{rank}</span>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </td>
                              <td className="p-3 font-medium text-foreground">Team {team.teamName}</td>
                              <td className="p-3 text-center font-mono font-bold">
                                {finishTime !== null
                                  ? <span className="text-primary">{formatTime(finishTime)}</span>
                                  : <span className="text-muted-foreground">미완료</span>
                                }
                              </td>
                              <td className="p-3 text-center text-muted-foreground">
                                {team.isFinished ? TOTAL_QUESTIONS : team.currentQuestion - 1} / {TOTAL_QUESTIONS}
                              </td>
                              <td className="p-3 text-center text-muted-foreground">{team.hintsUsed}회</td>
                              <td className="p-3 text-center">
                                {team.penaltySeconds > 0
                                  ? <span className="text-destructive">+{team.penaltySeconds}초</span>
                                  : <span className="text-muted-foreground">-</span>
                                }
                              </td>
                            </tr>
                          )
                        })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Individual Stats */}
        {isStarted && memberStats.length > 0 && (
          <div className="space-y-4 animate-fade-in-up" style={{ animationDelay: "0.6s" }}>
            <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <Star className="w-5 h-5 text-accent" />
              개인 통계
            </h2>

            {/* Highlights */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 가장 많이 푼 사람 */}
              {memberStats[0] && (
                <Card className="border-accent/30 bg-accent/5">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
                      <Trophy className="w-6 h-6 text-accent" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs text-muted-foreground mb-0.5">가장 많이 푼 사람</div>
                      <div className="font-bold text-foreground truncate">{memberStats[0].nickname}</div>
                      <div className="text-sm text-accent">{memberStats[0].count}문제 정답</div>
                    </div>
                  </CardContent>
                </Card>
              )}
              {/* 가장 빠른 사람 (마지막 정답 / 정답 수 → 평균 시간 낮은 사람) */}
              {(() => {
                const fastest = [...memberStats]
                  .filter(s => s.count > 0 && s.lastAnswerSec !== null)
                  .sort((a, b) => (a.lastAnswerSec! / a.count) - (b.lastAnswerSec! / b.count))[0]
                if (!fastest) return null
                const avgSec = Math.round(fastest.lastAnswerSec! / fastest.count)
                const m = Math.floor(avgSec / 60), s = avgSec % 60
                return (
                  <Card className="border-primary/30 bg-primary/5">
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                        <Zap className="w-6 h-6 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs text-muted-foreground mb-0.5">가장 빠른 사람</div>
                        <div className="font-bold text-foreground truncate">{fastest.nickname}</div>
                        <div className="text-sm text-primary">문제당 평균 {m > 0 ? `${m}분 ${s}초` : `${s}초`}</div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })()}
            </div>

            {/* Full Table */}
            <Card className="border-border/50">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50 bg-secondary/30">
                        <th className="text-left p-3 text-muted-foreground font-medium">순위</th>
                        <th className="text-left p-3 text-muted-foreground font-medium">닉네임</th>
                        <th className="text-left p-3 text-muted-foreground font-medium">팀</th>
                        <th className="text-center p-3 text-muted-foreground font-medium">정답 수</th>
                        <th className="text-center p-3 text-muted-foreground font-medium">첫 정답</th>
                        <th className="text-center p-3 text-muted-foreground font-medium">마지막 정답</th>
                      </tr>
                    </thead>
                    <tbody>
                      {memberStats.map((stat, i) => {
                        const fmtSec = (sec: number | null) => {
                          if (sec === null) return "-"
                          const m = Math.floor(sec / 60), s = sec % 60
                          return m > 0 ? `${m}분 ${s}초` : `${s}초`
                        }
                        const teamName = gameData?.teams?.find((t: TeamState) => t.teamId === stat.teamId)?.teamName || stat.teamId
                        return (
                          <tr key={stat.deviceId} className={`border-b border-border/30 transition-colors hover:bg-secondary/20 ${i === 0 ? "bg-accent/5" : ""}`}>
                            <td className="p-3">
                              <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                                i === 0 ? "bg-accent text-accent-foreground" :
                                i === 1 ? "bg-muted-foreground/20 text-foreground" :
                                i === 2 ? "bg-chart-4/20 text-chart-4" :
                                "text-muted-foreground"
                              }`}>
                                {i + 1}
                              </span>
                            </td>
                            <td className="p-3 font-medium text-foreground">{stat.nickname}</td>
                            <td className="p-3 text-muted-foreground">Team {teamName}</td>
                            <td className="p-3 text-center">
                              <span className="font-bold text-foreground">{stat.count}</span>
                              <span className="text-muted-foreground text-xs ml-1">개</span>
                            </td>
                            <td className="p-3 text-center text-muted-foreground">{fmtSec(stat.firstAnswerSec)}</td>
                            <td className="p-3 text-center text-muted-foreground">{fmtSec(stat.lastAnswerSec)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Nickname Management */}
        <NicknameManager nicknames={nicknameList} onMutate={mutateNicknames} />
      </div>
    </div>
  )
}
