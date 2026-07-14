import { generateVersionPdfs } from "$lib/server/profile/generate-version-pdfs";
import { getLatestExportWithFile } from "$lib/server/profile/export-files";
console.error("generating citrus CV (nl)…");
await generateVersionPdfs(1, "citrus", "citrus", "nl");
const res = await getLatestExportWithFile({ profileId: 1, exportType: "cv", fileType: "pdf", exportFormat: "citrus", template: "citrus", locale: "nl" });
if (!res) { console.error("NO EXPORT"); process.exit(1); }
console.error("pdf bytes:", res.buffer.length);
console.log("BASE64:" + Buffer.from(res.buffer).toString("base64"));
