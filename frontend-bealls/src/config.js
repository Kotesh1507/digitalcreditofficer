/** Use Vite proxy in dev (works on 5175/5176/5177). Override with VITE_API_BASE if needed. */
export const API_BASE = import.meta.env.VITE_API_BASE || '';

export const PILOT_URL =
  import.meta.env.VITE_PILOT_URL || 'https://www.bealls.com';

export const DEFLECT_SCRIPT =
  "Good question. For a deeper dive on your stores and categories, scan the QR code — we'll set up a full session with the Bealls analytics team.";
