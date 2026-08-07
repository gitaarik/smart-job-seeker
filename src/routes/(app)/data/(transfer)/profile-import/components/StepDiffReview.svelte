<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faUser,
		faBriefcase,
		faCertificate,
		faGraduationCap,
		faCode,
		faGlobe,
		faLightbulb,
		faQuoteLeft,
		faCheck,
		faArrowLeft,
		faBug,
		faChevronDown,
		faChevronRight
	} from '@fortawesome/free-solid-svg-icons';
	import Spinner from '$lib/components/Spinner.svelte';
	import type { ResumeData } from '$lib/server/resume/types';
	import {
		diffResumeData,
		countEnabledChanges,
		type ResumeDataDiff,
		type FieldDiff,
		type ItemDiff,
		type SkillCategoryDiff,
		type SkillItemDiff
	} from '$lib/resume-diff';
	import type { DiffApplyPayload } from '$lib/server/resume/apply-diff';
	import DiffSectionCard from './DiffSectionCard.svelte';
	import DiffFieldRow from './DiffFieldRow.svelte';
	import DiffItemRow from './DiffItemRow.svelte';
	import Card from '../../../../components/Card.svelte';

	interface Props {
		currentData: ResumeData;
		incomingData: ResumeData;
		isLoading: boolean;
		error: string | null;
		onBack: () => void;
		onLoadingChange: (loading: boolean) => void;
	}

	let { currentData, incomingData, isLoading, error, onBack, onLoadingChange }: Props = $props();

	// Compute the diff
	let diff = $state<ResumeDataDiff>(diffResumeData(currentData, incomingData));

	let showUnchanged = $state(false);
	const enabledCount = $derived(countEnabledChanges(diff));

	// Build the payload from current diff state
	function buildPayload(): DiffApplyPayload {
		const payload: DiffApplyPayload = {};

		// Basics
		const enabledBasics: Record<string, string | undefined> = {};
		for (const field of diff.basics) {
			if (field.changed && field.enabled) {
				enabledBasics[field.field] = field.incoming;
			}
		}
		if (Object.keys(enabledBasics).length > 0) {
			payload.basics = enabledBasics as any;
		}

		// Work
		const workPayload: DiffApplyPayload['work'] = {
			added: [],
			modified: [],
			removed: []
		};
		for (const item of diff.work) {
			if (!item.enabled) continue;
			if (item.type === 'added' && item.incoming) {
				workPayload.added!.push(item.incoming);
			} else if (item.type === 'removed' && item.current) {
				workPayload.removed!.push(`${item.current.name}|||${item.current.position}`);
			} else if (item.type === 'modified' && item.current && item.incoming) {
				const fields: Record<string, any> = {};
				for (const fd of item.fieldDiffs ?? []) {
					if (fd.changed && fd.enabled) {
						fields[fd.field] = fd.incoming;
					}
				}
				const mod: any = {
					matchKey: `${item.current.name}|||${item.current.position}`,
					fields
				};

				// Handle nested diffs
				for (const nd of item.nestedDiffs ?? []) {
					const addKey = nd.field === 'achievements' ? 'addAchievements' : 'addTechnologies';
					const removeKey =
						nd.field === 'achievements' ? 'removeAchievements' : 'removeTechnologies';

					const toAdd = nd.added.filter((_, i) => nd.addedEnabled[i]);
					const toRemove = nd.removed.filter((_, i) => nd.removedEnabled[i]);

					if (toAdd.length > 0) mod[addKey] = toAdd;
					if (toRemove.length > 0) mod[removeKey] = toRemove;
				}

				workPayload.modified!.push(mod);
			}
		}
		if (
			workPayload.added!.length > 0 ||
			workPayload.modified!.length > 0 ||
			workPayload.removed!.length > 0
		) {
			payload.work = workPayload;
		}

		// Education
		const eduPayload: DiffApplyPayload['education'] = {
			added: [],
			modified: [],
			removed: []
		};
		for (const item of diff.education) {
			if (!item.enabled) continue;
			if (item.type === 'added' && item.incoming) {
				eduPayload.added!.push(item.incoming);
			} else if (item.type === 'removed' && item.current) {
				eduPayload.removed!.push(`${item.current.institution}|||${item.current.area ?? ''}`);
			} else if (item.type === 'modified' && item.current) {
				const fields: Record<string, any> = {};
				for (const fd of item.fieldDiffs ?? []) {
					if (fd.changed && fd.enabled) fields[fd.field] = fd.incoming;
				}
				eduPayload.modified!.push({
					matchKey: `${item.current.institution}|||${item.current.area ?? ''}`,
					fields
				});
			}
		}
		if (
			eduPayload.added!.length > 0 ||
			eduPayload.modified!.length > 0 ||
			eduPayload.removed!.length > 0
		) {
			payload.education = eduPayload;
		}

		// Skills
		const skillsPayload: DiffApplyPayload['skills'] = {
			added: [],
			modified: [],
			removed: []
		};
		for (const cat of diff.skills) {
			if (!cat.enabled) continue;
			if (cat.type === 'added' && cat.incoming) {
				skillsPayload.added!.push(cat.incoming);
			} else if (cat.type === 'removed' && cat.current) {
				skillsPayload.removed!.push(cat.current.name);
			} else if (cat.type === 'modified' && cat.current) {
				const mod: any = { matchKey: cat.current.name };

				const addSkills: any[] = [];
				const removeSkills: string[] = [];
				const modifySkills: any[] = [];

				for (const sd of cat.skillDiffs ?? []) {
					if (!sd.enabled) continue;
					if (sd.type === 'added' && sd.incoming) {
						addSkills.push(sd.incoming);
					} else if (sd.type === 'removed' && sd.current) {
						removeSkills.push(sd.current.name);
					} else if (sd.type === 'modified' && sd.current) {
						const fields: Record<string, any> = {};
						for (const fd of sd.fieldDiffs ?? []) {
							if (fd.changed && fd.enabled) fields[fd.field] = fd.incoming;
						}
						if (Object.keys(fields).length > 0) {
							modifySkills.push({ name: sd.current.name, fields });
						}
					}
				}

				if (addSkills.length > 0) mod.addSkills = addSkills;
				if (removeSkills.length > 0) mod.removeSkills = removeSkills;
				if (modifySkills.length > 0) mod.modifySkills = modifySkills;

				skillsPayload.modified!.push(mod);
			}
		}
		if (
			skillsPayload.added!.length > 0 ||
			skillsPayload.modified!.length > 0 ||
			skillsPayload.removed!.length > 0
		) {
			payload.skills = skillsPayload;
		}

		// Languages
		const langPayload: DiffApplyPayload['languages'] = {
			added: [],
			modified: [],
			removed: []
		};
		for (const item of diff.languages) {
			if (!item.enabled) continue;
			if (item.type === 'added' && item.incoming) {
				langPayload.added!.push(item.incoming);
			} else if (item.type === 'removed' && item.current) {
				langPayload.removed!.push(item.current.name);
			} else if (item.type === 'modified' && item.current) {
				const fields: Record<string, any> = {};
				for (const fd of item.fieldDiffs ?? []) {
					if (fd.changed && fd.enabled) fields[fd.field] = fd.incoming;
				}
				langPayload.modified!.push({
					matchKey: item.current.name,
					fields
				});
			}
		}
		if (
			langPayload.added!.length > 0 ||
			langPayload.modified!.length > 0 ||
			langPayload.removed!.length > 0
		) {
			payload.languages = langPayload;
		}

		// Projects
		const projPayload: DiffApplyPayload['projects'] = {
			added: [],
			modified: [],
			removed: []
		};
		for (const item of diff.projects) {
			if (!item.enabled) continue;
			if (item.type === 'added' && item.incoming) {
				projPayload.added!.push(item.incoming);
			} else if (item.type === 'removed' && item.current) {
				projPayload.removed!.push(item.current.name);
			} else if (item.type === 'modified' && item.current) {
				const fields: Record<string, any> = {};
				for (const fd of item.fieldDiffs ?? []) {
					if (fd.changed && fd.enabled) fields[fd.field] = fd.incoming;
				}
				const mod: any = { matchKey: item.current.name, fields };

				for (const nd of item.nestedDiffs ?? []) {
					const addKey = nd.field === 'achievements' ? 'addAchievements' : 'addTechnologies';
					const removeKey =
						nd.field === 'achievements' ? 'removeAchievements' : 'removeTechnologies';

					const toAdd = nd.added.filter((_, i) => nd.addedEnabled[i]);
					const toRemove = nd.removed.filter((_, i) => nd.removedEnabled[i]);

					if (toAdd.length > 0) mod[addKey] = toAdd;
					if (toRemove.length > 0) mod[removeKey] = toRemove;
				}

				projPayload.modified!.push(mod);
			}
		}
		if (
			projPayload.added!.length > 0 ||
			projPayload.modified!.length > 0 ||
			projPayload.removed!.length > 0
		) {
			payload.projects = projPayload;
		}

		// Certificates
		const certPayload: DiffApplyPayload['certificates'] = {
			added: [],
			modified: [],
			removed: []
		};
		for (const item of diff.certificates) {
			if (!item.enabled) continue;
			if (item.type === 'added' && item.incoming) {
				certPayload.added!.push(item.incoming);
			} else if (item.type === 'removed' && item.current) {
				certPayload.removed!.push(item.current.name);
			} else if (item.type === 'modified' && item.current) {
				const fields: Record<string, any> = {};
				for (const fd of item.fieldDiffs ?? []) {
					if (fd.changed && fd.enabled) fields[fd.field] = fd.incoming;
				}
				certPayload.modified!.push({
					matchKey: item.current.name,
					fields
				});
			}
		}
		if (
			certPayload.added!.length > 0 ||
			certPayload.modified!.length > 0 ||
			certPayload.removed!.length > 0
		) {
			payload.certificates = certPayload;
		}

		// References
		const refPayload: DiffApplyPayload['references'] = {
			added: [],
			modified: [],
			removed: []
		};
		for (const item of diff.references) {
			if (!item.enabled) continue;
			if (item.type === 'added' && item.incoming) {
				refPayload.added!.push(item.incoming);
			} else if (item.type === 'removed' && item.current) {
				refPayload.removed!.push(item.current.author);
			} else if (item.type === 'modified' && item.current) {
				const fields: Record<string, any> = {};
				for (const fd of item.fieldDiffs ?? []) {
					if (fd.changed && fd.enabled) fields[fd.field] = fd.incoming;
				}
				refPayload.modified!.push({
					matchKey: item.current.author,
					fields
				});
			}
		}
		if (
			refPayload.added!.length > 0 ||
			refPayload.modified!.length > 0 ||
			refPayload.removed!.length > 0
		) {
			payload.references = refPayload;
		}

		return payload;
	}

	function selectAll() {
		for (const f of diff.basics) {
			if (f.changed) f.enabled = true;
		}
		for (const section of [
			diff.work,
			diff.education,
			diff.languages,
			diff.projects,
			diff.certificates,
			diff.references
		]) {
			for (const item of section) {
				if (item.type !== 'unchanged') item.enabled = true;
			}
		}
		for (const cat of diff.skills) {
			if (cat.type !== 'unchanged') {
				cat.enabled = true;
				for (const sd of cat.skillDiffs ?? []) {
					if (sd.type !== 'unchanged') sd.enabled = true;
				}
			}
		}
		// Trigger reactivity
		diff = diff;
	}

	function deselectAll() {
		for (const f of diff.basics) f.enabled = false;
		for (const section of [
			diff.work,
			diff.education,
			diff.languages,
			diff.projects,
			diff.certificates,
			diff.references
		]) {
			for (const item of section) item.enabled = false;
		}
		for (const cat of diff.skills) {
			cat.enabled = false;
			for (const sd of cat.skillDiffs ?? []) sd.enabled = false;
		}
		diff = diff;
	}

	const basicsChangedCount = $derived(diff.basics.filter((d) => d.changed).length);

	// Admin debug panel (also visible when impersonating another user)
	const isAdmin = $derived(
		($page.data.user as { is_admin?: boolean })?.is_admin || !!$page.data.adminUser
	);
	let debugOpen = $state(false);

	const debugSections = $derived([
		{
			name: 'Basics',
			fields: Object.entries(incomingData.basics).filter(([, v]) => v).length,
			total: Object.keys(incomingData.basics).length
		},
		{ name: 'Work', count: incomingData.work?.length, present: incomingData.work !== undefined },
		{
			name: 'Education',
			count: incomingData.education?.length,
			present: incomingData.education !== undefined
		},
		{
			name: 'Skills',
			count: incomingData.skills?.length,
			present: incomingData.skills !== undefined
		},
		{
			name: 'Languages',
			count: incomingData.languages?.length,
			present: incomingData.languages !== undefined
		},
		{
			name: 'Projects',
			count: incomingData.projects?.length,
			present: incomingData.projects !== undefined
		},
		{
			name: 'Certificates',
			count: incomingData.certificates?.length,
			present: incomingData.certificates !== undefined
		},
		{
			name: 'References',
			count: incomingData.references?.length,
			present: incomingData.references !== undefined
		}
	]);

	const isPartial = $derived(
		debugSections.filter((s) => s.name !== 'Basics' && s.present && (s.count ?? 0) > 0).length <= 2
	);

	// For partial documents, always show sections that were parsed (even if
	// all items match). This confirms to the user "your references were found"
	// even when the profile already has them.
	// For partial documents, show parsed sections even if all items match the
	// current profile. This confirms to the user that the data was detected.
	const partialWork = $derived(isPartial && (incomingData.work?.length ?? 0) > 0);
	const partialEducation = $derived(isPartial && (incomingData.education?.length ?? 0) > 0);
	const partialSkills = $derived(isPartial && (incomingData.skills?.length ?? 0) > 0);
	const partialLanguages = $derived(isPartial && (incomingData.languages?.length ?? 0) > 0);
	const partialProjects = $derived(isPartial && (incomingData.projects?.length ?? 0) > 0);
	const partialCertificates = $derived(isPartial && (incomingData.certificates?.length ?? 0) > 0);
	const partialReferences = $derived(isPartial && (incomingData.references?.length ?? 0) > 0);

	const showWork = $derived(
		diff.work.some((d) => d.type !== 'unchanged') || showUnchanged || partialWork
	);
	const showEducation = $derived(
		diff.education.some((d) => d.type !== 'unchanged') || showUnchanged || partialEducation
	);
	const showSkills = $derived(
		diff.skills.some((d) => d.type !== 'unchanged') || showUnchanged || partialSkills
	);
	const showLanguages = $derived(
		diff.languages.some((d) => d.type !== 'unchanged') || showUnchanged || partialLanguages
	);
	const showProjects = $derived(
		diff.projects.some((d) => d.type !== 'unchanged') || showUnchanged || partialProjects
	);
	const showCertificates = $derived(
		diff.certificates.some((d) => d.type !== 'unchanged') || showUnchanged || partialCertificates
	);
	const showReferences = $derived(
		diff.references.some((d) => d.type !== 'unchanged') || showUnchanged || partialReferences
	);
</script>

<div class="space-y-4">
	<!-- Summary bar -->
	<Card padding="responsive">
		<div
			class="mb-4 rounded-lg border border-[var(--dash-primary)]/20 bg-[var(--dash-primary)]/10 px-4 py-3"
		>
			<p class="text-sm text-[var(--dash-text)]">
				Review the differences between your current profile and the imported data. Toggle individual
				changes on or off, then click <strong>Apply Changes</strong> to update your profile.
			</p>
		</div>

		<!-- Stats grid -->
		<div class="grid grid-cols-4 gap-2 rounded-lg bg-[var(--dash-bg)] p-3 sm:p-4 md:grid-cols-8">
			<div class="text-center">
				<div
					class="text-lg font-semibold sm:text-xl {diff.stats.basicsChanged > 0
						? 'text-amber-600'
						: 'text-[var(--dash-text-muted)]'}"
				>
					{diff.stats.basicsChanged}
				</div>
				<div class="text-[10px] text-[var(--dash-text-muted)] sm:text-xs">Basics</div>
			</div>
			<div class="text-center">
				<div
					class="text-lg font-semibold sm:text-xl {diff.stats.workAdded + diff.stats.workModified >
					0
						? 'text-[var(--dash-primary)]'
						: 'text-[var(--dash-text-muted)]'}"
				>
					{diff.stats.workAdded + diff.stats.workModified + diff.stats.workRemoved}
				</div>
				<div class="text-[10px] text-[var(--dash-text-muted)] sm:text-xs">Work</div>
			</div>
			<div class="text-center">
				<div
					class="text-lg font-semibold sm:text-xl {diff.stats.educationAdded +
						diff.stats.educationModified >
					0
						? 'text-[var(--dash-primary)]'
						: 'text-[var(--dash-text-muted)]'}"
				>
					{diff.stats.educationAdded + diff.stats.educationModified + diff.stats.educationRemoved}
				</div>
				<div class="text-[10px] text-[var(--dash-text-muted)] sm:text-xs">Education</div>
			</div>
			<div class="text-center">
				<div
					class="text-lg font-semibold sm:text-xl {diff.stats.skillsAdded +
						diff.stats.skillsModified >
					0
						? 'text-[var(--dash-primary)]'
						: 'text-[var(--dash-text-muted)]'}"
				>
					{diff.stats.skillsAdded + diff.stats.skillsModified + diff.stats.skillsRemoved}
				</div>
				<div class="text-[10px] text-[var(--dash-text-muted)] sm:text-xs">Skills</div>
			</div>
			<div class="text-center">
				<div
					class="text-lg font-semibold sm:text-xl {diff.stats.languagesAdded +
						diff.stats.languagesModified >
					0
						? 'text-[var(--dash-primary)]'
						: 'text-[var(--dash-text-muted)]'}"
				>
					{diff.stats.languagesAdded + diff.stats.languagesModified + diff.stats.languagesRemoved}
				</div>
				<div class="text-[10px] text-[var(--dash-text-muted)] sm:text-xs">Languages</div>
			</div>
			<div class="text-center">
				<div
					class="text-lg font-semibold sm:text-xl {diff.stats.projectsAdded +
						diff.stats.projectsModified >
					0
						? 'text-[var(--dash-primary)]'
						: 'text-[var(--dash-text-muted)]'}"
				>
					{diff.stats.projectsAdded + diff.stats.projectsModified + diff.stats.projectsRemoved}
				</div>
				<div class="text-[10px] text-[var(--dash-text-muted)] sm:text-xs">Projects</div>
			</div>
			<div class="text-center">
				<div
					class="text-lg font-semibold sm:text-xl {diff.stats.certificatesAdded +
						diff.stats.certificatesModified >
					0
						? 'text-[var(--dash-primary)]'
						: 'text-[var(--dash-text-muted)]'}"
				>
					{diff.stats.certificatesAdded +
						diff.stats.certificatesModified +
						diff.stats.certificatesRemoved}
				</div>
				<div class="text-[10px] text-[var(--dash-text-muted)] sm:text-xs">Certs</div>
			</div>
			<div class="text-center">
				<div
					class="text-lg font-semibold sm:text-xl {diff.stats.referencesAdded +
						diff.stats.referencesModified >
					0
						? 'text-[var(--dash-primary)]'
						: 'text-[var(--dash-text-muted)]'}"
				>
					{diff.stats.referencesAdded +
						diff.stats.referencesModified +
						diff.stats.referencesRemoved}
				</div>
				<div class="text-[10px] text-[var(--dash-text-muted)] sm:text-xs">References</div>
			</div>
		</div>

		<!-- Global controls -->
		<div class="mt-4 flex items-center justify-between">
			<div class="flex items-center gap-2">
				<button
					type="button"
					onclick={selectAll}
					class="rounded border border-[var(--dash-border)] px-2.5 py-1 text-xs text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
				>
					Select All
				</button>
				<button
					type="button"
					onclick={deselectAll}
					class="rounded border border-[var(--dash-border)] px-2.5 py-1 text-xs text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
				>
					Deselect All
				</button>
				<label class="ml-2 flex items-center gap-1.5 text-xs text-[var(--dash-text-secondary)]">
					<input
						type="checkbox"
						bind:checked={showUnchanged}
						class="rounded border-[var(--dash-border)] text-[var(--dash-primary)] focus:ring-[var(--dash-primary)]"
					/>
					Show unchanged
				</label>
			</div>
			<span class="text-sm text-[var(--dash-text-secondary)]">
				{enabledCount} change{enabledCount !== 1 ? 's' : ''} selected
			</span>
		</div>
	</Card>

	{#if error}
		<div class="rounded-lg border border-[var(--dash-error)] bg-[var(--dash-error-light)] p-4">
			<p class="text-sm text-[var(--dash-error)]">{error}</p>
		</div>
	{/if}

	<!-- Basics section -->
	{#if basicsChangedCount > 0 || showUnchanged}
		<DiffSectionCard
			title="Basic Information"
			icon={faUser}
			count="{basicsChangedCount} changed"
			defaultExpanded={basicsChangedCount > 0}
		>
			<div class="space-y-1 p-3 sm:p-4">
				{#each diff.basics as _, i}
					<DiffFieldRow bind:diff={diff.basics[i]} {showUnchanged} />
				{/each}
			</div>
		</DiffSectionCard>
	{/if}

	<!-- Work section -->
	{#if showWork}
		<DiffSectionCard
			title="Work Experience"
			icon={faBriefcase}
			badge={{
				added: diff.stats.workAdded,
				modified: diff.stats.workModified,
				removed: diff.stats.workRemoved
			}}
			defaultExpanded={diff.work.some((d) => d.type !== 'unchanged') || partialWork}
		>
			<div class="divide-y divide-[var(--dash-border)]">
				{#each diff.work as _, i}
					{@const item = diff.work[i]}
					<DiffItemRow
						type={item.type}
						title={item.type === 'removed'
							? `${item.current?.position || 'Position'} at ${item.current?.name || 'Company'}`
							: `${item.incoming?.position || 'Position'} at ${item.incoming?.name || 'Company'}`}
						subtitle={item.type === 'modified'
							? `${item.current?.startDate || '?'} – ${item.current?.endDate || 'Present'}`
							: item.type === 'added'
								? `${item.incoming?.startDate || '?'} – ${item.incoming?.endDate || 'Present'}`
								: item.type === 'unchanged'
									? `${item.current?.startDate || '?'} – ${item.current?.endDate || 'Present'}`
									: undefined}
						bind:enabled={diff.work[i].enabled}
						fieldDiffs={item.fieldDiffs}
						nestedDiffs={item.nestedDiffs}
						showUnchanged={showUnchanged || partialWork}
					/>
				{/each}
			</div>
		</DiffSectionCard>
	{/if}

	<!-- Education section -->
	{#if showEducation}
		<DiffSectionCard
			title="Education"
			icon={faGraduationCap}
			badge={{
				added: diff.stats.educationAdded,
				modified: diff.stats.educationModified,
				removed: diff.stats.educationRemoved
			}}
			defaultExpanded={diff.education.some((d) => d.type !== 'unchanged') || partialEducation}
		>
			<div class="divide-y divide-[var(--dash-border)]">
				{#each diff.education as _, i}
					{@const item = diff.education[i]}
					<DiffItemRow
						type={item.type}
						title={item.type === 'removed'
							? item.current?.institution || 'Institution'
							: item.incoming?.institution || item.current?.institution || 'Institution'}
						subtitle={item.type === 'removed'
							? item.current?.area
							: item.incoming?.area || item.current?.area}
						bind:enabled={diff.education[i].enabled}
						fieldDiffs={item.fieldDiffs}
						showUnchanged={showUnchanged || partialEducation}
					/>
				{/each}
			</div>
		</DiffSectionCard>
	{/if}

	<!-- Skills section -->
	{#if showSkills}
		<DiffSectionCard
			title="Skills"
			icon={faCode}
			badge={{
				added: diff.stats.skillsAdded,
				modified: diff.stats.skillsModified,
				removed: diff.stats.skillsRemoved
			}}
			defaultExpanded={diff.skills.some((d) => d.type !== 'unchanged') || partialSkills}
		>
			<div class="divide-y divide-[var(--dash-border)]">
				{#each diff.skills as _, i}
					{@const cat = diff.skills[i]}
					<DiffItemRow
						type={cat.type}
						title={cat.type === 'removed'
							? cat.current?.name || 'Category'
							: cat.incoming?.name || cat.current?.name || 'Category'}
						subtitle={cat.type === 'modified' && cat.skillDiffs
							? `${cat.skillDiffs.filter((s) => s.type === 'added').length} new, ${cat.skillDiffs.filter((s) => s.type === 'modified').length} modified, ${cat.skillDiffs.filter((s) => s.type === 'removed').length} removed skills`
							: cat.type === 'added' && cat.incoming
								? `${cat.incoming.skills.length} skills`
								: undefined}
						bind:enabled={diff.skills[i].enabled}
						fieldDiffs={cat.fieldDiffs}
						showUnchanged={showUnchanged || partialSkills}
					/>
				{/each}
			</div>
		</DiffSectionCard>
	{/if}

	<!-- Languages section -->
	{#if showLanguages}
		<DiffSectionCard
			title="Languages"
			icon={faGlobe}
			badge={{
				added: diff.stats.languagesAdded,
				modified: diff.stats.languagesModified,
				removed: diff.stats.languagesRemoved
			}}
			defaultExpanded={diff.languages.some((d) => d.type !== 'unchanged') || partialLanguages}
		>
			<div class="divide-y divide-[var(--dash-border)]">
				{#each diff.languages as _, i}
					{@const item = diff.languages[i]}
					<DiffItemRow
						type={item.type}
						title={item.type === 'removed'
							? item.current?.name || 'Language'
							: item.incoming?.name || item.current?.name || 'Language'}
						subtitle={item.type === 'removed'
							? item.current?.proficiency
							: item.incoming?.proficiency || item.current?.proficiency}
						bind:enabled={diff.languages[i].enabled}
						fieldDiffs={item.fieldDiffs}
						showUnchanged={showUnchanged || partialLanguages}
					/>
				{/each}
			</div>
		</DiffSectionCard>
	{/if}

	<!-- Projects section -->
	{#if showProjects}
		<DiffSectionCard
			title="Side Projects"
			icon={faLightbulb}
			badge={{
				added: diff.stats.projectsAdded,
				modified: diff.stats.projectsModified,
				removed: diff.stats.projectsRemoved
			}}
			defaultExpanded={diff.projects.some((d) => d.type !== 'unchanged') || partialProjects}
		>
			<div class="divide-y divide-[var(--dash-border)]">
				{#each diff.projects as _, i}
					{@const item = diff.projects[i]}
					<DiffItemRow
						type={item.type}
						title={item.type === 'removed'
							? item.current?.name || 'Project'
							: item.incoming?.name || item.current?.name || 'Project'}
						subtitle={item.type === 'removed'
							? item.current?.url
							: item.incoming?.url || item.current?.url}
						bind:enabled={diff.projects[i].enabled}
						fieldDiffs={item.fieldDiffs}
						nestedDiffs={item.nestedDiffs}
						showUnchanged={showUnchanged || partialProjects}
					/>
				{/each}
			</div>
		</DiffSectionCard>
	{/if}

	<!-- Certificates section -->
	{#if showCertificates}
		<DiffSectionCard
			title="Certificates"
			icon={faCertificate}
			badge={{
				added: diff.stats.certificatesAdded,
				modified: diff.stats.certificatesModified,
				removed: diff.stats.certificatesRemoved
			}}
			defaultExpanded={diff.certificates.some((d) => d.type !== 'unchanged') || partialCertificates}
		>
			<div class="divide-y divide-[var(--dash-border)]">
				{#each diff.certificates as _, i}
					{@const item = diff.certificates[i]}
					<DiffItemRow
						type={item.type}
						title={item.type === 'removed'
							? item.current?.name || 'Certificate'
							: item.incoming?.name || item.current?.name || 'Certificate'}
						subtitle={item.type === 'removed'
							? item.current?.issuer
							: item.incoming?.issuer || item.current?.issuer}
						bind:enabled={diff.certificates[i].enabled}
						fieldDiffs={item.fieldDiffs}
						showUnchanged={showUnchanged || partialCertificates}
					/>
				{/each}
			</div>
		</DiffSectionCard>
	{/if}

	<!-- References section -->
	{#if showReferences}
		<DiffSectionCard
			title="References"
			icon={faQuoteLeft}
			badge={{
				added: diff.stats.referencesAdded,
				modified: diff.stats.referencesModified,
				removed: diff.stats.referencesRemoved
			}}
			defaultExpanded={diff.references.some((d) => d.type !== 'unchanged') || partialReferences}
		>
			<div class="divide-y divide-[var(--dash-border)]">
				{#each diff.references as _, i}
					{@const item = diff.references[i]}
					<DiffItemRow
						type={item.type}
						title={item.type === 'removed'
							? item.current?.author || 'Author'
							: item.incoming?.author || item.current?.author || 'Author'}
						subtitle={item.type === 'removed'
							? item.current?.authorPosition
							: item.incoming?.authorPosition || item.current?.authorPosition}
						bind:enabled={diff.references[i].enabled}
						fieldDiffs={item.fieldDiffs}
						showUnchanged={showUnchanged || partialReferences}
					/>
				{/each}
			</div>
		</DiffSectionCard>
	{/if}

	<!-- No changes message -->
	{#if diff.stats.totalChanges === 0 && !isPartial}
		<Card padding="responsive">
			<div class="py-8 text-center">
				<FontAwesomeIcon icon={faCheck} class="mx-auto mb-3 h-12 w-12 text-green-500" />
				<h3 class="mb-1 font-semibold text-[var(--dash-text)]">No differences found</h3>
				<p class="text-sm text-[var(--dash-text-secondary)]">
					The imported data matches your current profile.
				</p>
			</div>
		</Card>
	{:else if diff.stats.totalChanges === 0 && isPartial}
		<Card padding="responsive">
			<div class="py-4 text-center">
				<FontAwesomeIcon icon={faCheck} class="mx-auto mb-2 h-10 w-10 text-green-500" />
				<h3 class="mb-1 font-semibold text-[var(--dash-text)]">All data already matches</h3>
				<p class="text-sm text-[var(--dash-text-secondary)]">
					The parsed data from this document is already in your profile.
				</p>
			</div>
		</Card>
	{/if}

	<!-- Admin debug panel -->
	{#if isAdmin}
		<Card padding="responsive">
			<button
				type="button"
				onclick={() => (debugOpen = !debugOpen)}
				class="flex w-full items-center gap-2 text-left text-sm font-medium text-[var(--dash-text-muted)] transition-colors hover:text-[var(--dash-text)]"
			>
				<FontAwesomeIcon icon={faBug} class="h-3.5 w-3.5" />
				Parser Debug Info
				<FontAwesomeIcon
					icon={debugOpen ? faChevronDown : faChevronRight}
					class="ml-auto h-3 w-3"
				/>
			</button>
			{#if debugOpen}
				<div class="mt-3 space-y-3">
					<!-- Detection -->
					<div class="flex items-center gap-2">
						<span class="text-xs font-medium text-[var(--dash-text-secondary)]">Document type:</span
						>
						<span
							class="rounded px-2 py-0.5 text-xs {isPartial
								? 'border border-amber-500/30 bg-amber-500/15 text-amber-700'
								: 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-700'}"
						>
							{isPartial ? 'Partial' : 'Full'}
						</span>
					</div>

					<!-- Section presence -->
					<div>
						<p class="mb-1.5 text-xs font-medium text-[var(--dash-text-secondary)]">
							Parsed sections:
						</p>
						<div class="flex flex-wrap gap-1.5">
							{#each debugSections as section}
								{#if section.name === 'Basics'}
									<span
										class="rounded border px-2 py-0.5 text-xs {section.fields > 1
											? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700'
											: 'border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text-muted)]'}"
									>
										{section.name}: {section.fields}/{section.total} fields
									</span>
								{:else}
									<span
										class="rounded border px-2 py-0.5 text-xs {section.present &&
										(section.count ?? 0) > 0
											? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700'
											: 'border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text-muted)]'}"
									>
										{section.name}: {section.present ? section.count : 'absent'}
									</span>
								{/if}
							{/each}
						</div>
					</div>

					<!-- Raw JSON -->
					<details class="text-xs">
						<summary
							class="cursor-pointer text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)]"
						>
							Raw parsed data
						</summary>
						<pre
							class="mt-1.5 max-h-80 overflow-x-auto overflow-y-auto rounded-lg bg-[var(--dash-bg)] p-3 text-[10px] text-[var(--dash-text-secondary)]">{JSON.stringify(
								incomingData,
								null,
								2
							)}</pre>
					</details>
				</div>
			{/if}
		</Card>
	{/if}

	<!-- Submit -->
	<form
		method="POST"
		action="?/applyDiff"
		use:enhance={({ formData }) => {
			formData.set('payload', JSON.stringify(buildPayload()));
			onLoadingChange(true);
			return async ({ result, update }) => {
				onLoadingChange(false);
				if (result.type === 'redirect') {
					await goto(result.location, { invalidateAll: true });
				} else {
					await update();
				}
			};
		}}
		class="sticky bottom-0 z-10 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] p-4 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] sm:p-6"
	>
		<input type="hidden" name="payload" value="" />
		<div class="flex items-center justify-between">
			<button
				type="button"
				onclick={onBack}
				class="flex items-center gap-2 rounded-lg border border-[var(--dash-border)] px-4 py-2 text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
			>
				<FontAwesomeIcon icon={faArrowLeft} class="h-4 w-4" />
				Back
			</button>

			<div class="flex items-center gap-3">
				<span class="hidden text-sm text-[var(--dash-text-secondary)] sm:inline">
					{enabledCount} change{enabledCount !== 1 ? 's' : ''} selected
				</span>
				<button
					type="submit"
					disabled={enabledCount === 0 || isLoading}
					class="flex items-center gap-2 rounded-lg bg-[var(--dash-primary)] px-4 py-2 text-white transition-colors hover:bg-[var(--dash-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
				>
					{#if isLoading}
						<Spinner size="w-4 h-4" />
						Applying...
					{:else}
						<FontAwesomeIcon icon={faCheck} class="h-4 w-4" />
						Apply Changes
					{/if}
				</button>
			</div>
		</div>
	</form>
</div>
