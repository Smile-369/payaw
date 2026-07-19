import { AssetTargetCategory, type ImportedImageAsset } from './Customization';

const DATABASE_NAME = 'payaw-custom-assets';
const DATABASE_VERSION = 2;
const STORE_NAME = 'assets';

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result));
    request.addEventListener('error', () => reject(request.error ?? new Error('IndexedDB request failed.')));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.addEventListener('complete', () => resolve());
    transaction.addEventListener('abort', () => reject(transaction.error ?? new Error('IndexedDB transaction was aborted.')));
    transaction.addEventListener('error', () => reject(transaction.error ?? new Error('IndexedDB transaction failed.')));
  });
}

function normalizeAsset(value: ImportedImageAsset): ImportedImageAsset {
  if (value.targetCategory !== undefined) return value;
  const legacyBuildingType = value.buildingType ?? null;
  return {
    ...value,
    targetCategory: legacyBuildingType === null ? AssetTargetCategory.Map : AssetTargetCategory.Building,
    targetType: legacyBuildingType,
  };
}

export class AssetRepository {
  private databasePromise?: Promise<IDBDatabase>;

  public async list(): Promise<ImportedImageAsset[]> {
    const database = await this.open();
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const done = transactionDone(transaction);
    const request = transaction.objectStore(STORE_NAME).getAll();
    const records = (await requestToPromise(request) as ImportedImageAsset[]).map(normalizeAsset);
    await done;
    return records.sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
  }

  public async put(asset: ImportedImageAsset): Promise<void> {
    const database = await this.open();
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const done = transactionDone(transaction);
    transaction.objectStore(STORE_NAME).put(asset);
    await done;
  }

  public async delete(id: string): Promise<void> {
    const database = await this.open();
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const done = transactionDone(transaction);
    transaction.objectStore(STORE_NAME).delete(id);
    await done;
  }

  private open(): Promise<IDBDatabase> {
    this.databasePromise ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.addEventListener('upgradeneeded', () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      });
      request.addEventListener('success', () => resolve(request.result));
      request.addEventListener('error', () => reject(request.error ?? new Error('Unable to open the PAYAW asset database.')));
    });
    return this.databasePromise;
  }
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error(`Could not read ${file.name} as an image.`));
    });
    reader.addEventListener('error', () => reject(reader.error ?? new Error(`Could not read ${file.name}.`)));
    reader.readAsDataURL(file);
  });
}

export function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', () => reject(new Error('An imported image could not be decoded.')));
    image.src = dataUrl;
  });
}
