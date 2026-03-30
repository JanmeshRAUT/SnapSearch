import { ensureGoogleAccessToken } from './googleAuth';

export interface DriveFolderResult {
  id: string;
  name: string;
  webViewLink?: string;
}

export interface DriveImageResult {
  id: string;
  name: string;
  parents?: string[];
  mimeType?: string;
  createdTime?: string;
  webViewLink?: string;
  webContentLink?: string;
  publicUrl: string;
}

export function getDriveImageUrl(fileId: string) {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w2000`;
}

function toMultipartBody(metadata: Record<string, unknown>, file: File, boundary: string) {
  const metaPart =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    `${JSON.stringify(metadata)}\r\n`;

  const fileHeader =
    `--${boundary}\r\n` +
    `Content-Type: ${file.type || 'application/octet-stream'}\r\n\r\n`;

  const end = `\r\n--${boundary}--`;
  return new Blob([metaPart, fileHeader, file, end], {
    type: `multipart/related; boundary=${boundary}`,
  });
}

async function makeDriveFilePublic(accessToken: string, fileId: string) {
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      role: 'reader',
      type: 'anyone',
    }),
  });

  if (!response.ok && response.status !== 409) {
    const details = await response.text();
    throw new Error(`Failed to make Drive file public: ${response.status} ${details}`);
  }
}

export async function createDriveFolderForEvent(eventName: string): Promise<DriveFolderResult> {
  const accessToken = await ensureGoogleAccessToken(true);

  const response = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: `SnapSearch - ${eventName}`,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Drive folder creation failed: ${response.status} ${details}`);
  }

  return (await response.json()) as DriveFolderResult;
}

export async function uploadImageToDriveFolder(input: {
  file: File;
  folderId: string;
  fileName?: string;
}): Promise<DriveImageResult> {
  const accessToken = await ensureGoogleAccessToken(true);
  const boundary = `snapsearch_${Date.now().toString(36)}`;

  const safeFileName =
    input.fileName ||
    input.file.name ||
    `photo-${Date.now()}.jpg`;

  const metadata = {
    name: safeFileName,
    parents: [input.folderId],
  };

  const body = toMultipartBody(metadata, input.file, boundary);
  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,parents,webViewLink,webContentLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );

  if (!uploadRes.ok) {
    const details = await uploadRes.text();
    throw new Error(`Drive upload failed: ${uploadRes.status} ${details}`);
  }

  const uploaded = (await uploadRes.json()) as Omit<DriveImageResult, 'publicUrl'>;
  if (Array.isArray(uploaded.parents) && uploaded.parents.length > 0 && !uploaded.parents.includes(input.folderId)) {
    throw new Error('Drive folder mismatch detected for uploaded file.');
  }

  await makeDriveFilePublic(accessToken, uploaded.id);

  return {
    ...uploaded,
    publicUrl: getDriveImageUrl(uploaded.id),
  };
}

export async function listDriveImagesInFolder(folderId: string): Promise<DriveImageResult[]> {
  const accessToken = await ensureGoogleAccessToken(true);
  const q = encodeURIComponent(`'${folderId}' in parents and trashed = false and mimeType contains 'image/'`);
  const fields = encodeURIComponent('files(id,name,mimeType,parents,createdTime,webViewLink,webContentLink)');
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&pageSize=1000&orderBy=createdTime desc`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Drive list failed: ${response.status} ${details}`);
  }

  const payload = (await response.json()) as {
    files?: Array<{
      id: string;
      name: string;
      mimeType?: string;
      parents?: string[];
      createdTime?: string;
      webViewLink?: string;
      webContentLink?: string;
    }>;
  };

  return (payload.files || []).map((file) => ({
    ...file,
    publicUrl: getDriveImageUrl(file.id),
  }));
}

async function listDriveEntriesInFolder(folderId: string): Promise<Array<{ id: string; mimeType?: string }>> {
  const accessToken = await ensureGoogleAccessToken(true);
  const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
  const fields = encodeURIComponent('files(id,mimeType)');
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&pageSize=1000`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Drive list entries failed: ${response.status} ${details}`);
  }

  const payload = (await response.json()) as { files?: Array<{ id: string; mimeType?: string }> };
  return payload.files || [];
}

export async function deleteDriveFile(fileId: string): Promise<void> {
  const accessToken = await ensureGoogleAccessToken(true);
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok && response.status !== 404) {
    const details = await response.text();
    throw new Error(`Drive delete file failed: ${response.status} ${details}`);
  }
}

export async function deleteDriveFolderWithContents(folderId: string): Promise<void> {
  const entries = await listDriveEntriesInFolder(folderId);

  for (const entry of entries) {
    if (entry.mimeType === 'application/vnd.google-apps.folder') {
      await deleteDriveFolderWithContents(entry.id);
    } else {
      await deleteDriveFile(entry.id);
    }
  }

  await deleteDriveFile(folderId);
}
