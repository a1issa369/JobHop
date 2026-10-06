// Single source of truth for stages. Both the Kanban board and the
// conversion chart read from this so the pipeline order only lives in one place.
export const STAGES = [
  { key: 'wishlist', label: 'Wishlist', color: '#6B7684', dot: 'bg-[#6B7684]' },
  { key: 'applied', label: 'Applied', color: '#5B8DB8', dot: 'bg-[#5B8DB8]' },
  { key: 'assessment', label: 'OA / Assessment', color: '#8B6DB8', dot: 'bg-[#8B6DB8]' },
  { key: 'phone_screen', label: 'Phone Screen', color: '#D9B84A', dot: 'bg-[#D9B84A]' },
  { key: 'onsite', label: 'Onsite / Final', color: '#F2A63A', dot: 'bg-[#F2A63A]' },
  { key: 'offer', label: 'Offer', color: '#4CAF7D', dot: 'bg-[#4CAF7D]' },
  { key: 'rejected', label: 'Rejected', color: '#E2574C', dot: 'bg-[#E2574C]' },
  { key: 'withdrawn', label: 'Withdrawn', color: '#3E4C5E', dot: 'bg-[#3E4C5E]' }
];

export const STAGE_MAP = Object.fromEntries(STAGES.map((s) => [s.key, s]));

// Where a card may start and where it may go next. The Sankey chart is built
// from stage changes and starts at Applied, so a card has to enter the
// pipeline through Applied to show up in it:
//   - a new card starts in Wishlist or Applied
//   - a Wishlist card can only move to Applied
//   - once it's past Wishlist, it can move to any stage
// `currentStage` is null/undefined for a card that doesn't exist yet. The
// database enforces the same rule (migration 018), so this is what keeps the
// UI from offering a move the server would refuse.
export const INITIAL_STAGE_KEYS = ['wishlist', 'applied'];

export function allowedStageKeys(currentStage) {
  if (!currentStage || currentStage === 'wishlist') return INITIAL_STAGE_KEYS;
  return STAGES.map((s) => s.key);
}

export function isStageChangeAllowed(currentStage, nextStage) {
  return allowedStageKeys(currentStage).includes(nextStage);
}

export function stageRuleMessage(currentStage) {
  return currentStage
    ? 'A Wishlist card can only move to Applied first.'
    : 'New cards can only start in Wishlist or Applied.';
}

// Stages counted as "still active" in the pipeline (used for funnel math).
export const FUNNEL_ORDER = ['applied', 'assessment', 'phone_screen', 'onsite', 'offer'];

// The only three allowed values for an application's work arrangement -
// deliberately a closed dropdown, not free text, so cards stay consistent
// and filterable instead of accumulating "Remote", "remote", "WFH", etc.
export const WORK_TYPES = [
  { key: 'remote', label: 'Remote' },
  { key: 'hybrid', label: 'Hybrid' },
  { key: 'onsite', label: 'Onsite' }
];
export const WORK_TYPE_MAP = Object.fromEntries(WORK_TYPES.map((w) => [w.key, w]));
