/**
 * @file formatters.js
 * @description Pure utility functions for Indian Rupee (INR) formatting and relative timestamps.
 */

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

/**
 * Formats a number in Indian numbering system (e.g., 5,00,000 -> ₹5,00,000)
 * @param {number} amount
 * @returns {string}
 */
export function formatINR(amount) {
  return inrFormatter.format(amount);
}

/**
 * Formats relative age in days into human-readable priority text
 * @param {number} daysAgo
 * @returns {string}
 */
export function formatDaysAgo(daysAgo) {
  if (daysAgo === 0) return 'Today';
  if (daysAgo === 1) return '1d ago';
  return `${daysAgo}d ago`;
}
