<!--
	A crop over a picture, in the picture's own pixels.

	Drag the frame to move it, drag a corner to resize it, or focus the frame
	and use the arrow keys (Shift for bigger steps) and + / - to resize. With
	an `aspect` the frame keeps that shape; without one it is free.

	`mask` and `zones` draw what the platform will do to the result: the circle
	it shows a photo in, the corner its own photo covers, the band a phone cuts
	off. Zones are in preset pixels (`zoneWidth` x `zoneHeight`) and are drawn
	scaled onto the frame, since the frame is what becomes the preset.
-->
<script lang="ts">
	import type { Crop, MediaMask, SafeZone } from '$lib/media-library';
	import { clampCrop } from '$lib/media-library';

	interface Props {
		src: string;
		/** The picture's upright size, which `crop` is measured in. */
		width: number;
		height: number;
		crop: Crop;
		aspect?: number | null;
		mask?: MediaMask;
		zones?: SafeZone[];
		zoneWidth?: number;
		zoneHeight?: number;
		/** Tallest the editor may draw, in CSS pixels. */
		maxHeight?: number;
		label?: string;
		onchange?: (crop: Crop) => void;
	}

	let {
		src,
		width,
		height,
		crop = $bindable(),
		aspect = null,
		mask = 'none',
		zones = [],
		zoneWidth = 0,
		zoneHeight = 0,
		maxHeight = 420,
		label = 'Crop',
		onchange
	}: Props = $props();

	let containerWidth = $state(0);
	const uid = $props.id();

	/** CSS pixels per picture pixel. */
	const scale = $derived(
		containerWidth > 0 ? Math.min(containerWidth / width, maxHeight / height) : 0
	);
	const displayWidth = $derived(width * scale);
	const displayHeight = $derived(height * scale);

	const frame = $derived({
		x: crop.x * scale,
		y: crop.y * scale,
		w: crop.w * scale,
		h: crop.h * scale
	});

	type Drag = {
		mode: 'move' | 'nw' | 'ne' | 'sw' | 'se';
		startX: number;
		startY: number;
		start: Crop;
	};
	let drag: Drag | null = null;

	function set(next: Crop) {
		crop = clampCrop(next, width, height);
		onchange?.(crop);
	}

	/** A corner drag: the opposite corner stays put, and an aspect is kept. */
	function resized(start: Crop, mode: Drag['mode'], dx: number, dy: number): Crop {
		const right = start.x + start.w;
		const bottom = start.y + start.h;
		const west = mode === 'nw' || mode === 'sw';
		const north = mode === 'nw' || mode === 'ne';
		let w = Math.max(8, west ? start.w - dx : start.w + dx);
		let h = Math.max(8, north ? start.h - dy : start.h + dy);
		if (aspect) {
			// Follow whichever way the pointer moved further, then fit the
			// result inside the picture from the anchored corner.
			if (Math.abs(dx) * (start.h / start.w) >= Math.abs(dy)) h = w / aspect;
			else w = h * aspect;
			const roomW = west ? right : width - start.x;
			const roomH = north ? bottom : height - start.y;
			const fit = Math.min(1, roomW / w, roomH / h);
			w *= fit;
			h *= fit;
		} else {
			w = Math.min(w, west ? right : width - start.x);
			h = Math.min(h, north ? bottom : height - start.y);
		}
		return {
			x: west ? right - w : start.x,
			y: north ? bottom - h : start.y,
			w,
			h
		};
	}

	function onPointerDown(event: PointerEvent, mode: Drag['mode']) {
		if (event.button !== 0) return;
		event.preventDefault();
		event.stopPropagation();
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		drag = { mode, startX: event.clientX, startY: event.clientY, start: { ...crop } };
	}

	function onPointerMove(event: PointerEvent) {
		if (!drag || scale === 0) return;
		const dx = (event.clientX - drag.startX) / scale;
		const dy = (event.clientY - drag.startY) / scale;
		if (drag.mode === 'move') {
			set({ ...drag.start, x: drag.start.x + dx, y: drag.start.y + dy });
		} else {
			set(resized(drag.start, drag.mode, dx, dy));
		}
	}

	function onPointerUp() {
		drag = null;
	}

	/** Resize around the centre by a factor, keeping the shape. */
	function zoom(factor: number) {
		const w = Math.min(width, Math.max(8, crop.w * factor));
		const h = aspect ? w / aspect : Math.min(height, Math.max(8, crop.h * factor));
		const fit = Math.min(1, width / w, height / h);
		const cw = w * fit;
		const ch = h * fit;
		set({ x: crop.x + (crop.w - cw) / 2, y: crop.y + (crop.h - ch) / 2, w: cw, h: ch });
	}

	function onKeyDown(event: KeyboardEvent) {
		const step = Math.max(1, Math.round(Math.max(width, height) / (event.shiftKey ? 20 : 200)));
		const moves: Record<string, [number, number]> = {
			ArrowLeft: [-step, 0],
			ArrowRight: [step, 0],
			ArrowUp: [0, -step],
			ArrowDown: [0, step]
		};
		if (event.key in moves) {
			event.preventDefault();
			const [dx, dy] = moves[event.key];
			set({ ...crop, x: crop.x + dx, y: crop.y + dy });
		} else if (event.key === '+' || event.key === '=') {
			event.preventDefault();
			zoom(0.95);
		} else if (event.key === '-' || event.key === '_') {
			event.preventDefault();
			zoom(1 / 0.95);
		}
	}

	/** A zone in preset pixels, placed on the frame in CSS pixels. */
	function placed(zone: SafeZone) {
		const sx = zoneWidth > 0 ? frame.w / zoneWidth : 0;
		const sy = zoneHeight > 0 ? frame.h / zoneHeight : 0;
		return {
			x: frame.x + zone.x * sx,
			y: frame.y + zone.y * sy,
			w: zone.w * sx,
			h: zone.h * sy
		};
	}

	const corners = ['nw', 'ne', 'sw', 'se'] as const;

	/**
	 * Which corner a press landed on. The handles carry no handlers of their
	 * own: the frame takes every press and captures the pointer, so a drag
	 * that leaves a 14px handle keeps resizing.
	 */
	function cornerOf(target: EventTarget | null): Drag['mode'] | null {
		const corner = (target as HTMLElement | null)?.dataset?.corner;
		return corners.includes(corner as (typeof corners)[number]) ? (corner as Drag['mode']) : null;
	}
	const cornerNames: Record<(typeof corners)[number], string> = {
		nw: 'top left',
		ne: 'top right',
		sw: 'bottom left',
		se: 'bottom right'
	};
</script>

<div class="w-full" bind:clientWidth={containerWidth}>
	{#if scale > 0}
		<div
			class="relative mx-auto touch-none select-none"
			style:width="{displayWidth}px"
			style:height="{displayHeight}px"
		>
			<img {src} alt="" class="pointer-events-none block h-full w-full" draggable="false" />

			<svg
				class="pointer-events-none absolute inset-0"
				width={displayWidth}
				height={displayHeight}
				aria-hidden="true"
			>
				<defs>
					<pattern id="{uid}-hatch" width="8" height="8" patternUnits="userSpaceOnUse">
						<path d="M0 8 L8 0" stroke="rgba(239,68,68,0.9)" stroke-width="1.5" />
					</pattern>
				</defs>
				<path
					fill="rgba(0,0,0,0.55)"
					fill-rule="evenodd"
					d="M0 0H{displayWidth}V{displayHeight}H0Z M{frame.x} {frame.y}h{frame.w}v{frame.h}h{-frame.w}Z"
				/>
				{#if mask === 'circle'}
					<ellipse
						cx={frame.x + frame.w / 2}
						cy={frame.y + frame.h / 2}
						rx={frame.w / 2}
						ry={frame.h / 2}
						fill="none"
						stroke="white"
						stroke-dasharray="6 4"
						stroke-width="1.5"
					/>
				{:else if mask === 'rounded'}
					<rect
						x={frame.x}
						y={frame.y}
						width={frame.w}
						height={frame.h}
						rx={Math.min(frame.w, frame.h) * 0.18}
						fill="none"
						stroke="white"
						stroke-dasharray="6 4"
						stroke-width="1.5"
					/>
				{/if}
				{#each zones as zone, i (i)}
					{@const z = placed(zone)}
					{#if zone.kind === 'covered'}
						<rect x={z.x} y={z.y} width={z.w} height={z.h} fill="url(#{uid}-hatch)" opacity="0.8" />
						<rect
							x={z.x}
							y={z.y}
							width={z.w}
							height={z.h}
							fill="rgba(239,68,68,0.18)"
							stroke="rgba(239,68,68,0.9)"
						/>
					{:else}
						<rect
							x={z.x}
							y={z.y}
							width={z.w}
							height={z.h}
							fill="none"
							stroke="rgba(250,204,21,0.95)"
							stroke-dasharray="4 3"
							stroke-width="1.5"
						/>
					{/if}
				{/each}
			</svg>

			<div
				role="slider"
				tabindex="0"
				aria-label="{label}: arrow keys move it, Shift moves further, plus and minus resize it"
				aria-valuemin={0}
				aria-valuemax={width}
				aria-valuenow={Math.round(crop.x)}
				aria-valuetext="{Math.round(crop.w)} by {Math.round(crop.h)} pixels at {Math.round(
					crop.x
				)}, {Math.round(crop.y)}"
				class="absolute cursor-move border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.6)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--dash-primary)]"
				style:left="{frame.x}px"
				style:top="{frame.y}px"
				style:width="{frame.w}px"
				style:height="{frame.h}px"
				onpointerdown={(e) => onPointerDown(e, cornerOf(e.target) ?? 'move')}
				onpointermove={onPointerMove}
				onpointerup={onPointerUp}
				onpointercancel={onPointerUp}
				onkeydown={onKeyDown}
			>
				{#each corners as corner (corner)}
					<span
						class="absolute h-3.5 w-3.5 rounded-sm border border-black/50 bg-white
							{corner === 'nw' ? '-top-2 -left-2 cursor-nwse-resize' : ''}
							{corner === 'ne' ? '-top-2 -right-2 cursor-nesw-resize' : ''}
							{corner === 'sw' ? '-bottom-2 -left-2 cursor-nesw-resize' : ''}
							{corner === 'se' ? '-right-2 -bottom-2 cursor-nwse-resize' : ''}"
						title="Resize from the {cornerNames[corner]} corner"
						data-corner={corner}
						aria-hidden="true"
					></span>
				{/each}
			</div>
		</div>
		{#if zones.length > 0}
			<ul class="mt-2 space-y-0.5 text-xs text-[var(--dash-text-secondary)]">
				{#each zones as zone, i (i)}
					<li class="flex items-start gap-2">
						<span
							class="mt-0.5 inline-block h-3 w-3 shrink-0 rounded-sm border
								{zone.kind === 'covered' ? 'border-red-500 bg-red-500/30' : 'border-dashed border-yellow-400'}"
						></span>
						<span
							>{zone.label ??
								(zone.kind === 'covered'
									? 'Covered by something else on the platform'
									: 'Shown on every screen')}</span
						>
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
</div>
