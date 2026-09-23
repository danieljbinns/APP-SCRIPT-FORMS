/**
 * EfxRouterTrigger.node.ts — "Apps Script Router Trigger" (Employee Forms events).
 *
 * Polling trigger: every poll calls n8n_events(actor, { afterEventId | afterTs, kinds?, sources?, limit }) through the
 * Execution API and emits one item per new event. Cursor (afterEventId) and a small seen-set live in workflow static data.
 * `pruned:true` (cursor no longer in the Raw Log) resets the cursor to afterTs = now - 1 day.
 *
 * Equivalent to n8n/20_Forms_EventsPoller.json.
 *
 * SCAFFOLD — compiles in shape; NOT yet built, installed or run. See README.md.
 */
import type { IPollFunctions, INodeExecutionData, INodeType, INodeTypeDescription, IDataObject } from 'n8n-workflow';
import { NodeConnectionType } from 'n8n-workflow';
import { callAlias, defaultActor, toNodeError } from '../shared/transport';
import { loadProjects } from '../shared/registry';

interface EfxEvent {
	eventId: string | null;
	ts: string;
	kind: string;
	source: string;
	workflowId: string;
	actor: string;
	payload: unknown;
}

export class EfxRouterTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Apps Script Router Trigger (Employee Forms)',
		name: 'efxRouterTrigger',
		icon: 'file:../EfxRouter/efx.svg',
		group: ['trigger'],
		version: 1,
		subtitle: '=events · {{ $parameter["sources"] || "all sources" }}',
		description: 'Polls the Employee Forms event feed (n8n_events) and emits one item per new event',
		defaults: { name: 'Employee Forms Events' },
		polling: true,
		inputs: [],
		outputs: [NodeConnectionType.Main],
		credentials: [{ name: 'googleApi', required: true }],
		properties: [
			{
				displayName: 'Registry Sheet ID',
				name: 'registrySheetId',
				type: 'string',
				default: '',
				placeholder: '<<EFX_REGISTRY_SHEET_ID>>',
			},
			{
				displayName: 'Project',
				name: 'scriptId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'loadProjects', loadOptionsDependsOn: ['registrySheetId'] },
				default: '',
				required: true,
			},
			{
				displayName: 'Sources',
				name: 'sources',
				type: 'string',
				default: '',
				placeholder: 'submitInitialRequest,submitEmployeeIDSetup',
				description: 'Comma-separated Raw Log sources to keep (empty = all). Today: submitInitialRequest, submitEmployeeIDSetup, submitHRVerification, submitITSetup, submitITConfirmation, submitSpecialistForm, submitEquipmentRequest, submitTerminationRequest, submitTerminationApproval, submitPositionChangeRequest, submitPositionChangeApproval.',
			},
			{
				displayName: 'Kinds',
				name: 'kinds',
				type: 'multiOptions',
				options: [
					{ name: 'submit (form payload as posted)', value: 'submit' },
					{ name: 'result (post-write; carries workflowId, formId, internalEmployeeId)', value: 'result' },
				],
				default: [],
				description: 'Empty = all kinds. Use "result" for Initial Request / ID Setup when you need the final ids.',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add option',
				default: {},
				options: [
					{ displayName: 'Limit per poll', name: 'limit', type: 'number', default: 200 },
					{ displayName: 'Initial lookback (hours)', name: 'lookbackHours', type: 'number', default: 24, description: 'Used on first run and after a pruned cursor' },
					{ displayName: 'Actor (JSON)', name: 'actor', type: 'json', default: '' },
				],
			},
		],
	};

	methods = { loadOptions: { loadProjects } };

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		const sd = this.getWorkflowStaticData('node') as IDataObject & { afterEventId?: string | null; afterTs?: string | null; seen?: string[] };
		const scriptId = this.getNodeParameter('scriptId') as string;
		const options = this.getNodeParameter('options', {}) as IDataObject;
		const limit = (options.limit as number) || 200;
		const lookbackMs = ((options.lookbackHours as number) || 24) * 3600 * 1000;
		const sources = String(this.getNodeParameter('sources', '') || '').split(',').map((s) => s.trim()).filter(Boolean);
		const kinds = (this.getNodeParameter('kinds', []) as string[]) ?? [];
		const actor = defaultActor(this.getWorkflow().name ?? 'events', options.actor ? JSON.parse(options.actor as string) : { id: 'n8n:forms-events-trigger' });

		const params: IDataObject = { limit };
		if (sd.afterEventId) params.afterEventId = sd.afterEventId;
		else params.afterTs = sd.afterTs ?? new Date(Date.now() - lookbackMs).toISOString();
		if (sources.length) params.sources = sources;
		if (kinds.length) params.kinds = kinds;

		let res: IDataObject;
		try {
			res = await callAlias(this, scriptId, 'n8n_events', actor, [params]);
		} catch (err) {
			throw toNodeError(this, err);
		}

		if (res.pruned === true) {
			sd.afterEventId = null;
			sd.afterTs = new Date(Date.now() - lookbackMs).toISOString();
			return null;
		}

		const events = (Array.isArray(res.events) ? res.events : []) as EfxEvent[];
		const seen = new Set(Array.isArray(sd.seen) ? sd.seen : []);
		const fresh = events.filter((e) => e.eventId && !seen.has(e.eventId));

		if (res.nextAfterEventId) {
			sd.afterEventId = String(res.nextAfterEventId);
			sd.afterTs = null;
		} else if (!sd.afterEventId) {
			sd.afterTs = new Date(Date.now() - 10 * 60 * 1000).toISOString();
		}
		sd.seen = [...(Array.isArray(sd.seen) ? sd.seen : []), ...fresh.map((e) => e.eventId as string)].slice(-1000);

		if (!fresh.length) return null;
		return [
			fresh.map((e) => ({
				json: {
					eventId: e.eventId,
					ts: e.ts,
					kind: e.kind,
					source: e.source,
					workflowId: e.workflowId ?? '',
					actor: e.actor ?? '',
					payload: e.payload as IDataObject,
					internalEmployeeId: (e.payload as IDataObject | null)?.internalEmployeeId ?? null,
					formId: (e.payload as IDataObject | null)?.formId ?? null,
				},
			})),
		];
	}
}
