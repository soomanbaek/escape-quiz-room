import { GameState, TeamState, TEAM_NAMES, TOTAL_QUESTIONS } from "./game-data"

function createInitialTeams(): TeamState[] {
  return TEAM_NAMES.map((name, index) => ({
    teamId: index + 1,
    teamName: name,
    currentQuestion: 1,
    hintsUsed: 0,
    penaltySeconds: 0,
    startTime: null,
    endTime: null,
    isFinished: false,
    hasPlayer: false,
    playerSessionId: null
  }))
}

let gameState: GameState = {
  isStarted: false,
  startTime: null,
  teams: createInitialTeams()
}

export function getGameState(): GameState {
  return gameState
}

export function startGame(): GameState {
  const now = Date.now()
  gameState = {
    isStarted: true,
    startTime: now,
    teams: gameState.teams.map(team => ({
      ...team,
      startTime: now,
      currentQuestion: 1,
      hintsUsed: 0,
      penaltySeconds: 0,
      endTime: null,
      isFinished: false,
      hasPlayer: false,
      playerSessionId: null
    }))
  }
  return gameState
}

export function resetGame(): GameState {
  gameState = {
    isStarted: false,
    startTime: null,
    teams: createInitialTeams()
  }
  return gameState
}

export function getTeamState(teamId: number): TeamState | undefined {
  return gameState.teams.find(t => t.teamId === teamId)
}

export function useHint(teamId: number): TeamState | undefined {
  const team = gameState.teams.find(t => t.teamId === teamId)
  if (team && gameState.isStarted && !team.isFinished) {
    team.hintsUsed += 1
    team.penaltySeconds += 30
  }
  return team
}

export function submitAnswer(teamId: number, isCorrect: boolean): TeamState | undefined {
  const team = gameState.teams.find(t => t.teamId === teamId)
  if (team && gameState.isStarted && !team.isFinished && isCorrect) {
    if (team.currentQuestion >= TOTAL_QUESTIONS) {
      team.isFinished = true
      team.endTime = Date.now()
    } else {
      team.currentQuestion += 1
    }
  }
  return team
}

// 플레이어 등록 (팀당 1명만 가능)
export function registerPlayer(teamId: number, sessionId: string): { success: boolean; team?: TeamState } {
  const team = gameState.teams.find(t => t.teamId === teamId)
  if (!team) return { success: false }
  
  // 이미 플레이어가 있고 다른 세션이면 실패
  if (team.hasPlayer && team.playerSessionId !== sessionId) {
    return { success: false, team }
  }
  
  // 같은 세션이면 성공 (재접속)
  if (team.playerSessionId === sessionId) {
    return { success: true, team }
  }
  
  // 새 플레이어 등록
  team.hasPlayer = true
  team.playerSessionId = sessionId
  return { success: true, team }
}

// 플레이어 해제
export function unregisterPlayer(teamId: number, sessionId: string): boolean {
  const team = gameState.teams.find(t => t.teamId === teamId)
  if (!team || team.playerSessionId !== sessionId) return false
  
  team.hasPlayer = false
  team.playerSessionId = null
  return true
}
