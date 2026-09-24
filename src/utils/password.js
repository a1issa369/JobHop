// Mandatory to even submit: 8+ chars, one uppercase, one lowercase, one
// special character. The meter then rates strength beyond that minimum bar
// so "meets the minimum" and "Strong" aren't the same thing - length and a
// digit push it from Medium (orange) into Strong (green).
export function analyzePassword(password) {
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const longEnough = password.length >= 8;
  const veryLong = password.length >= 12;

  const meetsMinimum = hasUpper && hasLower && hasSpecial && longEnough;

  let level = 'weak';
  if (meetsMinimum) {
    level = veryLong && hasNumber ? 'strong' : 'medium';
  }

  return {
    hasUpper,
    hasLower,
    hasSpecial,
    hasNumber,
    longEnough,
    meetsMinimum,
    level // 'weak' | 'medium' | 'strong'
  };
}

export const LEVEL_LABEL = { weak: 'Weak', medium: 'Medium', strong: 'Strong' };
export const LEVEL_COLOR = { weak: '#E2574C', medium: '#F2A63A', strong: '#4CAF7D' };
export const LEVEL_WIDTH = { weak: '33%', medium: '66%', strong: '100%' };
