import { describe, expect, it } from 'vitest';
import { centredCrop, clampCrop, cropWarnings, slotOutputSize } from './media-library';

describe('centredCrop', () => {
	it('is the largest crop of the aspect, centred', () => {
		expect(centredCrop(1600, 400, 1584 / 396)).toEqual({ x: 0, y: 0, w: 1600, h: 400 });
		expect(centredCrop(1000, 1000, 4)).toEqual({ x: 0, y: 375, w: 1000, h: 250 });
		expect(centredCrop(1000, 500, 1)).toEqual({ x: 250, y: 0, w: 500, h: 500 });
	});

	it('is the whole picture without an aspect', () => {
		expect(centredCrop(300, 200, null)).toEqual({ x: 0, y: 0, w: 300, h: 200 });
	});
});

describe('clampCrop', () => {
	it('pulls a crop back inside the picture in whole pixels', () => {
		expect(clampCrop({ x: -5.4, y: 10.6, w: 50.2, h: 999 }, 100, 100)).toEqual({
			x: 0,
			y: 0,
			w: 50,
			h: 100
		});
		expect(clampCrop({ x: 90, y: 90, w: 20, h: 20 }, 100, 100)).toEqual({
			x: 80,
			y: 80,
			w: 20,
			h: 20
		});
	});
});

describe('slotOutputSize', () => {
	it('scales down to the slot, never up', () => {
		expect(slotOutputSize({ x: 0, y: 0, w: 1600, h: 400 }, 800)).toEqual({
			width: 800,
			height: 200
		});
		expect(slotOutputSize({ x: 0, y: 0, w: 300, h: 200 }, 800)).toEqual({
			width: 300,
			height: 200
		});
	});
});

describe('cropWarnings', () => {
	it('warns before a crop is enlarged', () => {
		expect(cropWarnings({ x: 0, y: 0, w: 800, h: 200 }, { width: 1584, height: 396 })).toHaveLength(
			1
		);
		expect(
			cropWarnings({ x: 0, y: 0, w: 1600, h: 400 }, { width: 1584, height: 396 })
		).toHaveLength(0);
	});
});
