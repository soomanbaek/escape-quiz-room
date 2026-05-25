export interface Question {
  id: number
  question: string
  answer: string
  hint: string
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
  playerSessionId: string | null  // 플레이어 세션 ID
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
export const TOTAL_QUESTIONS = 7

export const SAMPLE_QUESTIONS: Question[] = [
  {
    id: 1,
    question: "HTML에서 하이퍼링크를 만들 때 사용하는 태그는 무엇인가요?",
    answer: "a",
    hint: "anchor의 첫 글자입니다"
  },
  {
    id: 2,
    question: "JavaScript에서 배열의 길이를 구할 때 사용하는 속성은?",
    answer: "length",
    hint: "영어로 '길이'를 의미하는 단어입니다"
  },
  {
    id: 3,
    question: "CSS에서 요소를 가운데 정렬할 때 margin에 주는 값은? (두 단어)",
    answer: "0 auto",
    hint: "자동으로 좌우 마진을 계산합니다"
  },
  {
    id: 4,
    question: "React에서 상태 관리를 위해 사용하는 Hook의 이름은?",
    answer: "useState",
    hint: "use로 시작하고 State로 끝납니다"
  },
  {
    id: 5,
    question: "Git에서 변경사항을 원격 저장소에 업로드하는 명령어는?",
    answer: "push",
    hint: "밀다는 의미의 영어 단어입니다"
  },
  {
    id: 6,
    question: "HTTP 상태 코드 중 '찾을 수 없음'을 나타내는 숫자는?",
    answer: "404",
    hint: "4로 시작하는 3자리 숫자입니다"
  },
  {
    id: 7,
    question: "TypeScript에서 타입을 정의할 때 사용하는 키워드 두 가지 중 하나는?",
    answer: "interface",
    hint: "인터페이스라고도 부르며 객체의 구조를 정의합니다"
  }
]
