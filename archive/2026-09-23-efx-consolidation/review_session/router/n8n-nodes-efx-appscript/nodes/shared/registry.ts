/**
 * registry.ts — loadOptions helpers.
 *
 *  - Projects: rows of the "EFX Registry (<tier>)" Google Sheet, read with the same Google SA credential via the
 *    Sheets REST API. Columns (header row 1): project · scriptId · apiDeploymentId · gcpProject · enabled ·
 *    contractVersion · owner · registeredAt · notes   (see spec 12_ROUTER_AS_N8N_NODE.md §2)
 *  - Functions: live from the selected project's n8n_contracts() → aliases[] (name, kind, desc, form?).
 *
 * SCAFFOLD — untested.
 */
import type { ILoadOptionsFunctions, INodePropertyOptions, IHttpRequestOptions } from 'n8n-workflow';
import { callAlias, defaultActor, GOOGLE_SA_CREDENTIAL } from './transport';

export interface RegistryRow {
	project: string;
	scriptId: string;
	apiDeploymentId?: string;
	gcpProject?: string;
	enabled: boolean;
	contractVersion?: string;
	owner?: string;
	notes?: string;
}

export async function readRegistry(ctx: ILoadOptionsFunctions, registrySheetId: string, tab = 'Registry'): Promise<RegistryRow[]> {
	const options: IHttpRequestOptions = {
		method: 'GET',
		url: `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(registrySheetId)}/values/${encodeURIComponent(tab)}!A1:I500`,
		json: true,
	};
	const res = (await ctx.helpers.httpRequestWithAuthentication.call(ctx, GOOGLE_SA_CREDENTIAL, options)) as { values?: string[][] };
	const rows = res.values ?? [];
	if (rows.length < 2) return [];
	const header = rows[0].map((h) => String(h).trim());
	const col = (name: string) => header.indexOf(name);
	return rows
		.slice(1)
		.filter((r) => r[col('project')] && r[col('scriptId')])
		.map((r) => ({
			project: String(r[col('project')]),
			scriptId: String(r[col('scriptId')]),
			apiDeploymentId: r[col('apiDeploymentId')],
			gcpProject: r[col('gcpProject')],
			enabled: String(r[col('enabled')] ?? 'true').toLowerCase() !== 'false',
			contractVersion: r[col('contractVersion')],
			owner: r[col('owner')],
			notes: r[col('notes')],
		}));
}

/** loadOptions: Project dropdown → value = scriptId. */
export async function loadProjects(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const registrySheetId = this.getNodeParameter('registrySheetId', '') as string;
	if (!registrySheetId) return [{ name: 'Set "Registry Sheet ID" first', value: '' }];
	const rows = await readRegistry(this, registrySheetId);
	return rows
		.filter((r) => r.enabled)
		.map((r) => ({ name: `${r.project} (${r.contractVersion ?? '?'})`, value: r.scriptId, description: r.notes }));
}

/** loadOptions: Function dropdown → n8n_contracts().aliases from the selected script. */
export async function loadFunctions(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const scriptId = this.getNodeParameter('scriptId', '') as string;
	if (!scriptId) return [{ name: 'Select a Project first', value: '' }];
	const actor = defaultActor(this.getWorkflow().name ?? 'loadOptions', { id: 'n8n:loadOptions', display: 'n8n (loadOptions)' });
	const out = await callAlias(this, scriptId, 'n8n_contracts', actor, []);
	const aliases = (out.aliases as Array<{ name: string; kind: string; desc: string; form?: string }>) ?? [];
	return aliases.map((a) => ({ name: `${a.name}  ·  ${a.kind}${a.form ? ` (${a.form})` : ''}`, value: a.name, description: a.desc }));
}
