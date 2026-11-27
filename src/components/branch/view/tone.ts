import { BRANCH_TONES, type BranchTone } from '@/lib/branch-status';

/**
 * The fill of a tone without its border colour: a highlighted box takes `border-primary`, and two
 * border colour classes on one view would resolve by stylesheet order, not by the order written.
 */
export const toneBackground = (tone: BranchTone) =>
  BRANCH_TONES[tone].box
    .split(' ')
    .filter((name) => name.startsWith('bg-'))
    .join(' ');
