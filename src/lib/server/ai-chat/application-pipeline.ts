/**
 * The applicant's other applications, as a comparison table.
 *
 * Answers the questions retrieval structurally cannot: *which* of my
 * applications is furthest along, *how many* are stalled, *where* does this one
 * rank. Top-k similarity gives a biased sample — fine for "find me evidence
 * about X", wrong for a comparison, where an incomplete set makes the answer
 * false rather than merely thin. So this source renders the pipeline WHOLE and
 * pays for it by rendering each application as one line rather than as prose.
 *
 * ## Why a table and not retrieval
 *
 * The axes people actually compare on are already columns: stage, how long it
 * has been stuck there, salary, match score, when they applied. A dozen other
 * applications' job descriptions would be ten times this whole prompt's budget;
 * a dozen rows is about 4k. Depth — what an interviewer actually said, what the
 * offer letter actually contains — is the job of the per-application history
 * (application-activity.ts) and, later, of cross-application retrieval.
 *
 * ## Why the current application is IN the table
 *
 * Deliberately inverting the `excludeApplicationId` convention that keeps a
 * cover letter from retrieving itself. That rule is right for retrieval, where
 * being your own evidence is degenerate. Here the current application is the
 * baseline: without it the model holds this one in prose and the rest in a
 * table, and has to bridge two formats to compare.
 *
 * See planning/SEMANTIC-MATCHING-AND-RAG.md and APPLICATION-ACTIVITY.md.
 */

import { db } from "$lib/server/db";
import { and, eq, inArray } from "drizzle-orm";
import {
  application_records,
  applications,
  job_matches,
} from "$lib/server/db/schema";
import { getFxRates } from "$lib/server/salary/fx";
import {
  convertCurrency,
  hourlyToRate,
  normalizeSalaryPeriod,
  rateToHourly,
} from "$lib/salary/conversion";
import { getStatusLabel, isFinishedStatus } from "$lib/application-status";

/**
 * Cap on applications rendered. Set well above a realistic open pipeline so it
 * effectively never binds — and when it does, the block says so.
 *
 * A silent cap is worse here than anywhere else in the context system: a
 * comparison over a truncated set is not vague, it is wrong ("this is your
 * strongest option" when the strongest was cut).
 */
const MAX_APPLICATIONS = 25;

/** Everything one row needs. Kept narrow so the renderer is testable dry. */
export interface PipelineRow {
  id: number;
  isCurrent: boolean;
  title: string | null;
  company: string | null;
  status: string;
  step: string | null;
  action: string | null;
  /** Days since the stage last moved — the highest-signal derived column. */
  daysInStage: number | null;
  appliedOn: string | null;
  /** As written, e.g. "EUR 70000-90000/year". Null when the job says nothing. */
  salary: string | null;
  /** The same figure normalised to one currency and period, for ranking. */
  salaryAnnual: number | null;
  workLocation: string | null;
  matchScore: number | null;
  matchRecommendation: string | null;
  /** What depth exists, so the model knows when to say "I can look that up". */
  entryCount: number;
  hasOffer: boolean;
  /**
   * Whether anyone from the employer has been recorded on this application.
   * NULL means nothing has been analysed yet, which is NOT the same as "nobody
   * was involved" — see derived_at in APPLICATION-ACTIVITY.md. Reporting the
   * two as the same is how a stalled application would look like an active one.
   */
  employerContact: boolean | null;
}

const dash = (v: string | number | null | undefined) =>
  v === null || v === undefined || v === "" ? "—" : String(v);

/**
 * Render the pipeline as a prompt block. Pure — no DB — so both the layout and
 * the "what does the model do with it" guidance are directly testable.
 */
export function formatPipelineContext(
  rows: PipelineRow[],
  opts: { omitted?: number; currency?: string } = {},
): string {
  if (rows.length === 0) return "";

  const currency = opts.currency ?? "EUR";
  const lines = rows.map((r) => {
    const who = [r.title, r.company].filter(Boolean).join(" at ") ||
      `application #${r.id}`;
    const stage = [getStatusLabel(r.status), r.step, r.action]
      .filter(Boolean).join(" / ");
    const stalled = r.daysInStage !== null
      ? `${r.daysInStage}d in stage`
      : "age unknown";
    const pay = r.salary
      ? r.salaryAnnual
        ? `${r.salary} (~${r.salaryAnnual.toLocaleString()} ${currency}/yr)`
        : r.salary
      : "no salary stated";
    const match = r.matchScore !== null
      ? `match ${r.matchScore}${
        r.matchRecommendation ? ` (${r.matchRecommendation})` : ""
      }`
      : "not scored";
    const depth = [
      `${r.entryCount} ${r.entryCount === 1 ? "entry" : "entries"}`,
      r.hasOffer ? "OFFER RECORDED" : null,
      r.employerContact === null
        ? "employer contact unknown"
        : r.employerContact
        ? null
        : "no employer contact recorded",
    ].filter(Boolean).join(", ");

    return [
      `- ${r.isCurrent ? "**THIS ONE** — " : ""}${who}`,
      `  ${stage} · ${stalled} · applied ${dash(r.appliedOn)}`,
      `  ${pay} · ${dash(r.workLocation)} · ${match}`,
      `  ${depth}`,
    ].join("\n");
  });

  const omission = opts.omitted && opts.omitted > 0
    ? [
      "",
      `NOTE: ${opts.omitted} further application(s) exist but were omitted to`,
      "fit. Say the picture is partial if the user asks you to rank or count.",
    ]
    : [];

  return [
    "## The applicant's other applications in progress",
    "",
    // The tone guard. Always-on context makes an assistant volunteer summaries
    // nobody asked for; this is background, and most turns are not about it.
    "This is background on the rest of the applicant's pipeline, including the",
    "one they are looking at now (marked THIS ONE). Draw on it when they ask",
    "how this compares, when they ask what to prioritise, or when it materially",
    "changes your advice — an application stuck for weeks, or an offer already",
    "in hand elsewhere, changes what is worth doing here. Do NOT open every",
    "reply with a pipeline summary, and do not bring up other applications when",
    "the question is only about this one.",
    "",
    "Each line is a summary, not the whole story: you can read the full history",
    "of the application they are ON, but not of the others. If they ask for",
    "detail about another one, say it is on that application's page rather than",
    "inventing it.",
    "",
    "Salary figures in brackets are converted to one currency and period so",
    "they can be ranked. Quote the figure as written, never the converted one,",
    "and never present a conversion as what the employer offered.",
    ...omission,
    "",
    ...lines,
  ].join("\n");
}

/** Whole days between then and now, or null when there is no date. */
function daysSince(date: Date | string | null): number | null {
  if (!date) return null;
  const then = date instanceof Date ? date : new Date(date);
  if (isNaN(then.getTime())) return null;
  const days = Math.floor((Date.now() - then.getTime()) / 86_400_000);
  return days < 0 ? 0 : days;
}

/** "EUR 70000-90000/year", or null when the job states nothing usable. */
function describeSalary(job: {
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  salary_period: string | null;
}): string | null {
  const { salary_min: min, salary_max: max } = job;
  if (min == null && max == null) return null;
  const cur = job.salary_currency || "";
  const per = normalizeSalaryPeriod(job.salary_period);
  const amount = min != null && max != null && min !== max
    ? `${min.toLocaleString()}-${max.toLocaleString()}`
    : (min ?? max)!.toLocaleString();
  return [cur, amount].filter(Boolean).join(" ") + (per ? `/${per}` : "");
}

/**
 * A single comparable number: the midpoint, normalised to one currency and a
 * yearly period. Null whenever any part of that is unknown — a missing FX rate
 * must read as "cannot compare", never as zero.
 */
function annualise(
  job: {
    salary_min: number | null;
    salary_max: number | null;
    salary_currency: string | null;
    salary_period: string | null;
  },
  target: string,
  rates: Record<string, number>,
): number | null {
  const { salary_min: min, salary_max: max } = job;
  if (min == null && max == null) return null;
  const mid = min != null && max != null ? (min + max) / 2 : (min ?? max)!;
  const period = normalizeSalaryPeriod(job.salary_period);
  // A fixed-price engagement has no annual equivalent; saying one would be a
  // fabricated comparison rather than a rough one.
  if (!period || period === "project") return null;
  // No stated currency means no comparable figure. Defaulting to the target
  // would silently assert a currency the employer never named — dev has a job
  // listed as "100/year" that rendered as "~100 EUR/yr", which reads as a fact.
  const from = job.salary_currency?.trim();
  if (!from) return null;
  const yearly = Math.round(hourlyToRate(rateToHourly(mid, period), "year"));
  return convertCurrency(yearly, from, target, rates);
}

/**
 * Load the profile's in-progress applications and render them.
 *
 * ⚠️ This is the first context source that reads rows the route never
 * authorized. Every other scoped source reads only the entity resolved and
 * checked in chat-context.ts, so the `profile_id` filter here is load-bearing
 * rather than hygiene.
 */
export async function applicationPipelineText(
  profileId: number,
  currentApplicationId: number | null,
): Promise<string> {
  try {
    const rows = await db.query.applications.findMany({
      where: eq(applications.profile_id, profileId),
      columns: {
        id: true,
        // Selected because the match score is keyed by job, not application.
        // Without it every lookup below missed and the whole pipeline rendered
        // "not scored" — silently, since "not scored" is a legitimate state.
        job_id: true,
        status: true,
        status_step: true,
        status_action: true,
        status_action_date: true,
        application_sent_date: true,
        date_updated: true,
        date_created: true,
      },
      with: {
        job: {
          columns: {
            title: true,
            company: true,
            job_poster: true,
            salary_min: true,
            salary_max: true,
            salary_currency: true,
            salary_period: true,
            work_location: true,
          },
        },
      },
    });

    // Finished applications are excluded: they grow without bound and dilute
    // "what am I working on". The current one is kept even if finished — the
    // user is looking at it, so a table that omits it reads as a bug.
    const live = rows.filter((a) =>
      !isFinishedStatus(a.status) || a.id === currentApplicationId
    );
    if (live.length === 0) return "";

    const ids = live.map((a) => a.id);
    const [matches, records, rates] = await Promise.all([
      db.query.job_matches.findMany({
        where: eq(job_matches.profile_id, profileId),
        columns: {
          job_id: true,
          score: true,
          recommendation: true,
        },
      }),
      db.query.application_records.findMany({
        where: inArray(application_records.application_id, ids),
        columns: {
          application_id: true,
          record_type: true,
          contacts: true,
          derived_at: true,
        },
      }),
      getFxRates(),
    ]);

    const byApp = new Map<number, typeof records>();
    for (const r of records) {
      const list = byApp.get(r.application_id) ?? [];
      list.push(r);
      byApp.set(r.application_id, list);
    }

    const built: PipelineRow[] = live.map((a) => {
      const entries = byApp.get(a.id) ?? [];
      const analysed = entries.filter((e) => e.derived_at);
      return {
        id: a.id,
        isCurrent: a.id === currentApplicationId,
        title: a.job?.title ?? null,
        company: a.job?.company ?? a.job?.job_poster ?? null,
        status: a.status,
        step: a.status_step,
        action: a.status_action,
        // The stage's own date first: date_updated moves on any edit, so it
        // would report a freshly retitled note as "the stage just changed".
        daysInStage: daysSince(
          a.status_action_date ?? a.date_updated ?? a.date_created,
        ),
        appliedOn: a.application_sent_date,
        salary: a.job ? describeSalary(a.job) : null,
        salaryAnnual: a.job ? annualise(a.job, "EUR", rates) : null,
        workLocation: Array.isArray(a.job?.work_location)
          ? (a.job.work_location as string[]).join(", ")
          : null,
        matchScore: null,
        matchRecommendation: null,
        entryCount: entries.length,
        hasOffer: entries.some((e) =>
          e.record_type === "offer" || e.record_type === "contract"
        ),
        // Unknown until something has actually looked. Reporting "no contact"
        // for an un-analysed application would make it look stalled when it
        // may be the most active one.
        employerContact: analysed.length === 0
          ? null
          : analysed.some((e) => ((e.contacts ?? []) as unknown[]).length > 0),
      };
    });

    // Match scores are keyed by job, not application; attach them separately so
    // an application with no job (hand-created) simply has none.
    const scoreByJob = new Map(matches.map((m) => [m.job_id, m]));
    for (const [i, a] of live.entries()) {
      const m = a.job_id != null ? scoreByJob.get(a.job_id) : undefined;
      if (m) {
        built[i].matchScore = m.score;
        built[i].matchRecommendation = m.recommendation;
      }
    }

    // Current first, then most recently active — so a long pipeline is
    // truncated from its stalest end rather than arbitrarily.
    built.sort((x, y) =>
      Number(y.isCurrent) - Number(x.isCurrent) ||
      (x.daysInStage ?? 1e9) - (y.daysInStage ?? 1e9)
    );

    const kept = built.slice(0, MAX_APPLICATIONS);
    return formatPipelineContext(kept, {
      omitted: built.length - kept.length,
      currency: "EUR",
    });
  } catch {
    // Context is a bonus, never a reason to fail the generation.
    return "";
  }
}
