'use strict';

// Shared helpers for API routes: pagination, sorting, date windows, and
// sanitization of submission rows so no sensitive fields can ever leak.

const { CATEGORIES } = require('./text');

const CATEGORY_SET = new Set(CATEGORIES);
const MAX_CATEGORY_LEN = 40;
const MAX_PROBLEM_LEN = 5000;
const MAX_SOLUTION_LEN = 5000;
const MAX_LOCATION_LEN = 80;

function cleanCategory(raw) {
  const cat = String(raw || '').trim().toLowerCase();
  if (!cat) return 'other';
  return CATEGORY_SET.has(cat) ? cat : 'other';
}

function cleanLocation(raw) {
  const loc = String(raw || '').trim().replace(/\s+/g, ' ');
  if (!loc) return null;
  return loc.slice(0, MAX_LOCATION_LEN);
}

function cleanText(raw, max) {
  return String(raw || '').trim().slice(0, max);
}

// Validate a submission payload; returns { ok, data } or { ok, error }.
function validateSubmission(body) {
  const problem = cleanText(body && body.problem, MAX_PROBLEM_LEN);
  const desiredSolution = cleanText(body && body.desiredSolution, MAX_SOLUTION_LEN);
  if (problem.length < 10) {
    return { ok: false, error: 'Please describe your problem in at least a few words.' };
  }
  if (desiredSolution.length < 5) {
    return { ok: false, error: 'Please tell us a little about what would make it better.' };
  }
  const category = cleanCategory(body && body.category);
  const broadLocation = cleanLocation(body && body.broadLocation);
  return { ok: true, data: { problem, desiredSolution, category, broadLocation } };
}

function nowIso() {
  return new Date().toISOString();
}

// Pagination params from query string (with hard caps).
function paging(query, defaultLimit = 20, maxLimit = 200) {
  let page = Math.max(1, parseInt(query.page, 10) || 1);
  let limit = Math.max(1, parseInt(query.limit, 10) || defaultLimit);
  limit = Math.min(maxLimit, limit);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

function parseBool(v) {
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

function toInt(v, def = 0) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
}

// Date window helpers — always UTC day boundaries.
function startOfDayUTC(date = new Date()) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}
function startOfWeekUTC(date = new Date()) {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0 = Sunday
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - ((day + 6) % 7)); // Monday
  return d.toISOString();
}
function startOfMonthUTC(date = new Date()) {
  const d = new Date(date);
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

// Public-safe representation of a submission (no sensitive fields exist in the
// table, but this is the only shape the admin API ever returns).
function publicSubmission(row) {
  if (!row) return null;
  return {
    id: row.id,
    problem: row.problem,
    desiredSolution: row.desired_solution,
    category: row.category,
    broadLocation: row.broad_location || null,
    clusterId: row.cluster_id || null,
    createdAt: row.created_at,
  };
}

module.exports = {
  cleanCategory,
  cleanLocation,
  cleanText,
  validateSubmission,
  nowIso,
  paging,
  parseBool,
  toInt,
  startOfDayUTC,
  startOfWeekUTC,
  startOfMonthUTC,
  publicSubmission,
};
