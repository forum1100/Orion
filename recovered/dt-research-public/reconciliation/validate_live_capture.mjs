#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';

const [,, exportPath, livePath, outPath = 'reconciliation_report.json'] = process.argv;
if (!exportPath || !livePath) {
  console.error('Usage: node validate_live_capture.mjs <conversations.json> <live.jsonl> [report.json]');
  process.exit(2);
}

const readUtf8 = path => { const s = fs.readFileSync(path, 'utf8'); return s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s; };
const sha = text => crypto.createHash('sha256').update(String(text ?? ''), 'utf8').digest('hex');
const normText = value => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(normText).join('');
  if (value && typeof value === 'object') {
    if (Array.isArray(value.parts)) return value.parts.map(normText).join('');
    if ('text' in value) return normText(value.text);
  }
  return '';
};

function exportRecords(data) {
  const conversations = Array.isArray(data) ? data : [data];
  const rows = [];
  for (const conv of conversations) {    const conversationId = conv.id ?? conv.conversation_id ?? null;
    const title = conv.title ?? null;
    const mapping = conv.mapping ?? {};
    for (const [nodeId, node] of Object.entries(mapping)) {
      const message = node?.message;
      if (!message) continue;
      const role = message?.author?.role ?? null;
      const text = normText(message?.content);
      const messageId = message?.id ?? nodeId;
      rows.push({
        conversation_id: conversationId,
        conversation_title: title,
        node_id: nodeId,
        message_id: messageId,
        parent_id: node?.parent ?? null,
        role,
        create_time: message?.create_time ?? null,
        content_text: text,
        content_sha256: sha(text)
      });
    }
  }
  return rows;
}

function liveRecords(path) {
  const lines = fs.readFileSync(path, 'utf8').split(/\r?\n/).filter(Boolean);
  return lines.map((line, i) => {
    const row = JSON.parse(line);
    const text = row.content_text ?? row.text ?? normText(row.content);
    return { ...row, _line: i + 1, content_text: text, content_sha256: row.content_sha256 ?? sha(text) };
  });
}const exported = exportRecords(JSON.parse(readUtf8(exportPath)));
const live = liveRecords(livePath);
const liveByMessage = new Map(live.filter(r => r.message_id).map(r => [r.message_id, r]));
const matched = [];
const missing = [];
const mismatches = [];

for (const e of exported) {
  const l = liveByMessage.get(e.message_id);
  if (!l) {
    missing.push({type: 'MISSING_LIVE_CAPTURE', export: e});
    continue;
  }
  const issues = [];
  if ((l.conversation_id ?? null) !== e.conversation_id) issues.push('CONVERSATION_ID');
  if ((l.parent_id ?? l.parent_message_id ?? null) !== e.parent_id) issues.push('PARENTAGE');
  if ((l.role ?? null) !== e.role) issues.push('ROLE');
  if ((l.content_sha256 ?? '') !== e.content_sha256) issues.push('CONTENT');
  if (issues.length) mismatches.push({type: 'MISMATCH', issues, export: e, live: l});
  else matched.push(e.message_id);
}

const exportedIds = new Set(exported.map(r => r.message_id));
const extra = live.filter(r => r.message_id && !exportedIds.has(r.message_id))
  .map(r => ({type: 'EXTRA_LIVE_CAPTURE', live: r}));

const denominator = exported.length || 1;
const report = {
  generated_at: new Date().toISOString(),
  export_path: exportPath,
  live_path: livePath,
  exported_message_count: exported.length,
  live_message_count: live.length,
  exact_match_count: matched.length,
  exact_match_rate: matched.length / denominator,
  missing_count: missing.length,
  mismatch_count: mismatches.length,
  extra_count: extra.length,
  missing, mismatches, extra
};fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({
  exported_message_count: report.exported_message_count,
  live_message_count: report.live_message_count,
  exact_match_count: report.exact_match_count,
  exact_match_rate: report.exact_match_rate,
  missing_count: report.missing_count,
  mismatch_count: report.mismatch_count,
  extra_count: report.extra_count,
  report: outPath
}, null, 2));
