export type WorldId = 'forest' | 'ocean' | 'desert' | 'space' | 'garden' | 'arctic';

export type RewardType = 'seed' | 'star' | 'piece' | 'badge' | 'trophy';

export interface Reward {
  id: string;
  name: string;
  emoji: string;
  type: RewardType;
  description?: string;
}

export interface AvatarOption {
  id: string;
  emoji: string;
  name: string;
}

export const AVATAR_OPTIONS: AvatarOption[] = [
  { id: 'cat', emoji: '\uD83D\uDC31', name: 'Cat' },
  { id: 'dog', emoji: '\uD83D\uDC36', name: 'Dog' },
  { id: 'bunny', emoji: '\uD83D\uDC30', name: 'Bunny' },
  { id: 'bear', emoji: '\uD83D\uDC3B', name: 'Bear' },
  { id: 'fox', emoji: '\uD83E\uDD8A', name: 'Fox' },
  { id: 'panda', emoji: '\uD83D\uDC3C', name: 'Panda' },
  { id: 'monkey', emoji: '\uD83D\uDC35', name: 'Monkey' },
  { id: 'lion', emoji: '\uD83E\uDD81', name: 'Lion' },
  { id: 'frog', emoji: '\uD83D\uDC38', name: 'Frog' },
  { id: 'owl', emoji: '\uD83E\uDD89', name: 'Owl' },
  { id: 'penguin', emoji: '\uD83D\uDC27', name: 'Penguin' },
  { id: 'chick', emoji: '\uD83D\uDC24', name: 'Chick' },
  { id: 'dragon', emoji: '\uD83D\uDC32', name: 'Dragon' },
  { id: 'unicorn', emoji: '\uD83E\uDD84', name: 'Unicorn' },
  { id: 'turtle', emoji: '\uD83D\uDC22', name: 'Turtle' },
  { id: 'dolphin', emoji: '\uD83D\uDC2C', name: 'Dolphin' },
];

export const AVATAR_DEFAULT_COLORS = [
  '#FFB74D', '#BA68C8', '#81C784', '#64B5F6',
  '#FF8A65', '#4DD0E1', '#AED581', '#FFD54F',
];

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'play';

export type AnimationType = 'fadeIn' | 'slideUp';

export interface ChildModalButton {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
}
