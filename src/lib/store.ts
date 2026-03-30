export interface EventRecord {
  id: string;
  name: string;
  createdAt: string;
  updatedAt?: string;
  createdBy: string;
  creatorName: string;
  isPublic?: boolean;
  driveFolderId?: string;
  driveFolderLink?: string;
  shareTokenHash?: string;
  shareTokenUpdatedAt?: string;
}

export interface PhotoRecord {
  id: string;
  eventId: string;
  url: string;
  caption?: string;
  tags?: string[];
  uploadedAt: string;
  uploadedBy: string;
  photographerName?: string;
  driveFileId?: string;
  driveFolderId?: string;
}

export interface ActivityRecord {
  id: string;
  userId: string;
  type: 'create_event' | 'upload' | 'download' | 'match';
  description: string;
  timestamp: string;
  eventId?: string;
  photoId?: string;
}

export interface UserStats {
  totalDownloads: number;
  totalAiMatches: number;
}

interface StoreSchema {
  events: EventRecord[];
  photosByEvent: Record<string, PhotoRecord[]>;
  activity: ActivityRecord[];
  userStats: Record<string, UserStats>;
}

const STORE_KEY = 'snapsearch.store.v1';

function makeId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createEmptyStore(): StoreSchema {
  return {
    events: [],
    photosByEvent: {},
    activity: [],
    userStats: {},
  };
}

function readStore(): StoreSchema {
  const raw = localStorage.getItem(STORE_KEY);
  if (!raw) return createEmptyStore();

  try {
    const parsed = JSON.parse(raw) as StoreSchema;
    return {
      events: parsed.events || [],
      photosByEvent: parsed.photosByEvent || {},
      activity: parsed.activity || [],
      userStats: parsed.userStats || {},
    };
  } catch {
    return createEmptyStore();
  }
}

function writeStore(next: StoreSchema) {
  localStorage.setItem(STORE_KEY, JSON.stringify(next));
}

function makeSecureToken(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    let out = '';
    for (const b of bytes) out += alphabet[b % alphabet.length];
    return out;
  }

  let out = '';
  for (let i = 0; i < 48; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

async function sha256Hex(value: string): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    return value;
  }

  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function listEvents(): EventRecord[] {
  return readStore().events.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function listEventsByCreator(userId: string): EventRecord[] {
  return listEvents().filter((event) => event.createdBy === userId);
}

export function getEvent(eventId: string): EventRecord | null {
  return readStore().events.find((event) => event.id === eventId) || null;
}

export function createEvent(input: {
  name: string;
  createdBy: string;
  creatorName: string;
}): EventRecord {
  const store = readStore();
  const event: EventRecord = {
    id: makeId(),
    name: input.name,
    createdAt: new Date().toISOString(),
    createdBy: input.createdBy,
    creatorName: input.creatorName,
    isPublic: true,
  };

  store.events.unshift(event);
  store.photosByEvent[event.id] = [];
  writeStore(store);
  return event;
}

export function updateEvent(eventId: string, updates: Partial<Pick<EventRecord, 'name' | 'isPublic'>>): EventRecord | null {
  const store = readStore();
  const idx = store.events.findIndex((event) => event.id === eventId);
  if (idx === -1) return null;

  const next: EventRecord = {
    ...store.events[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  store.events[idx] = next;
  writeStore(store);
  return next;
}

export function setEventDriveFolder(eventId: string, input: { driveFolderId: string; driveFolderLink?: string }): EventRecord | null {
  const store = readStore();
  const idx = store.events.findIndex((event) => event.id === eventId);
  if (idx === -1) return null;

  const next: EventRecord = {
    ...store.events[idx],
    driveFolderId: input.driveFolderId,
    driveFolderLink: input.driveFolderLink,
    updatedAt: new Date().toISOString(),
  };

  store.events[idx] = next;
  writeStore(store);
  return next;
}

export async function issueEventShareToken(eventId: string): Promise<string | null> {
  const store = readStore();
  const idx = store.events.findIndex((event) => event.id === eventId);
  if (idx === -1) return null;

  const token = makeSecureToken();
  const tokenHash = await sha256Hex(token);
  const next: EventRecord = {
    ...store.events[idx],
    shareTokenHash: tokenHash,
    shareTokenUpdatedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  store.events[idx] = next;
  writeStore(store);
  return token;
}

export async function validateEventShareToken(eventId: string, token: string): Promise<boolean> {
  const event = getEvent(eventId);
  if (!event) return false;

  if (event.isPublic !== false && !event.shareTokenHash) {
    return true;
  }

  if (!token || !event.shareTokenHash) {
    return false;
  }

  const incomingHash = await sha256Hex(token);
  return incomingHash === event.shareTokenHash;
}

export function deleteEvent(eventId: string) {
  const store = readStore();
  store.events = store.events.filter((event) => event.id !== eventId);
  delete store.photosByEvent[eventId];
  store.activity = store.activity.filter((item) => item.eventId !== eventId);
  writeStore(store);
}

export function listPhotos(eventId: string): PhotoRecord[] {
  const photos = readStore().photosByEvent[eventId] || [];
  return photos.slice().sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

export function addPhoto(
  eventId: string,
  input: {
    url: string;
    caption?: string;
    tags?: string[];
    uploadedBy: string;
    photographerName?: string;
    driveFileId?: string;
    driveFolderId?: string;
  },
): PhotoRecord {
  const store = readStore();
  const nextPhoto: PhotoRecord = {
    id: makeId(),
    eventId,
    url: input.url,
    caption: input.caption,
    tags: input.tags || [],
    uploadedAt: new Date().toISOString(),
    uploadedBy: input.uploadedBy,
    photographerName: input.photographerName,
    driveFileId: input.driveFileId,
    driveFolderId: input.driveFolderId,
  };

  const current = store.photosByEvent[eventId] || [];
  store.photosByEvent[eventId] = [nextPhoto, ...current];
  writeStore(store);
  return nextPhoto;
}

export function deletePhoto(eventId: string, photoId: string) {
  const store = readStore();
  store.photosByEvent[eventId] = (store.photosByEvent[eventId] || []).filter((photo) => photo.id !== photoId);
  store.activity = store.activity.filter((item) => item.photoId !== photoId);
  writeStore(store);
}

export function deletePhotosBulk(eventId: string, photoIds: string[]) {
  const photoIdSet = new Set(photoIds);
  const store = readStore();
  store.photosByEvent[eventId] = (store.photosByEvent[eventId] || []).filter((photo) => !photoIdSet.has(photo.id));
  store.activity = store.activity.filter((item) => !item.photoId || !photoIdSet.has(item.photoId));
  writeStore(store);
}

export function recordActivity(input: Omit<ActivityRecord, 'id' | 'timestamp'> & { timestamp?: string }) {
  const store = readStore();
  const nextActivity: ActivityRecord = {
    id: makeId(),
    ...input,
    timestamp: input.timestamp || new Date().toISOString(),
  };
  store.activity.unshift(nextActivity);
  writeStore(store);
}

export function listActivityByUser(userId: string, maxItems: number): ActivityRecord[] {
  return readStore().activity.filter((item) => item.userId === userId).slice(0, maxItems);
}

export function getUserStats(userId: string): UserStats {
  const stats = readStore().userStats[userId];
  return stats || { totalDownloads: 0, totalAiMatches: 0 };
}

export function incrementUserStats(
  userId: string,
  increments: Partial<Record<keyof UserStats, number>>,
) {
  const store = readStore();
  const current = store.userStats[userId] || { totalDownloads: 0, totalAiMatches: 0 };
  store.userStats[userId] = {
    totalDownloads: current.totalDownloads + (increments.totalDownloads || 0),
    totalAiMatches: current.totalAiMatches + (increments.totalAiMatches || 0),
  };
  writeStore(store);
}

export function countPhotosUploadedBy(userId: string): number {
  const store = readStore();
  return Object.values(store.photosByEvent).flat().filter((photo) => photo.uploadedBy === userId).length;
}

export function upsertDrivePhotos(
  eventId: string,
  photos: Array<{
    driveFileId: string;
    driveFolderId: string;
    name: string;
    url: string;
    uploadedAt?: string;
  }>,
) {
  const store = readStore();
  const current = store.photosByEvent[eventId] || [];
  const byDriveId = new Map(current.filter((photo) => photo.driveFileId).map((photo) => [photo.driveFileId as string, photo]));

  for (const drivePhoto of photos) {
    if (byDriveId.has(drivePhoto.driveFileId)) continue;

    const nextPhoto: PhotoRecord = {
      id: makeId(),
      eventId,
      url: drivePhoto.url,
      caption: drivePhoto.name,
      tags: [],
      uploadedAt: drivePhoto.uploadedAt || new Date().toISOString(),
      uploadedBy: 'drive-import',
      photographerName: 'Drive Import',
      driveFileId: drivePhoto.driveFileId,
      driveFolderId: drivePhoto.driveFolderId,
    };

    current.unshift(nextPhoto);
    byDriveId.set(drivePhoto.driveFileId, nextPhoto);
  }

  store.photosByEvent[eventId] = current.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  writeStore(store);
}
