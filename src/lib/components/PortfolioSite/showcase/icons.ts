/**
 * Font Awesome icons by the names profile rows store them under.
 *
 * Highlights, achievements and skill categories carry an icon as text, and in
 * three spellings that all occur in real rows: `node-js`, `fa-server` and
 * `faNodeJs` (the last from `highlights.icon_name`, which held the export name
 * the site it came from imported). `iconFor` folds all three to one key.
 *
 * A fixed list rather than the whole of free-solid and free-brands: the
 * showcase is a public page, and importing every icon by name would ship a
 * couple of megabytes to render a handful. A name not here renders no icon,
 * which the markup already allows for.
 */

import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
	faAward,
	faBolt,
	faBook,
	faBriefcase,
	faBug,
	faBuilding,
	faBullseye,
	faChartLine,
	faCheck,
	faCircleCheck,
	faCloud,
	faCode,
	faCodeBranch,
	faCogs,
	faComments,
	faCompass,
	faDatabase,
	faDollarSign,
	faEnvelope,
	faFlask,
	faGauge,
	faGear,
	faGears,
	faGem,
	faGlobe,
	faGraduationCap,
	faHeart,
	faHouse,
	faLanguage,
	faLaptopCode,
	faLayerGroup,
	faLightbulb,
	faLock,
	faMagnifyingGlass,
	faMicrochip,
	faMobileScreen,
	faPaintbrush,
	faPenNib,
	faPuzzlePiece,
	faRobot,
	faRocket,
	faServer,
	faShieldHalved,
	faStar,
	faTerminal,
	faToolbox,
	faScrewdriverWrench,
	faTrophy,
	faUserGear,
	faUserTie,
	faUsers,
	faWrench
} from '@fortawesome/free-solid-svg-icons';
import {
	faAws,
	faDocker,
	faGitAlt,
	faGithub,
	faJs,
	faLinux,
	faNodeJs,
	faNpm,
	faPhp,
	faPython,
	faReact,
	faStackOverflow,
	faSvelte
} from '@fortawesome/free-brands-svg-icons';

const ICONS: Record<string, IconDefinition> = {
	award: faAward,
	bolt: faBolt,
	book: faBook,
	briefcase: faBriefcase,
	bug: faBug,
	building: faBuilding,
	bullseye: faBullseye,
	'chart-line': faChartLine,
	check: faCheck,
	'check-circle': faCircleCheck,
	'circle-check': faCircleCheck,
	cloud: faCloud,
	code: faCode,
	'code-branch': faCodeBranch,
	cogs: faCogs,
	comments: faComments,
	compass: faCompass,
	database: faDatabase,
	'dollar-sign': faDollarSign,
	envelope: faEnvelope,
	flask: faFlask,
	gauge: faGauge,
	gear: faGear,
	gears: faGears,
	gem: faGem,
	globe: faGlobe,
	'graduation-cap': faGraduationCap,
	heart: faHeart,
	home: faHouse,
	house: faHouse,
	language: faLanguage,
	'laptop-code': faLaptopCode,
	'layer-group': faLayerGroup,
	lightbulb: faLightbulb,
	lock: faLock,
	search: faMagnifyingGlass,
	'magnifying-glass': faMagnifyingGlass,
	microchip: faMicrochip,
	mobile: faMobileScreen,
	'mobile-screen': faMobileScreen,
	paintbrush: faPaintbrush,
	'pen-nib': faPenNib,
	'puzzle-piece': faPuzzlePiece,
	robot: faRobot,
	rocket: faRocket,
	server: faServer,
	'shield-halved': faShieldHalved,
	star: faStar,
	terminal: faTerminal,
	toolbox: faToolbox,
	tools: faScrewdriverWrench,
	'screwdriver-wrench': faScrewdriverWrench,
	trophy: faTrophy,
	'user-gear': faUserGear,
	'user-tie': faUserTie,
	users: faUsers,
	wrench: faWrench,
	aws: faAws,
	docker: faDocker,
	'git-alt': faGitAlt,
	github: faGithub,
	js: faJs,
	linux: faLinux,
	'node-js': faNodeJs,
	npm: faNpm,
	php: faPhp,
	python: faPython,
	react: faReact,
	'stack-overflow': faStackOverflow,
	svelte: faSvelte
};

/** `faNodeJs`, `fa-node-js` and `node-js` all to `node-js`. */
export function iconKey(name: string): string {
	const trimmed = name.trim();
	if (/^fa[A-Z]/.test(trimmed)) {
		return trimmed
			.slice(2)
			.replace(/([a-z0-9])([A-Z])/g, '$1-$2')
			.toLowerCase();
	}
	return trimmed.toLowerCase().replace(/^fa-/, '');
}

/** The icon a row names, or null for none or one this list does not carry. */
export function iconFor(name: string | null | undefined): IconDefinition | null {
	if (!name) return null;
	return ICONS[iconKey(name)] ?? null;
}
