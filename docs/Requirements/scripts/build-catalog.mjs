import fs from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve(process.cwd(), 'docs/Requirements');
const manifestPath = path.join(rootDir, 'catalog-manifest.json');
const outputPath = path.join(rootDir, 'generated', 'requirements-data.js');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function parseFrontMatter(markdown) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    throw new Error('Missing front matter block');
  }

  const frontMatterLines = match[1].split(/\r?\n/);
  const body = match[2].trim();
  const data = {};
  let currentKey = null;

  for (const line of frontMatterLines) {
    if (!line.trim()) continue;

    const listMatch = line.match(/^\s*-\s+(.*)$/);
    if (listMatch && currentKey) {
      data[currentKey] = data[currentKey] || [];
      data[currentKey].push(listMatch[1].trim());
      continue;
    }

    const keyValueMatch = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (keyValueMatch) {
      const [, key, value] = keyValueMatch;
      currentKey = key;
      if (value === '') {
        data[key] = [];
      } else if (value === 'true' || value === 'false') {
        data[key] = value === 'true';
      } else {
        data[key] = value;
      }
    }
  }

  return { data, body };
}

function extractAcceptanceCriteria(body) {
  const match = body.match(/## Acceptance Criteria\n\n([\s\S]*)$/);
  if (!match) return [];

  return match[1]
    .split(/\r?\n/)
    .map(line => line.replace(/^[-*]\s+/, '').trim())
    .filter(Boolean);
}

function extractDescription(body) {
  const paragraphs = body
    .split(/\r?\n\s*\r?\n/)
    .map(part => part.trim())
    .filter(Boolean);

  for (const paragraph of paragraphs) {
    if (!paragraph.startsWith('#')) {
      return paragraph;
    }
  }

  return '';
}

function toRelativePosix(filePath) {
  return path.relative(rootDir, filePath).split(path.sep).join('/');
}

const manifest = readJson(manifestPath);
const entries = manifest.requirements.map(entry => {
  const requirementPath = path.join(rootDir, entry.file);
  const markdown = fs.readFileSync(requirementPath, 'utf8');
  const { data, body } = parseFrontMatter(markdown);

  return {
    id: data.id || entry.id,
    title: data.title || entry.id,
    type: data.type || 'Functional',
    module: data.module || 'General',
    priority: data.priority || 'Medium',
    status: data.status || 'Draft',
    description: extractDescription(body),
    acceptanceCriteria: extractAcceptanceCriteria(body),
    roles: Array.isArray(data.roles) ? data.roles : [],
    relatedRequirements: Array.isArray(data.relatedRequirements) ? data.relatedRequirements : [],
    designRefs: [],
    diagramRefs: (entry.diagrams || []).map(diagram => toRelativePosix(path.join(rootDir, diagram))),
    implementationRefs: [],
    testRefs: [],
    diagram: ''
  };
});

const output = `// Auto-generated from docs/Requirements/catalog-manifest.json\nconst REQUIREMENTS = ${JSON.stringify(entries, null, 2)};\n`;
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, output, 'utf8');
console.log(`Wrote ${outputPath}`);
