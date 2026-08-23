/**
 * In-app user guide content.
 *
 * Sections are authored as markdown (single source of truth) and rendered at
 * /guide/[slug]. Add a section by dropping a .md file here and adding an entry
 * below. Order here is the order shown in the guide sidebar.
 */

import howItWorks from './how-it-works.md?raw';
import bestResults from './getting-the-best-results.md?raw';
import devices from './devices.md?raw';
import matching from './matching.md?raw';
import resumes from './resumes-and-cvs.md?raw';
import sharing from './sharing-your-cv.md?raw';
import interviewPrep from './interview-prep.md?raw';
import salaryPrep from './salary-prep.md?raw';
import assistant from './assistant.md?raw';
import connectedApps from './connected-apps.md?raw';
import credits from './credits.md?raw';
import yourData from './your-data.md?raw';
import faq from './faq.md?raw';

export interface GuideSection {
	slug: string;
	title: string;
	markdown: string;
}

export const guideSections: GuideSection[] = [
	{ slug: 'how-it-works', title: 'How it works', markdown: howItWorks },
	{
		slug: 'getting-the-best-results',
		title: 'Getting the best results',
		markdown: bestResults
	},
	{ slug: 'devices', title: 'Devices & sharing', markdown: devices },
	{ slug: 'matching', title: 'Matching & alerts', markdown: matching },
	{ slug: 'resumes-and-cvs', title: 'Resumes & CVs', markdown: resumes },
	{ slug: 'sharing-your-cv', title: 'Sharing your CV', markdown: sharing },
	{ slug: 'interview-prep', title: 'Interview prep', markdown: interviewPrep },
	{ slug: 'salary-prep', title: 'Salary prep', markdown: salaryPrep },
	{ slug: 'assistant', title: 'The AI assistant', markdown: assistant },
	{
		slug: 'connected-apps',
		title: 'Connecting your own AI',
		markdown: connectedApps
	},
	{ slug: 'credits', title: 'Credits', markdown: credits },
	{ slug: 'your-data', title: 'Your data', markdown: yourData },
	{ slug: 'faq', title: 'FAQ & troubleshooting', markdown: faq }
];

export function getGuideSection(slug: string): GuideSection | undefined {
	return guideSections.find((s) => s.slug === slug);
}
