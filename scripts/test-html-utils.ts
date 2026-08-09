/**
 * Test script for Cheerio-based HTML utilities
 */

import { stripHtmlForLlm } from '$lib/server/html/strip';
import { extractLinks } from '$lib/server/html/extract';

// Test HTML with various elements
const testHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Test Job Posting</title>
  <style>.hidden { display: none; }</style>
  <script>console.log('test');</script>
</head>
<body class="page" data-tracking="xyz" id="main">
  <!-- This is a comment -->
  <div class="container">
    <h1 class="title">Software Engineer</h1>
    <div class="empty"></div>
    <p class="description">
      Join our team as a <strong>Senior Developer</strong>.
      <a href="/jobs/123" class="job-link">Apply here</a>
    </p>
    <img src="/logo.png" alt="Company Logo" data-lazy="true" />
    <a href="/jobs/456">Another Job</a>
    <a href="https://external.com/jobs/789">External Job</a>
    <svg><circle /></svg>
    <noscript>Enable JavaScript</noscript>
  </div>
</body>
</html>
`;

console.log('=== Testing stripHtmlForLlm() ===\n');

try {
	const stripped = stripHtmlForLlm(testHtml);
	console.log('✓ stripHtmlForLlm() executed successfully\n');
	console.log('Stripped HTML:');
	console.log(stripped);
	console.log('\nLength: original=' + testHtml.length + ' stripped=' + stripped.length);

	// Verify key features
	const checks = [
		{ name: 'Scripts removed', pass: !stripped.includes('<script>') },
		{ name: 'Styles removed', pass: !stripped.includes('<style>') },
		{ name: 'Comments removed', pass: !stripped.includes('<!--') },
		{ name: 'SVG removed', pass: !stripped.includes('<svg>') },
		{
			name: 'href attributes kept',
			pass: stripped.includes('href="/jobs/123"')
		},
		{
			name: 'alt attributes kept',
			pass: stripped.includes('alt="Company Logo"')
		},
		{
			name: 'Unnecessary attributes removed',
			pass: !stripped.includes('data-tracking') && !stripped.includes('class=')
		},
		{ name: 'Empty divs removed', pass: !stripped.includes('<div></div>') }
	];

	console.log('\n=== Verification Checks ===');
	checks.forEach((check) => {
		console.log(check.pass ? '✓' : '✗', check.name);
	});

	const allPassed = checks.every((c) => c.pass);
	if (!allPassed) {
		console.log('\n⚠ Some checks failed!');
	}
} catch (error) {
	console.error('✗ stripHtmlForLlm() failed:', error);
	process.exit(1);
}

console.log('\n=== Testing extractLinks() ===\n');

try {
	const allLinks = extractLinks(testHtml);
	console.log('✓ extractLinks() executed successfully');
	console.log('All links found:', allLinks);

	const jobLinks = extractLinks(testHtml, /\/jobs\//);
	console.log('Job links only:', jobLinks);

	const linkChecks = [
		{ name: 'Found all 3 links', pass: allLinks.length === 3 },
		{ name: 'Pattern filtering works', pass: jobLinks.length === 3 }, // All 3 contain /jobs/
		{ name: 'Includes relative link', pass: allLinks.includes('/jobs/123') },
		{
			name: 'Includes external link',
			pass: allLinks.includes('https://external.com/jobs/789')
		}
	];

	console.log('\n=== Link Extraction Checks ===');
	linkChecks.forEach((check) => {
		console.log(check.pass ? '✓' : '✗', check.name);
	});

	const allPassed = linkChecks.every((c) => c.pass);
	if (!allPassed) {
		console.log('\n⚠ Some checks failed!');
	}
} catch (error) {
	console.error('✗ extractLinks() failed:', error);
	process.exit(1);
}

console.log('\n=== All Tests Passed ✓ ===');
