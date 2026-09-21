// Small deterministic documents for parser regression testing; no external data.
import { writeFileSync, mkdirSync } from 'node:fs';
import { crc32 } from 'node:zlib';
const dir = new URL('./fixtures/', import.meta.url);
mkdirSync(dir, { recursive: true });
const objects = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
];
const stream = 'BT /F1 12 Tf 72 720 Td (Hello PDF world) Tj ET';
objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
let pdf = '%PDF-1.4\n',
  offsets = [0];
objects.forEach((object, i) => {
  offsets.push(Buffer.byteLength(pdf));
  pdf += `${i + 1} 0 obj\n${object}\nendobj\n`;
});
const xref = Buffer.byteLength(pdf);
pdf += `xref\n0 6\n0000000000 65535 f \n${offsets
  .slice(1)
  .map((n) => String(n).padStart(10, '0') + ' 00000 n ')
  .join('\n')}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
writeFileSync(new URL('sample.pdf', dir), pdf);
const entries = {
  '[Content_Types].xml':
    '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
  '_rels/.rels':
    '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  'word/document.xml':
    '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Hello DOCX world</w:t></w:r></w:p></w:body></w:document>',
};
const parts = [],
  central = [];
let offset = 0;
for (const [name, value] of Object.entries(entries)) {
  const filename = Buffer.from(name),
    data = Buffer.from(value);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50);
  local.writeUInt16LE(20, 4);
  local.writeUInt32LE(crc32(data), 14);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(filename.length, 26);
  parts.push(local, filename, data);
  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt32LE(crc32(data), 16);
  header.writeUInt32LE(data.length, 20);
  header.writeUInt32LE(data.length, 24);
  header.writeUInt16LE(filename.length, 28);
  header.writeUInt32LE(offset, 42);
  central.push(header, filename);
  offset += local.length + filename.length + data.length;
}
const directory = Buffer.concat(central),
  end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50);
end.writeUInt16LE(3, 8);
end.writeUInt16LE(3, 10);
end.writeUInt32LE(directory.length, 12);
end.writeUInt32LE(offset, 16);
writeFileSync(new URL('sample.docx', dir), Buffer.concat([...parts, directory, end]));
