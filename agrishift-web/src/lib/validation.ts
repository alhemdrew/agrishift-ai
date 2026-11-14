export function validateEmail(value: string): string {
  const v = value.trim();
  if (!v) return "Enter your email address.";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? "" : "Enter a valid email address.";
}

export function validatePassword(value: string): string {
  if (!value) return "Enter a password.";
  if (value.length < 8) return "Use at least 8 characters.";
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) return "Include at least one letter and one number.";
  return "";
}

export function validateName(value: string): string {
  return value.trim().length < 2 ? "Enter your full name." : "";
}
