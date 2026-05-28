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
    question: "표에서 ?에 들어갈 숫자는?",
    answer: "20",
    hint: "맨 아래 행부터 시작해서 위로 올라가보세요. 각 숫자와 그 왼쪽·아래 숫자 사이의 관계를 찾아보세요",
    imageUrl: "/questions/q2.png"
  },
  {
    id: 3,
    type: "text",
    question: "다음이 의미하는 6글자 비밀 암호는?",
    answer: "CARBON",
    hint: "왼쪽 단어에서 일부 글자를 추출하고, 오른쪽은 B의 위치 관계를 영어로 표현해보세요",
    imageUrl: "/questions/q3.png"
  },
  {
    id: 4,
    type: "qr",
    question: "주변에 숨겨진 QR 코드를 찾아 스캔하세요! 올바른 QR 코드만 통과됩니다.",
    answer: "SIGNAL",
  },
  {
    id: 5,
    type: "text",
    question: "화살표를 알파벳으로 바꿔 단어를 해독하세요. (정답은 4글자, →=E, ↑=N, ↓=S, ←=W)",
    answer: "NEST",
    hint: "화살표를 방위(North, East, South, West)의 첫 글자로 바꿔보세요. 마지막 줄 4개의 타일이 정답입니다",
    imageUrl: "/questions/q5.png"
  },
  {
    id: 6,
    type: "text",
    question: "GKG가 의미하는 단어는? 영어로 답하세요.",
    answer: "KING",
    hint: "각 코드는 원래 단어의 마지막+첫번째+마지막 글자 순서입니다. 예) WINE → EWE",
    imageUrl: "/questions/q6.png"
  },
  {
    id: 7,
    type: "photo",
    question: "📷 미션: '고구마'를 닮은 것을 찾아 사진을 찍어 제출하세요! (보라색이거나 길쭉한 덩이 모양이면 통과)",
    answer: "고구마를 닮은 사물 또는 자연물. 보라색 계열의 색이거나, 길쭉하고 둥근 덩이줄기 형태(고구마, 감자, 돌멩이, 가방, 신발 등)이면 높은 점수를 준다. 색이나 모양 중 하나라도 고구마와 비슷하면 후하게 평가할 것.",
  },
  {
    id: 8,
    type: "text",
    question: "어떤 사람이 단어를 입력하려 했는데, 손의 위치가 잘못된 채로 타이핑을 해버렸습니다.\n출력된 암호를 보고 원래 단어를 맞춰보세요.\n\nQ W E R T Y U I O P\n A S D F G H J K L\n  Z X C V B N M\n\n암호: N T S O M D",
    answer: "BRAINS",
    hint: "키보드에서 각 암호 글자 주변의 키들을 살펴보세요. 손가락 위치가 어느 방향으로 틀어졌을까요?",
  },
  {
    id: 9,
    type: "text",
    question: "이번 워크샵에 참석한 인원수는? (숫자로 입력)",
    answer: "46",
  },
  {
    id: 10,
    type: "updown",
    question: "카카오뱅크가 1000만 고객을 달성한 시기는? (YYYYMMDD 8자리 숫자)\n\n제출하면 정답이 더 위(↑)인지 아래(↓)인지 알려드립니다.",
    answer: "20190711",
  },
  {
    id: 11,
    type: "text",
    question: "두 줄의 글자 '사이'를 읽어 단어를 만드세요. (영어 7글자)",
    answer: "COUNTRY",
    hint: "각 위치에서 위·아래 두 글자 사이에 오는 알파벳을 찾으세요.",
    imageUrl: "/questions/q11.png",
  },
]
