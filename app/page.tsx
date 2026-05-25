"use client"

import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { TEAM_NAMES } from "@/lib/game-data"
import { Lock, Users, Shield, ArrowRight } from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      {/* Animated background grid */}
      <div className="absolute inset-0 bg-grid-escape pointer-events-none" />
      {/* Radial glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-primary/5 blur-3xl pointer-events-none" />

      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative z-10">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="space-y-4 animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full text-primary text-sm">
              <Lock className="w-4 h-4 animate-float" />
              Workshop Edition
            </div>
            <h1 className="text-5xl md:text-7xl font-bold text-foreground tracking-tight">
              ESCAPE
              <span className="text-primary animate-glow-text"> ROOM</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              7개의 문제를 가장 빠르게 풀고 탈출하세요.
              <br />
              힌트를 사용하면 30초의 패널티가 추가됩니다.
            </p>

          </div>

          {/* Team Selection */}
          <div className="space-y-4">
            <h2
              className="text-lg font-medium text-muted-foreground flex items-center justify-center gap-2 animate-fade-in-up"
              style={{ animationDelay: "0.1s" }}
            >
              <Users className="w-5 h-5" />
              팀을 선택하세요
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
              {TEAM_NAMES.map((name, index) => (
                <Link
                  key={index}
                  href={`/team/${index + 1}`}
                  className="animate-fade-in-up"
                  style={{ animationDelay: `${0.15 + index * 0.07}s` }}
                >
                  <Card className="border-border/50 hover:border-primary/50 hover:bg-primary/5 hover:shadow-[0_0_24px_oklch(0.75_0.18_145_/_0.12)] transition-all duration-300 cursor-pointer group">
                    <CardContent className="p-6 text-center">
                      <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-secondary flex items-center justify-center text-lg font-bold text-primary group-hover:bg-primary group-hover:text-primary-foreground group-hover:shadow-[0_0_16px_oklch(0.75_0.18_145_/_0.5)] transition-all duration-300">
                        {index + 1}
                      </div>
                      <div className="font-semibold text-foreground">Team {name}</div>
                      <div className="flex items-center justify-center gap-1 mt-2 text-sm text-muted-foreground group-hover:text-primary transition-colors">
                        입장하기
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Admin Link */}
      <div className="p-6 border-t border-border relative z-10">
        <div className="max-w-4xl mx-auto flex justify-center">
          <Link href="/admin">
            <Button
              variant="outline"
              className="border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all duration-300"
            >
              <Shield className="w-4 h-4 mr-2" />
              관리자 페이지
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
