/**
 * EfxUtil.js — pure helpers shared by RawLog.js, EfxApi.js and N8n.js  (fork: employee_management_v2_efx)
 *
 *   efxRedact_(v)        deep-copies v replacing values whose key matches EFX_SECRET_KEY_RE with '[REDACTED]'
 *   efxJsonSafe(v)       deep-converts Dates to ISO strings so Execution API returns are JSON-safe
 *   efxSign_(secret,env) HMAC-SHA256 over the canonical event envelope (signed webhook fan-out)
 *
 * All three are plain function declarations (hoisted across files) and are only called at runtime from function bodies,
 * so file order does not matter; callers call efxRedact_ unguarded on purpose — a missing file must fail closed (pass-3 F2). Moved verbatim from
 * RawLog.js / EfxApi.js (review pass 2 §5). No sheet access, no side effects.
 */

/**
 * Redacts credential-like keys anywhere in an object (deep). The Raw Log sheet keeps the full payload as before
 * (recovery net, prod behaviour), but nothing leaving the sheet via API/webhook may carry passwords (review F2).
 */
var EFX_SECRET_KEY_RE = /password|passwd|pwd|secret|token|apikey|api_key|vm_?pin|Email_Temp_Password/i;
function efxRedact_(v, depth) {
  depth = depth || 0;
  if (depth > 6 || v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(function (x) { return efxRedact_(x, depth + 1); });
  var out = {};
  Object.keys(v).forEach(function (k) {
    out[k] = EFX_SECRET_KEY_RE.test(k) ? (v[k] === '' || v[k] === null || v[k] === undefined ? v[k] : '[REDACTED]') : efxRedact_(v[k], depth + 1);
  });
  return out;
}

/** Deep-converts Dates to ISO strings so Execution API returns are JSON-safe. */
function efxJsonSafe(v, depth) {
  depth = depth || 0;
  if (v instanceof Date) return isNaN(v.getTime()) ? '' : v.toISOString();
  if (depth > 8 || v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(function (x) { return efxJsonSafe(x, depth + 1); });
  var out = {};
  Object.keys(v).forEach(function (k) { out[k] = efxJsonSafe(v[k], depth + 1); });
  return out;
}

/** Same canonical/HMAC as the bridge's Auth.js (kept tiny here to avoid a dependency). */
function efxSign_(secret, env) {
  function hex(bytes) { return bytes.map(function (b) { b = (b + 256) % 256; return (b < 16 ? '0' : '') + b.toString(16); }).join(''); }
  function stable(v) {
    if (v === undefined) return 'null';
    if (v === null || typeof v !== 'object') return JSON.stringify(v);
    if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
    return '{' + Object.keys(v).filter(function (k) { return v[k] !== undefined; }).sort().map(function (k) { return JSON.stringify(k) + ':' + stable(v[k]); }).join(',') + '}';
  }
  var payloadHash = hex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, stable(env.payload || {}), Utilities.Charset.UTF_8));
  var canonical = [String(env.v), String(env.kid), String(env.ts), String(env.nonce), String(env.action), payloadHash].join('\n');
  return hex(Utilities.computeHmacSha256Signature(canonical, secret, Utilities.Charset.UTF_8));
}
