/**
 * Text extraction from various file formats
 * Supports PDF, DOCX, and HTML files
 */

const SUPPORTED_MIME_TYPES = [
	'application/pdf',
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	'text/html'
] as const;

type SupportedMimeType = (typeof SUPPORTED_MIME_TYPES)[number];

/**
 * Check if a MIME type is supported for text extraction
 */
export function isSupportedMimeType(mimeType: string): boolean {
	return SUPPORTED_MIME_TYPES.includes(mimeType as SupportedMimeType);
}

/**
 * Get human-readable format name from MIME type
 */
export function getFormatName(mimeType: string): string {
	switch (mimeType) {
		case 'application/pdf':
			return 'PDF';
		case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
			return 'DOCX';
		case 'text/html':
			return 'HTML';
		default:
			return 'Unknown';
	}
}

/**
 * Extract text from a PDF buffer
 * Uses dynamic import so pdf-parse (and its pdfjs dependency) is only
 * loaded when a PDF is actually processed.
 */
async function extractFromPdf(buffer: Buffer): Promise<string> {
	const { PDFParse } = await import('pdf-parse');
	const parser = new PDFParse({ data: buffer });
	try {
		const result = await parser.getText();
		return result.text;
	} finally {
		// Release the underlying pdfjs document/worker resources.
		await parser.destroy();
	}
}

/**
 * Extract text from a DOCX buffer
 */
async function extractFromDocx(buffer: Buffer): Promise<string> {
	const mammoth = await import('mammoth');
	const result = await mammoth.extractRawText({ buffer });
	return result.value;
}

/**
 * Extract text from HTML content
 */
function extractFromHtml(buffer: Buffer): string {
	const html = buffer.toString('utf-8');

	// Remove script and style tags with their content
	let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
	text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

	// Replace common block elements with newlines
	text = text.replace(/<\/(p|div|h[1-6]|li|tr|br)[^>]*>/gi, '\n');
	text = text.replace(/<br\s*\/?>/gi, '\n');

	// Remove all remaining HTML tags
	text = text.replace(/<[^>]+>/g, ' ');

	// Decode HTML entities
	text = text.replace(/&nbsp;/g, ' ');
	text = text.replace(/&amp;/g, '&');
	text = text.replace(/&lt;/g, '<');
	text = text.replace(/&gt;/g, '>');
	text = text.replace(/&quot;/g, '"');
	text = text.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));

	// Normalize whitespace
	text = text.replace(/[ \t]+/g, ' ');
	text = text.replace(/\n\s*\n/g, '\n\n');

	return text.trim();
}

/**
 * Extract text from a file buffer based on its MIME type
 * @throws Error if the MIME type is not supported or extraction fails
 */
export async function extractTextFromFile(buffer: Buffer, mimeType: string): Promise<string> {
	if (!isSupportedMimeType(mimeType)) {
		throw new Error(`Unsupported file type: ${mimeType}. Supported formats: PDF, DOCX, HTML`);
	}

	let text: string;

	switch (mimeType) {
		case 'application/pdf':
			text = await extractFromPdf(buffer);
			break;
		case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
			text = await extractFromDocx(buffer);
			break;
		case 'text/html':
			text = extractFromHtml(buffer);
			break;
		default:
			throw new Error(`Unsupported file type: ${mimeType}`);
	}

	if (!text || text.trim().length === 0) {
		throw new Error(`No text could be extracted from the ${getFormatName(mimeType)} file`);
	}

	return text.trim();
}
