"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { SAMPLE_QUESTIONS, TOTAL_QUESTIONS } from "@/lib/game-data"
import { ArrowLeft, Eye, EyeOff, KeyRound, Lightbulb, Loader2 } from "lucide-react"

const typeLabel = (t: string) =>
  t === "qr" ? "QR" : t === "photo" ? "사진" : t === "updown" ? "업/다운" : "텍스트"

const typeBadgeClass = (t: string) =>
  t === "qr"
    ? "bg-chart-3/15 text-chart-3 border-chart-3/30"
    : t === "photo"
    ? "bg-accent/20 text-accent border-accent/30"
    : t === "updown"
    ? "bg-chart-2/15 text-chart-2 border-chart-2/30"
    : "bg-secondary text-muted-foreground border-border/50"

export default function AdminQuestionsPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [showAnswers, setShowAnswers] = useState(false)

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("admin_auth") !== "1") {
      router.replace("/admin")
      return
    }
    setReady(true)
  }, [router])

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background relative">
      <div className="absolute inset-0 bg-grid-escape pointer-events-none" />

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-6 sm:py-10 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Link href="/admin">
              <Button variant="outline" size="sm" className="h-9 border-border/50">
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                관리자
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-foreground">문제 목록</h1>
              <p className="text-sm text-muted-foreground">총 {TOTAL_QUESTIONS}문제 · 운영 참고용</p>
            </div>
          </div>
          <Button
            onClick={() => setShowAnswers(s => !s)}
            variant="outline"
            size="sm"
            className="h-9 border-border/50"
          >
            {showAnswers ? (
              <><EyeOff className="w-4 h-4 mr-1.5" />정답 숨기기</>
            ) : (
              <><Eye className="w-4 h-4 mr-1.5" />정답 보기</>
            )}
          </Button>
        </div>

        {/* Questions */}
        <div className="space-y-4">
          {SAMPLE_QUESTIONS.map(q => (
            <Card key={q.id} className="border-border/50 animate-fade-in-up">
              <CardContent className="p-5 space-y-4">
                {/* number + type */}
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary/15 text-primary text-sm font-bold">
                    {q.id}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${typeBadgeClass(q.type)}`}>
                    {typeLabel(q.type)}
                  </span>
                </div>

                {/* image */}
                {q.imageUrl && (
                  <div className="rounded-lg overflow-hidden border border-border/40 bg-secondary/20 max-w-md">
                    <Image
                      src={q.imageUrl}
                      alt={`문제 ${q.id} 이미지`}
                      width={600}
                      height={400}
                      className="w-full h-auto object-contain max-h-72"
                    />
                  </div>
                )}

                {/* question text */}
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">문제</div>
                  <p className="text-foreground leading-relaxed whitespace-pre-line">{q.question}</p>
                </div>

                {/* hint */}
                {q.hint && (
                  <div className="flex items-start gap-2 p-3 rounded-md bg-accent/10 border border-accent/30">
                    <Lightbulb className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <div className="text-xs uppercase tracking-wider text-accent/80 mb-0.5">힌트</div>
                      <p className="text-sm text-accent whitespace-pre-line">{q.hint}</p>
                    </div>
                  </div>
                )}

                {/* answer */}
                {showAnswers && (
                  <div className="flex items-start gap-2 p-3 rounded-md bg-primary/10 border border-primary/30">
                    <KeyRound className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs uppercase tracking-wider text-primary/80 mb-0.5">
                        {q.type === "photo" ? "채점 기준" : "정답"}
                      </div>
                      <p className={`text-sm break-words ${q.type === "photo" ? "text-foreground" : "font-mono font-bold text-primary"}`}>
                        {q.answer}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
