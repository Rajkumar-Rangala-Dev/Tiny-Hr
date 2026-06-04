export interface PasswordValidation {
  valid: boolean;
  metRequirements: string[];
  unmetRequirements: string[];
  score: number;
}

export function validatePassword(password: string): PasswordValidation {
  const requirements = [
    { regex: /.{12,}/, label: 'At least 12 characters' },
    { regex: /[A-Z]/, label: 'One uppercase letter (A-Z)' },
    { regex: /[a-z]/, label: 'One lowercase letter (a-z)' },
    { regex: /[0-9]/, label: 'One number (0-9)' },
    {
      regex: /[!@#$%^&*()_+\-=\[\]{};:'"<>?/\\|`~]/,
      label: 'One special character',
    },
  ];

  const met = requirements.filter((req) => req.regex.test(password));
  const unmet = requirements.filter((req) => !req.regex.test(password));

  return {
    valid: unmet.length === 0,
    metRequirements: met.map((r) => r.label),
    unmetRequirements: unmet.map((r) => r.label),
    score: Math.round((met.length / requirements.length) * 100),
  };
}

export function getPasswordStrengthColor(score: number): string {
  if (score < 40) return 'bg-red-500';
  if (score < 60) return 'bg-yellow-500';
  if (score < 80) return 'bg-lime-500';
  return 'bg-green-500';
}

export function getPasswordStrengthLabel(score: number): string {
  if (score < 20) return 'Very Weak';
  if (score < 40) return 'Weak';
  if (score < 60) return 'Fair';
  if (score < 80) return 'Good';
  return 'Strong';
}
