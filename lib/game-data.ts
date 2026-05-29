export type QuestionType = "text" | "qr" | "photo" | "updown"

export interface Question {
  id: number
  type: QuestionType
  question: string
  // text/qr: 비교할 정답 / photo: Claude가 비교할 목표 설명(서버 전용)
  answer: string
  hint?: string
  imageUrl?: string
}

export interface TeamState {
  teamId: number
  teamName: string
  currentQuestion: number
  hintsUsed: number
  penaltySeconds: number
  startTime: number | null
  endTime: number | null
  isFinished: boolean
  hasPlayer: boolean  // 플레이어가 접속했는지 여부
  playerSessionId: string | null  // (구) 단일 플레이어 세션 ID
  memberCount?: number  // 현재 접속 중인 팀원 수
}

export interface GameState {
  isStarted: boolean
  startTime: number | null
  teams: TeamState[]
}

export const TEAM_NAMES = [
  "Alpha",
  "Bravo",
  "Charlie",
  "Delta",
  "Echo",
  "Foxtrot"
]

// 일시정지 시간을 제외한 경과 시간(ms) 계산.
// reference: 현재 시각(진행중) / paused_at(일시정지중) / end_time(완료)
export function computeElapsedMs(
  startTime: number | null,
  reference: number,
  totalPausedMs: number
): number {
  if (startTime === null) return 0
  return Math.max(0, reference - startTime - totalPausedMs)
}

export const HINT_PENALTY_SECONDS = 120
export const PASS_PENALTY_SECONDS = 300  // 문제 패쓰 패널티
export const WRONG_ANSWER_DELAY_MS = 10000  // 오답 후 재시도 딜레이
export const PHOTO_PASS_THRESHOLD = 70  // 사진 미션 통과 기준 점수
export const TOTAL_QUESTIONS = 11

export const SAMPLE_QUESTIONS: Question[] = [
  {
    id: 1,
    type: "text",
    question: "각 사각형 안의 선분이 알파벳 획을 나타냅니다. 4개의 사각형이 만드는 단어는?",
    answer: "EXIT",
    hint: "사각형 안의 선분이 알파벳 한 획처럼 생겼습니다. 각 선분이 어느 글자의 특징적인 부분인지 생각해보세요",
    imageUrl: "/questions/q1.png"
  },
  {
    id: 2,
    type: "text",
    question: "이번 워크샵에 참석한 인원수는? (숫자로 입력)",
    answer: "46",
  },
  {
    id: 3,
    type: "text",
    question: "표에서 ?에 들어갈 숫자는?",
    answer: "20",
    hint: "맨 아래 행부터 시작해서 위로 올라가보세요. 각 숫자와 그 왼쪽·아래 숫자 사이의 관계를 찾아보세요",
    imageUrl: "/questions/q3.png"
  },
  {
    id: 4,
    type: "text",
    question: "다음이 의미하는 6글자 비밀 암호는?",
    answer: "CARBON",
    hint: "왼쪽 단어에서 일부 글자를 추출하고, 오른쪽은 B의 위치 관계를 영어로 표현해보세요",
    imageUrl: "/questions/q4.png"
  },
  {
    id: 5,
    type: "qr",
    question: "실외에 숨겨진 QR 코드를 찾아 스캔하세요! 총 5개의 QR 중 1개만 정답이며, 올바른 QR 코드만 통과됩니다.",
    answer: "SIGNAL",
  },
  {
    id: 6,
    type: "text",
    question: "화살표를 알파벳으로 바꿔 단어를 해독하세요. (정답은 4글자, →=E, ↑=N, ↓=S, ←=W)",
    answer: "NEST",
    hint: "화살표를 방위(North, East, South, West)의 첫 글자로 바꿔보세요. 마지막 줄 4개의 타일이 정답입니다",
    imageUrl: "/questions/q6.png"
  },
  {
    id: 7,
    type: "text",
    question: "GKG가 의미하는 단어는? 영어로 답하세요.",
    answer: "KING",
    hint: "각 코드는 원래 단어의 마지막+첫번째+마지막 글자 순서입니다. 예) WINE → EWE",
    imageUrl: "/questions/q7.png"
  },
  {
    id: 8,
    type: "photo",
    question: "📷 미션: 바다에 떠다니는 '배'를 찾아 사진을 찍어 제출하세요! (실제 바다 위의 선박 사진이면 통과)",
    answer: "바다 위에 떠 있는 배(선박). 실제 바다·강·호수 등 수면 위에 떠 있는 배(여객선, 어선, 요트, 보트, 카누, 군함, 화물선 등)면 높은 점수를 준다. 배경에 물이 명확하게 보이고 배가 수면 위에 있어야 함. 종이접기 배·장난감 배·항구 안 정박 중인 배도 후하게 평가. 단순 항구 풍경이나 물 없이 육지에 있는 배는 낮은 점수.",
  },
  {
    id: 9,
    type: "text",
    question: "?에 들어갈 단어를 영어로 답하세요. (6글자)",
    answer: "OFFICE",
    hint: "스위치 상태(ON/OFF)를 양쪽 글자 사이에 그대로 끼워 넣어보세요.",
    imageUrl: "/questions/q9.png",
  },
  {
    id: 10,
    type: "text",
    question: "두 줄의 글자 '사이'를 읽어 단어를 만드세요. (영어 7글자)",
    answer: "COUNTRY",
    hint: "각 위치에서 위·아래 두 글자 사이에 오는 알파벳을 찾으세요.",
    imageUrl: "/questions/q10.png",
  },
  {
    id: 11,
    type: "updown",
    question: "카카오뱅크가 1000만 고객을 달성한 시기는? (YYYYMMDD 8자리 숫자)\n\n제출하면 정답이 더 위(↑)인지 아래(↓)인지 알려드립니다.",
    answer: "20190711",
  },
]
