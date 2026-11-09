<script lang="ts">
	/**
	 * Selected work as a carousel: the projects the applicant featured, one
	 * slide each, with the whole write-up of the one in view in a story that
	 * opens under it.
	 *
	 * Built to avoid what makes carousels bad. Nothing moves on its own. The
	 * slides are a native horizontal scroller with snap points, so a swipe, a
	 * trackpad and the arrow keys move it the way they move anything else, and
	 * the next slide shows at the edge, which says there is more without dots.
	 * The count and the two buttons say where you are and move one at a time;
	 * a slide at the edge comes forward when clicked. Every slide is the same
	 * quiet teaser, and the rest is read below it in the page's own flow,
	 * rather than in a card that grows inside a row that scrolls sideways.
	 *
	 * See work-slides.ts for what a slide holds.
	 */
	import { tick } from 'svelte';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faArrowLeft,
		faArrowRight,
		faChevronDown,
		faCircleCheck
	} from '@fortawesome/free-solid-svg-icons';
	import ExternalLink from '$lib/components/ExternalLink.svelte';
	import TechTags from './TechTags.svelte';
	import { hasStory, SLIDE_TECHNOLOGIES, type WorkSlide } from './work-slides';

	interface Props {
		slides: WorkSlide[];
		title: string;
		aos?: Record<string, string>;
		/** The private CV page, for a visitor who may open it: every project is there. */
		moreHref?: string | null;
	}

	let { slides, title, aos = {}, moreHref = null }: Props = $props();

	let track: HTMLElement | undefined = $state();
	let stories: HTMLElement | undefined = $state();
	let active = $state(0);
	let storyOpen = $state(false);

	const count = $derived(slides.length);
	const shown = $derived(Math.min(active, Math.max(0, count - 1)));
	const pad = (n: number) => String(n).padStart(2, '0');

	const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

	function slideElements(): HTMLElement[] {
		return track ? [...track.querySelectorAll<HTMLElement>(':scope > .slide')] : [];
	}

	/** The slide nearest the column's start, which is the one in view. */
	function measure() {
		const els = slideElements();
		if (!track || !els.length) return;
		const start = els[0].offsetLeft;
		const scrolled = track.scrollLeft;
		let nearest = 0;
		let distance = Infinity;
		els.forEach((el, i) => {
			const d = Math.abs(el.offsetLeft - start - scrolled);
			if (d < distance) {
				distance = d;
				nearest = i;
			}
		});
		// Scrolled to the end, the last slide is the one in view even where it
		// could not reach the start.
		if (scrolled + track.clientWidth >= track.scrollWidth - 2) nearest = els.length - 1;
		active = nearest;
	}

	let frame = 0;
	function onScroll() {
		cancelAnimationFrame(frame);
		frame = requestAnimationFrame(measure);
	}

	function go(i: number) {
		const els = slideElements();
		if (!track || !els[i]) return;
		active = i;
		track.scrollTo({
			left: els[i].offsetLeft - els[0].offsetLeft,
			behavior: reducedMotion() ? 'auto' : 'smooth'
		});
	}

	async function toggleStory(i: number) {
		if (i !== active) go(i);
		storyOpen = !(storyOpen && i === active);
		if (!storyOpen) return;
		await tick();
		stories?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
	}

	function closeStory() {
		storyOpen = false;
		track?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'nearest' });
	}
</script>

{#if count}
	<section
		class="work-band w-full bg-(--pf-surface) transition-colors"
		aria-labelledby="pf-featured"
		aria-roledescription="carousel"
	>
		<div class="flex justify-center px-5 pt-20 min-[40rem]:px-10 min-[50rem]:pt-28">
			<div
				{...aos}
				class="flex w-full max-w-[885px] flex-wrap items-end justify-between gap-x-8 gap-y-5 pb-8 min-[50rem]:pb-10"
			>
				<h2
					id="pf-featured"
					class="pf-display text-[2.75rem] text-(--pf-strong) capitalize min-[50rem]:text-[4rem]"
				>
					{title}
				</h2>
				{#if count > 1}
					<div class="flex items-center gap-3">
						<p class="count mr-2" aria-live="polite">
							<span aria-hidden="true"
								><span class="text-(--pf-strong)">{pad(shown + 1)}</span><span
									class="text-(--pf-muted)">{` / ${pad(count)}`}</span
								></span
							>
							<span class="sr-only"
								>{`Project ${shown + 1} of ${count}: ${slides[shown].name}`}</span
							>
						</p>
						<button
							type="button"
							class="arrow"
							aria-label="Previous project"
							disabled={shown === 0}
							onclick={() => go(shown - 1)}
						>
							<FontAwesomeIcon icon={faArrowLeft} class="h-3.5 w-3.5" />
						</button>
						<button
							type="button"
							class="arrow"
							aria-label="Next project"
							disabled={shown === count - 1}
							onclick={() => go(shown + 1)}
						>
							<FontAwesomeIcon icon={faArrowRight} class="h-3.5 w-3.5" />
						</button>
					</div>
				{/if}
			</div>
		</div>

		<!-- A scroller has to take focus for a keyboard to scroll it (axe: scrollable-region-focusable); the arrow keys then move it a slide at a time. -->
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<div
			bind:this={track}
			class="track"
			class:single={count === 1}
			role="region"
			aria-label="Projects"
			tabindex="0"
			onscroll={onScroll}
		>
			{#each slides as s, i (s.key)}
				{@const isActive = i === shown}
				<div
					class="slide"
					class:is-active={isActive}
					role="group"
					aria-roledescription="slide"
					aria-label={`${i + 1} of ${count}: ${s.name}`}
				>
					<div class="slide-body">
						<div class="slide-meta">
							<p class="slide-context">
								{#if s.logo}
									<img src={s.logo} alt="" class="slide-logo" loading="lazy" />
								{/if}
								<span>{s.context}</span>
							</p>
							<h3 class="slide-name">
								{#if s.link}
									<ExternalLink href={s.link} class="hover:text-(--pf-accent-text)"
										>{s.name}</ExternalLink
									>
								{:else}
									{s.name}
								{/if}
							</h3>
							{#if s.role || s.period}
								<p class="slide-sub">{[s.role, s.period].filter(Boolean).join(' · ')}</p>
							{/if}
							{#if s.technologies.length}
								<ul class="slide-tech" aria-label="Technologies">
									{#each s.technologies.slice(0, SLIDE_TECHNOLOGIES) as name, j (j)}
										<li>{name}</li>
									{/each}
									{#if s.technologies.length > SLIDE_TECHNOLOGIES}
										<li class="more">+{s.technologies.length - SLIDE_TECHNOLOGIES}</li>
									{/if}
								</ul>
							{/if}
						</div>

						<div class="slide-text">
							{#if s.story[0]}
								<p class="slide-lede">{s.story[0]}</p>
							{/if}
							{#if s.outcome[0]}
								<div class="slide-outcome">
									<p class="slide-label">Outcome</p>
									<p class="slide-outcome-text">{s.outcome[0]}</p>
								</div>
							{:else if s.points.length}
								<ul class="slide-points">
									{#each s.points.slice(0, 2) as point, j (j)}
										<li>{point}</li>
									{/each}
								</ul>
							{/if}
							{#if hasStory(s)}
								<button
									type="button"
									class="slide-more group"
									aria-expanded={storyOpen && isActive}
									aria-controls="pf-stories"
									onclick={() => toggleStory(i)}
								>
									<span>{storyOpen && isActive ? 'Close the story' : 'Read the full story'}</span>
									<!-- Turned by its wrapper: the icon reads its class once, at mount. -->
									<span
										class="inline-flex transition-transform {storyOpen && isActive
											? 'rotate-180'
											: 'group-hover:translate-y-0.5'}"
									>
										<FontAwesomeIcon icon={faChevronDown} class="h-3 w-3" />
									</span>
								</button>
							{/if}
						</div>
					</div>

					{#if !isActive}
						<!-- A slide at the edge comes forward on a click. Out of the tab order: the arrows do this for a keyboard. -->
						<button
							type="button"
							class="slide-cover"
							tabindex="-1"
							aria-label={`Show ${s.name}`}
							onclick={() => go(i)}
						></button>
					{/if}
				</div>
			{/each}
		</div>

		{#if count > 1}
			<div class="flex justify-center px-5 min-[40rem]:px-10" aria-hidden="true">
				<div class="progress w-full max-w-[885px]">
					<span style:width="{100 / count}%" style:transform="translateX({shown * 100}%)"></span>
				</div>
			</div>
		{/if}

		{#if moreHref}
			<div class="flex justify-center px-5 pt-6 min-[40rem]:px-10">
				<p class="w-full max-w-[885px] text-right">
					<!-- eslint-disable svelte/no-navigation-without-resolve -- built by the load, query included -->
					<a href={moreHref} class="all-work group">
						<span>All projects in the full CV</span>
						<FontAwesomeIcon
							icon={faArrowRight}
							class="h-3 w-3 transition-transform group-hover:translate-x-0.5"
						/>
					</a>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
				</p>
			</div>
		{/if}

		<div class="flex justify-center px-5 pb-20 min-[40rem]:px-10 min-[50rem]:pb-28">
			<div id="pf-stories" bind:this={stories} class="stories w-full max-w-[885px]">
				{#each slides as s, i (s.key)}
					<article class="story" hidden={!(storyOpen && i === shown)} aria-label={s.name}>
						<p class="slide-context">
							{#if s.logo}
								<img src={s.logo} alt="" class="slide-logo" loading="lazy" />
							{/if}
							<span>{[s.context, s.role, s.period].filter(Boolean).join(' · ')}</span>
						</p>
						<h3 class="story-name">{s.name}</h3>
						<div class="story-text">
							{#each s.story as paragraph, j (j)}
								<p>{paragraph}</p>
							{/each}
						</div>
						{#if s.outcome.length}
							<h4 class="story-heading">
								<FontAwesomeIcon icon={faCircleCheck} class="h-4 w-4 text-(--pf-accent-text)" />
								Outcome
							</h4>
							<div class="story-text">
								{#each s.outcome as paragraph, j (j)}
									<p>{paragraph}</p>
								{/each}
							</div>
						{/if}
						{#if s.points.length}
							<ul class="story-points">
								{#each s.points as point, j (j)}
									<li>{point}</li>
								{/each}
							</ul>
						{/if}
						{#if s.technologies.length}
							<div class="mt-8">
								<TechTags names={s.technologies} />
							</div>
						{/if}
						<div class="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3">
							<button type="button" class="slide-more group" onclick={closeStory}>
								<FontAwesomeIcon icon={faChevronDown} class="h-3 w-3 rotate-180" />
								<span>Close the story</span>
							</button>
							{#if s.link}
								<ExternalLink
									href={s.link}
									class="text-sm font-medium text-(--pf-accent-text) underline-offset-4 hover:underline"
									>{s.link.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</ExternalLink
								>
							{/if}
						</div>
					</article>
				{/each}
			</div>
		</div>
	</section>
{/if}

<style>
	/*
	 * The track runs the width of the page, its first slide on the column the
	 * rest of the page reads down, and the next one in view at the right edge.
	 * `cqw` is the band's width wherever it is used, which a percentage is not:
	 * in padding it is the band's, in a flex basis the track's content box.
	 */
	.work-band {
		container-type: inline-size;
	}

	.track {
		--gutter: 1.25rem;
		--gap: 1rem;
		--edge: max(var(--gutter), (100cqw - 885px) / 2);
		--slide: min(885px, 100cqw - var(--edge) - 3.5rem);

		display: flex;
		gap: var(--gap);
		overflow-x: auto;
		overscroll-behavior-x: contain;
		scroll-snap-type: x mandatory;
		scroll-padding-inline: var(--edge);
		padding: 0.25rem var(--edge) 1.75rem;
		scrollbar-width: none;
	}

	.track::-webkit-scrollbar {
		display: none;
	}

	/* Room after the last slide, so it too can come to rest on the column. */
	.track::after {
		content: '';
		flex: 0 0 max(0px, 100cqw - 2 * var(--edge) - var(--slide) - var(--gap));
	}

	.track.single {
		--slide: min(885px, 100cqw - 2 * var(--edge));
	}

	.track:focus-visible {
		outline: none;
	}

	.track:focus-visible .slide.is-active {
		outline: 2px solid var(--pf-accent-text);
		outline-offset: 3px;
	}

	@media (min-width: 40rem) {
		.track {
			--gutter: 2.5rem;
			--gap: 1.5rem;
		}
	}

	.slide {
		position: relative;
		flex: 0 0 var(--slide);
		scroll-snap-align: start;
		container-type: inline-size;
		border: 1px solid var(--pf-line);
		border-radius: 2px;
		background: var(--pf-surface-raised);
		transition:
			opacity 0.4s ease,
			border-color 0.4s ease;
	}

	.slide:not(.is-active) {
		opacity: 0.45;
	}

	.slide:not(.is-active):hover {
		opacity: 0.7;
	}

	.slide-cover {
		position: absolute;
		inset: 0;
		cursor: pointer;
	}

	/*
	 * One column on a narrow slide, read top to bottom: who and what, the
	 * teaser, the stack, then the way into the story. Side by side once the
	 * slide is wide enough, with the stack under who and what on the left.
	 */
	.slide-body {
		display: flex;
		height: 100%;
		flex-direction: column;
		align-items: flex-start;
		padding: 1.5rem;
	}

	.slide-meta,
	.slide-text {
		display: contents;
	}

	.slide-lede,
	.slide-outcome,
	.slide-points,
	.slide-tech {
		align-self: stretch;
		margin-top: 1.5rem;
	}

	.slide-tech {
		order: 1;
	}

	@media (min-width: 40rem) {
		.slide-body {
			padding: 2rem;
		}
	}

	@container (min-width: 44rem) {
		.slide-body {
			display: grid;
			grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
			gap: 3rem;
			padding: 2.75rem;
		}

		.slide-meta,
		.slide-text {
			display: flex;
			flex-direction: column;
			align-items: flex-start;
		}

		.slide-lede {
			margin-top: 0;
		}

		.slide-tech {
			order: 0;
			margin-top: auto;
			padding-top: 1.75rem;
		}
	}

	.slide-context {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--pf-muted);
	}

	.slide-logo {
		width: 1.75rem;
		height: 1.75rem;
		flex-shrink: 0;
		border-radius: 2px;
		object-fit: contain;
		box-shadow: 0 0 0 1px var(--pf-line);
	}

	.slide-name {
		margin-top: 1rem;
		font-size: 1.875rem;
		font-weight: 650;
		font-stretch: 84%;
		letter-spacing: -0.01em;
		line-height: 1.05;
		color: var(--pf-strong);
		text-wrap: balance;
	}

	.slide-sub {
		margin-top: 0.75rem;
		font-size: 0.875rem;
		color: var(--pf-muted);
	}

	.slide-tech {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 0;
		font-size: 0.8125rem;
		color: var(--pf-muted);
	}

	.slide-tech li:not(:last-child)::after {
		content: '·';
		margin: 0 0.5rem;
		opacity: 0.6;
	}

	.slide-tech .more {
		color: var(--pf-accent-text);
	}

	/* A teaser: a few lines of each, the rest in the story. */
	.slide-lede,
	.slide-outcome-text {
		display: -webkit-box;
		-webkit-box-orient: vertical;
		overflow: hidden;
		line-height: 1.7;
	}

	.slide-lede {
		-webkit-line-clamp: 5;
		line-clamp: 5;
		font-size: 1.0625rem;
	}

	.slide-outcome {
		border-left: 2px solid var(--pf-accent-text);
		padding-left: 1rem;
	}

	.slide-outcome-text {
		-webkit-line-clamp: 3;
		line-clamp: 3;
		font-size: 0.9375rem;
	}

	.slide-label {
		margin-bottom: 0.25rem;
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--pf-accent-text);
	}

	.slide-points {
		margin-left: 1.1rem;
		list-style: disc;
		font-size: 0.9375rem;
		line-height: 1.6;
	}

	.slide-more {
		display: inline-flex;
		align-items: center;
		gap: 0.625rem;
		padding: 0.25rem 0;
		cursor: pointer;
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--pf-accent-text);
	}

	/* On a slide, last and at the foot, however much the teaser above it holds. */
	.slide-text > .slide-more {
		order: 2;
		margin-top: auto;
		padding-top: 1.5rem;
	}

	.slide-more:hover span,
	.slide-more:focus-visible span {
		text-decoration: underline;
		text-underline-offset: 4px;
	}

	.all-work {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--pf-accent-text);
	}

	.all-work:hover span,
	.all-work:focus-visible span {
		text-decoration: underline;
		text-underline-offset: 4px;
	}

	.count {
		font-size: 0.9375rem;
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.04em;
	}

	.arrow {
		display: inline-flex;
		width: 2.75rem;
		height: 2.75rem;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--pf-line);
		border-radius: 999px;
		background: var(--pf-surface-raised);
		color: var(--pf-strong);
		cursor: pointer;
		transition:
			border-color 0.2s,
			color 0.2s,
			opacity 0.2s;
	}

	.arrow:hover:not(:disabled),
	.arrow:focus-visible {
		border-color: var(--pf-accent-text);
		color: var(--pf-accent-text);
	}

	.arrow:disabled {
		cursor: default;
		opacity: 0.35;
	}

	.progress {
		position: relative;
		height: 2px;
		overflow: hidden;
		background: var(--pf-line);
	}

	.progress span {
		position: absolute;
		inset: 0 auto 0 0;
		background: var(--pf-accent-text);
		transition: transform 0.45s cubic-bezier(0.2, 0.7, 0.2, 1);
	}

	.stories {
		scroll-margin-top: 5rem;
	}

	.story {
		padding-top: 3.5rem;
	}

	.story-name {
		margin-top: 1rem;
		font-size: 2.25rem;
		font-weight: 700;
		font-stretch: 80%;
		letter-spacing: -0.015em;
		line-height: 1;
		color: var(--pf-strong);
		text-wrap: balance;
	}

	.story-text {
		max-width: 68ch;
	}

	.story-text p {
		margin-top: 1.25rem;
		font-size: 1.0625rem;
		line-height: 1.75;
	}

	.story-heading {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		margin-top: 2.5rem;
		font-size: 1.25rem;
		font-weight: 650;
		font-stretch: 88%;
	}

	.story-points {
		max-width: 68ch;
		margin: 1.5rem 0 0 1.25rem;
		list-style: disc;
		line-height: 1.7;
	}

	.story-points li + li {
		margin-top: 0.5rem;
	}

	@media (prefers-reduced-motion: reduce) {
		.slide,
		.progress span {
			transition: none;
		}
	}

	@media print {
		.track {
			flex-direction: column;
			overflow: visible;
		}

		.slide:not(.is-active) {
			opacity: 1;
		}
	}
</style>
