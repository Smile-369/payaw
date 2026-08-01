import { clearRecentProjects } from './RecentProjectStore';
import * as elements from '../ui/AppElements';

type StatusTone = 'success' | 'warning' | 'error' | 'working' | 'idle';

export interface ProjectControllerDependencies {
  readonly downloadProject: () => void;
  readonly exportImage: () => Promise<void>;
  readonly exportCustomization: () => void;
  readonly importCustomization: (file: File) => Promise<void>;
  readonly importProject: (file: File) => Promise<void>;
  readonly restoreAutosave: () => Promise<void>;
  readonly renderRecentProjects: () => void;
  readonly setStatus: (message: string, tone?: StatusTone) => void;
}

export class ProjectController {
  public constructor(private readonly dependencies: ProjectControllerDependencies) {
    this.bindEvents();
  }

  private bindEvents(): void {
    elements.studioSaveButton.addEventListener('click', this.dependencies.downloadProject);
    elements.studioOpenButton.addEventListener('click', () => elements.projectImportFile.click());
    elements.studioExportImageButton.addEventListener('click', () => { void this.dependencies.exportImage(); });
    elements.restoreSessionButton.addEventListener('click', () => {
      void this.dependencies.restoreAutosave().catch((error: unknown) => this.reportError(error));
    });
    elements.clearRecentProjectsButton.addEventListener('click', () => {
      clearRecentProjects();
      this.dependencies.renderRecentProjects();
      this.dependencies.setStatus('Cleared recent worlds.', 'success');
    });
    elements.exportButton.addEventListener('click', this.dependencies.downloadProject);
    elements.exportImageButton.addEventListener('click', () => { void this.dependencies.exportImage(); });
    elements.exportCustomizationButton.addEventListener('click', this.dependencies.exportCustomization);
    elements.customizationImportFile.addEventListener('change', () => {
      const file = elements.customizationImportFile.files?.[0];
      if (file === undefined) return;
      void this.dependencies.importCustomization(file).catch((error: unknown) => this.reportError(error));
      elements.customizationImportFile.value = '';
    });
    elements.projectImportFile.addEventListener('change', () => {
      const file = elements.projectImportFile.files?.[0];
      if (file === undefined) return;
      this.dependencies.setStatus('Validating PAYAW JSON…', 'working');
      void this.dependencies.importProject(file).catch((error: unknown) => this.reportError(error));
      elements.projectImportFile.value = '';
    });
    elements.projectJsonDropzone.addEventListener('dragenter', (event) => {
      event.preventDefault();
      elements.projectJsonDropzone.dataset.dragging = 'true';
    });
    elements.projectJsonDropzone.addEventListener('dragover', (event) => {
      event.preventDefault();
      if (event.dataTransfer !== null) event.dataTransfer.dropEffect = 'copy';
      elements.projectJsonDropzone.dataset.dragging = 'true';
    });
    elements.projectJsonDropzone.addEventListener('dragleave', (event) => {
      if (event.relatedTarget instanceof Node && elements.projectJsonDropzone.contains(event.relatedTarget)) return;
      delete elements.projectJsonDropzone.dataset.dragging;
    });
    elements.projectJsonDropzone.addEventListener('drop', (event) => this.importDroppedProject(event));
  }

  private importDroppedProject(event: DragEvent): void {
    event.preventDefault();
    delete elements.projectJsonDropzone.dataset.dragging;
    const file = [...(event.dataTransfer?.files ?? [])]
      .find((candidate) => candidate.name.toLowerCase().endsWith('.json') || candidate.type === 'application/json');
    if (file === undefined) {
      this.dependencies.setStatus('Drop a PAYAW JSON file.', 'error');
      return;
    }
    this.dependencies.setStatus('Validating dropped PAYAW JSON…', 'working');
    void this.dependencies.importProject(file).catch((error: unknown) => this.reportError(error));
  }

  private reportError(error: unknown): void {
    this.dependencies.setStatus(error instanceof Error ? error.message : String(error), 'error');
  }
}
