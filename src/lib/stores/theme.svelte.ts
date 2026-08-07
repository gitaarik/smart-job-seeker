import { getWindowVariable } from '$lib/tools/window';
import { browser } from '$app/environment';

type ThemePreference = 'light' | 'dark' | 'auto';
type ActualTheme = 'light' | 'dark';

// Track the auto-cycle state
let autoCycleState: 'first' | 'second' | null = null;

// Reactive state using Svelte 5 runes
let preference = $state<ThemePreference>('auto');
let system = $state<ActualTheme>('light');

// Derived actual theme
const actual = $derived<ActualTheme>(preference === 'auto' ? system : (preference as ActualTheme));

// Public API - export getter/setter functions
export const themeState = {
	get preference() {
		return preference;
	},
	set preference(value: ThemePreference) {
		preference = value;
	},
	get system() {
		return system;
	},
	set system(value: ActualTheme) {
		system = value;
	},
	get actual() {
		return actual;
	}
};

// Initialize theme from server data
export function initializeTheme(
	serverPreference: ThemePreference,
	serverActualTheme: ActualTheme,
	serverSystemTheme: ActualTheme
) {
	preference = serverPreference;
	system = serverSystemTheme;

	if (browser) {
		// Set up system theme monitoring
		const matchMedia = getWindowVariable('matchMedia');
		if (matchMedia) {
			const mediaQuery = matchMedia('(prefers-color-scheme: dark)');

			// Update system theme based on current preference
			system = mediaQuery.matches ? 'dark' : 'light';

			// Listen for system theme changes
			const handleChange = (e: MediaQueryListEvent) => {
				system = e.matches ? 'dark' : 'light';
			};

			mediaQuery.addEventListener('change', handleChange);
		}
	}
}

// Client-side initialization for when server data isn't available
function initializeClientTheme() {
	if (!browser) return;

	const document = getWindowVariable('document');
	let initialPreference: ThemePreference = 'auto';

	// Check for stored preference in cookie
	if (document && document.cookie) {
		const themeCookie = document.cookie
			.split(';')
			.find((cookie: string) => cookie.trim().startsWith('theme='));

		if (themeCookie) {
			const theme = themeCookie.split('=')[1]?.trim();
			if (theme === 'dark' || theme === 'light' || theme === 'auto') {
				initialPreference = theme as ThemePreference;
			}
		}
	}

	preference = initialPreference;

	// Set system theme
	const matchMedia = getWindowVariable('matchMedia');
	if (matchMedia) {
		const mediaQuery = matchMedia('(prefers-color-scheme: dark)');
		system = mediaQuery.matches ? 'dark' : 'light';

		// Listen for system theme changes
		const handleChange = (e: MediaQueryListEvent) => {
			system = e.matches ? 'dark' : 'light';
		};

		mediaQuery.addEventListener('change', handleChange);
	}
}

// Initialize client-side theme if not already initialized by server
if (browser) {
	initializeClientTheme();
}

// Helper functions for updating DOM and cookies
// These should be called from components using $effect()
export function updateDOM(theme: ActualTheme) {
	if (!browser) return;

	const document = getWindowVariable('document');
	if (document) {
		document.documentElement.classList.remove('theme-light', 'theme-dark');
		document.documentElement.classList.add(`theme-${theme}`);
	}
}

export function saveToCookie(preference: ThemePreference) {
	if (!browser) return;

	const document = getWindowVariable('document');
	if (document) {
		const expires = new Date();
		expires.setFullYear(expires.getFullYear() + 1);
		document.cookie = `theme=${preference}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
	}
}

export function switchTheme() {
	// Handle auto-cycle continuation
	if (autoCycleState === 'first') {
		// Second step: go to the other theme
		autoCycleState = 'second';
		preference = preference === 'light' ? 'dark' : 'light';
		return;
	} else if (autoCycleState === 'second') {
		// Third step: go back to auto
		autoCycleState = null;
		preference = 'auto';
		return;
	}

	// Standard cycle: light -> dark -> auto -> light
	switch (preference) {
		case 'light':
			autoCycleState = null;
			preference = 'dark';
			break;
		case 'dark':
			autoCycleState = null;
			preference = 'auto';
			break;
		case 'auto':
			// When on auto, switch to opposite of current actual theme first
			autoCycleState = 'first';
			preference = system === 'light' ? 'dark' : 'light';
			break;
		default:
			autoCycleState = null;
			preference = 'light';
	}
}
