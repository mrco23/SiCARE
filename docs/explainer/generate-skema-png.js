// Generates an SVG/HTML schema diagram (Schema Visualizer style) for SiCARE.
// Column flags: P = primary key, N = not null, U = unique. FK target as "table.col".
const fs = require('fs');
const out = process.argv[2];

const ts = (n, nn = true) => [n, 'timestamptz', nn ? 'N' : ''];
const T = {
  'auth.users': { col: 0, cols: [
    ['id','uuid','PN'],['email','varchar',''],['encrypted_password','varchar',''],['email_confirmed_at','timestamptz',''],
    ['phone','text','U'],['raw_user_meta_data','jsonb',''],['last_sign_in_at','timestamptz',''],['created_at','timestamptz',''],['updated_at','timestamptz',''],
  ], note: '+ kolom internal Supabase Auth' },
  'hero_motivations': { col: 0, cols: [['id','uuid','PN'],['content','text','N'],['is_active','bool','N'],ts('created_at'),ts('updated_at')] },
  'profiles': { col: 1, cols: [
    ['id','uuid','PN','auth.users.id'],['identity_code','text','U'],['full_name','text','N'],['app_role','text','N'],['member_category','text',''],
    ['account_status','text','N'],['phone_e164','text',''],['whatsapp_opt_in','bool','N'],ts('whatsapp_opt_in_at',false),['gender','text',''],
    ['siap_number','text',''],['sipp_silp_number','text',''],['sipp_silp_valid_until','date',''],ts('sipp_silp_updated_at',false),ts('created_at'),ts('updated_at'),
  ]},
  'counselor_profiles': { col: 2, cols: [
    ['profile_id','uuid','PN','profiles.id'],['public_name','text',''],['headline','text',''],['bio','text',''],['specialties','text[]','N'],
    ['years_experience','int4',''],['photo_path','text',''],['is_public','bool','N'],ts('created_at'),ts('updated_at'),
  ]},
  'counselor_history_credentials': { col: 2, cols: [['counselor_id','uuid','PN','profiles.id'],['password_hash','text','N'],ts('created_at'),ts('updated_at')] },
  'academic_periods': { col: 2, cols: [
    ['id','uuid','PN'],['academic_year','text','N'],['semester','text','N'],['starts_on','date','N'],['ends_on','date','N'],['is_published','bool','N'],ts('created_at'),ts('updated_at'),
  ]},
  'consent_templates': { col: 2, cols: [
    ['id','uuid','PN'],['template_code','text','N'],['version','text','N'],['title','text','N'],['description','text',''],['storage_bucket','text','N'],
    ['storage_path','text','N'],['mime_type','text','N'],['file_sha256','text','N'],['file_size_bytes','int8','N'],['is_active','bool','N'],
    ts('effective_at'),['created_by','uuid','','profiles.id'],ts('created_at'),ts('updated_at'),
  ]},
  'notifications': { col: 2, cols: [
    ['id','uuid','PN'],['recipient_user_id','uuid','N','profiles.id'],['type','text','N'],['title','text','N'],['body','text','N'],
    ['entity_type','text',''],['entity_id','uuid',''],ts('created_at'),ts('read_at',false),ts('updated_at'),
  ]},
  'audit_events': { col: 2, cols: [
    ['id','uuid','PN'],['actor_user_id','uuid','','profiles.id'],['action','text','N'],['entity_type','text','N'],['entity_id','uuid',''],['metadata','jsonb','N'],ts('created_at'),
  ]},
  'homepage_logo': { col: 2, cols: [['id','int2','PN'],['storage_path','text','N'],['alt_text','text','N'],['updated_by','uuid','','profiles.id'],ts('created_at'),ts('updated_at')] },
  'availability_slots': { col: 3, cols: [
    ['id','uuid','PN'],['counselor_id','uuid','N','profiles.id'],['academic_period_id','uuid','','academic_periods.id'],ts('starts_at'),ts('ends_at'),['status','text','N'],ts('created_at'),ts('updated_at'),
  ]},
  'bookings': { col: 4, cols: [
    ['id','uuid','PN'],['client_id','uuid','N','profiles.id'],['counselor_id','uuid','N','profiles.id'],['availability_slot_id','uuid','','availability_slots.id'],
    ['service_type','text','N'],['group_name','text',''],['participant_count','int4','N'],ts('starts_at'),ts('ends_at'),['status','text','N'],
    ['cancellation_reason','text',''],['reschedule_reason','text',''],ts('expired_at',false),['expired_reason','text',''],ts('created_at'),ts('updated_at'),
  ]},
  'booking_participants': { col: 5, cols: [
    ['id','uuid','PN'],['booking_id','uuid','N','bookings.id'],['display_name','text','N'],['is_representative','bool','N'],['user_id','uuid','','profiles.id'],
    ['participant_type','text','N'],['full_name','text',''],['faculty','text',''],['study_program','text',''],['nim','text',''],['birthplace','text',''],
    ['date_of_birth','date',''],['gender','text',''],['phone_e164','text',''],['is_primary','bool','N'],['participant_status','text','N'],
    ['religion','text',''],['education','text',''],['address','text',''],ts('created_at'),ts('updated_at'),
  ]},
  'booking_intakes': { col: 5, cols: [['booking_id','uuid','PN','bookings.id'],['client_id','uuid','N','profiles.id'],['answers','jsonb','N'],ts('created_at'),ts('updated_at')] },
  'counseling_sessions': { col: 5, cols: [
    ['id','uuid','PN'],['booking_id','uuid','NU','bookings.id'],['counselor_id','uuid','N','profiles.id'],ts('starts_at'),ts('ends_at'),['status','text','N'],
    ['format','text','N'],['room','text',''],ts('started_at',false),ts('completed_at',false),['missed_reason','text',''],ts('missed_at',false),
    ts('auto_completed_at',false),ts('created_at'),ts('updated_at'),
  ]},
  'whatsapp_outbox': { col: 5, cols: [
    ['id','uuid','PN'],['booking_id','uuid','N','bookings.id'],['recipient_user_id','uuid','','profiles.id'],['booking_participant_id','uuid','','booking_participants.id'],
    ['message_type','text','N'],ts('scheduled_at'),['status','text','N'],['idempotency_key','text','NU'],['attempt_count','int4','N'],['max_attempts','int4','N'],
    ts('next_attempt_at',false),ts('last_attempt_at',false),ts('locked_at',false),['locked_by','text',''],ts('lease_expires_at',false),['phone_e164','text',''],
    ['payload','jsonb','N'],['provider_message_id','text',''],['provider_request_id','text',''],['provider_state_id','text',''],['provider_status','text',''],
    ['provider_state','text',''],['provider_response','jsonb',''],['last_error_code','text',''],['last_error_message','text',''],['error_category','text',''],
    ts('sent_at',false),ts('delivered_at',false),ts('created_at'),ts('updated_at'),
  ]},
  'session_notes': { col: 6, cols: [
    ['session_id','uuid','PN','counseling_sessions.id'],['counselor_id','uuid','N','profiles.id'],['counselor_note','text',''],['client_note','text',''],['follow_up','text',''],ts('created_at'),ts('updated_at'),
  ]},
  'feedback': { col: 6, cols: [
    ['id','uuid','PN'],['session_id','uuid','N','counseling_sessions.id'],['client_id','uuid','N','profiles.id'],['counselor_id','uuid','N','profiles.id'],
    ['rating','int2','N'],['comment','text',''],['moderation_status','text','N'],['review_status','text','N'],['disabled_reason','text',''],ts('created_at'),ts('updated_at'),
  ]},
  'informed_consents': { col: 6, cols: [
    ['id','uuid','PN'],['booking_id','uuid','N','bookings.id'],['session_id','uuid','','counseling_sessions.id'],['booking_participant_id','uuid','N','booking_participants.id'],
    ['consent_template_id','uuid','N','consent_templates.id'],['status','text','N'],['signer_user_id','uuid','','profiles.id'],['signer_name_snapshot','text',''],
    ['identity_snapshot','jsonb','N'],['consent_statement_version','text','N'],ts('viewed_at',false),ts('signed_at',false),ts('revoked_at',false),
    ['revocation_reason','text',''],['signature_method','text',''],['signature_storage_path','text',''],['signed_document_storage_path','text',''],
    ['signed_document_sha256','text',''],['signed_document_size_bytes','int8',''],ts('created_at'),ts('updated_at'),
  ]},
  'consent_invitations': { col: 7, cols: [
    ['id','uuid','PN'],['booking_participant_id','uuid','N','booking_participants.id'],['consent_id','uuid','','informed_consents.id'],['invitation_type','text','N'],
    ['recipient_phone_e164','text',''],['recipient_email','text',''],['token_hash','text','NU'],['status','text','N'],ts('expires_at'),ts('sent_at',false),
    ts('claimed_at',false),['claimed_by_user_id','uuid','','profiles.id'],ts('completed_at',false),ts('revoked_at',false),['revoked_by','uuid','','profiles.id'],
    ['created_by','uuid','','profiles.id'],ts('created_at'),ts('updated_at'),
  ]},
  'consent_invitation_secrets': { col: 8, cols: [
    ['invitation_id','uuid','PN','consent_invitations.id'],['encrypted_token','text','N'],['iv','text','N'],['auth_tag','text','N'],['key_version','text','N'],ts('created_at'),ts('cleared_at',false),
  ]},
  'consent_audit_logs': { col: 8, cols: [
    ['id','uuid','PN'],['consent_id','uuid','','informed_consents.id'],['booking_participant_id','uuid','','booking_participants.id'],['booking_id','uuid','','bookings.id'],
    ['invitation_id','uuid','','consent_invitations.id'],['actor_user_id','uuid','','profiles.id'],['actor_type','text','N'],['event_type','text','N'],
    ts('event_timestamp'),['metadata','jsonb','N'],['request_id','text',''],ts('created_at'),
  ]},
};

// ---------- layout ----------
const W = 320, HEAD = 42, ROW = 30, NOTE = 26, COLGAP = 170, ROWGAP = 56, MARGIN = 70, TOP = 170;
const order = {}; // keep declaration order within column
Object.keys(T).forEach(k => { const c = T[k].col; (order[c] ||= []).push(k); });
const colH = {};
for (const c in order) {
  let y = TOP;
  for (const k of order[c]) {
    const t = T[k];
    t.h = HEAD + t.cols.length * ROW + (t.note ? NOTE : 0) + 4;
    t.x = MARGIN + c * (W + COLGAP);
    t.y = y;
    y += t.h + ROWGAP;
  }
  colH[c] = y;
}
// vertically centre shorter columns against the tallest
const maxH = Math.max(...Object.values(colH));
for (const c in order) { const off = Math.round((maxH - colH[c]) / 2); order[c].forEach(k => T[k].y += off); }
const nCols = Math.max(...Object.keys(order).map(Number)) + 1;
const WIDTH = MARGIN * 2 + nCols * W + (nCols - 1) * COLGAP;
const HEIGHT = maxH + 60;
const rowCY = (k, cname) => { const t = T[k]; const i = t.cols.findIndex(c => c[0] === cname); return t.y + HEAD + i * ROW + ROW / 2; };

// ---------- edges ----------
const edges = [];
for (const k in T) T[k].cols.forEach(c => { if (c[3]) { const parts = c[3].split('.'); const col = parts.pop(); edges.push({ child: k, ccol: c[0], parent: parts.join('.'), pcol: col }); } });
// lane offsets per destination column so vertical segments don't overlap
const lanes = {};
edges.forEach(e => { const c = T[e.child].col; (lanes[c] ||= []).push(e); });
for (const c in lanes) {
  lanes[c].sort((a, b) => rowCY(a.parent, a.pcol) - rowCY(b.parent, b.pcol));
  const n = lanes[c].length, span = COLGAP - 50;
  lanes[c].forEach((e, i) => { e.laneX = T[e.child].x - 25 - (n > 1 ? (i * span) / (n - 1) : span / 2); });
}
const R = 10;
function smooth(x1, y1, mx, x2, y2) {
  if (Math.abs(y2 - y1) < 1) return `M${x1},${y1} H${x2}`;
  const s = y2 > y1 ? 1 : -1, r = Math.min(R, Math.abs(y2 - y1) / 2);
  return `M${x1},${y1} H${mx - r} Q${mx},${y1} ${mx},${y1 + s * r} V${y2 - s * r} Q${mx},${y2} ${mx + r},${y2} H${x2}`;
}
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

// ---------- icons ----------
const keyIcon = (x, y) => `<g transform="translate(${x},${y})" fill="none" stroke="#a0a0a0" stroke-width="1.6" stroke-linecap="round"><circle cx="4.5" cy="7" r="3.2"/><path d="M7.5 7 H14 M11.5 7 V10 M14 7 V9.5"/></g>`;
const diamond = (x, y, filled) => `<path transform="translate(${x},${y})" d="M7 2 L12 7 L7 12 L2 7 Z" ${filled ? 'fill="#a0a0a0"' : 'fill="none"'} stroke="#a0a0a0" stroke-width="1.4"/>`;
const uniq = (x, y) => `<g transform="translate(${x},${y})" fill="none" stroke="#a0a0a0" stroke-width="1.3" stroke-linecap="round"><path d="M3 9 C3 4 11 4 11 9"/><path d="M5 11 C5 7 9 7 9 11"/><path d="M7 9 V12.5"/><path d="M1.5 6 C3 1.5 11 1.5 12.5 6"/></g>`;
const tableIcon = (x, y) => `<g transform="translate(${x},${y})" fill="none" stroke="#8a8a8a" stroke-width="1.4"><rect x="1" y="1" width="14" height="12" rx="2"/><path d="M1 5 H15 M6 5 V13"/></g>`;

let svg = '';
// background dots
svg += `<defs><pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#2a2a2a"/></pattern></defs>`;
svg += `<rect width="${WIDTH}" height="${HEIGHT}" fill="#121212"/><rect width="${WIDTH}" height="${HEIGHT}" fill="url(#dots)"/>`;
// title + legend
svg += `<text x="${MARGIN}" y="72" font-family="Segoe UI, Arial, sans-serif" font-size="34" font-weight="600" fill="#ededed">Skema Database SiCARE</text>`;
svg += `<text x="${MARGIN}" y="106" font-family="Segoe UI, Arial, sans-serif" font-size="17" fill="#8f8f8f">Supabase PostgreSQL · schema public (21 tabel) + auth.users · berdasarkan supabase/migrations per 17 November 2026</text>`;
let lx = WIDTH - MARGIN - 760;
const leg = [[keyIcon, 'Primary key'], [uniq, 'Unique'], [(x, y) => diamond(x, y, false), 'Nullable'], [(x, y) => diamond(x, y, true), 'Non-nullable']];
svg += `<rect x="${lx - 20}" y="48" width="780" height="52" rx="8" fill="#1c1c1c" stroke="#2e2e2e"/>`;
leg.forEach(([fn, label]) => { svg += fn(lx, 66); svg += `<text x="${lx + 24}" y="79" font-family="Segoe UI, Arial, sans-serif" font-size="15" fill="#b4b4b4">${label}</text>`; lx += 150; });
svg += `<path d="M${lx} 74 H${lx + 34}" stroke="#4a8f6f" stroke-width="2"/><circle cx="${lx}" cy="74" r="3.5" fill="#3ecf8e"/><circle cx="${lx + 34}" cy="74" r="3.5" fill="#3ecf8e"/><text x="${lx + 44}" y="79" font-family="Segoe UI, Arial, sans-serif" font-size="15" fill="#b4b4b4">Foreign key</text>`;

// edges below cards
svg += '<g fill="none" stroke="#4a8f6f" stroke-width="1.6" opacity="0.85">';
for (const e of edges) {
  const P = T[e.parent], C = T[e.child];
  const y1 = rowCY(e.parent, e.pcol), y2 = rowCY(e.child, e.ccol);
  const x1 = P.x + W, x2 = C.x;
  svg += `<path d="${smooth(x1, y1, e.laneX, x2, y2)}"/>`;
}
svg += '</g>';

// cards
for (const k in T) {
  const t = T[k];
  svg += `<g>`;
  svg += `<rect x="${t.x}" y="${t.y}" width="${W}" height="${t.h}" rx="8" fill="#1c1c1c" stroke="#333" stroke-width="1.2"/>`;
  svg += `<path d="M${t.x} ${t.y + 8} a8 8 0 0 1 8 -8 h${W - 16} a8 8 0 0 1 8 8 v${HEAD - 8} h-${W} z" fill="#232323"/>`;
  svg += `<line x1="${t.x}" y1="${t.y + HEAD}" x2="${t.x + W}" y2="${t.y + HEAD}" stroke="#333"/>`;
  svg += tableIcon(t.x + 14, t.y + 14);
  svg += `<text x="${t.x + 40}" y="${t.y + 27}" font-family="Segoe UI, Arial, sans-serif" font-size="15.5" font-weight="600" fill="#ededed">${esc(k)}</text>`;
  t.cols.forEach(([name, type, flags, fk], i) => {
    const y = t.y + HEAD + i * ROW;
    if (i > 0) svg += `<line x1="${t.x}" y1="${y}" x2="${t.x + W}" y2="${y}" stroke="#262626"/>`;
    let ix = t.x + 12;
    const iy = y + 8;
    if (flags.includes('P')) svg += keyIcon(ix, iy);
    else if (flags.includes('U')) svg += uniq(ix, iy);
    else svg += diamond(ix, iy, flags.includes('N'));
    svg += `<text x="${t.x + 38}" y="${y + 20}" font-family="Consolas, 'Cascadia Mono', monospace" font-size="14" fill="${fk ? '#e6e6e6' : '#cfcfcf'}">${esc(name)}</text>`;
    svg += `<text x="${t.x + W - 14}" y="${y + 20}" text-anchor="end" font-family="Consolas, 'Cascadia Mono', monospace" font-size="13" fill="#7c7c7c">${esc(type)}</text>`;
  });
  if (t.note) svg += `<text x="${t.x + 14}" y="${t.y + HEAD + t.cols.length * ROW + 19}" font-family="Segoe UI, Arial, sans-serif" font-size="13" font-style="italic" fill="#7c7c7c">${esc(t.note)}</text>`;
  svg += `</g>`;
}
// handle dots on top of cards
const dots = new Set();
for (const e of edges) {
  dots.add(`${T[e.parent].x + W},${rowCY(e.parent, e.pcol)}`);
  dots.add(`${T[e.child].x},${rowCY(e.child, e.ccol)}`);
}
dots.forEach(d => { const [x, y] = d.split(','); svg += `<circle cx="${x}" cy="${y}" r="4" fill="#3ecf8e" stroke="#121212" stroke-width="1.5"/>`; });

const full = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">${svg}</svg>`;
fs.writeFileSync(out + '.svg', full);
fs.writeFileSync(out + '.html', `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#121212}</style></head><body>${full}</body></html>`);
console.log(JSON.stringify({ WIDTH, HEIGHT, tables: Object.keys(T).length, edges: edges.length }));
