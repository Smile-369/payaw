export interface ImportedCharacterSkill {
  readonly slot: string;
  readonly name: string;
  readonly type: string;
  readonly role: string;
  readonly useCase: string;
  readonly roll: string;
  readonly combatEffect: string;
  readonly utility: string;
  readonly costRisk: string;
}

export interface ImportedUltimateSkill extends ImportedCharacterSkill {
  readonly unlocked: boolean;
}

export interface ImportedCharacterGear {
  readonly item: string;
  readonly use: string;
  readonly notes: string;
}

export interface ImportedCharacterSheet {
  readonly version: 1;
  readonly sourceFile: string;
  readonly worksheet: string;
  readonly importedAt: string;
  readonly player: string;
  readonly characterName: string;
  readonly handle: string;
  readonly ageYear: string;
  readonly background: string;
  readonly connectionToGroup: string;
  readonly schoolWork: string;
  readonly homeArea: string;
  readonly startingItem: string;
  readonly currentSituation: string;
  readonly stats: Readonly<Record<string, string>>;
  readonly malasCurrent: string;
  readonly malasState: string;
  readonly warning: string;
  readonly warningConsequence: string;
  readonly privateWish: string;
  readonly risk: string;
  readonly usefulContact: string;
  readonly worriedPerson: string;
  readonly avoidedPlace: string;
  readonly notes: string;
  readonly skills: readonly ImportedCharacterSkill[];
  readonly ultimateSkill: ImportedUltimateSkill;
  readonly gear: readonly ImportedCharacterGear[];
}

export interface StoredCharacterSheet {
  readonly sheet: ImportedCharacterSheet | null;
  readonly freeformNotes: string;
}

interface ZipEntry {
  readonly compression: number;
  readonly compressedSize: number;
  readonly localHeaderOffset: number;
}

interface WorkbookSheet {
  readonly name: string;
  readonly path: string;
  readonly cells: readonly (readonly string[])[];
}

const SHEET_BEGIN = '[[PAYAW_CHARACTER_SHEET_V1]]';
const SHEET_END = '[[/PAYAW_CHARACTER_SHEET_V1]]';
const MAX_PRIVATE_NOTES = 32000;
const textDecoder = new TextDecoder('utf-8');

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function clip(value: string, maximum: number): string {
  return value.trim().slice(0, maximum);
}

function normalizeLabel(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function parseXml(bytes: Uint8Array, source: string): XMLDocument {
  const xml = new DOMParser().parseFromString(textDecoder.decode(bytes), 'application/xml');
  if (xml.querySelector('parsererror') !== null) throw new Error(`The character sheet contains invalid XML in ${source}.`);
  return xml;
}

function findEndOfCentralDirectory(view: DataView): number {
  const minimum = Math.max(0, view.byteLength - 65_557);
  for (let offset = view.byteLength - 22; offset >= minimum; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) return offset;
  }
  throw new Error('This file is not a readable .xlsx workbook.');
}

function readZipDirectory(buffer: ArrayBuffer): Map<string, ZipEntry> {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const end = findEndOfCentralDirectory(view);
  const entryCount = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true);
  const entries = new Map<string, ZipEntry>();
  for (let index = 0; index < entryCount; index += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) throw new Error('The .xlsx directory is damaged.');
    const compression = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const name = textDecoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    entries.set(name.replace(/^\//, ''), { compression, compressedSize, localHeaderOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

async function readZipEntry(buffer: ArrayBuffer, entries: ReadonlyMap<string, ZipEntry>, path: string): Promise<Uint8Array> {
  const normalized = path.replace(/^\//, '');
  const entry = entries.get(normalized);
  if (entry === undefined) throw new Error(`The workbook is missing ${normalized}.`);
  const view = new DataView(buffer);
  if (view.getUint32(entry.localHeaderOffset, true) !== 0x04034b50) throw new Error(`The workbook entry ${normalized} is damaged.`);
  const nameLength = view.getUint16(entry.localHeaderOffset + 26, true);
  const extraLength = view.getUint16(entry.localHeaderOffset + 28, true);
  const start = entry.localHeaderOffset + 30 + nameLength + extraLength;
  const compressed = new Uint8Array(buffer, start, entry.compressedSize);
  if (entry.compression === 0) return new Uint8Array(compressed);
  if (entry.compression !== 8) throw new Error(`Unsupported compression method in ${normalized}.`);
  if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot open .xlsx files. Use a current Chrome, Edge, or Firefox release.');
  const source = new Blob([compressed]).stream();
  const decompressed = source.pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(decompressed).arrayBuffer());
}

function relationshipTarget(target: string): string {
  const cleaned = target.replaceAll('\\', '/').replace(/^\//, '');
  if (cleaned.startsWith('xl/')) return cleaned;
  return `xl/${cleaned.replace(/^\.\//, '')}`;
}

function columnIndex(reference: string): number {
  const letters = /^([A-Z]+)/i.exec(reference)?.[1] ?? 'A';
  let value = 0;
  for (const letter of letters.toLocaleUpperCase()) value = value * 26 + letter.charCodeAt(0) - 64;
  return Math.max(0, value - 1);
}

function parseSharedStrings(xml: XMLDocument): string[] {
  return [...xml.getElementsByTagName('si')].map((item) =>
    [...item.getElementsByTagName('t')].map((text) => text.textContent ?? '').join(''),
  );
}

function parseWorksheet(xml: XMLDocument, sharedStrings: readonly string[]): string[][] {
  const rows: string[][] = [];
  for (const cell of [...xml.getElementsByTagName('c')]) {
    const reference = cell.getAttribute('r') ?? 'A1';
    const rowNumber = Number(/\d+$/.exec(reference)?.[0] ?? 1) - 1;
    const colNumber = columnIndex(reference);
    const type = cell.getAttribute('t') ?? '';
    const raw = cell.getElementsByTagName('v')[0]?.textContent ?? '';
    const inline = [...cell.getElementsByTagName('t')].map((item) => item.textContent ?? '').join('');
    let value = raw;
    if (type === 's') value = sharedStrings[Number(raw)] ?? '';
    else if (type === 'inlineStr') value = inline;
    else if (type === 'b') value = raw === '1' ? 'TRUE' : 'FALSE';
    const row = rows[rowNumber] ?? [];
    row[colNumber] = value;
    rows[rowNumber] = row;
  }
  return Array.from({ length: rows.length }, (_, rowIndex) => {
    const row = rows[rowIndex] ?? [];
    return Array.from({ length: row.length }, (_, colIndex) => row[colIndex] ?? '');
  });
}

async function readWorkbook(file: File): Promise<WorkbookSheet[]> {
  const buffer = await file.arrayBuffer();
  const entries = readZipDirectory(buffer);
  const workbookXml = parseXml(await readZipEntry(buffer, entries, 'xl/workbook.xml'), 'workbook.xml');
  const relationshipsXml = parseXml(await readZipEntry(buffer, entries, 'xl/_rels/workbook.xml.rels'), 'workbook relationships');
  const sharedStrings = entries.has('xl/sharedStrings.xml')
    ? parseSharedStrings(parseXml(await readZipEntry(buffer, entries, 'xl/sharedStrings.xml'), 'shared strings'))
    : [];
  const targets = new Map<string, string>();
  for (const relationship of [...relationshipsXml.getElementsByTagName('Relationship')]) {
    const id = relationship.getAttribute('Id');
    const target = relationship.getAttribute('Target');
    if (id !== null && target !== null) targets.set(id, relationshipTarget(target));
  }
  const sheets: WorkbookSheet[] = [];
  for (const element of [...workbookXml.getElementsByTagName('sheet')]) {
    const name = element.getAttribute('name') ?? 'Character Sheet';
    const relationshipId = element.getAttribute('r:id')
      ?? element.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
    const path = relationshipId === null ? null : targets.get(relationshipId);
    if (path === null || path === undefined || !entries.has(path)) continue;
    const xml = parseXml(await readZipEntry(buffer, entries, path), path);
    sheets.push({ name, path, cells: parseWorksheet(xml, sharedStrings) });
  }
  if (sheets.length === 0) throw new Error('No worksheets were found in this .xlsx file.');
  return sheets;
}

function findLabel(cells: readonly (readonly string[])[], label: string): { readonly row: number; readonly col: number } | null {
  const expected = normalizeLabel(label);
  for (let row = 0; row < cells.length; row += 1) {
    const values = cells[row] ?? [];
    for (let col = 0; col < values.length; col += 1) {
      if (normalizeLabel(values[col] ?? '') === expected) return { row, col };
    }
  }
  return null;
}

function at(cells: readonly (readonly string[])[], row: number, col: number): string {
  return clip(cells[row]?.[col] ?? '', 4000);
}

function afterLabel(cells: readonly (readonly string[])[], label: string, scan = 3): string {
  const position = findLabel(cells, label);
  if (position === null) return '';
  for (let offset = 1; offset <= scan; offset += 1) {
    const value = at(cells, position.row, position.col + offset);
    if (value.length > 0) return value;
  }
  return '';
}

function firstValueBelow(cells: readonly (readonly string[])[], label: string, maximumRows = 3): string {
  const position = findLabel(cells, label);
  if (position === null) return '';
  for (let rowOffset = 1; rowOffset <= maximumRows; rowOffset += 1) {
    for (let col = position.col; col < Math.min(position.col + 9, cells[position.row + rowOffset]?.length ?? 0); col += 1) {
      const value = at(cells, position.row + rowOffset, col);
      if (value.length > 0) return value;
    }
  }
  return '';
}

function sectionRows(cells: readonly (readonly string[])[], sectionLabel: string, stopLabels: readonly string[]): readonly (readonly string[])[] {
  const section = findLabel(cells, sectionLabel);
  if (section === null) return [];
  const start = section.row + 2;
  const rows: (readonly string[])[] = [];
  for (let row = start; row < cells.length; row += 1) {
    const values = cells[row] ?? [];
    const first = normalizeLabel(values[0] ?? '');
    if (stopLabels.some((label) => first === normalizeLabel(label))) break;
    if (values.every((value) => value.trim().length === 0)) {
      if (rows.length > 0) break;
      continue;
    }
    rows.push(values);
  }
  return rows;
}

function sheetScore(sheet: WorkbookSheet): number {
  const labels = ['PAYAW CHARACTER SHEET', 'Character Name', 'Background', 'STR', 'MALAS', 'CUSTOM SKILLS', 'GEAR / LOOT'];
  let score = 0;
  for (const label of labels) if (findLabel(sheet.cells, label) !== null) score += 10;
  if (afterLabel(sheet.cells, 'Character Name').length > 0) score += 80;
  for (const row of sheet.cells) for (const value of row) if (value.trim().length > 0) score += 1;
  return score;
}

export function emptyUltimateSkill(): ImportedUltimateSkill {
  return {
    slot: 'Ultimate',
    name: '',
    type: '',
    role: '',
    useCase: '',
    roll: '',
    combatEffect: '',
    utility: '',
    costRisk: '',
    unlocked: false,
  };
}

function parseUltimateSkill(cells: readonly (readonly string[])[]): ImportedUltimateSkill {
  const rows = sectionRows(cells, 'ULTIMATE SKILL', ['GEAR / LOOT', 'NOTES / DEBTS / RESPONSIBILITIES']);
  const row = rows.find((candidate) => candidate.some((value) => value.trim().length > 0));
  if (row === undefined) return emptyUltimateSkill();
  return {
    slot: clip(row[0] ?? 'Ultimate', 40) || 'Ultimate',
    name: clip(row[1] ?? '', 120),
    type: clip(row[2] ?? '', 80),
    role: clip(row[3] ?? '', 80),
    useCase: clip(row[4] ?? '', 700),
    roll: clip(row[5] ?? '', 160),
    combatEffect: clip(row[6] ?? '', 700),
    utility: clip(row[7] ?? '', 700),
    costRisk: clip(row[8] ?? '', 700),
    unlocked: normalizeLabel(row[9] ?? '') === 'unlocked' || normalizeLabel(row[9] ?? '') === 'yes' || normalizeLabel(row[9] ?? '') === 'true',
  };
}

function parseSheet(sheet: WorkbookSheet, sourceFile: string): ImportedCharacterSheet {
  const stats: Record<string, string> = {};
  for (const stat of ['STR', 'CON', 'AGL', 'INT', 'WIL', 'CHA']) {
    const position = findLabel(sheet.cells, stat);
    const value = position === null ? '' : at(sheet.cells, position.row, position.col + 1);
    if (value.length > 0) stats[stat] = value;
  }
  const skills = sectionRows(sheet.cells, 'CUSTOM SKILLS', ['SKILL CREATION NOTES FROM PLAYER GUIDE', 'GEAR / LOOT'])
    .filter((row) => at([row], 0, 1).length > 0)
    .slice(0, 10)
    .map((row): ImportedCharacterSkill => ({
      slot: clip(row[0] ?? '', 40),
      name: clip(row[1] ?? '', 120),
      type: clip(row[2] ?? '', 80),
      role: clip(row[3] ?? '', 80),
      useCase: clip(row[4] ?? '', 700),
      roll: clip(row[5] ?? '', 160),
      combatEffect: clip(row[6] ?? '', 700),
      utility: clip(row[7] ?? '', 700),
      costRisk: clip(row[8] ?? '', 700),
    }));
  const gear = sectionRows(sheet.cells, 'GEAR / LOOT', [])
    .filter((row) => at([row], 0, 0).length > 0)
    .slice(0, 30)
    .map((row): ImportedCharacterGear => ({
      item: clip(row[0] ?? '', 120),
      use: clip(row[1] ?? '', 300),
      notes: clip(row[2] ?? '', 700),
    }));
  const malas = findLabel(sheet.cells, 'MALAS');
  return {
    version: 1,
    sourceFile: clip(sourceFile, 180),
    worksheet: clip(sheet.name, 120),
    importedAt: new Date().toISOString(),
    player: clip(afterLabel(sheet.cells, 'Player'), 120),
    characterName: clip(afterLabel(sheet.cells, 'Character Name'), 120),
    handle: clip(afterLabel(sheet.cells, 'Screen Name / Handle'), 120),
    ageYear: clip(afterLabel(sheet.cells, 'Age / Year'), 120),
    background: clip(afterLabel(sheet.cells, 'Background'), 1600),
    connectionToGroup: clip(afterLabel(sheet.cells, 'Connection to Group'), 1200),
    schoolWork: clip(afterLabel(sheet.cells, 'School / Work'), 700),
    homeArea: clip(afterLabel(sheet.cells, 'Home Area'), 500),
    startingItem: clip(afterLabel(sheet.cells, 'Starting Item'), 500),
    currentSituation: clip(afterLabel(sheet.cells, 'Current Situation'), 1200),
    stats,
    malasCurrent: malas === null ? '' : clip(at(sheet.cells, malas.row, malas.col + 2), 40),
    malasState: malas === null ? '' : clip(at(sheet.cells, malas.row, malas.col + 4), 160),
    warning: clip(afterLabel(sheet.cells, 'Personal Warning / Taboo'), 700),
    warningConsequence: clip(afterLabel(sheet.cells, 'What happens if you break it?'), 1000),
    privateWish: clip(afterLabel(sheet.cells, 'Private Wish'), 800),
    risk: clip(afterLabel(sheet.cells, 'What would you risk trouble for?'), 1000),
    usefulContact: clip(afterLabel(sheet.cells, 'Useful Contact'), 800),
    worriedPerson: clip(afterLabel(sheet.cells, 'Person Who Worries About You'), 800),
    avoidedPlace: clip(afterLabel(sheet.cells, 'Place You Avoid'), 800),
    notes: clip(firstValueBelow(sheet.cells, 'Notes / Debts / Responsibilities', 1), 1600),
    skills,
    ultimateSkill: parseUltimateSkill(sheet.cells),
    gear,
  };
}

function normalizeSkill(value: unknown): ImportedCharacterSkill {
  const candidate = isRecord(value) ? value : {};
  return {
    slot: clip(typeof candidate.slot === 'string' ? candidate.slot : '', 40),
    name: clip(typeof candidate.name === 'string' ? candidate.name : '', 120),
    type: clip(typeof candidate.type === 'string' ? candidate.type : '', 80),
    role: clip(typeof candidate.role === 'string' ? candidate.role : '', 80),
    useCase: clip(typeof candidate.useCase === 'string' ? candidate.useCase : '', 700),
    roll: clip(typeof candidate.roll === 'string' ? candidate.roll : '', 160),
    combatEffect: clip(typeof candidate.combatEffect === 'string' ? candidate.combatEffect : '', 700),
    utility: clip(typeof candidate.utility === 'string' ? candidate.utility : '', 700),
    costRisk: clip(typeof candidate.costRisk === 'string' ? candidate.costRisk : '', 700),
  };
}

function normalizeGear(value: unknown): ImportedCharacterGear {
  const candidate = isRecord(value) ? value : {};
  return {
    item: clip(typeof candidate.item === 'string' ? candidate.item : '', 120),
    use: clip(typeof candidate.use === 'string' ? candidate.use : '', 300),
    notes: clip(typeof candidate.notes === 'string' ? candidate.notes : '', 700),
  };
}

export function normalizeImportedCharacterSheet(value: unknown): ImportedCharacterSheet | null {
  if (!isRecord(value) || value.version !== 1 || typeof value.characterName !== 'string') return null;
  const stats = isRecord(value.stats)
    ? Object.fromEntries(Object.entries(value.stats).flatMap(([key, item]) => typeof item === 'string' ? [[clip(key, 20), clip(item, 80)] as const] : []).slice(0, 40))
    : {};
  const ultimateCandidate = isRecord(value.ultimateSkill) ? value.ultimateSkill : {};
  const ultimateBase = normalizeSkill(ultimateCandidate);
  return {
    version: 1,
    sourceFile: clip(typeof value.sourceFile === 'string' ? value.sourceFile : '', 180),
    worksheet: clip(typeof value.worksheet === 'string' ? value.worksheet : '', 120),
    importedAt: typeof value.importedAt === 'string' ? value.importedAt : new Date().toISOString(),
    player: clip(typeof value.player === 'string' ? value.player : '', 120),
    characterName: clip(value.characterName, 120),
    handle: clip(typeof value.handle === 'string' ? value.handle : '', 120),
    ageYear: clip(typeof value.ageYear === 'string' ? value.ageYear : '', 120),
    background: clip(typeof value.background === 'string' ? value.background : '', 1600),
    connectionToGroup: clip(typeof value.connectionToGroup === 'string' ? value.connectionToGroup : '', 1200),
    schoolWork: clip(typeof value.schoolWork === 'string' ? value.schoolWork : '', 700),
    homeArea: clip(typeof value.homeArea === 'string' ? value.homeArea : '', 500),
    startingItem: clip(typeof value.startingItem === 'string' ? value.startingItem : '', 500),
    currentSituation: clip(typeof value.currentSituation === 'string' ? value.currentSituation : '', 1200),
    stats,
    malasCurrent: clip(typeof value.malasCurrent === 'string' ? value.malasCurrent : '', 40),
    malasState: clip(typeof value.malasState === 'string' ? value.malasState : '', 160),
    warning: clip(typeof value.warning === 'string' ? value.warning : '', 700),
    warningConsequence: clip(typeof value.warningConsequence === 'string' ? value.warningConsequence : '', 1000),
    privateWish: clip(typeof value.privateWish === 'string' ? value.privateWish : '', 800),
    risk: clip(typeof value.risk === 'string' ? value.risk : '', 1000),
    usefulContact: clip(typeof value.usefulContact === 'string' ? value.usefulContact : '', 800),
    worriedPerson: clip(typeof value.worriedPerson === 'string' ? value.worriedPerson : '', 800),
    avoidedPlace: clip(typeof value.avoidedPlace === 'string' ? value.avoidedPlace : '', 800),
    notes: clip(typeof value.notes === 'string' ? value.notes : '', 1600),
    skills: (Array.isArray(value.skills) ? value.skills : []).map(normalizeSkill).filter((skill) => skill.name.length > 0).slice(0, 10),
    ultimateSkill: {
      ...ultimateBase,
      slot: ultimateBase.slot || 'Ultimate',
      unlocked: ultimateCandidate.unlocked === true,
    },
    gear: (Array.isArray(value.gear) ? value.gear : []).map(normalizeGear).filter((entry) => entry.item.length > 0).slice(0, 30),
  };
}

export function createEmptyCharacterSheet(characterName: string, player = ''): ImportedCharacterSheet {
  return {
    version: 1,
    sourceFile: '',
    worksheet: 'Player View',
    importedAt: new Date().toISOString(),
    player: clip(player, 120),
    characterName: clip(characterName, 120),
    handle: '',
    ageYear: '',
    background: '',
    connectionToGroup: '',
    schoolWork: '',
    homeArea: '',
    startingItem: '',
    currentSituation: '',
    stats: {},
    malasCurrent: '',
    malasState: '',
    warning: '',
    warningConsequence: '',
    privateWish: '',
    risk: '',
    usefulContact: '',
    worriedPerson: '',
    avoidedPlace: '',
    notes: '',
    skills: [],
    ultimateSkill: emptyUltimateSkill(),
    gear: [],
  };
}

export async function parsePayawCharacterWorkbook(file: File): Promise<ImportedCharacterSheet> {
  if (!file.name.toLocaleLowerCase().endsWith('.xlsx')) throw new Error('Choose the PAYAW .xlsx character sheet.');
  if (file.size > 8 * 1024 * 1024) throw new Error('The character sheet must be smaller than 8 MB.');
  const sheets = await readWorkbook(file);
  const selected = [...sheets].sort((left, right) => sheetScore(right) - sheetScore(left))[0];
  if (selected === undefined) throw new Error('No readable PAYAW worksheet was found.');
  const parsed = parseSheet(selected, file.name);
  const meaningfulFields = [parsed.characterName, parsed.background, parsed.homeArea, parsed.currentSituation, ...Object.values(parsed.stats)]
    .filter((value) => value.trim().length > 0).length;
  if (meaningfulFields < 3) throw new Error('The workbook looks like an empty character-sheet template. Fill it in first, then upload it again.');
  return parsed;
}

export function readStoredCharacterSheet(privateNotes: string): StoredCharacterSheet {
  const begin = privateNotes.indexOf(SHEET_BEGIN);
  const end = privateNotes.indexOf(SHEET_END);
  if (begin < 0 || end < begin) return { sheet: null, freeformNotes: privateNotes };
  const json = privateNotes.slice(begin + SHEET_BEGIN.length, end).trim();
  const freeformNotes = `${privateNotes.slice(0, begin)}${privateNotes.slice(end + SHEET_END.length)}`.trim();
  try {
    const parsed: unknown = JSON.parse(json);
    const normalized = normalizeImportedCharacterSheet(parsed);
    return normalized === null ? { sheet: null, freeformNotes: privateNotes } : { sheet: normalized, freeformNotes };
  } catch {
    return { sheet: null, freeformNotes: privateNotes };
  }
}

export function writeStoredCharacterSheet(sheet: ImportedCharacterSheet | null, freeformNotes: string): string {
  if (sheet === null) return clip(freeformNotes, MAX_PRIVATE_NOTES);
  const normalized = normalizeImportedCharacterSheet(sheet);
  if (normalized === null) throw new Error('The character sheet data is invalid.');
  const metadata = `${SHEET_BEGIN}\n${JSON.stringify(normalized)}\n${SHEET_END}`;
  if (metadata.length > MAX_PRIVATE_NOTES) throw new Error('The imported sheet contains too much text. Shorten the longest skill descriptions or notes and try again.');
  const remaining = MAX_PRIVATE_NOTES - metadata.length - 2;
  const notes = clip(freeformNotes, Math.max(0, remaining));
  return notes.length > 0 ? `${metadata}\n\n${notes}` : metadata;
}
