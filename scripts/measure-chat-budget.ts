/**
 * What the chat context blocks cost on a real application, and how the pipeline
 * degrades as its budget tightens.
 *
 * The pipeline block is the only context source whose size grows with how long
 * someone has been job-hunting, so its budget is the one that needs re-checking
 * as real pipelines fill up — see the ⚠️ note on `application_pipeline` in
 * generation-context.ts, which cites numbers taken with this.
 *
 *   npx dotenvx run -f ../.env -- npx tsx scripts/measure-chat-budget.ts <appId>
 */
import {
	applicationPipelineText,
	DEFAULT_PIPELINE_BUDGET_CHARS
} from '$lib/server/ai-chat/application-pipeline';
import { applicationActivityText } from '$lib/server/ai-chat/application-activity';
import { jobDetailsText } from '$lib/server/ai-chat/job-context';
import { CHAT_BUDGET_CHARS } from '$lib/server/ai-chat/chat-context';
import { dbDirect as db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { applications } from '$lib/server/db/schema';

const appId = Number(process.argv[2]);

/** Rows begin at a line-initial "- "; everything before the first is the frame. */
function rowsOf(block: string): string[] {
	const first = block.indexOf('\n- ');
	return first === -1
		? []
		: block
				.slice(first)
				.split('\n- ')
				.filter((s) => s.trim());
}

async function main() {
	const app = await db.query.applications.findFirst({
		where: eq(applications.id, appId),
		columns: { id: true, profile_id: true }
	});
	if (!app) throw new Error(`no application ${appId}`);

	// Both modes: the chat asks for `full` on an application page, writing
	// prompts ask for `compact`, and the gap between them is the thing worth
	// seeing — it is what a cover letter would start carrying if the two were
	// ever collapsed back into one number.
	const [pipeline, activity, activityCompact, job] = await Promise.all([
		applicationPipelineText(app.profile_id, app.id),
		applicationActivityText(app.id, 'full'),
		applicationActivityText(app.id, 'compact'),
		jobDetailsText({ applicationId: app.id })
	]);

	const rows = rowsOf(pipeline);
	const frame = pipeline.length - rows.join('').length;
	console.log(`application #${app.id} (profile ${app.profile_id})`);
	console.log(`  job          ${job.length}`);
	console.log(`  activity     ${activity.length}  (full — what the chat gets)`);
	console.log(`  activity     ${activityCompact.length}  (compact — writing)`);
	console.log(
		`  pipeline     ${pipeline.length}  (${rows.length} rows, frame ${frame}, ` +
			`cap ${DEFAULT_PIPELINE_BUDGET_CHARS})`
	);
	console.log(
		`  ─── these three ${job.length + activity.length + pipeline.length} of ${CHAT_BUDGET_CHARS}\n`
	);

	// The ladder, on the real pipeline: depth should go before applications do.
	console.log('  pipeline as its budget tightens:');
	for (const budget of [12000, 6000, 4000, 3000, 2000, 1500, 800]) {
		const block = await applicationPipelineText(app.profile_id, app.id, budget);
		const r = rowsOf(block);
		const withSummary = r.filter((s) => s.split('\n').length > 4).length;
		console.log(
			`    ${String(budget).padStart(5)} → ${String(block.length).padStart(
				5
			)} chars, ${r.length} rows, ${withSummary} with a summary` +
				(block.includes('were omitted') ? '  [omission noted]' : '') +
				(block.includes('without a summary') ? '  [shedding noted]' : '')
		);
	}
}

main()
	.then(() => process.exit(0))
	.catch((e) => {
		console.error(e);
		process.exit(1);
	});
