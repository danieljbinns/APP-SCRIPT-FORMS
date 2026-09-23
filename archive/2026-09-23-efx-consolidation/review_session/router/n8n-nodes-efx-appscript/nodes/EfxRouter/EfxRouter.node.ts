/**
 * EfxRouter.node.ts — "Apps Script Router" (Employee Forms) node.
 *
 * Resource  = Project   (dropdown loaded from the EFX Registry sheet; value = scriptId)
 * Operation = Function  (dropdown loaded live from n8n_contracts(); value = n8n_* alias)
 * Params    = actor (JSON, optional) + args (JSON array) — or the typed presets below.
 *
 * Calls scripts.run on the Execution API with the built-in Google Service Account credential (googleApi),
 * unwraps the EFX envelope and applies the guard rule (see ../shared/transport.ts).
 *
 * Written in the programmatic style (execute()) rather than declarative routing because the unwrap/guard
 * logic needs code. Property layout is kept "declarative-looking" (resource/operation/params).
 *
 * SCAFFOLD — compiles in shape; NOT yet built, installed or run. See README.md.
 */
import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IDataObject,
} from 'n8n-workflow';
import { NodeConnectionType } from 'n8n-workflow';
import { callAlias, defaultActor, toNodeError, REQUIRED_SCOPES } from '../shared/transport';
import { loadProjects, loadFunctions } from '../shared/registry';

function parseJson(v: unknown, what: string): unknown {
	if (v === undefined || v === null || v === '') return undefined;
	if (typeof v !== 'string') return v;
	try {
		return JSON.parse(v);
	} catch {
		throw new Error(`EFX E_VALIDATION: ${what} is not valid JSON`);
	}
}

export class EfxRouter implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Apps Script Router (Employee Forms)',
		name: 'efxRouter',
		icon: 'file:efx.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{ $parameter["fn"] || $parameter["operation"] }}',
		description: `Call an Employee Forms n8n_* alias through the Apps Script Execution API. Credential: Google Service Account impersonating efx-bot@team-group.com with scopes ${REQUIRED_SCOPES.join(' ')}`,
		defaults: { name: 'Apps Script Router' },
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		usableAsTool: true,
		credentials: [
			{
				// Built-in n8n type. Requirements: Impersonate a user = efx-bot@team-group.com; "Set up for use in HTTP Request node"
				// enabled with the REQUIRED_SCOPES list (community nodes are not in n8n's internal scope map, so scopes must come from the credential).
				name: 'googleApi',
				required: true,
			},
		],
		properties: [
			// ── Project (resource) ────────────────────────────────────────────────
			{
				displayName: 'Registry Sheet ID',
				name: 'registrySheetId',
				type: 'string',
				default: '',
				placeholder: '<<EFX_REGISTRY_SHEET_ID>>',
				description: 'Google Sheet "EFX Registry (<tier>)": project · scriptId · apiDeploymentId · gcpProject · enabled · contractVersion · owner · registeredAt · notes. Read with the same Service Account.',
			},
			{
				displayName: 'Project',
				name: 'scriptId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'loadProjects', loadOptionsDependsOn: ['registrySheetId'] },
				default: '',
				required: true,
				description: 'Registered Apps Script project (value = scriptId). Toggle "enabled" in the registry to hide a project.',
			},
			// ── Operation ─────────────────────────────────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Call Function', value: 'call', action: 'Call an n8n_* alias with raw args', description: 'Pick any alias from the live contract list and pass args as a JSON array' },
					{ name: 'Health (ping)', value: 'ping', action: 'Ping the project', description: 'n8n_ping → env, spreadsheetId, versions' },
					{ name: 'Get Contracts', value: 'contracts', action: 'Get form and alias contracts', description: 'n8n_contracts → forms[] with required/optional/hash, aliases[]' },
					{ name: 'Create Workflow (new hire)', value: 'createInitialRequest', action: 'Create a new hire workflow', description: 'n8n_createInitialRequest(data, include)' },
					{ name: 'Submit ID Setup', value: 'submitIdSetup', action: 'Submit the ID setup step', description: 'n8n_submitIdSetup(data, include)' },
					{ name: 'Get Workflow', value: 'getWorkflow', action: 'Get workflow details and checklist', description: 'n8n_getWorkflow(workflowId)' },
					{ name: 'Get Employee ID', value: 'getEmployeeId', action: 'Get the pre-assigned internal employee ID', description: 'n8n_getEmployeeId(workflowId)' },
					{ name: 'List Tasks', value: 'listTasks', action: 'List action items', description: 'n8n_listTasks(filter)' },
					{ name: 'Close Task', value: 'closeTask', action: 'Close an action item', description: 'n8n_closeTask(params)' },
					{ name: 'Close JR Task', value: 'closeJrTask', action: 'Close the JR title task', description: 'n8n_closeJrTask(idOrWorkflow, notes)' },
					{ name: 'Assign Safety Training', value: 'assignSafetyTraining', action: 'Close the safety onboarding task', description: 'n8n_assignSafetyTraining(workflowId, details)' },
				],
				default: 'call',
			},
			// ── Call Function ─────────────────────────────────────────────────────
			{
				displayName: 'Function',
				name: 'fn',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'loadFunctions', loadOptionsDependsOn: ['scriptId'] },
				default: '',
				required: true,
				displayOptions: { show: { operation: ['call'] } },
				description: 'n8n_* alias, loaded live from n8n_contracts(). The actor is always prepended as parameters[0].',
			},
			{
				displayName: 'Args (JSON array)',
				name: 'args',
				type: 'json',
				default: '[]',
				displayOptions: { show: { operation: ['call'] } },
				description: 'Positional arguments after actor, e.g. ["TK-8247F3AB", "notes"] for n8n_closeJrTask',
			},
			// ── Presets ───────────────────────────────────────────────────────────
			{
				displayName: 'Form Data (JSON)',
				name: 'data',
				type: 'json',
				default: '{}',
				displayOptions: { show: { operation: ['createInitialRequest', 'submitIdSetup'] } },
				description: 'Exactly the keys of the FormContracts entry (new_hire / id_setup). Unknown keys → E_VALIDATION.',
			},
			{
				displayName: 'Include Record',
				name: 'includeRecord',
				type: 'boolean',
				default: false,
				displayOptions: { show: { operation: ['createInitialRequest', 'submitIdSetup'] } },
				description: 'Whether to read back the written row (adds "record" to the output)',
			},
			{
				displayName: 'Workflow ID',
				name: 'workflowId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { operation: ['getWorkflow', 'getEmployeeId', 'assignSafetyTraining'] } },
				placeholder: 'NEW_EMP_20260916-141501_123',
			},
			{
				displayName: 'Task ID or Workflow ID',
				name: 'idOrWorkflow',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { operation: ['closeJrTask'] } },
				placeholder: 'TK-8247F3AB or NEW_EMP_…',
			},
			{
				displayName: 'Notes',
				name: 'notes',
				type: 'string',
				default: '',
				displayOptions: { show: { operation: ['closeJrTask'] } },
			},
			{
				displayName: 'Filter (JSON)',
				name: 'filter',
				type: 'json',
				default: '{}',
				displayOptions: { show: { operation: ['listTasks'] } },
				description: '{ workflowId?, formType?, status?: "Open"|"Closed", assignedTo?, taskId? }',
			},
			{
				displayName: 'Params (JSON)',
				name: 'params',
				type: 'json',
				default: '{}',
				displayOptions: { show: { operation: ['closeTask'] } },
				description: '{ taskId } | { workflowId, formType } + { notes?, checklist?, formData?, dryRun? }',
			},
			{
				displayName: 'Details (JSON)',
				name: 'details',
				type: 'json',
				default: '{"siteDocsConfirmed":"Yes","dssConfirmed":"Yes"}',
				displayOptions: { show: { operation: ['assignSafetyTraining'] } },
				description: '{ siteDocsConfirmed: Yes|No, dssConfirmed: Yes|No, notes?, siteDocsNotes?, dssNotes?, dryRun? }',
			},
			// ── Common ────────────────────────────────────────────────────────────
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add option',
				default: {},
				options: [
					{
						displayName: 'Actor (JSON)',
						name: 'actor',
						type: 'json',
						default: '',
						description: 'Identity written to Submitted By / closedBy / Raw Log. Default: { id: "n8n:<workflow name>", email: "efx-bot@team-group.com", display: "<workflow name> (n8n)" }',
					},
					{
						displayName: 'Treat E_ALREADY_CLOSED as Success',
						name: 'treatAlreadyClosedAsSuccess',
						type: 'boolean',
						default: true,
						description: 'Whether re-closing an already closed task returns { ok:true, alreadyClosed:true } instead of failing',
					},
					{
						displayName: 'Dev Mode (run HEAD)',
						name: 'devMode',
						type: 'boolean',
						default: false,
						description: 'Whether to run the latest saved code instead of the API-executable deployment (script owner only)',
					},
					{
						displayName: 'Timeout (ms)',
						name: 'timeout',
						type: 'number',
						default: 120000,
					},
				],
			},
		],
	};

	methods = {
		loadOptions: { loadProjects, loadFunctions },
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const out: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const scriptId = this.getNodeParameter('scriptId', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;
				const options = this.getNodeParameter('options', i, {}) as IDataObject;
				const actor = defaultActor(this.getWorkflow().name ?? 'n8n', parseJson(options.actor, 'actor') as any);
				const callOpts = {
					treatAlreadyClosedAsSuccess: options.treatAlreadyClosedAsSuccess !== false,
					devMode: options.devMode === true,
					timeoutMs: (options.timeout as number) || 120000,
				};

				let fn: string;
				let args: unknown[];
				switch (operation) {
					case 'call': {
						fn = this.getNodeParameter('fn', i) as string;
						const a = parseJson(this.getNodeParameter('args', i, '[]'), 'args') ?? [];
						args = Array.isArray(a) ? a : [a];
						break;
					}
					case 'ping': fn = 'n8n_ping'; args = []; break;
					case 'contracts': fn = 'n8n_contracts'; args = []; break;
					case 'createInitialRequest':
					case 'submitIdSetup': {
						fn = operation === 'createInitialRequest' ? 'n8n_createInitialRequest' : 'n8n_submitIdSetup';
						const data = parseJson(this.getNodeParameter('data', i, '{}'), 'data') ?? {};
						const include = (this.getNodeParameter('includeRecord', i, false) as boolean) ? ['record'] : [];
						args = [data, include];
						break;
					}
					case 'getWorkflow': fn = 'n8n_getWorkflow'; args = [this.getNodeParameter('workflowId', i) as string]; break;
					case 'getEmployeeId': fn = 'n8n_getEmployeeId'; args = [this.getNodeParameter('workflowId', i) as string]; break;
					case 'listTasks': fn = 'n8n_listTasks'; args = [parseJson(this.getNodeParameter('filter', i, '{}'), 'filter') ?? {}]; break;
					case 'closeTask': fn = 'n8n_closeTask'; args = [parseJson(this.getNodeParameter('params', i, '{}'), 'params') ?? {}]; break;
					case 'closeJrTask': {
						fn = 'n8n_closeJrTask';
						const notes = this.getNodeParameter('notes', i, '') as string;
						args = [this.getNodeParameter('idOrWorkflow', i) as string, notes || 'JR title verified & assigned via n8n'];
						break;
					}
					case 'assignSafetyTraining': {
						fn = 'n8n_assignSafetyTraining';
						args = [this.getNodeParameter('workflowId', i) as string, parseJson(this.getNodeParameter('details', i, '{}'), 'details') ?? {}];
						break;
					}
					default:
						throw new Error(`EFX E_VALIDATION: unknown operation ${operation}`);
				}

				const result = await callAlias(this, scriptId, fn, actor, args, callOpts);
				out.push({ json: result, pairedItem: { item: i } });
			} catch (err) {
				if (this.continueOnFail()) {
					out.push({ json: { error: (err as Error).message }, pairedItem: { item: i } });
					continue;
				}
				throw toNodeError(this, err, i);
			}
		}
		return [out];
	}
}
