/**
 * What a certificate's upload may be, and where an overwrite import puts the
 * files back.
 *
 * The bytes decide, not the name: a `.pdf` that is not one is refused, and an
 * image comes out as WebP whatever it went in as, which is what drops a phone
 * photo's GPS tags. The matching is tested as the pure half it is; the writes
 * around it are the database's business.
 */
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { matchFilesByName, prepareCertificateFile } from '../certificate-file';
import { MAX_CERTIFICATE_FILE_BYTES } from '$lib/certificate-files';

const enc = (s: string) => new TextEncoder().encode(s);
const PDF = enc('%PDF-1.7\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n');

async function png(): Promise<Uint8Array> {
	const buf = await sharp({
		create: { width: 40, height: 30, channels: 3, background: { r: 20, g: 120, b: 200 } }
	})
		.png()
		.toBuffer();
	return new Uint8Array(buf);
}

describe('prepareCertificateFile', () => {
	it('keeps a PDF as it was sent', async () => {
		const out = await prepareCertificateFile('cka.pdf', PDF);
		expect(out.filename).toBe('cka.pdf');
		expect(Buffer.compare(out.bytes, Buffer.from(PDF))).toBe(0);
	});

	it('names a PDF that arrived without an extension, so it downloads as one', async () => {
		expect((await prepareCertificateFile('certificate', PDF)).filename).toBe('certificate.pdf');
	});

	it('re-encodes an image to WebP', async () => {
		const out = await prepareCertificateFile('scan.png', await png());
		expect(out.filename).toBe('scan.webp');
		expect((await sharp(out.bytes).metadata()).format).toBe('webp');
	});

	it('refuses a file whose bytes are not what its name claims', async () => {
		await expect(prepareCertificateFile('cka.pdf', enc('not a pdf at all'))).rejects.toMatchObject({
			status: 415
		});
	});

	it('refuses a kind of file it does not keep', async () => {
		await expect(prepareCertificateFile('notes.txt', enc('hello'))).rejects.toMatchObject({
			status: 415
		});
	});

	it('refuses a file over the limit', async () => {
		const big = new Uint8Array(MAX_CERTIFICATE_FILE_BYTES + 1);
		big.set(PDF);
		await expect(prepareCertificateFile('big.pdf', big)).rejects.toMatchObject({ status: 413 });
	});
});

describe('matchFilesByName', () => {
	it('gives each file to the certificate of the same name, whatever its case or spacing', () => {
		const byName = new Map([
			['cka', ['file-1']],
			['pmp', ['file-2']]
		]);
		expect(
			matchFilesByName(
				[
					{ id: 10, name: 'PMP' },
					{ id: 11, name: ' CKA ' }
				],
				byName
			)
		).toEqual({
			assignments: [
				{ id: 10, fileId: 'file-2' },
				{ id: 11, fileId: 'file-1' }
			],
			leftover: []
		});
	});

	it('hands out same-named files in order, and returns what nobody claimed', () => {
		const byName = new Map([
			['cka', ['file-1', 'file-2']],
			['gone', ['file-3']]
		]);
		expect(matchFilesByName([{ id: 1, name: 'CKA' }], byName)).toEqual({
			assignments: [{ id: 1, fileId: 'file-1' }],
			leftover: ['file-2', 'file-3']
		});
	});

	it('leaves the map it was given as it was', () => {
		const byName = new Map([['cka', ['file-1']]]);
		matchFilesByName([{ id: 1, name: 'CKA' }], byName);
		expect(byName.get('cka')).toEqual(['file-1']);
	});
});
