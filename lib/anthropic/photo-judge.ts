import Anthropic from "@anthropic-ai/sdk"

// 빠르고 저렴한 비전 모델 (필요 시 claude-sonnet-4-6로 교체 가능)
const VISION_MODEL = "claude-haiku-4-5"

type MediaType = "image/jpeg" | "image/png" | "image/webp" | "image/gif"

export interface PhotoJudgeResult {
  score: number   // 0~100
  reason: string  // 한국어 한 문장
}

/**
 * 사진이 목표 설명과 얼마나 일치하는지 Claude 비전으로 평가한다.
 * 서버 사이드에서만 호출할 것 (ANTHROPIC_API_KEY 보호).
 */
export async function judgePhoto(
  target: string,
  imageBase64: string,
  mediaType: string
): Promise<PhotoJudgeResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return { score: 0, reason: "서버에 ANTHROPIC_API_KEY가 설정되지 않았습니다." }
  }

  const anthropic = new Anthropic({ apiKey })

  const prompt = `당신은 워크샵 사진 미션의 채점자입니다.
미션 목표: "${target}"

첨부된 사진이 이 목표와 얼마나 잘 맞는지 0~100점으로 평가하세요.
색깔, 모양, 사물의 종류 중 하나라도 비슷하면 후하게 점수를 주세요.
재미있는 팀 게임이므로 너무 엄격하게 보지 말고 관대하게 채점하세요.

반드시 아래 JSON 형식으로만 답하세요 (다른 텍스트 없이):
{"score": <0-100 사이 정수>, "reason": "<한국어 한 문장 설명>"}`

  try {
    const msg = await anthropic.messages.create({
      model: VISION_MODEL,
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: (mediaType as MediaType) || "image/jpeg",
                data: imageBase64,
              },
            },
            { type: "text", text: prompt },
          ],
        },
      ],
    })

    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")

    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      const parsed = JSON.parse(match[0]) as { score?: number; reason?: string }
      const score = Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0)))
      return { score, reason: String(parsed.reason ?? "") }
    }
    return { score: 0, reason: "평가 결과를 해석하지 못했습니다. 다시 시도해주세요." }
  } catch (error) {
    console.error("Photo judge failed:", error)
    return { score: 0, reason: "사진 평가 중 오류가 발생했습니다. 다시 시도해주세요." }
  }
}
