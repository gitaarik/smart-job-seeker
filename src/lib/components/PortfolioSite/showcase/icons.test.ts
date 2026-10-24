import { describe, expect, test } from 'vitest';
import { iconFor, iconKey } from './icons';

describe('iconKey', () => {
	test('folds the three spellings rows hold to one', () => {
		expect(iconKey('faNodeJs')).toBe('node-js');
		expect(iconKey('fa-server')).toBe('server');
		expect(iconKey('node-js')).toBe('node-js');
		expect(iconKey('faUserTie')).toBe('user-tie');
	});
});

describe('iconFor', () => {
	test('resolves every name stored on dev', () => {
		const stored = [
			'cloud',
			'code',
			'database',
			'dollar-sign',
			'envelope',
			'faChartLine',
			'fa-check-circle',
			'fa-cloud',
			'fa-code',
			'faCode',
			'faDatabase',
			'faGears',
			'faNodeJs',
			'faPython',
			'fa-server',
			'fa-tools',
			'faUsers',
			'faUserTie',
			'gem',
			'home',
			'microchip',
			'mobile',
			'node-js',
			'paintbrush',
			'python',
			'robot',
			'rocket',
			'search',
			'server',
			'user-gear',
			'users',
			'wrench'
		];
		expect(stored.filter((name) => !iconFor(name))).toEqual([]);
	});

	test('no name, or one it does not carry, is no icon', () => {
		expect(iconFor(null)).toBeNull();
		expect(iconFor('')).toBeNull();
		expect(iconFor('not-an-icon')).toBeNull();
	});
});
