/**
 * @file pipelineConfig.js
 * @description Central domain constants for the 50,000-deal Sales Pipeline.
 * Defines the canonical pipeline stages, sales team members, and virtualization geometry.
 */

export const STAGES = [
  'New Lead',
  'Contacted',
  'Demo Done',
  'Proposal Sent',
  'Negotiation',
  'Won',
  'Lost',
];

export const STAGE_COLORS = {
  'New Lead': 'bg-slate-800 text-slate-200 border-slate-700',
  'Contacted': 'bg-sky-950/80 text-sky-300 border-sky-800',
  'Demo Done': 'bg-indigo-950/80 text-indigo-300 border-indigo-800',
  'Proposal Sent': 'bg-violet-950/80 text-violet-300 border-violet-800',
  'Negotiation': 'bg-amber-950/80 text-amber-300 border-amber-800',
  'Won': 'bg-emerald-950/80 text-emerald-300 border-emerald-800',
  'Lost': 'bg-rose-950/80 text-rose-300 border-rose-800',
};

export const SALES_REPS = [
  'Priya', 'Rahul', 'Ananya', 'Vikram', 'Sneha',
  'Rohan', 'Kavita', 'Arjun', 'Meera', 'Kabir',
  'Zoya', 'Dev', 'Nisha', 'Aditya', 'Pooja',
  'Siddharth', 'Tara', 'Varun', 'Ishaan', 'Diya'
];

export const VIRTUALIZATION_CONFIG = {
  ROW_HEIGHT: 48,
  VIEWPORT_HEIGHT: 528, // 11 visible rows * 48px
  OVERSCAN_COUNT: 5,    // Extra buffer rows above and below viewport
};
