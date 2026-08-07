/**
 * Static UI labels for the structured resume/CV templates (section headings,
 * the "Present" date label, …).
 *
 * These are template *chrome*, not profile data — they live in the render
 * component, so the profile_translations overlay (which covers user content)
 * never touches them. This deterministic dictionary localizes them per render
 * locale, falling back to English. Dutch terms mirror the Citrus reference CV.
 */

export type TemplateLabelKey =
	'skills' | 'contactDetails' | 'education' | 'workExperience' | 'present';

const LABELS: Record<TemplateLabelKey, Record<string, string>> = {
	skills: {
		en: 'Skills',
		nl: 'Vaardigheden',
		de: 'Kenntnisse',
		fr: 'Compétences',
		es: 'Habilidades'
	},
	contactDetails: {
		en: 'Contact details',
		nl: 'Contactgegevens',
		de: 'Kontaktdaten',
		fr: 'Coordonnées',
		es: 'Datos de contacto'
	},
	education: {
		en: 'Education',
		nl: 'Opleidingen',
		de: 'Ausbildung',
		fr: 'Formation',
		es: 'Formación'
	},
	workExperience: {
		en: 'Work experience',
		nl: 'Werkervaring',
		de: 'Berufserfahrung',
		fr: 'Expérience professionnelle',
		es: 'Experiencia laboral'
	},
	present: {
		en: 'Present',
		nl: 'Heden',
		de: 'Heute',
		fr: 'Présent',
		es: 'Actualidad'
	}
};

/** Localized template label for `key`, falling back to English. */
export function templateLabel(key: TemplateLabelKey, locale: string | null | undefined): string {
	const entry = LABELS[key];
	return entry[locale ?? 'en'] ?? entry.en;
}
