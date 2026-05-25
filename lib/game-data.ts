export type QuestionType = "text" | "qr" | "photo"

export interface Question {
  id: number
  type: QuestionType
  question: string
  // text/qr: 비교할 정답 / photo: Claude가 비교할 목표 설명(서버 전용)
  answer: string
  hint?: string
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

export const HINT_PENALTY_SECONDS = 30
export const PHOTO_PASS_THRESHOLD = 70  // 사진 미션 통과 기준 점수
export const TOTAL_QUESTIONS = 9

export const SAMPLE_QUESTIONS: Question[] = [
  {
    id: 1,
    type: "text",
    question: "화살표가 방위를 나타낸다. ↑=N, →=E, ↓=S, ←=W 일 때, 다음 화살표를 해독하시오: ↑→←↓",
    answer: "NEWS",
    hint: "화살표 4개를 순서대로 방위 이름(North, East, West, South)의 첫 글자로 바꿔 이어붙이면 영단어가 됩니다"
  },
  {
    id: 2,
    type: "text",
    question: "다음 규칙을 보고 GKG를 해독하시오.\nENE → NINE\nKWK → WINK\nEWE → WINE",
    answer: "KING",
    hint: "첫 번째 글자는 버리고, '중간 글자 + 공통 두 글자 + 마지막 글자' 순으로 읽으세요. 세 예시에 공통으로 삽입된 두 글자를 찾아보세요"
  },
  {
    id: 3,
    type: "text",
    question: "각 카드 이름의 해당 번째 알파벳을 순서대로 이어붙이면?\nSPADE의 1번째\nHEART의 2번째\nDIAMOND의 3번째\nCLUB의 2번째",
    answer: "SEAL",
    hint: "카드 이름을 알파벳으로 나열하고 지정된 위치의 글자를 고르세요. DIAMOND는 D-I-A-M-O-N-D, 3번째는 A입니다"
  },
  {
    id: 4,
    type: "text",
    question: "A↔Z, B↔Y, C↔X ... 알파벳 역순 규칙으로 암호 'XSIRHGNZH'를 해독하면 어떤 날의 날짜인가? (숫자 4자리)",
    answer: "1225",
    hint: "알파벳 순서 1번(A)과 26번(Z)이 서로 대응됩니다. X는 3번째이니 반대쪽 3번째인 C로 변환됩니다. 해독하면 12월의 유명한 기념일 이름이 나옵니다"
  },
  {
    id: 5,
    type: "text",
    question: "어떤 달의 1일이 화요일이고 마지막 날이 31일이다. 31일은 무슨 요일인가?",
    answer: "목요일",
    hint: "7일마다 같은 요일이 반복됩니다. 1→8→15→22→29일이 모두 화요일이므로, 30일과 31일의 요일을 순서대로 구해보세요"
  },
  {
    id: 6,
    type: "text",
    question: "다음 수열의 빈칸을 채우시오: 1, 1, 2, 3, 5, 8, 13, 21, 34, ___",
    answer: "55",
    hint: "바로 앞의 두 수를 더하면 다음 수가 됩니다. 21+34=?"
  },
  {
    id: 7,
    type: "text",
    question: "1~9를 한 번씩 사용해 3×3 표를 채울 때, 가로·세로·대각선의 합이 모두 15가 되도록 한다. 이 마방진에서 가운데 칸에 들어갈 숫자는?",
    answer: "5",
    hint: "1~9의 합은 45이고, 3줄의 합이 모두 같으니 한 줄의 합은 15입니다. 가운데 칸은 가로·세로·대각선 4개의 합에 모두 포함됩니다. 4×15에서 나머지 8칸의 합을 빼면 가운데 값이 나옵니다"
  },
  {
    id: 8,
    type: "qr",
    question: "주변에 숨겨진 QR 코드를 찾아 스캔하세요! 코드 안에 탈출 암호가 들어 있습니다.",
    answer: "UNLOCK",
  },
  {
    id: 9,
    type: "photo",
    question: "📷 미션: '고구마'를 닮은 것을 찾아 사진을 찍어 제출하세요! (보라색이거나 길쭉한 덩이 모양이면 통과)",
    answer: "고구마를 닮은 사물 또는 자연물. 보라색 계열의 색이거나, 길쭉하고 둥근 덩이줄기 형태(고구마, 감자, 돌멩이, 가방, 신발 등)이면 높은 점수를 준다. 색이나 모양 중 하나라도 고구마와 비슷하면 후하게 평가할 것.",
  }
]
