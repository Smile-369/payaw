import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const source = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

const requiredIds = [
  'workspace-editor-button',
  'workspace-dm-button',
  'editor-workspace',
  'dm-workspace',
  'workspace-title',
  'map-workspace-badge',
  'dm-view-preset',
  'dm-story-search',
  'dm-random-encounter-button',
  'dm-random-encounter-result',
  'dm-session-log',
  'dm-clear-log',
  'story-list',
  'custom-story-form',
  'story-rule-form',
];

for (const id of requiredIds) {
  const matches = html.match(new RegExp(`id=["']${id}["']`, 'g')) ?? [];
  assert.equal(matches.length, 1, `${id} must exist exactly once`);
}

const editorStart = html.indexOf('id="editor-workspace"');
const dmStart = html.indexOf('id="dm-workspace"');
const storyList = html.indexOf('id="story-list"');
const customStoryForm = html.indexOf('id="custom-story-form"');
assert(editorStart >= 0 && dmStart > editorStart, 'workspace panels must be ordered editor then DM');
assert(customStoryForm > editorStart && customStoryForm < dmStart, 'story authoring must stay in the editor');
assert(storyList > dmStart, 'encounter deck must live in DM Mode');
const editorHtml = html.slice(editorStart, dmStart);
assert.equal((editorHtml.match(/<details[^>]*\sopen(?:=|\s|>)/g) ?? []).length, 0, 'editor disclosures should start collapsed');

assert(source.includes("type WorkspaceMode = 'editor' | 'dm'"));
assert(source.includes('function setWorkspace('));
assert(source.includes('function rollDmEncounter('));
assert(source.includes("setEditMode(false);\n    setZoneEditMode(false);"), 'DM Mode must disable editing tools');
assert(source.includes("workspaceEditorButton.addEventListener('click'"));
assert(source.includes("workspaceDmButton.addEventListener('click'"));
assert(source.includes("dmStorySearch.addEventListener('input'"));
assert(source.includes("dmRandomEncounterButton.addEventListener('click'"));

assert(css.includes('.workspace-panel[hidden]'));
assert(css.includes(".viewport-shell[data-workspace='dm'] #toolbar-edit-button"));
assert(css.includes('.dm-story-list'));
assert(css.includes('.workspace-switcher'));

const result = {
  version: '0.9.0',
  workspaces: ['editor', 'dm'],
  requiredUiIds: requiredIds.length,
  storyAuthoringInEditor: true,
  encounterDeckInDmMode: true,
  collapsedEditorModules: true,
  dmDisablesEditing: true,
  dmTools: ['story search', 'random encounter', 'per-site roll', 'session log', 'map presets'],
};

console.log(JSON.stringify(result, null, 2));
