/**
 * Static UI labels for the resume/CV renderers (section headings, contact
 * labels, the "Present" date label, …).
 *
 * These are template *chrome*, not profile data — they live in the render
 * components, so the profile_translations overlay (which covers user content)
 * never touches them. This deterministic dictionary localizes them per render
 * locale, falling back to English. Both renderers read it: the DB-backed
 * templates (StructuredResume) and the built-in default (ProfileDisplay).
 * Dutch terms mirror the Citrus reference CV.
 *
 * Every key carries every locale in `LOCALES` (resume-translations.ts); the
 * unit test enforces it so a new heading cannot ship half-English.
 */

export type TemplateLabelKey =
	| 'skills'
	| 'contactDetails'
	| 'education'
	| 'workExperience'
	| 'present'
	| 'summary'
	| 'sideProjects'
	| 'certificates'
	| 'languages'
	| 'nationality'
	| 'references'
	| 'contactEmail'
	| 'contactPhone'
	| 'contactLocation'
	| 'contactWebsite'
	| 'note'
	| 'graduationYear'
	| 'referencesOnRequest';

export const TEMPLATE_LABELS: Readonly<Record<TemplateLabelKey, Readonly<Record<string, string>>>> =
	{
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
		},
		summary: {
			en: 'Summary',
			nl: 'Samenvatting',
			de: 'Zusammenfassung',
			fr: 'Résumé',
			es: 'Resumen'
		},
		sideProjects: {
			en: 'Side projects',
			nl: 'Nevenprojecten',
			de: 'Nebenprojekte',
			fr: 'Projets personnels',
			es: 'Proyectos personales'
		},
		certificates: {
			en: 'Certificates',
			nl: 'Certificaten',
			de: 'Zertifikate',
			fr: 'Certifications',
			es: 'Certificados'
		},
		languages: {
			en: 'Languages',
			nl: 'Talen',
			de: 'Sprachen',
			fr: 'Langues',
			es: 'Idiomas'
		},
		nationality: {
			en: 'Nationality',
			nl: 'Nationaliteit',
			de: 'Staatsangehörigkeit',
			fr: 'Nationalité',
			es: 'Nacionalidad'
		},
		references: {
			en: 'References',
			nl: 'Referenties',
			de: 'Referenzen',
			fr: 'Références',
			es: 'Referencias'
		},
		// Contact labels. LinkedIn and GitHub are proper nouns and stay literal.
		contactEmail: {
			en: 'Email',
			nl: 'E-mail',
			de: 'E-Mail',
			fr: 'E-mail',
			es: 'Correo electrónico'
		},
		contactPhone: {
			en: 'Phone',
			nl: 'Telefoon',
			de: 'Telefon',
			fr: 'Téléphone',
			es: 'Teléfono'
		},
		contactLocation: {
			en: 'Location',
			nl: 'Locatie',
			de: 'Standort',
			fr: 'Localisation',
			es: 'Ubicación'
		},
		contactWebsite: {
			en: 'Website',
			nl: 'Website',
			de: 'Website',
			fr: 'Site web',
			es: 'Sitio web'
		},
		note: {
			en: 'Note',
			nl: 'Opmerking',
			de: 'Hinweis',
			fr: 'Remarque',
			es: 'Nota'
		},
		graduationYear: {
			en: 'Graduation Year',
			nl: 'Afstudeerjaar',
			de: 'Abschlussjahr',
			fr: 'Diplôme obtenu en',
			es: 'Año de graduación'
		},
		referencesOnRequest: {
			en: 'Contact details available upon request',
			nl: 'Contactgegevens op aanvraag beschikbaar',
			de: 'Kontaktdaten auf Anfrage erhältlich',
			fr: 'Coordonnées disponibles sur demande',
			es: 'Datos de contacto disponibles a petición'
		}
	};

/** Localized template label for `key`, falling back to English. */
export function templateLabel(key: TemplateLabelKey, locale: string | null | undefined): string {
	const entry = TEMPLATE_LABELS[key];
	return entry[locale ?? 'en'] ?? entry.en;
}

/**
 * Language proficiency is stored as an English keyword (`native`, `fluent`,
 * `conversational`, `basic`) that the renderers print as a label. It is a
 * fixed vocabulary rather than the applicant's prose, so it is localized here
 * with the chrome instead of through the translation overlay.
 */
export const PROFICIENCY_LABELS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
	native: {
		en: 'Native',
		nl: 'Moedertaal',
		de: 'Muttersprache',
		fr: 'Langue maternelle',
		es: 'Lengua materna'
	},
	fluent: {
		en: 'Fluent',
		nl: 'Vloeiend',
		de: 'Fließend',
		fr: 'Courant',
		es: 'Fluido'
	},
	conversational: {
		en: 'Conversational',
		nl: 'Conversatieniveau',
		de: 'Konversationsniveau',
		fr: 'Niveau conversationnel',
		es: 'Conversacional'
	},
	basic: {
		en: 'Basic',
		nl: 'Basis',
		de: 'Grundkenntnisse',
		fr: 'Notions de base',
		es: 'Básico'
	}
};

/**
 * Localized proficiency label. A value outside the keyword vocabulary is free
 * text and is printed as typed, capitalized; empty stays empty.
 */
export function proficiencyLabel(
	value: string | null | undefined,
	locale: string | null | undefined
): string {
	const raw = (value ?? '').trim();
	if (!raw) return '';
	const entry = PROFICIENCY_LABELS[raw.toLowerCase()];
	if (entry) return entry[locale ?? 'en'] ?? entry.en;
	return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/**
 * ISO 639-1 codes ICU is asked about when a language row carries no code and
 * its English name has to be matched instead. Deliberately short: the
 * languages a CV realistically lists, each one DisplayNames lookup on first use.
 */
const LANGUAGE_CODES =
	'en nl de fr es it pt ru zh ja ko ar hi tr pl sv no da fi cs el he hu ro uk id vi th ms fa bn ta ur sw af ca hr sr sk sl bg lt lv et is ga cy eu gl fil tl la'.split(
		' '
	);

let codeByEnglishName: Map<string, string> | null = null;

function codeForEnglishName(name: string): string | null {
	if (!codeByEnglishName) {
		codeByEnglishName = new Map();
		try {
			const english = new Intl.DisplayNames(['en'], { type: 'language', fallback: 'none' });
			for (const code of LANGUAGE_CODES) {
				const label = english.of(code);
				if (label) codeByEnglishName.set(label.toLowerCase(), code);
			}
		} catch {
			// A runtime without ICU display names has nothing to match against.
		}
	}
	return codeByEnglishName.get(name.toLowerCase()) ?? null;
}

/**
 * A language's name is profile data, but it is also a fixed vocabulary every
 * locale has its own word for: "English" is "Engels" on a Dutch CV whoever the
 * applicant is. So it is localized here, with the chrome, from ICU — via the
 * row's ISO code when it has one, else by matching the English name against
 * ICU's English names. Anything ICU cannot place (a dialect, "Mandarin
 * Chinese", a typo) prints as typed. An overlay row, when the applicant wrote
 * one, wins over all of this — see applyTranslations.
 */
export function localizeLanguageName(
	name: string | null | undefined,
	code: string | null | undefined,
	locale: string | null | undefined
): string {
	const raw = (name ?? '').trim();
	if (!raw || !locale || locale === 'en') return raw;

	const tag = (code ?? '').trim().toLowerCase();
	const resolved = /^[a-z]{2,3}(-[a-z0-9]{2,8})*$/.test(tag) ? tag : codeForEnglishName(raw);
	if (!resolved) return raw;

	try {
		const localized = new Intl.DisplayNames([locale], { type: 'language', fallback: 'none' }).of(
			resolved
		);
		if (!localized) return raw;
		// ICU casing is for running text ("anglais"); a CV lists languages at the
		// start of a line, where every locale capitalizes.
		return localized.charAt(0).toLocaleUpperCase(locale) + localized.slice(1);
	} catch {
		return raw;
	}
}
