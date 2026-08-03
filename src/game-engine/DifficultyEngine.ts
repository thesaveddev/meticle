export type DifficultyStage = 1 | 2 | 3 | 4 | 5;

export interface DifficultyInput {
  correct: number;
  incorrect: number;
  hintsUsed: number;
  totalAttempts: number;
  completionTimeMs: number;
  earlyExit: boolean;
  currentStage: DifficultyStage;
}

export interface StageParameters {
  itemCount: number;
  timeLimit: number | null;
  hintAvailability: number;
  complexity: number;
}

const STAGE_PARAMETERS: Record<DifficultyStage, StageParameters> = {
  1: {
    itemCount: 3,
    timeLimit: null,
    hintAvailability: 999,
    complexity: 1,
  },
  2: {
    itemCount: 4,
    timeLimit: null,
    hintAvailability: 3,
    complexity: 2,
  },
  3: {
    itemCount: 5,
    timeLimit: null,
    hintAvailability: 2,
    complexity: 3,
  },
  4: {
    itemCount: 6,
    timeLimit: 60,
    hintAvailability: 1,
    complexity: 4,
  },
  5: {
    itemCount: 8,
    timeLimit: 45,
    hintAvailability: 1,
    complexity: 5,
  },
};

const STAGE_MIN = 1;
const STAGE_MAX = 5;
const ACCURACY_INCREASE_THRESHOLD = 0.85;
const ACCURACY_DECREASE_THRESHOLD = 0.35;
const HINTS_INCREASE_THRESHOLD = 1;
const HINTS_DECREASE_THRESHOLD = 3;

export class DifficultyEngine {
  computeNextStage(input: DifficultyInput): DifficultyStage {
    const { correct, incorrect, hintsUsed, totalAttempts, earlyExit, currentStage } = input;

    if (totalAttempts <= 0) {
      return currentStage;
    }

    const accuracy = correct / Math.max(totalAttempts, 1);
    const earlyExitCount = earlyExit ? 1 : 0;

    let shouldIncrease = false;
    let shouldDecrease = false;

    if (accuracy >= ACCURACY_INCREASE_THRESHOLD && hintsUsed <= HINTS_INCREASE_THRESHOLD) {
      shouldIncrease = true;
    }

    if (
      accuracy <= ACCURACY_DECREASE_THRESHOLD ||
      hintsUsed > HINTS_DECREASE_THRESHOLD ||
      earlyExitCount > 0
    ) {
      shouldDecrease = true;
    }

    if (shouldIncrease && !shouldDecrease) {
      return Math.min(currentStage + 1, STAGE_MAX) as DifficultyStage;
    }

    if (shouldDecrease && !shouldIncrease) {
      return Math.max(currentStage - 1, STAGE_MIN) as DifficultyStage;
    }

    return currentStage;
  }

  getStageParameters(stage: DifficultyStage): StageParameters {
    return { ...STAGE_PARAMETERS[stage] };
  }

  getStageDescription(stage: DifficultyStage): string {
    const p = STAGE_PARAMETERS[stage];
    const timeInfo = p.timeLimit !== null ? `${p.timeLimit}s timer` : 'no timer';
    const hintInfo =
      p.hintAvailability >= 999
        ? 'unlimited hints'
        : `${p.hintAvailability} hint${p.hintAvailability === 1 ? '' : 's'}`;
    return `Stage ${stage}: ${p.itemCount} items, ${timeInfo}, ${hintInfo}`;
  }
}

export default DifficultyEngine;
