/**
 * transport.ts — Apps Script Execution API call + EFX envelope unwrap/guard.
 *
 * Mirrors the logic of the "EFX · Router" sub-workflow (n8n/00_EFX_Router.json) so a workflow built on the
 * plain HTTP Request node and one built on this node behave identically.
 *
 * SCAFFOLD — compiles in shape, not yet run against n8n. See README.md.
 */
import type {
	IExecuteFunctions,
	ILoadOptionsFunctions,
	IPollFunctions,
	IHttpRequestOptions,
	IDataObject,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

/** n8n built-in Google Service Account credential type. Must have "Impersonate a user" = efx-bot@team-group.com. */
export const GOOGLE_SA_CREDENTIAL = 'googleApi';

/** Scopes the SA / DWD grant must carry (script.projects for the Execution API + the script's own manifest scopes). */
export const REQUIRED_SCOPES = [
	'https://www.googleapis.com/auth/script.projects',
	'https://www.googleapis.com/auth/spreadsheets',
	'https://www.googleapis.com/auth/drive',
	'https://www.googleapis.com/auth/gmail.send',
	'https://www.googleapis.com/auth/script.external_request',
	'https://www.googleapis.com/auth/userinfo.email',
	'https://www.googleapis.com/auth/admin.directory.user.readonly',
];

export interface EfxActor {
	id: string;
	email: string;
	display: string;
}

export interface EfxEnvelopeOk {
	ok: true;
	apiVersion: string;
	requestId: string;
	result: unknown;
	[extra: string]: unknown; // record, employeeId, …
}
export interface EfxEnvelopeErr {
	ok: false;
	apiVersion?: string;
	requestId?: string;
	error: { code: string; message: string; fields?: unknown; [k: string]: unknown };
}
export type EfxEnvelope = EfxEnvelopeOk | EfxEnvelopeErr;

/** Thrown for every non-clean outcome. `code` is E_TRANSPORT | E_SCRIPT | <alias error code>. */
export class EfxError extends Error {
	constructor(
		public readonly code: string,
		message: string,
		public readonly fn: string,
		public readonly requestId?: string | null,
		public readonly fields?: unknown,
	) {
		super(`EFX ${code}: ${message} [fn=${fn}${requestId ? `, requestId=${requestId}` : ''}]`);
		this.name = 'EfxError';
	}
}

type Ctx = IExecuteFunctions | ILoadOptionsFunctions | IPollFunctions;

export function defaultActor(workflowName: string, given?: Partial<EfxActor> | string | null): EfxActor {
	let a: Partial<EfxActor> = {};
	if (typeof given === 'string' && given.trim()) {
		try {
			a = JSON.parse(given) as Partial<EfxActor>;
		} catch {
			a = { id: given };
		}
	} else if (given && typeof given === 'object') {
		a = given;
	}
	const id = a.id && String(a.id).trim() ? String(a.id) : `n8n:${workflowName}`;
	return {
		id,
		email: a.email && String(a.email).trim() ? String(a.email).toLowerCase() : 'efx-bot@team-group.com',
		display: a.display && String(a.display).trim() ? String(a.display) : `${id.replace(/^n8n:/, '')} (n8n)`,
	};
}

/**
 * POST https://script.googleapis.com/v1/scripts/{scriptId}:run with the googleApi credential.
 * Returns the raw Execution API body (never throws on HTTP status; the guard decides).
 */
export async function callScriptsRun(
	ctx: Ctx,
	scriptId: string,
	fn: string,
	parameters: unknown[],
	devMode = false,
	timeoutMs = 120000,
): Promise<{ statusCode: number; body: unknown }> {
	const options: IHttpRequestOptions = {
		method: 'POST',
		url: `https://script.googleapis.com/v1/scripts/${encodeURIComponent(scriptId)}:run`,
		body: { function: fn, parameters, devMode },
		json: true,
		timeout: timeoutMs,
		returnFullResponse: true,
		ignoreHttpStatusErrors: true,
	};
	// httpRequestWithAuthentication handles the Google SA JWT → access-token exchange (incl. impersonation) for 'googleApi'.
	const res = (await ctx.helpers.httpRequestWithAuthentication.call(ctx, GOOGLE_SA_CREDENTIAL, options)) as {
		statusCode: number;
		body: unknown;
	};
	return { statusCode: res.statusCode, body: res.body };
}

/**
 * Guard rule (same as the Router's "Unwrap & guard" Code node):
 *  - non-JSON / HTTP error / done!=true → E_TRANSPORT
 *  - body.error (script threw)          → E_SCRIPT
 *  - envelope ok:false                  → throw <code>, except E_ALREADY_CLOSED when treatAlreadyClosedAsSuccess
 * Returns the flattened output item.
 */
export function unwrapAndGuard(
	fn: string,
	statusCode: number,
	rawBody: unknown,
	treatAlreadyClosedAsSuccess: boolean,
	startedAt: number,
): IDataObject {
	let body: any = rawBody;
	if (typeof body === 'string') {
		try {
			body = JSON.parse(body);
		} catch {
			body = null;
		}
	}
	const snippet = typeof rawBody === 'string' ? rawBody.slice(0, 300) : JSON.stringify(rawBody ?? '').slice(0, 300);

	if (!body || typeof body !== 'object') {
		throw new EfxError('E_TRANSPORT', `Non-JSON response from script.googleapis.com (HTTP ${statusCode}): ${snippet}`, fn);
	}
	if (statusCode >= 400 || (body.error && body.done !== true)) {
		const ge = body.error ?? {};
		throw new EfxError(
			'E_TRANSPORT',
			`Execution API HTTP ${statusCode} ${ge.status ?? ''}: ${ge.message ?? snippet} — check SA credential + impersonation, script linked to the SA GCP project, API-executable deployment, script.projects scope`,
			fn,
		);
	}
	if (body.done !== true) throw new EfxError('E_TRANSPORT', 'Execution API returned done=false', fn);
	if (body.error) {
		const d = body.error.details?.[0] ?? {};
		const trace = Array.isArray(d.scriptStackTraceElements)
			? ' @ ' + d.scriptStackTraceElements.map((s: any) => `${s.function}:${s.lineNumber}`).join(' < ')
			: '';
		throw new EfxError('E_SCRIPT', `${d.errorType ? d.errorType + ': ' : ''}${d.errorMessage ?? body.error.message ?? 'Apps Script error'}${trace}`, fn);
	}

	const env = body.response?.result as EfxEnvelope | undefined;
	if (env === undefined || env === null) throw new EfxError('E_SCRIPT', 'Function returned nothing — not an n8n_* alias, or it returned undefined', fn);
	if (typeof env !== 'object' || typeof (env as any).ok !== 'boolean') {
		throw new EfxError('E_SCRIPT', `Return value is not an EFX envelope {ok,...}: ${JSON.stringify(env).slice(0, 300)}`, fn);
	}

	const meta: IDataObject = { fn, requestId: env.requestId ?? null, apiVersion: env.apiVersion ?? null, tookMs: Date.now() - startedAt };

	if (env.ok === false) {
		const code = env.error?.code ?? 'E_UNKNOWN';
		if (code === 'E_ALREADY_CLOSED' && treatAlreadyClosedAsSuccess) {
			return { ok: true, alreadyClosed: true, code, message: env.error?.message ?? '', ...meta };
		}
		throw new EfxError(code, env.error?.message ?? 'no message', fn, env.requestId, env.error?.fields);
	}

	const res = env.result;
	const out: IDataObject = { ok: true, ...((res && typeof res === 'object' && !Array.isArray(res)) ? (res as IDataObject) : { value: res as any }), ...meta };
	for (const k of Object.keys(env)) if (!['ok', 'apiVersion', 'requestId', 'result'].includes(k)) out[k] = (env as any)[k];
	return out;
}

/** Convenience: call an alias and unwrap. Always prepends actor as parameters[0] (N8n.js contract). */
export async function callAlias(
	ctx: Ctx,
	scriptId: string,
	fn: string,
	actor: EfxActor,
	args: unknown[],
	opts: { treatAlreadyClosedAsSuccess?: boolean; devMode?: boolean; timeoutMs?: number } = {},
): Promise<IDataObject> {
	if (!/^n8n_[A-Za-z0-9_]+$/.test(fn)) throw new EfxError('E_VALIDATION', `fn must be an n8n_* alias (got "${fn}")`, fn);
	const startedAt = Date.now();
	const { statusCode, body } = await callScriptsRun(ctx, scriptId, fn, [actor, ...args], opts.devMode ?? false, opts.timeoutMs ?? 120000);
	return unwrapAndGuard(fn, statusCode, body, opts.treatAlreadyClosedAsSuccess ?? true, startedAt);
}

/** Convert an EfxError into the n8n error type the node should throw (keeps `EFX <CODE>:` prefix in the message). */
export function toNodeError(ctx: IExecuteFunctions | IPollFunctions, err: unknown, itemIndex?: number): Error {
	if (err instanceof EfxError) {
		if (err.code === 'E_TRANSPORT') {
			return new NodeApiError(ctx.getNode(), { message: err.message, code: err.code } as JsonObject, { message: err.message, description: 'Execution API / credential problem' });
		}
		return new NodeOperationError(ctx.getNode(), err.message, { itemIndex, description: err.fields ? `fields: ${JSON.stringify(err.fields)}` : undefined });
	}
	return err instanceof Error ? err : new Error(String(err));
}
