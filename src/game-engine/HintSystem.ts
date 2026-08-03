export type HintType = 'visual' | 'text' | 'audio';

export interface Hint {
  id: string;
  text: string;
  spokenText: string;
  type: HintType;
  shown: boolean;
}

const INACTIVITY_THRESHOLD_MS = 15000;
const CONSECUTIVE_WRONG_THRESHOLD = 2;
const NO_INTERACTION_THRESHOLD_MS = 3000;

export class HintSystem {
  private hints: Hint[];

  constructor(hints: Hint[]) {
    this.hints = hints;
  }

  getNextHint(): Hint | null {
    for (const hint of this.hints) {
      if (!hint.shown) {
        return hint;
      }
    }
    return null;
  }

  markHintShown(id: string): void {
    const hint = this.hints.find((h) => h.id === id);
    if (hint) {
      hint.shown = true;
    }
  }

  shouldShowHint(
    elapsedMs: number,
    incorrectStreak: number,
    hintsShown: number
  ): boolean {
    const hasUnshownHints = this.getNextHint() !== null;
    if (!hasUnshownHints) {
      return false;
    }

    if (incorrectStreak >= CONSECUTIVE_WRONG_THRESHOLD) {
      return true;
    }

    if (elapsedMs >= NO_INTERACTION_THRESHOLD_MS && hintsShown < 1) {
      return true;
    }

    if (elapsedMs >= INACTIVITY_THRESHOLD_MS) {
      return true;
    }

    return false;
  }

  getRemainingHintCount(): number {
    return this.hints.filter((h) => !h.shown).length;
  }

  getAllHints(): readonly Hint[] {
    return this.hints;
  }

  getHintById(id: string): Hint | undefined {
    return this.hints.find((h) => h.id === id);
  }

  getHintsByType(type: HintType): Hint[] {
    return this.hints.filter((h) => h.type === type);
  }

  areAllHintsShown(): boolean {
    return this.hints.every((h) => h.shown);
  }

  reset(): void {
    for (const hint of this.hints) {
      hint.shown = false;
    }
  }
}

export default HintSystem;
