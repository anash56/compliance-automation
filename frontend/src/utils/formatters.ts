// src/utils/formatters.ts

/**
 * Formats a numeric value into Indian Rupee currency format (e.g. ₹1,50,000)
 */
export const formatCurrency = (amount: number): string => {
  if (isNaN(amount)) return '₹0';
  return `₹${amount.toLocaleString('en-IN')}`;
};

/**
 * Formats a date object or date string into Indian standard date (e.g. 15 Jul 2026)
 */
export const formatDate = (date: Date | string): string => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

/**
 * Formats a date to full display format with weekday (e.g. Wed, 15 Jul 2026)
 */
export const formatDateWithDay = (date: Date | string): string => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};
