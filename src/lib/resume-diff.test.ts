import { describe, expect, it } from 'vitest';
import { diffResumeData } from './resume-diff';
import type { Certificate, ResumeData } from '$lib/server/resume/types';

const withCertificates = (certificates: Certificate[]): ResumeData => ({
	basics: { name: 'Alex Morgan' },
	certificates
});

const cka: Certificate = {
	name: 'CKA',
	issuer: 'CNCF',
	date: '2024-03-01',
	expiryDate: '2026-03-01',
	credentialId: 'LF-123',
	skills: ['Kubernetes', 'Helm']
};

describe('diffResumeData — certificates', () => {
	it('offers skills the incoming file adds, and pre-ticks none it would remove', () => {
		const diff = diffResumeData(
			withCertificates([cka]),
			withCertificates([{ ...cka, skills: ['Kubernetes', 'etcd'] }])
		);
		const [item] = diff.certificates;
		expect(item.type).toBe('modified');
		expect(item.nestedDiffs).toEqual([
			{
				field: 'skills',
				label: 'Skills',
				added: ['etcd'],
				removed: ['Helm'],
				addedEnabled: [true],
				removedEnabled: [false]
			}
		]);
	});

	it('reads a source that never mentions expiry, credential ID or skills as silent, not as clearing them', () => {
		// A CV, or a JSON Resume file: neither has anywhere to say these.
		const diff = diffResumeData(
			withCertificates([cka]),
			withCertificates([{ name: 'CKA', issuer: 'CNCF', date: '2024-03-01' }])
		);
		expect(diff.certificates[0].type).toBe('unchanged');
	});

	it('diffs an expiry date and a credential ID the source does carry', () => {
		const diff = diffResumeData(
			withCertificates([cka]),
			withCertificates([{ ...cka, expiryDate: '2028-03-01', credentialId: 'LF-456' }])
		);
		const changed = diff.certificates[0].fieldDiffs?.filter((d) => d.changed).map((d) => d.field);
		expect(changed).toEqual(['expiryDate', 'credentialId']);
	});
});
