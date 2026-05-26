"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Lock, Loader2 } from "lucide-react"

export const CRED_NICKNAME_KEY = "escape_nickname"
export const CRED_TEAM_KEY = "escape_team_id"

export default function HomePage() {
  const router = useRouter()
  const [nickname, setNickname] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [checking, setChecking] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const storedNickname = localStorage.getItem(CRED_NICKNAME_KEY)
    const storedTeamId = localStorage.getItem(CRED_TEAM_KEY)
    if (storedNickname && storedTeamId !== null) {
      const tid = parseInt(storedTeamId)
      router.replace(tid === 0 ? "/admin" : `/team/${tid}`)
    } else {
      setChecking(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [router])

  const handleSubmit = async () => {
    const trimmed = nickname.trim()
    if (!trimmed || loading) return
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/auth/nickname", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: trimmed }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "오류가 발생했습니다")
        return
      }
      localStorage.setItem(CRED_NICKNAME_KEY, trimmed)
      localStorage.setItem(CRED_TEAM_KEY, String(data.teamId))
      router.push(data.teamId === 0 ? "/admin" : `/team/${data.teamId}`)
    } catch {
      setError("서버에 연결할 수 없습니다")
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-grid-escape pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm space-y-8 animate-fade-in-up">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full text-primary text-sm">
            <Lock className="w-4 h-4 animate-float" />
            Workshop Edition
          </div>
          <h1 className="text-5xl font-bold text-foreground tracking-tight">
            ESCAPE
            <span className="text-primary animate-glow-text"> ROOM</span>
          </h1>
        </div>

        <Card className="border-border/50">
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground block text-center">LDAP을 입력해주세요</label>
              <Input
                ref={inputRef}
                value={nickname}
                onChange={(e) => { setNickname(e.target.value); setError("") }}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="예: rowan.1"
                maxLength={30}
                className={`h-12 text-center bg-input border-border focus:border-primary/60 ${error ? "border-destructive focus:border-destructive" : ""}`}
                disabled={loading}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
              />
              {error && (
                <p className="text-sm text-destructive text-center animate-fade-in">{error}</p>
              )}
            </div>
            <Button
              onClick={handleSubmit}
              disabled={!nickname.trim() || loading}
              className="w-full h-12 text-base bg-primary hover:bg-primary/90 hover:shadow-[0_0_20px_oklch(0.75_0.18_145_/_0.4)] transition-all duration-300"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "입장하기"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
