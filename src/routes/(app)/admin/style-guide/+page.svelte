<script lang="ts">
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { getAllIcons } from '$lib/data/job-icons';
	import CategoryPill from '$lib/components/CategoryPill.svelte';
	import Checkbox from '../../components/Checkbox.svelte';
	import RadioGroup from '../../components/RadioGroup.svelte';
	import ToggleSwitch from '../../components/ToggleSwitch.svelte';
	import FilterTabs from '../../components/FilterTabs.svelte';
	import TabNav from '../../components/TabNav.svelte';
	import {
		faArrowLeft,
		faArrowRight,
		faBan,
		faBars,
		faBell,
		faBook,
		faBookmark,
		faBriefcase,
		faBullseye,
		faBuilding,
		faCalendar,
		faCalendarDays,
		faCamera,
		faChartBar,
		faChartLine,
		faCheck,
		faCheckCircle,
		faChevronDown,
		faChevronLeft,
		faChevronRight,
		faChevronUp,
		faCircle,
		faClipboardList,
		faCloud,
		faCloudUploadAlt,
		faCode,
		faCog,
		faComments,
		faCopy,
		faDatabase,
		faDesktop,
		faDownload,
		faEnvelope,
		faExclamationTriangle,
		faExternalLink,
		faExternalLinkAlt,
		faEye,
		faEyeSlash,
		faFile,
		faFileAlt,
		faFileArchive,
		faFileImport,
		faForward,
		faGauge,
		faGlobe,
		faGraduationCap,
		faGripVertical,
		faHistory,
		faHome,
		faImage,
		faKey,
		faLayerGroup,
		faLightbulb,
		faLink,
		faListCheck,
		faLocationDot,
		faMapMarkerAlt,
		faMoneyBillWave,
		faPaperPlane,
		faPalette,
		faPencil,
		faPlay,
		faPlus,
		faQuestionCircle,
		faQuoteLeft,
		faRotate,
		faSearch,
		faShieldAlt,
		faSignOutAlt,
		faSitemap,
		faSliders,
		faSpinner,
		faStop,
		faStickyNote,
		faSync,
		faTag,
		faTimes,
		faTimesCircle,
		faTrash,
		faUndo,
		faUser,
		faUserFriends,
		faUserSecret,
		faUsers,
		faUserTie,
		faWrench,
		faXmark
	} from '@fortawesome/free-solid-svg-icons';
	import {
		faClock,
		faStar as faStarRegular,
		faTimesCircle as faTimesCircleRegular
	} from '@fortawesome/free-regular-svg-icons';
	import {
		faGithub,
		faLinkedin,
		faNpm,
		faPython,
		faStackOverflow
	} from '@fortawesome/free-brands-svg-icons';
	import { faStar } from '@fortawesome/free-solid-svg-icons';
	import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
	import SectionHeader from '../../profile/components/SectionHeader.svelte';
	import Card from '../../components/Card.svelte';
	import CopyButton from '../../components/CopyButton.svelte';
	import Spinner from '$lib/components/Spinner.svelte';

	// Group icons by category for display
	const iconGroups: { label: string; icons: { name: string; icon: IconDefinition }[] }[] = [
		{
			label: 'Navigation',
			icons: [
				{ name: 'faHome', icon: faHome },
				{ name: 'faArrowLeft', icon: faArrowLeft },
				{ name: 'faArrowRight', icon: faArrowRight },
				{ name: 'faChevronDown', icon: faChevronDown },
				{ name: 'faChevronUp', icon: faChevronUp },
				{ name: 'faChevronLeft', icon: faChevronLeft },
				{ name: 'faChevronRight', icon: faChevronRight },
				{ name: 'faBars', icon: faBars },
				{ name: 'faTimes', icon: faTimes },
				{ name: 'faXmark', icon: faXmark },
				{ name: 'faExternalLink', icon: faExternalLink },
				{ name: 'faExternalLinkAlt', icon: faExternalLinkAlt },
				{ name: 'faSearch', icon: faSearch }
			]
		},
		{
			label: 'Actions',
			icons: [
				{ name: 'faPlus', icon: faPlus },
				{ name: 'faPencil', icon: faPencil },
				{ name: 'faTrash', icon: faTrash },
				{ name: 'faCopy', icon: faCopy },
				{ name: 'faDownload', icon: faDownload },
				{ name: 'faCloudUploadAlt', icon: faCloudUploadAlt },
				{ name: 'faFileImport', icon: faFileImport },
				{ name: 'faPlay', icon: faPlay },
				{ name: 'faStop', icon: faStop },
				{ name: 'faForward', icon: faForward },
				{ name: 'faSync', icon: faSync },
				{ name: 'faRotate', icon: faRotate },
				{ name: 'faUndo', icon: faUndo },
				{ name: 'faSave (faCheck)', icon: faCheck },
				{ name: 'faBan', icon: faBan },
				{ name: 'faSignOutAlt', icon: faSignOutAlt }
			]
		},
		{
			label: 'Status & Feedback',
			icons: [
				{ name: 'faSpinner', icon: faSpinner },
				{ name: 'faCheckCircle', icon: faCheckCircle },
				{ name: 'faTimesCircle', icon: faTimesCircle },
				{ name: 'faExclamationTriangle', icon: faExclamationTriangle },
				{ name: 'faCircle', icon: faCircle },
				{ name: 'faBell', icon: faBell },
				{ name: 'faLightbulb', icon: faLightbulb },
				{ name: 'faEye', icon: faEye },
				{ name: 'faEyeSlash', icon: faEyeSlash },
				{ name: 'faGauge', icon: faGauge }
			]
		},
		{
			label: 'Content & Data',
			icons: [
				{ name: 'faFile', icon: faFile },
				{ name: 'faFileAlt', icon: faFileAlt },
				{ name: 'faFileArchive', icon: faFileArchive },
				{ name: 'faBook', icon: faBook },
				{ name: 'faImage', icon: faImage },
				{ name: 'faCamera', icon: faCamera },
				{ name: 'faLink', icon: faLink },
				{ name: 'faTag', icon: faTag },
				{ name: 'faDatabase', icon: faDatabase },
				{ name: 'faChartBar', icon: faChartBar },
				{ name: 'faQuoteLeft', icon: faQuoteLeft },
				{ name: 'faGripVertical', icon: faGripVertical }
			]
		},
		{
			label: 'Dashboard Sections',
			icons: [
				{ name: 'faBriefcase', icon: faBriefcase },
				{ name: 'faBullseye', icon: faBullseye },
				{ name: 'faListCheck', icon: faListCheck },
				{ name: 'faBookmark', icon: faBookmark },
				{ name: 'faPaperPlane', icon: faPaperPlane },
				{ name: 'faEnvelope', icon: faEnvelope },
				{ name: 'faMoneyBillWave', icon: faMoneyBillWave },
				{ name: 'faUserTie', icon: faUserTie },
				{ name: 'faComments', icon: faComments },
				{ name: 'faStickyNote', icon: faStickyNote },
				{ name: 'faUser', icon: faUser },
				{ name: 'faUsers', icon: faUsers },
				{ name: 'faUserFriends', icon: faUserFriends },
				{ name: 'faUserSecret', icon: faUserSecret },
				{ name: 'faCog', icon: faCog },
				{ name: 'faSliders', icon: faSliders },
				{ name: 'faShieldAlt', icon: faShieldAlt },
				{ name: 'faDesktop', icon: faDesktop }
			]
		},
		{
			label: 'Job & Profile',
			icons: [
				{ name: 'faBuilding', icon: faBuilding },
				{ name: 'faLocationDot', icon: faLocationDot },
				{ name: 'faMapMarkerAlt', icon: faMapMarkerAlt },
				{ name: 'faCalendar', icon: faCalendar },
				{ name: 'faCalendarDays', icon: faCalendarDays },
				{ name: 'faGlobe', icon: faGlobe },
				{ name: 'faGraduationCap', icon: faGraduationCap },
				{ name: 'faCode', icon: faCode },
				{ name: 'faWrench', icon: faWrench },
				{ name: 'faCloud', icon: faCloud },
				{ name: 'faKey', icon: faKey },
				{ name: 'faHistory', icon: faHistory },
				{ name: 'faSitemap', icon: faSitemap },
				{ name: 'faLayerGroup', icon: faLayerGroup },
				{ name: 'faStar (solid)', icon: faStar }
			]
		},
		{
			label: 'Regular (outlined)',
			icons: [
				{ name: 'faClock', icon: faClock },
				{ name: 'faStar (regular)', icon: faStarRegular },
				{ name: 'faTimesCircle (regular)', icon: faTimesCircleRegular }
			]
		},
		{
			label: 'Brands',
			icons: [
				{ name: 'faGithub', icon: faGithub },
				{ name: 'faLinkedin', icon: faLinkedin },
				{ name: 'faNpm', icon: faNpm },
				{ name: 'faPython', icon: faPython },
				{ name: 'faStackOverflow', icon: faStackOverflow }
			]
		}
	];

	// Selection control demo state
	let segmentedValue = $state('option_b');
	let chipValue = $state('cover_letter');

	const segmentedOptions = [
		{ value: 'option_a', label: 'Option A' },
		{ value: 'option_b', label: 'Option B' },
		{ value: 'option_c', label: 'Option C' }
	];

	const chipOptions = [
		{ value: 'cover_letter', label: 'Cover Letter' },
		{ value: 'follow_up', label: 'Follow-up' },
		{ value: 'thank_you', label: 'Thank You' },
		{ value: 'introduction', label: 'Introduction' }
	];

	let checkboxValues = $state<Set<string>>(new Set(['frontend', 'typescript']));

	const checkboxOptions = [
		{ value: 'frontend', label: 'Frontend' },
		{ value: 'backend', label: 'Backend' },
		{ value: 'typescript', label: 'TypeScript' },
		{ value: 'python', label: 'Python' },
		{ value: 'devops', label: 'DevOps' },
		{ value: 'databases', label: 'Databases' }
	];

	function toggleCheckbox(value: string) {
		if (checkboxValues.has(value)) {
			checkboxValues.delete(value);
		} else {
			checkboxValues.add(value);
		}
		checkboxValues = new Set(checkboxValues);
	}

	// Checkbox demo
	let checkboxA = $state(true);
	let checkboxB = $state(false);
	let checkboxC = $state(true);

	// RadioGroup demo
	let radioValue = $state('hybrid');
	const radioOptions = [
		{ value: 'remote', label: 'Remote' },
		{ value: 'hybrid', label: 'Hybrid' },
		{ value: 'onsite', label: 'On-site' }
	];

	// ToggleSwitch demo
	let toggleBasic = $state(false);
	let toggleWithLabel = $state(true);
	let toggleDisabled = $state(false);

	// FilterTabs demo
	let filterValue = $state('all');
	const filterOptions = [
		{ value: 'all', label: 'All', icon: faLayerGroup },
		{ value: 'letters', label: 'Letters', icon: faEnvelope },
		{ value: 'questions', label: 'Questions', icon: faQuestionCircle }
	];

	let filterValueNoIcons = $state('active');
	const filterOptionsNoIcons = [
		{ value: 'active', label: 'Active' },
		{ value: 'archived', label: 'Archived' }
	];

	// TabNav demo
	let activeTab = $state('#overview');
	const tabNavTabs = [
		{ label: 'Overview', href: '#overview', icon: faClipboardList },
		{ label: 'Applications', href: '#applications', icon: faBriefcase },
		{ label: 'Analytics', href: '#analytics', icon: faChartLine },
		{ label: 'Documents', href: '#documents', icon: faFileAlt },
		{ label: 'Salary', href: '#salary', icon: faMoneyBillWave },
		{ label: 'Timeline', href: '#timeline', icon: faHistory },
		{ label: 'Settings', href: '#settings', icon: faCog },
		{ label: 'Profile', href: '#profile', icon: faUser },
		{ label: 'Notifications', href: '#notifications', icon: faBell },
		{ label: 'Bookmarks', href: '#bookmarks', icon: faBookmark }
	];

	const colorTokens = [
		{
			group: 'Primary',
			tokens: [
				{ name: '--dash-primary', label: 'Primary' },
				{ name: '--dash-primary-hover', label: 'Primary Hover' },
				{ name: '--dash-primary-light', label: 'Primary Light' }
			]
		},
		{
			group: 'Chrome',
			tokens: [
				{ name: '--dash-chrome', label: 'Chrome' },
				{ name: '--dash-chrome-hover', label: 'Chrome Hover' },
				{ name: '--dash-chrome-text', label: 'Chrome Text' }
			]
		},
		{
			group: 'Backgrounds',
			tokens: [
				{ name: '--dash-bg', label: 'Background' },
				{ name: '--dash-bg-inset', label: 'Background Inset' },
				{ name: '--dash-card', label: 'Card' }
			]
		},
		{
			group: 'Borders',
			tokens: [
				{ name: '--dash-border', label: 'Border' },
				{ name: '--dash-border-input', label: 'Input Border' }
			]
		},
		{
			group: 'Text',
			tokens: [
				{ name: '--dash-text', label: 'Text' },
				{ name: '--dash-text-secondary', label: 'Text Secondary' },
				{ name: '--dash-text-muted', label: 'Text Muted' }
			]
		},
		{
			group: 'Semantic',
			tokens: [
				{ name: '--dash-error', label: 'Error' },
				{ name: '--dash-error-light', label: 'Error Light' },
				{ name: '--dash-success', label: 'Success' },
				{ name: '--dash-success-light', label: 'Success Light' },
				{ name: '--dash-warning', label: 'Warning' },
				{ name: '--dash-warning-light', label: 'Warning Light' },
				{ name: '--dash-info', label: 'Info' },
				{ name: '--dash-info-light', label: 'Info Light' },
				{ name: '--dash-purple', label: 'Purple' },
				{ name: '--dash-purple-light', label: 'Purple Light' }
			]
		}
	];
</script>

<div class="space-y-8">
	<SectionHeader title="Style Guide" icon={faPalette} />

	<!-- Logo -->
	<section>
		<h2 class="mb-3 text-lg font-semibold text-[var(--dash-text)]">Logo</h2>

		<!-- Logo with text -->
		<Card padding="responsive" class="mb-3">
			<h3 class="mb-4 text-sm font-medium text-[var(--dash-text)]">Logo with Text</h3>
			<div class="flex flex-wrap gap-6">
				<!-- Light background -->
				<div class="flex flex-col items-center gap-2">
					<div
						class="flex items-center gap-3 rounded-lg border border-[var(--dash-border)] px-6 py-4"
					>
						<svg
							class="h-10 w-10"
							viewBox="0 0 40 40"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
						>
							<circle cx="16" cy="16" r="12" stroke="#4f46e5" stroke-width="3" fill="none" />
							<line
								x1="25"
								y1="25"
								x2="36"
								y2="36"
								stroke="#4f46e5"
								stroke-width="4"
								stroke-linecap="round"
							/>
							<path
								d="M10 17l4 4 8-8"
								stroke="#4f46e5"
								stroke-width="3"
								stroke-linecap="round"
								stroke-linejoin="round"
								fill="none"
							/>
						</svg>
						<span class="font-semibold tracking-wide text-[var(--dash-text)] uppercase"
							>Smart Job Seeker</span
						>
					</div>
					<span class="text-xs text-[var(--dash-text-muted)]">Light background</span>
				</div>
				<!-- Indigo header -->
				<div class="flex flex-col items-center gap-2">
					<div class="flex items-center gap-3 rounded-lg bg-[var(--dash-chrome)] px-6 py-4">
						<svg
							class="h-10 w-10"
							viewBox="0 0 40 40"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
						>
							<circle cx="16" cy="16" r="12" stroke="#ffffff" stroke-width="3" fill="none" />
							<line
								x1="25"
								y1="25"
								x2="36"
								y2="36"
								stroke="#ffffff"
								stroke-width="4"
								stroke-linecap="round"
							/>
							<path
								d="M10 17l4 4 8-8"
								stroke="#ffffff"
								stroke-width="3"
								stroke-linecap="round"
								stroke-linejoin="round"
								fill="none"
							/>
						</svg>
						<span class="font-semibold tracking-wide text-white uppercase">Smart Job Seeker</span>
					</div>
					<span class="text-xs text-[var(--dash-text-muted)]">Indigo header</span>
				</div>
				<!-- Dark background -->
				<div class="flex flex-col items-center gap-2">
					<div class="flex items-center gap-3 rounded-lg bg-gray-800 px-6 py-4">
						<svg
							class="h-10 w-10"
							viewBox="0 0 40 40"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
						>
							<circle cx="16" cy="16" r="12" stroke="#ffffff" stroke-width="3" fill="none" />
							<line
								x1="25"
								y1="25"
								x2="36"
								y2="36"
								stroke="#ffffff"
								stroke-width="4"
								stroke-linecap="round"
							/>
							<path
								d="M10 17l4 4 8-8"
								stroke="#ffffff"
								stroke-width="3"
								stroke-linecap="round"
								stroke-linejoin="round"
								fill="none"
							/>
						</svg>
						<span class="font-semibold tracking-wide text-white uppercase">Smart Job Seeker</span>
					</div>
					<span class="text-xs text-[var(--dash-text-muted)]">Dark background</span>
				</div>
			</div>
		</Card>

		<!-- Icon only -->
		<Card padding="responsive" class="mb-3">
			<h3 class="mb-4 text-sm font-medium text-[var(--dash-text)]">Icon Only</h3>
			<div class="flex flex-wrap items-end gap-10">
				<div class="flex flex-col items-center gap-2">
					<svg class="h-16 w-16" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
						<circle cx="16" cy="16" r="12" stroke="#4f46e5" stroke-width="3" fill="none" />
						<line
							x1="25"
							y1="25"
							x2="36"
							y2="36"
							stroke="#4f46e5"
							stroke-width="4"
							stroke-linecap="round"
						/>
						<path
							d="M10 17l4 4 8-8"
							stroke="#4f46e5"
							stroke-width="3"
							stroke-linecap="round"
							stroke-linejoin="round"
							fill="none"
						/>
					</svg>
					<span class="text-xs text-[var(--dash-text-muted)]">64px</span>
				</div>
				<div class="flex flex-col items-center gap-2">
					<svg class="h-12 w-12" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
						<circle cx="16" cy="16" r="12" stroke="#4f46e5" stroke-width="3" fill="none" />
						<line
							x1="25"
							y1="25"
							x2="36"
							y2="36"
							stroke="#4f46e5"
							stroke-width="4"
							stroke-linecap="round"
						/>
						<path
							d="M10 17l4 4 8-8"
							stroke="#4f46e5"
							stroke-width="3"
							stroke-linecap="round"
							stroke-linejoin="round"
							fill="none"
						/>
					</svg>
					<span class="text-xs text-[var(--dash-text-muted)]">48px</span>
				</div>
				<div class="flex flex-col items-center gap-2">
					<svg class="h-9 w-9" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
						<circle cx="16" cy="16" r="12" stroke="#4f46e5" stroke-width="3" fill="none" />
						<line
							x1="25"
							y1="25"
							x2="36"
							y2="36"
							stroke="#4f46e5"
							stroke-width="4"
							stroke-linecap="round"
						/>
						<path
							d="M10 17l4 4 8-8"
							stroke="#4f46e5"
							stroke-width="3"
							stroke-linecap="round"
							stroke-linejoin="round"
							fill="none"
						/>
					</svg>
					<span class="text-xs text-[var(--dash-text-muted)]">36px (header)</span>
				</div>
				<div class="flex flex-col items-center gap-2">
					<svg class="h-7 w-7" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
						<circle cx="16" cy="16" r="12" stroke="#4f46e5" stroke-width="3" fill="none" />
						<line
							x1="25"
							y1="25"
							x2="36"
							y2="36"
							stroke="#4f46e5"
							stroke-width="4"
							stroke-linecap="round"
						/>
						<path
							d="M10 17l4 4 8-8"
							stroke="#4f46e5"
							stroke-width="3"
							stroke-linecap="round"
							stroke-linejoin="round"
							fill="none"
						/>
					</svg>
					<span class="text-xs text-[var(--dash-text-muted)]">28px</span>
				</div>
				<div class="flex flex-col items-center gap-2">
					<svg class="h-4 w-4" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
						<circle cx="16" cy="16" r="12" stroke="#4f46e5" stroke-width="3" fill="none" />
						<line
							x1="25"
							y1="25"
							x2="36"
							y2="36"
							stroke="#4f46e5"
							stroke-width="4"
							stroke-linecap="round"
						/>
						<path
							d="M10 17l4 4 8-8"
							stroke="#4f46e5"
							stroke-width="3"
							stroke-linecap="round"
							stroke-linejoin="round"
							fill="none"
						/>
					</svg>
					<span class="text-xs text-[var(--dash-text-muted)]">16px (favicon)</span>
				</div>
			</div>
		</Card>

		<!-- SVG assets -->
		<Card padding="responsive">
			<h3 class="mb-2 text-sm font-medium text-[var(--dash-text)]">SVG Assets</h3>
			<div class="flex flex-wrap gap-4 text-xs text-[var(--dash-text-secondary)]">
				<a
					href="/brand/logo-indigo.svg"
					target="_blank"
					class="text-[var(--dash-primary)] hover:underline">/brand/logo-indigo.svg</a
				>
				<a
					href="/brand/logo-white.svg"
					target="_blank"
					class="text-[var(--dash-primary)] hover:underline">/brand/logo-white.svg</a
				>
			</div>
			<p class="mt-2 text-xs text-[var(--dash-text-muted)]">
				Uses <code class="text-[var(--dash-primary)]">currentColor</code> via stroke attribute. Set
				color with CSS <code class="text-[var(--dash-primary)]">color</code> or Tailwind
				<code class="text-[var(--dash-primary)]">text-*</code> classes.
			</p>
		</Card>
	</section>

	<!-- Color Tokens -->
	<section>
		<h2 class="mb-3 text-lg font-semibold text-[var(--dash-text)]">Color Tokens</h2>
		<div class="space-y-3">
			{#each colorTokens as group}
				<Card padding="responsive">
					<h3 class="mb-3 text-sm font-medium text-[var(--dash-text)]">{group.group}</h3>
					<div class="flex flex-wrap gap-3">
						{#each group.tokens as token}
							<div class="flex items-center gap-2">
								<div
									class="h-8 w-8 rounded border border-[var(--dash-border)]"
									style="background: var({token.name})"
								></div>
								<div>
									<div class="text-xs font-medium text-[var(--dash-text)]">{token.label}</div>
									<div class="font-mono text-xs text-[var(--dash-text-muted)]">{token.name}</div>
								</div>
							</div>
						{/each}
					</div>
				</Card>
			{/each}
		</div>
	</section>

	<!-- Typography -->
	<section>
		<h2 class="mb-3 text-lg font-semibold text-[var(--dash-text)]">Typography</h2>
		<Card padding="responsive">
			<div class="space-y-3">
				<div>
					<h1 class="text-2xl font-bold text-[var(--dash-text)]">Page Title (text-2xl bold)</h1>
				</div>
				<div>
					<h2 class="text-lg font-semibold text-[var(--dash-text)]">
						Section Title (text-lg semibold)
					</h2>
				</div>
				<div>
					<h3 class="text-sm font-medium text-[var(--dash-text)]">Card Title (text-sm medium)</h3>
				</div>
				<div>
					<p class="text-sm text-[var(--dash-text)]">Body text (text-sm)</p>
				</div>
				<div>
					<p class="text-sm text-[var(--dash-text-secondary)]">
						Secondary text (text-sm, --dash-text-secondary)
					</p>
				</div>
				<div>
					<p class="text-xs text-[var(--dash-text-muted)]">
						Muted / caption text (text-xs, --dash-text-muted)
					</p>
				</div>
				<div>
					<code class="rounded bg-[var(--dash-bg)] px-1.5 py-0.5 text-xs text-[var(--dash-primary)]"
						>Inline code</code
					>
				</div>
			</div>
			<p class="mt-4 text-xs text-[var(--dash-text-muted)]">
				Font: Noto Sans (300–700). All text uses CSS variable colors.
			</p>
		</Card>
	</section>

	<!-- Loading States -->
	<section>
		<h2 class="mb-3 text-lg font-semibold text-[var(--dash-text)]">Loading States</h2>
		<Card padding="responsive">
			<div class="flex flex-wrap items-start gap-8">
				<!-- Custom spinner -->
				<div class="flex flex-col items-center gap-2">
					<Spinner size="w-6 h-6" color="var(--dash-primary)" />
					<span class="text-xs text-[var(--dash-text-muted)]">Spinner (default)</span>
				</div>
				<!-- Small spinner -->
				<div class="flex flex-col items-center gap-2">
					<Spinner size="w-4 h-4" color="var(--dash-primary)" />
					<span class="text-xs text-[var(--dash-text-muted)]">Spinner (small)</span>
				</div>
				<!-- Inline spinner -->
				<div class="flex flex-col items-center gap-2">
					<Spinner size="w-3 h-3" />
					<span class="text-xs text-[var(--dash-text-muted)]">Spinner (inline)</span>
				</div>
				<!-- Spinner in button -->
				<div class="flex flex-col items-center gap-2">
					<button
						type="button"
						disabled
						class="flex cursor-not-allowed items-center gap-2 rounded-lg bg-[var(--dash-primary)] px-4 py-2 text-white opacity-70"
					>
						<Spinner size="w-4 h-4" color="white" />
						<span class="text-sm">Saving...</span>
					</button>
					<span class="text-xs text-[var(--dash-text-muted)]">Button loading</span>
				</div>
				<!-- Muted spinner -->
				<div class="flex flex-col items-center gap-2">
					<Spinner size="w-5 h-5" color="var(--dash-text-muted)" />
					<span class="text-xs text-[var(--dash-text-muted)]">Muted</span>
				</div>
				<!-- Live indicator -->
				<div class="flex flex-col items-center gap-2">
					<span class="relative flex h-3 w-3">
						<span
							class="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"
						></span>
						<span class="relative inline-flex h-3 w-3 rounded-full bg-green-500"></span>
					</span>
					<span class="text-xs text-[var(--dash-text-muted)]">Live indicator</span>
				</div>
				<!-- Idle indicator -->
				<div class="flex flex-col items-center gap-2">
					<span class="relative flex h-3 w-3">
						<span class="relative inline-flex h-3 w-3 rounded-full bg-gray-400"></span>
					</span>
					<span class="text-xs text-[var(--dash-text-muted)]">Idle indicator</span>
				</div>
				<!-- Active (no ping) -->
				<div class="flex flex-col items-center gap-2">
					<span class="relative flex h-3 w-3">
						<span class="relative inline-flex h-3 w-3 rounded-full bg-yellow-500"></span>
					</span>
					<span class="text-xs text-[var(--dash-text-muted)]">Active (waiting)</span>
				</div>
			</div>

			<!-- Inline usage examples -->
			<div class="mt-6 space-y-3 border-t border-[var(--dash-border)] pt-4">
				<h3 class="text-sm font-medium text-[var(--dash-text)]">Usage</h3>
				<div
					class="overflow-x-auto rounded bg-[var(--dash-bg)] p-3 font-mono text-xs text-[var(--dash-text-secondary)]"
				>
					&lt;Spinner size="w-6 h-6" color="var(--dash-primary)" /&gt;
				</div>
				<div
					class="overflow-x-auto rounded bg-[var(--dash-bg)] p-3 font-mono text-xs text-[var(--dash-text-secondary)]"
				>
					&lt;Spinner size="w-4 h-4" color="white" /&gt; &lt;!-- in buttons --&gt;
				</div>
				<div
					class="overflow-x-auto rounded bg-[var(--dash-bg)] p-3 font-mono text-xs text-[var(--dash-text-secondary)]"
				>
					&lt;Spinner /&gt; &lt;!-- inherits text color, w-4 h-4 default --&gt;
				</div>
			</div>
		</Card>
	</section>

	<!-- Buttons -->
	<section>
		<h2 class="mb-3 text-lg font-semibold text-[var(--dash-text)]">Buttons</h2>
		<Card padding="responsive">
			<div class="flex flex-wrap items-center gap-3">
				<button
					type="button"
					class="rounded-lg bg-[var(--dash-primary)] px-4 py-2 text-sm text-white transition-colors hover:bg-[var(--dash-primary-hover)]"
					>Primary</button
				>
				<button
					type="button"
					class="rounded-lg border border-[var(--dash-border)] px-4 py-2 text-sm text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
					>Secondary</button
				>
				<button
					type="button"
					class="rounded-lg bg-[var(--dash-error)] px-4 py-2 text-sm text-white transition-colors hover:opacity-90"
					>Danger</button
				>
				<button
					type="button"
					class="rounded-lg bg-[var(--dash-success)] px-4 py-2 text-sm text-white transition-colors hover:opacity-90"
					>Success</button
				>
				<button type="button" class="text-sm text-[var(--dash-primary)] hover:underline"
					>Text Link</button
				>
				<button
					type="button"
					disabled
					class="cursor-not-allowed rounded-lg bg-[var(--dash-primary)] px-4 py-2 text-sm text-white opacity-50"
					>Disabled</button
				>
			</div>

			<div class="mt-4 flex flex-wrap items-center gap-3">
				<button
					type="button"
					class="flex items-center gap-2 rounded-lg bg-[var(--dash-primary)] px-4 py-2 text-sm text-white transition-colors hover:bg-[var(--dash-primary-hover)]"
				>
					<FontAwesomeIcon icon={faPlus} class="h-4 w-4" />
					With Icon
				</button>
				<button
					type="button"
					class="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--dash-primary)] text-white transition-colors hover:bg-[var(--dash-primary-hover)]"
				>
					<FontAwesomeIcon icon={faPlus} class="h-5 w-5" />
				</button>
				<span
					class="rounded-full bg-[var(--dash-primary)]/10 px-2 py-1 text-xs text-[var(--dash-primary)]"
					>Badge</span
				>
				<span
					class="rounded-full bg-[var(--dash-success-light)] px-2 py-1 text-xs text-[var(--dash-success)]"
					>Success badge</span
				>
				<span
					class="rounded-full bg-[var(--dash-error-light)] px-2 py-1 text-xs text-[var(--dash-error)]"
					>Error badge</span
				>
				<span
					class="rounded-full bg-[var(--dash-warning-light)] px-2 py-1 text-xs text-[var(--dash-warning)]"
					>Warning badge</span
				>
			</div>
		</Card>
	</section>

	<!-- Copy Button -->
	<section>
		<h2 class="mb-3 text-lg font-semibold text-[var(--dash-text)]">Copy Button</h2>
		<Card padding="responsive">
			<p class="mb-4 text-xs text-[var(--dash-text-secondary)]">
				Copies text to clipboard with visual feedback (icon swaps to checkmark for 2 seconds).
				Supports icon-only and labeled variants, in two sizes.
			</p>

			<div class="space-y-5">
				<div>
					<p class="mb-3 text-xs font-medium text-[var(--dash-text-secondary)]">Variants</p>
					<div class="flex flex-wrap items-center gap-6">
						<div class="flex flex-col items-center gap-2">
							<CopyButton text="hello world" />
							<span class="text-xs text-[var(--dash-text-muted)]">Icon only (md)</span>
						</div>
						<div class="flex flex-col items-center gap-2">
							<CopyButton text="hello world" size="sm" />
							<span class="text-xs text-[var(--dash-text-muted)]">Icon only (sm)</span>
						</div>
						<div class="flex flex-col items-center gap-2">
							<CopyButton text="hello world" label="Copy" />
							<span class="text-xs text-[var(--dash-text-muted)]">With label (md)</span>
						</div>
						<div class="flex flex-col items-center gap-2">
							<CopyButton text="hello world" label="Copy" size="sm" />
							<span class="text-xs text-[var(--dash-text-muted)]">With label (sm)</span>
						</div>
					</div>
				</div>

				<div>
					<p class="mb-2 text-xs font-medium text-[var(--dash-text-secondary)]">Inline example</p>
					<div class="flex items-center gap-2">
						<code
							class="rounded bg-[var(--dash-bg)] px-2 py-1 font-mono text-xs text-[var(--dash-text-secondary)]"
							>sk_live_abc123xyz</code
						>
						<CopyButton text="sk_live_abc123xyz" />
					</div>
				</div>

				<div class="border-t border-[var(--dash-border)] pt-4">
					<h3 class="mb-2 text-sm font-medium text-[var(--dash-text)]">Usage</h3>
					<pre
						class="overflow-x-auto rounded-md border border-[var(--dash-border)] bg-[var(--dash-bg)] p-3 text-xs"><code
							>{`import CopyButton from "../../components/CopyButton.svelte";

<!-- Icon only -->
<CopyButton text="value to copy" />

<!-- With label -->
<CopyButton text="value to copy" label="Copy" />

<!-- Small size -->
<CopyButton text="value to copy" size="sm" />

<!-- Custom tooltip, for when the label alone doesn't say what gets copied -->
<CopyButton text="42" label="#42" title="Conversation ID" />`}</code
						></pre>
				</div>
			</div>
		</Card>
	</section>

	<!-- Selection Controls -->
	<section>
		<h2 class="mb-3 text-lg font-semibold text-[var(--dash-text)]">Selection Controls</h2>
		<div class="space-y-3">
			<!-- Segmented Control -->
			<Card padding="responsive">
				<h3 class="mb-3 text-sm font-medium text-[var(--dash-text)]">Segmented Control</h3>
				<p class="mb-4 text-xs text-[var(--dash-text-secondary)]">
					Best for 2–4 short options. All options visible at once. Not suitable for long labels or
					many items — will overflow on mobile.
				</p>
				<div class="inline-flex overflow-hidden rounded-lg border border-[var(--dash-border)]">
					{#each segmentedOptions as opt, i}
						<button
							type="button"
							onclick={() => (segmentedValue = opt.value)}
							class="px-3 py-2 text-sm transition-colors {segmentedValue === opt.value
								? 'bg-[var(--dash-primary)]/10 font-medium text-[var(--dash-primary)]'
								: 'text-[var(--dash-text-secondary)] hover:bg-[var(--dash-bg)]'} {i > 0
								? 'border-l border-[var(--dash-border)]'
								: ''}"
						>
							{opt.label}
						</button>
					{/each}
				</div>
				<p class="mt-3 text-xs text-[var(--dash-text-muted)]">
					Selected: <code class="text-[var(--dash-primary)]">{segmentedValue}</code>
				</p>
			</Card>

			<!-- Chip / Pill Selector -->
			<Card padding="responsive">
				<h3 class="mb-3 text-sm font-medium text-[var(--dash-text)]">Chip Selector</h3>
				<p class="mb-4 text-xs text-[var(--dash-text-secondary)]">
					Best for any number of options, including long labels. Wraps naturally on mobile. Radio
					dot makes it clearly a selection control, not an action button.
				</p>
				<div class="flex flex-wrap gap-2">
					{#each chipOptions as opt}
						<button
							type="button"
							onclick={() => (chipValue = opt.value)}
							class="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors {chipValue ===
							opt.value
								? 'border-[var(--dash-primary)] bg-[var(--dash-primary)]/10 text-[var(--dash-primary)]'
								: 'border-[var(--dash-border)] text-[var(--dash-text-secondary)] hover:border-[var(--dash-text-muted)]'}"
						>
							<span
								class="flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full border {chipValue ===
								opt.value
									? 'border-[var(--dash-primary)]'
									: 'border-[var(--dash-border)]'}"
							>
								{#if chipValue === opt.value}
									<span class="h-2 w-2 rounded-full bg-[var(--dash-primary)]"></span>
								{/if}
							</span>
							{opt.label}
						</button>
					{/each}
				</div>
				<p class="mt-3 text-xs text-[var(--dash-text-muted)]">
					Selected: <code class="text-[var(--dash-primary)]">{chipValue}</code>
				</p>
			</Card>

			<!-- Checkbox Chips -->
			<Card padding="responsive">
				<h3 class="mb-3 text-sm font-medium text-[var(--dash-text)]">
					Checkbox Chips (Multi-select)
				</h3>
				<p class="mb-4 text-xs text-[var(--dash-text-secondary)]">
					Same wrapping pill style but for multi-select. Uses a checkmark square instead of a radio
					dot to signal multiple selection.
				</p>
				<div class="flex flex-wrap gap-2">
					{#each checkboxOptions as opt}
						<button
							type="button"
							onclick={() => toggleCheckbox(opt.value)}
							class="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors {checkboxValues.has(
								opt.value
							)
								? 'border-[var(--dash-primary)] bg-[var(--dash-primary)]/10 text-[var(--dash-primary)]'
								: 'border-[var(--dash-border)] text-[var(--dash-text-secondary)] hover:border-[var(--dash-text-muted)]'}"
						>
							<span
								class="flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded border {checkboxValues.has(
									opt.value
								)
									? 'border-[var(--dash-primary)] bg-[var(--dash-primary)]'
									: 'border-[var(--dash-border)]'}"
							>
								{#if checkboxValues.has(opt.value)}
									<FontAwesomeIcon icon={faCheck} class="h-2.5 w-2.5 text-white" />
								{/if}
							</span>
							{opt.label}
						</button>
					{/each}
				</div>
				<p class="mt-3 text-xs text-[var(--dash-text-muted)]">
					Selected: <code class="text-[var(--dash-primary)]">{[...checkboxValues].join(', ')}</code>
				</p>
			</Card>
		</div>
	</section>

	<!-- Form Controls -->
	<section>
		<h2 class="mb-3 text-lg font-semibold text-[var(--dash-text)]">Form Controls</h2>
		<div class="space-y-3">
			<!-- Checkbox -->
			<Card padding="responsive">
				<h3 class="mb-1 text-sm font-medium text-[var(--dash-text)]">Checkbox</h3>
				<p class="mb-4 text-xs text-[var(--dash-text-secondary)]">
					Standard checkbox with label. Use for multi-select options and toggleable settings. Value
					is bindable.
				</p>

				<div class="space-y-5">
					<div>
						<p class="mb-2 text-xs font-medium text-[var(--dash-text-secondary)]">Inline group</p>
						<div class="flex flex-wrap gap-x-4 gap-y-2">
							<Checkbox bind:checked={checkboxA} label="Remote" />
							<Checkbox bind:checked={checkboxB} label="Hybrid" />
							<Checkbox bind:checked={checkboxC} label="On-site" />
						</div>
						<p class="mt-2 text-xs text-[var(--dash-text-muted)]">
							Selected: {[checkboxA && 'Remote', checkboxB && 'Hybrid', checkboxC && 'On-site']
								.filter(Boolean)
								.join(', ') || 'none'}
						</p>
					</div>

					<div>
						<p class="mb-2 text-xs font-medium text-[var(--dash-text-secondary)]">Usage</p>
						<pre
							class="overflow-x-auto rounded-md border border-[var(--dash-border)] bg-[var(--dash-bg)] p-3 text-xs"><code
								>{`<Checkbox bind:checked={value} label="Option" />`}</code
							></pre>
					</div>
				</div>
			</Card>

			<!-- RadioGroup -->
			<Card padding="responsive">
				<h3 class="mb-1 text-sm font-medium text-[var(--dash-text)]">RadioGroup</h3>
				<p class="mb-4 text-xs text-[var(--dash-text-secondary)]">
					Single-select radio buttons. Use for mutually exclusive choices. Value is bindable.
				</p>

				<div class="space-y-5">
					<div>
						<p class="mb-2 text-xs font-medium text-[var(--dash-text-secondary)]">Default</p>
						<RadioGroup options={radioOptions} bind:value={radioValue} />
						<p class="mt-2 text-xs text-[var(--dash-text-muted)]">Selected: {radioValue}</p>
					</div>

					<div>
						<p class="mb-2 text-xs font-medium text-[var(--dash-text-secondary)]">Usage</p>
						<pre
							class="overflow-x-auto rounded-md border border-[var(--dash-border)] bg-[var(--dash-bg)] p-3 text-xs"><code
								>{`<RadioGroup
  options={[
    { value: "remote", label: "Remote" },
    { value: "hybrid", label: "Hybrid" },
    { value: "onsite", label: "On-site" },
  ]}
  bind:value={selected}
/>`}</code
							></pre>
					</div>
				</div>
			</Card>

			<!-- ToggleSwitch -->
			<Card padding="responsive">
				<h3 class="mb-1 text-sm font-medium text-[var(--dash-text)]">ToggleSwitch</h3>
				<p class="mb-4 text-xs text-[var(--dash-text-secondary)]">
					On/off toggle. Supports label, description, and disabled state. Value is bindable.
				</p>

				<div class="space-y-5">
					<div>
						<p class="mb-2 text-xs font-medium text-[var(--dash-text-secondary)]">Basic</p>
						<ToggleSwitch bind:checked={toggleBasic} />
						<p class="mt-2 text-xs text-[var(--dash-text-muted)]">Checked: {toggleBasic}</p>
					</div>

					<div>
						<p class="mb-2 text-xs font-medium text-[var(--dash-text-secondary)]">
							With label and description
						</p>
						<ToggleSwitch
							bind:checked={toggleWithLabel}
							label="Enable feature"
							description="This enables an optional feature that does something useful"
						/>
					</div>

					<div>
						<p class="mb-2 text-xs font-medium text-[var(--dash-text-secondary)]">Disabled</p>
						<ToggleSwitch bind:checked={toggleDisabled} label="Unavailable option" disabled />
					</div>

					<div>
						<p class="mb-2 text-xs font-medium text-[var(--dash-text-secondary)]">Usage</p>
						<pre
							class="overflow-x-auto rounded-md border border-[var(--dash-border)] bg-[var(--dash-bg)] p-3 text-xs"><code
								>{`<ToggleSwitch
  bind:checked={enabled}
  label="Enable feature"
  description="Optional description text"
/>`}</code
							></pre>
					</div>
				</div>
			</Card>

			<!-- FilterTabs -->
			<Card padding="responsive">
				<h3 class="mb-1 text-sm font-medium text-[var(--dash-text)]">FilterTabs</h3>
				<p class="mb-4 text-xs text-[var(--dash-text-secondary)]">
					Single-select tabs for filtering or choosing between options. Icons are optional.
				</p>

				<div class="space-y-5">
					<div>
						<p class="mb-2 text-xs font-medium text-[var(--dash-text-secondary)]">With icons</p>
						<FilterTabs
							filters={filterOptions}
							value={filterValue}
							onchange={(v) => (filterValue = v)}
						/>
						<p class="mt-2 text-xs text-[var(--dash-text-muted)]">Selected: {filterValue}</p>
					</div>

					<div>
						<p class="mb-2 text-xs font-medium text-[var(--dash-text-secondary)]">Without icons</p>
						<FilterTabs
							filters={filterOptionsNoIcons}
							value={filterValueNoIcons}
							onchange={(v) => (filterValueNoIcons = v)}
						/>
						<p class="mt-2 text-xs text-[var(--dash-text-muted)]">Selected: {filterValueNoIcons}</p>
					</div>

					<div>
						<p class="mb-2 text-xs font-medium text-[var(--dash-text-secondary)]">Usage</p>
						<pre
							class="overflow-x-auto rounded-md border border-[var(--dash-border)] bg-[var(--dash-bg)] p-3 text-xs"><code
								>{`<FilterTabs
  filters={[
    { value: "all", label: "All", icon: faLayerGroup },
    { value: "letters", label: "Letters", icon: faEnvelope },
    { value: "questions", label: "Questions", icon: faQuestionCircle },
  ]}
  value={currentType}
  onchange={(v) => (currentType = v)}
/>`}</code
							></pre>
					</div>
				</div>
			</Card>
		</div>
	</section>

	<!-- TabNav -->
	<section>
		<h2 class="mb-3 text-lg font-semibold text-[var(--dash-text)]">TabNav</h2>
		<Card padding="responsive">
			<p class="mb-4 text-xs text-[var(--dash-text-secondary)]">
				Navigation tabs with multi-row bookmark layout on small screens. Click a tab to change the
				active state.
			</p>

			<div class="space-y-5">
				<div>
					<p class="mb-2 text-xs font-medium text-[var(--dash-text-secondary)]">
						10 tabs (forces multi-row on most screens)
					</p>
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="-mx-4 sm:-mx-6"
						onclick={(e) => {
							const a = (e.target as HTMLElement).closest("a[href^='#']");
							if (a) {
								e.preventDefault();
								activeTab = a.getAttribute('href') || activeTab;
							}
						}}
					>
						<TabNav tabs={tabNavTabs} isActive={(href) => href === activeTab}>
							<div class="px-4 py-4 text-sm text-[var(--dash-text-muted)] sm:px-6">
								Active tab: <strong class="text-[var(--dash-text)]">{activeTab}</strong>
							</div>
						</TabNav>
					</div>
				</div>
			</div>
		</Card>
	</section>

	<!-- Category Tag Pills -->
	<section>
		<h2 class="mb-3 text-lg font-semibold text-[var(--dash-text)]">Category Tag Pills</h2>
		<p class="mb-3 text-sm text-[var(--dash-text-secondary)]">
			Colored tag pills with icons used on job cards, job detail pages, salary expectations, and
			match config. Each category has a distinct color. Icons resolve via the job taxonomy, handling
			non-canonical forms automatically.
		</p>
		<div class="space-y-3">
			<!-- Job Types -->
			<Card padding="responsive">
				<h3 class="mb-3 text-sm font-medium text-[var(--dash-text)]">
					Job Type <span class="text-xs font-normal text-[var(--dash-text-muted)]">— emerald</span>
				</h3>
				<div class="flex flex-wrap gap-2">
					{#each getAllIcons('job_type') as { value }}
						<CategoryPill category="job_type" {value} />
					{/each}
				</div>
			</Card>

			<!-- Work Location -->
			<Card padding="responsive">
				<h3 class="mb-3 text-sm font-medium text-[var(--dash-text)]">
					Work Location <span class="text-xs font-normal text-[var(--dash-text-muted)]"
						>— primary (blue)</span
					>
				</h3>
				<div class="flex flex-wrap gap-2">
					{#each getAllIcons('work_location') as { value }}
						<CategoryPill category="work_location" {value} />
					{/each}
				</div>
			</Card>

			<!-- Experience Level -->
			<Card padding="responsive">
				<h3 class="mb-3 text-sm font-medium text-[var(--dash-text)]">
					Experience Level <span class="text-xs font-normal text-[var(--dash-text-muted)]"
						>— purple</span
					>
				</h3>
				<div class="flex flex-wrap gap-2">
					{#each getAllIcons('experience_level') as { value }}
						<CategoryPill category="experience_level" {value} />
					{/each}
				</div>
			</Card>

			<!-- Usage -->
			<Card padding="responsive">
				<h3 class="mb-3 text-sm font-medium text-[var(--dash-text)]">Usage</h3>
				<div class="space-y-3">
					<div
						class="overflow-x-auto rounded bg-[var(--dash-bg)] p-3 font-mono text-xs text-[var(--dash-text-secondary)]"
					>
						import CategoryPill from "$lib/components/CategoryPill.svelte";
					</div>
					<div
						class="overflow-x-auto rounded bg-[var(--dash-bg)] p-3 font-mono text-xs text-[var(--dash-text-secondary)]"
					>
						&lt;CategoryPill category="job_type" value="full_time" /&gt;
					</div>
					<p class="text-xs text-[var(--dash-text-muted)]">
						Normalizes non-canonical values (e.g. "Full-time", "contractor", "medior") through the
						job taxonomy automatically.
					</p>
				</div>
			</Card>
		</div>
	</section>

	<!-- Links -->
	<section>
		<h2 class="mb-3 text-lg font-semibold text-[var(--dash-text)]">Links</h2>
		<Card padding="responsive">
			<div class="space-y-4">
				<div>
					<h3 class="mb-3 text-sm font-medium text-[var(--dash-text)]">External Link Pills</h3>
					<p class="mb-3 text-xs text-[var(--dash-text-secondary)]">
						Use <code class="rounded bg-[var(--dash-bg)] px-1 py-0.5 text-[var(--dash-primary)]"
							>.dash-link-ext</code
						> for prominent action links that open externally (previews, exports, documents).
					</p>
					<div class="flex flex-wrap gap-2">
						<a href="#" class="dash-link-ext">Resume</a>
						<a href="#" class="dash-link-ext">Resume PDF</a>
						<a href="#" class="dash-link-ext">CV</a>
						<a href="#" class="dash-link-ext">CV PDF</a>
					</div>
				</div>
				<div>
					<h3 class="mb-3 text-sm font-medium text-[var(--dash-text)]">Inline Text Link</h3>
					<p class="mb-3 text-xs text-[var(--dash-text-secondary)]">
						For links within body text, use <code
							class="rounded bg-[var(--dash-bg)] px-1 py-0.5 text-[var(--dash-primary)]"
							>text-[var(--dash-primary)] hover:underline</code
						>.
					</p>
					<p class="text-sm text-[var(--dash-text)]">
						For trackable links with view limits, use <a
							href="#"
							class="text-[var(--dash-primary)] hover:underline">Private Links</a
						>.
					</p>
				</div>
			</div>

			<div class="mt-6 space-y-3 border-t border-[var(--dash-border)] pt-4">
				<h3 class="text-sm font-medium text-[var(--dash-text)]">Usage</h3>
				<div
					class="overflow-x-auto rounded bg-[var(--dash-bg)] p-3 font-mono text-xs text-[var(--dash-text-secondary)]"
				>
					&lt;a href="..." target="_blank" class="dash-link-ext"&gt;Resume PDF&lt;/a&gt;
				</div>
			</div>
		</Card>
	</section>

	<!-- Cards -->
	<section>
		<h2 class="mb-3 text-lg font-semibold text-[var(--dash-text)]">Cards</h2>
		<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
			<Card padding="responsive">
				<h3 class="mb-1 text-sm font-medium text-[var(--dash-text)]">Default Card</h3>
				<p class="text-xs text-[var(--dash-text-secondary)]">
					padding="responsive" — p-4 on mobile, p-6 on desktop
				</p>
			</Card>
			<Card padding="sm">
				<h3 class="mb-1 text-sm font-medium text-[var(--dash-text)]">Small Card</h3>
				<p class="text-xs text-[var(--dash-text-secondary)]">padding="sm" — p-3</p>
			</Card>
			<Card padding="responsive">
				<div class="flex items-center gap-3">
					<span class="relative flex h-3 w-3">
						<span
							class="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"
						></span>
						<span class="relative inline-flex h-3 w-3 rounded-full bg-green-500"></span>
					</span>
					<span class="text-sm font-medium text-[var(--dash-success)]">Card with status</span>
				</div>
			</Card>
			<Card padding="responsive">
				<div class="flex items-center justify-between">
					<h3 class="text-sm font-medium text-[var(--dash-text)]">Card with action</h3>
					<button type="button" class="text-xs text-[var(--dash-primary)] hover:underline"
						>View all</button
					>
				</div>
			</Card>
		</div>
	</section>

	<!-- Alerts / Status Messages -->
	<section>
		<h2 class="mb-3 text-lg font-semibold text-[var(--dash-text)]">Alerts</h2>
		<div class="space-y-3">
			<div class="rounded-lg border border-[var(--dash-info)]/20 bg-[var(--dash-info-light)] p-3">
				<div class="flex items-center gap-2">
					<FontAwesomeIcon icon={faCircle} class="h-3 w-3 text-[var(--dash-info)]" />
					<span class="text-sm text-[var(--dash-info)]">Info message — general information</span>
				</div>
			</div>
			<div
				class="rounded-lg border border-[var(--dash-success)]/20 bg-[var(--dash-success-light)] p-3"
			>
				<div class="flex items-center gap-2">
					<FontAwesomeIcon icon={faCheckCircle} class="h-3.5 w-3.5 text-[var(--dash-success)]" />
					<span class="text-sm text-[var(--dash-success)]">Success — operation completed</span>
				</div>
			</div>
			<div
				class="rounded-lg border border-[var(--dash-warning)]/20 bg-[var(--dash-warning-light)] p-3"
			>
				<div class="flex items-center gap-2">
					<FontAwesomeIcon
						icon={faExclamationTriangle}
						class="h-3.5 w-3.5 text-[var(--dash-warning)]"
					/>
					<span class="text-sm text-[var(--dash-warning)]">Warning — something needs attention</span
					>
				</div>
			</div>
			<div class="rounded-lg border border-[var(--dash-error)]/20 bg-[var(--dash-error-light)] p-3">
				<div class="flex items-center gap-2">
					<FontAwesomeIcon icon={faTimesCircle} class="h-3.5 w-3.5 text-[var(--dash-error)]" />
					<span class="text-sm text-[var(--dash-error)]">Error — something went wrong</span>
				</div>
			</div>
		</div>
	</section>

	<!-- Progress Bar -->
	<section>
		<h2 class="mb-3 text-lg font-semibold text-[var(--dash-text)]">Progress Bars</h2>
		<Card padding="responsive">
			<div class="space-y-4">
				<div>
					<div class="mb-1 flex items-center justify-between">
						<span class="text-xs text-[var(--dash-text-secondary)]">In progress (65%)</span>
					</div>
					<div class="h-1.5 w-full overflow-hidden rounded-full bg-[var(--dash-bg)]">
						<div
							class="h-full rounded-full bg-[var(--dash-primary)] transition-all duration-500"
							style="width: 65%"
						></div>
					</div>
				</div>
				<div>
					<div class="mb-1 flex items-center justify-between">
						<span class="text-xs text-[var(--dash-text-secondary)]">Complete (100%)</span>
					</div>
					<div class="h-1.5 w-full overflow-hidden rounded-full bg-[var(--dash-bg)]">
						<div
							class="h-full rounded-full bg-[var(--dash-success)] transition-all duration-500"
							style="width: 100%"
						></div>
					</div>
				</div>
			</div>
		</Card>
	</section>

	<!-- Icons -->
	<section>
		<h2 class="mb-3 text-lg font-semibold text-[var(--dash-text)]">Icons</h2>
		<p class="mb-3 text-sm text-[var(--dash-text-secondary)]">
			FontAwesome 6.7 — all icons currently used in the dashboard.
		</p>
		<div class="space-y-3">
			{#each iconGroups as group}
				<Card padding="responsive">
					<h3 class="mb-3 text-sm font-medium text-[var(--dash-text)]">{group.label}</h3>
					<div class="flex flex-wrap gap-1.5">
						{#each group.icons as { name, icon }}
							<div
								class="group relative flex h-14 w-14 cursor-default flex-col items-center justify-center rounded-lg transition-colors hover:bg-[var(--dash-bg)]"
								title={name}
							>
								<FontAwesomeIcon {icon} class="h-5 w-5 text-[var(--dash-text-secondary)]" />
								<span
									class="pointer-events-none absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] whitespace-nowrap text-[var(--dash-text-muted)] opacity-0 transition-opacity group-hover:opacity-100"
								>
									{name.replace('fa', '')}
								</span>
							</div>
						{/each}
					</div>
				</Card>
			{/each}
		</div>
	</section>
</div>
