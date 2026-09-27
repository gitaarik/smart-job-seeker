/**
 * What a certificate's uploaded document may be, for the browser and the
 * server alike: the picker filters on it and checks the size before sending,
 * and `profile/certificate-file.ts` enforces both on the bytes that arrive.
 */

/**
 * Per file, PDF or image. A scanned certificate is a few hundred KB, so this is
 * room for a heavy one, and it stays under the 12MB `BODY_SIZE_LIMIT` the
 * deployed app runs with: a larger cap would only ever be enforced by the
 * adapter, as a bare 413.
 */
export const MAX_CERTIFICATE_FILE_BYTES = 10 * 1024 * 1024;

/** For a file input's `accept`. The server decides by the bytes, not by this. */
export const CERTIFICATE_FILE_ACCEPT = 'application/pdf,.pdf,image/png,image/jpeg,image/webp';

/** "240 KB", "3.1 MB": the size of a stored file, as the page shows it. */
export function formatFileSize(bytes: number | null | undefined): string {
	if (!bytes) return '0 KB';
	if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
