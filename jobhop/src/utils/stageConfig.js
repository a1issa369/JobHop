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

// Stages counted as "still active" in the pipeline (used for funnel math).
export const FUNNEL_ORDER = ['applied', 'assessment', 'phone_screen', 'onsite', 'offer'];
