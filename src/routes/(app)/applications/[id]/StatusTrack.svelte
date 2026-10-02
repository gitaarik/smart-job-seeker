<script lang="ts">
	/**
	 * Where an application is, drawn as a track: applied, each interview round,
	 * the offer, and the result where it ended.
	 *
	 * Rounds are added as they happen, so the track has no fixed length. While
	 * the application is interviewing, a dashed node after the last round adds
	 * the next one, unless that round was the final one, after which the next
	 * thing is an offer. Every state shown is worked out from the rounds' dates
	 * by `roundState`, so a round turns from booked to behind them on its own.
	 */
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faCheck, faPlus, faXmark } from '@fortawesome/free-solid-svg-icons';
	import {
		FINAL_ROUND_KIND,
		currentRoundIndex,
		formatRoundWhen,
		getStatusLabel,
		getStepperPhase,
		roundState,
		type InterviewRound
	} from '$lib/application-status';
	import type { TimeFormat } from '$lib/format-date';

	let {
		status,
		step,
		rounds,
		sent,
		today,
		timeFormat = '24h',
		onaddround
	}: {
		status: string;
		step: string | null;
		rounds: readonly InterviewRound[];
		/** Whether the application has gone out, which puts "Applied" behind it. */
		sent: boolean;
		today: string;
		timeFormat?: TimeFormat;
		/** The dashed next-round node calls this. Without it there is no such node. */
		onaddround?: () => void;
	} = $props();

	/**
	 * `done` is behind them, `current` is where they are, `ahead` is still to
	 * come (booked or not), `ended` is a closed application and `won` an
	 * accepted one.
	 */
	type Mark = 'done' | 'current' | 'ahead' | 'ended' | 'won';

	interface Point {
		key: string;
		title: string;
		lines: string[];
		mark: Mark;
		/** What the circle shows: a round's number, or one of the three icons. */
		badge: number | 'check' | 'cross' | 'add' | null;
	}

	const points = $derived.by((): Point[] => {
		// A `draft` (the old column default) is an application not yet sent.
		const phase = status === 'draft' ? 'applying' : getStepperPhase(status);
		const list: Point[] = [];

		list.push(
			phase === 'applying' && !sent
				? {
						key: 'applied',
						title: 'Applying',
						lines: step ? [step] : [],
						mark: 'current',
						badge: null
					}
				: { key: 'applied', title: 'Applied', lines: [], mark: 'done', badge: 'check' }
		);

		if (phase === 'applying') {
			list.push({ key: 'rounds', title: 'Interviews', lines: [], mark: 'ahead', badge: null });
		} else {
			const interviewing = phase === 'interviewing';
			const at = interviewing ? currentRoundIndex(rounds, today) : -1;
			rounds.forEach((round, i) => {
				const state = roundState(rounds, i, today);
				const lines = [round.kind, formatRoundWhen(round.date, round.time, timeFormat)];
				if (i === at && state === 'unscheduled') lines.push('To schedule');
				if (i === at && state === 'done') lines.push('Awaiting result');
				list.push({
					key: `round-${i}`,
					title: `Round ${i + 1}`,
					lines: lines.filter((line): line is string => !!line),
					// Past the interviews every round is behind them, whatever its date.
					mark: !interviewing || i < at ? 'done' : i === at ? 'current' : 'ahead',
					badge: !interviewing || i < at ? 'check' : i + 1
				});
			});
			if (interviewing && onaddround && rounds.at(-1)?.kind !== FINAL_ROUND_KIND) {
				list.push({ key: 'add', title: 'Next round', lines: [], mark: 'ahead', badge: 'add' });
			}
		}

		if (status === 'rejected' || status === 'withdrawn') {
			list.push({
				key: 'result',
				title: getStatusLabel(status),
				lines: [],
				mark: 'ended',
				badge: 'cross'
			});
		} else if (phase === 'result') {
			list.push({ key: 'offer', title: 'Offer', lines: [], mark: 'done', badge: 'check' });
			list.push({
				key: 'result',
				title: getStatusLabel(status),
				lines: [],
				mark: 'won',
				badge: 'check'
			});
		} else {
			list.push({
				key: 'offer',
				title: 'Offer',
				lines: phase === 'negotiating' && step ? [step] : [],
				mark: phase === 'negotiating' ? 'current' : 'ahead',
				badge: null
			});
		}

		return list;
	});

	const circle: Record<Mark, string> = {
		done: 'bg-[var(--dash-primary)] text-white',
		current:
			'bg-[var(--dash-card)] text-[var(--dash-primary)] ring-2 ring-[var(--dash-primary)] ring-offset-2 ring-offset-[var(--dash-card)]',
		ahead: 'border border-[var(--dash-border)] bg-[var(--dash-card)] text-[var(--dash-text-muted)]',
		ended: 'bg-[var(--dash-bg)] text-[var(--dash-text-muted)] border border-[var(--dash-border)]',
		won: 'bg-green-600 text-white'
	};

	const spoken: Record<Mark, string> = {
		done: 'done',
		current: 'current',
		ahead: 'still to come',
		ended: 'ended here',
		won: 'done'
	};

	/** The line into a point is filled once the application has got that far. */
	const reached = (mark: Mark) => mark === 'done' || mark === 'current' || mark === 'won';

	// On a narrow screen the track scrolls sideways, and four rounds in, the round
	// they are at is off the right edge. Bring it into the middle of the strip.
	let strip = $state<HTMLDivElement>();
	const currentKey = $derived(points.find((point) => point.mark === 'current')?.key);
	$effect(() => {
		const point = strip?.querySelector<HTMLElement>(`[data-point="${currentKey}"]`);
		if (!strip || !point || strip.scrollWidth <= strip.clientWidth) return;
		strip.scrollLeft = point.offsetLeft - (strip.clientWidth - point.offsetWidth) / 2;
	});
</script>

<div bind:this={strip} class="relative -mx-1 overflow-x-auto px-1 pt-1 pb-1">
	<ol class="flex w-full" aria-label="Where this application stands">
		{#each points as point, i (point.key)}
			<li
				data-point={point.key}
				class="relative flex min-w-[4.75rem] flex-1 flex-col items-center px-1 text-center"
			>
				{#if i > 0}
					<span
						aria-hidden="true"
						class="absolute top-3.5 right-1/2 h-0.5 w-full -translate-y-1/2 {reached(point.mark)
							? 'bg-[var(--dash-primary)]'
							: 'bg-[var(--dash-border)]'}"
					></span>
				{/if}
				{#if point.badge === 'add'}
					<button
						type="button"
						onclick={onaddround}
						class="relative z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 border-dashed border-[var(--dash-primary)] bg-[var(--dash-card)] text-[var(--dash-primary)] transition-colors hover:bg-[var(--dash-primary)]/10"
						aria-label="Add the next round"
					>
						<FontAwesomeIcon icon={faPlus} class="h-3 w-3" />
					</button>
				{:else}
					<span
						class="relative z-10 flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold {circle[
							point.mark
						]}"
					>
						{#if point.badge === 'check'}
							<FontAwesomeIcon icon={faCheck} class="h-3 w-3" />
						{:else if point.badge === 'cross'}
							<FontAwesomeIcon icon={faXmark} class="h-3 w-3" />
						{:else if point.badge !== null}
							{point.badge}
						{/if}
					</span>
				{/if}
				<span
					class="mt-1.5 text-xs font-medium {point.mark === 'ahead'
						? 'text-[var(--dash-text-muted)]'
						: 'text-[var(--dash-text)]'}"
				>
					{point.title}
				</span>
				{#each point.lines as line, j (j)}
					<span class="text-[11px] leading-snug text-[var(--dash-text-muted)]">{line}</span>
				{/each}
				<span class="sr-only">({spoken[point.mark]})</span>
			</li>
		{/each}
	</ol>
</div>
