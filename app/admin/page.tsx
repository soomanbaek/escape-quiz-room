"use client"

import { useState, useEffect } from "react"
import useSWR from "swr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { TOTAL_QUESTIONS } from "@/lib/game-data"
import type { TeamState } from "@/lib/game-data"
import { Play, RotateCcw, Trophy, Clock, Users, Lightbulb, CheckCircle2, Gamepad2 } from "lucide-react"

const fetcher = (url: string) => fetch(url).then(res => res.json())

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
}

export default function AdminPage() {
  const { data: gameData, mutate } = useSWR("/api/game", fetcher, { 
    refreshInterval: 500 
  })
  
  const [elapsedTime, setElapsedTime] = useState(0)
  
  const isStarted = gameData?.isStarted
  const startTime = gameData?.startTime
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
  
  const handleStart = async () => {
    await fetch("/api/game", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start" })
    })
    mutate()
  }
  
  const handleReset = async () => {
    if (confirm("게임을 초기화하시겠습니까? 모든 진행 상황이 리셋됩니다.")) {
      await fetch("/api/game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" })
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
    if (a.currentQuestion !== b.currentQuestion) {
      return b.currentQuestion - a.currentQuestion
    }
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
              {!isStarted ? (
                <Button
                  onClick={handleStart}
                  size="lg"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground hover:shadow-[0_0_20px_oklch(0.75_0.18_145_/_0.4)] transition-all duration-300"
                >
                  <Play className="w-5 h-5 mr-2" />
                  게임 시작
                </Button>
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
              const teamTime = team.isFinished && team.endTime && startTime
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
                            <span className="text-lg font-semibold text-foreground">
                              Team {team.teamName}
                            </span>
                            {team.hasPlayer && (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-primary/20 text-primary text-xs rounded-full border border-primary/20">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-live-dot" />
                                <Gamepad2 className="w-3 h-3" />
                                플레이어 접속
                              </span>
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
                          {isStarted ? formatTime(teamTime) : "--:--"}
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

        {/* Team Access Links */}
        {!isStarted && (
          <Card className="border-border/50 animate-fade-in-up" style={{ animationDelay: "0.7s" }}>
            <CardHeader>
              <CardTitle className="text-lg">팀 접속 링크</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {teams.map(team => (
                  <div
                    key={team.teamId}
                    className="p-4 bg-secondary/50 rounded-lg text-center border border-border/30 hover:border-primary/30 hover:bg-primary/5 transition-all duration-300"
                  >
                    <div className="font-semibold text-foreground mb-1">
                      Team {team.teamName}
                    </div>
                    <code className="text-xs text-primary break-all">
                      /team/{team.teamId}
                    </code>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                각 팀에게 해당하는 URL을 공유하세요. 팀당 플레이어 1명 + 관전자 6명이 참여할 수 있습니다.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
