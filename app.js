'use strict';
// HF Registry - "Fill from report" reader.
// A callable Cloud Function: the app sends 1-6 page images (or a PDF) of a report,
// Claude reads them, and the function returns field values for the doctor to review.
// The Anthropic API key lives only here (Secret Manager), never in index.html.
// Images are not stored or logged.

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret, defineString, defineInt } = require('firebase-functions/params');
const logger = require('firebase-functions/logger');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const Anthropic = require('@anthropic-ai/sdk');
const lib = require('./lib');

initializeApp();

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');
const AI_MODEL = defineString('AI_MODEL', { default: 'claude-sonnet-5' });
const DAILY_PAGE_LIMIT = defineInt('DAILY_PAGE_LIMIT', { default: 150 });

// Keep in step with AI_REGION in the app (index.html, CFAI config).
const REGION = 'europe-west1';

exports.extractReport = onCall({
  region: REGION,
  secrets: [ANTHROPIC_API_KEY],
  timeoutSeconds: 180,
  memory: '512MiB',
  maxInstances: 5,
  cors: true
}, async (req) => {
  try { return await handle(req); }
  catch (e) {
    if (e instanceof HttpsError) throw e;
    // unexpected server fault: log the reason (never the images) and show it in the app
    logger.error('extractReport failed', { message: String(e && e.message || e).slice(0, 300), stack: String(e && e.stack || '').slice(0, 800) });
    throw new HttpsError('internal', 'Server error: ' + String(e && e.message || e).slice(0, 160));
  }
});

async function handle(req) {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Please sign in first.');
  const data = req.data || {};
  const mode = data.mode === 'visit' ? 'visit' : 'admission';

  let content;
  try { content = lib.toContent(data.images); }
  catch (e) { throw new HttpsError('invalid-argument', e.message); }

  // Per-user daily page cap (protects the budget from a stuck loop or a leaked login).
  const today = new Date().toISOString().slice(0, 10);
  const db = getFirestore();
  const usageRef = db.collection('aiUsage').doc(req.auth.uid + '_' + today);
  const pages = content.length;
  await db.runTransaction(async (t) => {
    const snap = await t.get(usageRef);
    const used = snap.exists ? (snap.data().pages || 0) : 0;
    if (used + pages > DAILY_PAGE_LIMIT.value()) {
      throw new HttpsError('resource-exhausted', 'Daily limit reached (' + DAILY_PAGE_LIMIT.value() + ' pages per user). Try again tomorrow.');
    }
    t.set(usageRef, { uid: req.auth.uid, date: today, pages: used + pages, requests: (snap.exists ? (snap.data().requests || 0) : 0) + 1, updated: FieldValue.serverTimestamp() }, { merge: true });
  });

  const model = AI_MODEL.value();
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value(), maxRetries: 2 });
  const userText = 'Today is ' + (lib.isoOrEmpty(data.today) || today) + '. ' +
    (pages > 1 ? 'These ' + pages + ' pages belong to one report. ' : '') +
    'Read the document and call fill_registry with everything you can place.';

  let msg;
  try {
    msg = await client.messages.create({
      model,
      max_tokens: 8000,
      system: [{ type: 'text', text: lib.buildSystem(mode), cache_control: { type: 'ephemeral' } }],
      tools: [lib.TOOL],
      tool_choice: { type: 'tool', name: lib.TOOL.name },
      messages: [{ role: 'user', content: content.concat([{ type: 'text', text: userText }]) }]
    });
  } catch (e) {
    // Log only the status and message - never the request (it contains patient images).
    logger.error('Claude API error', { status: e.status, message: String(e.message || '').slice(0, 300) });
    if (e.status === 401) throw new HttpsError('failed-precondition', 'The AI key is missing or wrong. Re-run: firebase functions:secrets:set ANTHROPIC_API_KEY');
    if (e.status === 429 || e.status === 529) throw new HttpsError('unavailable', 'The AI service is busy. Please try again in a minute.');
    if (e.status === 400) throw new HttpsError('invalid-argument', 'The AI service could not read these pages (' + String(e.message || '').slice(0, 160) + ').');
    throw new HttpsError('internal', 'The AI service failed. Please try again.');
  }

  const block = (msg.content || []).find(b => b.type === 'tool_use');
  if (!block) throw new HttpsError('internal', 'No result came back. Please try again.');
  const result = lib.sanitize(block.input, mode);
  if (msg.stop_reason === 'max_tokens') result.flags.unshift('The report was very long and the reading was cut short. Check for missing items or send fewer pages at a time.');

  const u = msg.usage || {};
  const usage = {
    input_tokens: u.input_tokens || 0, output_tokens: u.output_tokens || 0,
    cache_read_input_tokens: u.cache_read_input_tokens || 0, cache_creation_input_tokens: u.cache_creation_input_tokens || 0,
    est_cost_usd: lib.estimateCost(model, u)
  };
  logger.info('extractReport ok', { uid: req.auth.uid, mode, pages, model, usage, fields: result.fields.length, meds: result.medications.length });
  return { mode, model, pages, usage, result };
}
