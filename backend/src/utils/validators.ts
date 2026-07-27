// src/utils/validators.ts

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.toLowerCase());
};

export const validateFullName = (fullName: string): boolean => {
  const fullNameRegex = /^[a-zA-Z\s.'-]{2,50}$/;
  return fullNameRegex.test(fullName.trim());
};

export const validatePasswordStrength = (password: string): boolean => {
  const passwordStrengthRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  return passwordStrengthRegex.test(password);
};

export const validateGSTIN = (gstin: string): boolean => {
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
  return gstinRegex.test(gstin.trim().toUpperCase());
};

export const validatePAN = (pan: string): boolean => {
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
  return panRegex.test(pan.trim().toUpperCase());
};
