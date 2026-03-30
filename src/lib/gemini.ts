type PhotoInput = { id: string; url: string };

interface FaceBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface FaceMatch {
  id: string;
  score: number;
}

declare global {
  interface Window {
    FaceDetector?: new (options?: { fastMode?: boolean; maxDetectedFaces?: number }) => {
      detect: (source: HTMLImageElement) => Promise<Array<{ boundingBox: FaceBox }>>;
    };
  }
}

const EMBEDDING_SIZE = 32;
const MATCH_THRESHOLD = 0.88;

function clamp(val: number, min: number, max: number) {
  return Math.min(max, Math.max(min, val));
}

function cosineSimilarity(a: number[], b: number[]) {
  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

function normalizeVector(vec: number[]) {
  const mean = vec.reduce((sum, v) => sum + v, 0) / vec.length;
  const centered = vec.map((v) => v - mean);
  const mag = Math.sqrt(centered.reduce((sum, v) => sum + v * v, 0)) || 1;
  return centered.map((v) => v / mag);
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.referrerPolicy = 'no-referrer';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Image decode failed'));
    image.src = url;
  });
}

async function detectFaces(image: HTMLImageElement): Promise<FaceBox[]> {
  if (!window.FaceDetector) {
    return [];
  }

  try {
    const detector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 5 });
    const detections = await detector.detect(image);
    return detections.map((item) => item.boundingBox);
  } catch {
    return [];
  }
}

function getCenterCrop(image: HTMLImageElement): FaceBox {
  const side = Math.min(image.width, image.height);
  const x = (image.width - side) / 2;
  const y = (image.height - side) / 2;
  return { x, y, width: side, height: side };
}

function extractEmbedding(image: HTMLImageElement, face: FaceBox): number[] {
  const canvas = document.createElement('canvas');
  canvas.width = EMBEDDING_SIZE;
  canvas.height = EMBEDDING_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];

  const x = clamp(face.x, 0, image.width);
  const y = clamp(face.y, 0, image.height);
  const width = clamp(face.width, 1, image.width - x);
  const height = clamp(face.height, 1, image.height - y);

  ctx.drawImage(image, x, y, width, height, 0, 0, EMBEDDING_SIZE, EMBEDDING_SIZE);
  const pixels = ctx.getImageData(0, 0, EMBEDDING_SIZE, EMBEDDING_SIZE).data;

  const vec: number[] = [];
  for (let i = 0; i < pixels.length; i += 4) {
    const gray = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
    vec.push(gray / 255);
  }

  return normalizeVector(vec);
}

async function getFaceEmbeddings(imageUrl: string): Promise<number[][]> {
  const image = await loadImage(imageUrl);
  const faces = await detectFaces(image);
  const boxes = faces.length > 0 ? faces : [getCenterCrop(image)];
  return boxes.map((face) => extractEmbedding(image, face)).filter((vec) => vec.length > 0);
}

function bestSimilarity(selfieEmbeddings: number[][], photoEmbeddings: number[][]): number {
  let best = 0;
  for (const selfie of selfieEmbeddings) {
    for (const photo of photoEmbeddings) {
      const score = cosineSimilarity(selfie, photo);
      if (score > best) best = score;
    }
  }
  return best;
}

export async function findMatchingPhotos(selfieBase64s: string[], photos: PhotoInput[]) {
  if (photos.length === 0 || selfieBase64s.length === 0) return [];

  try {
    const selfieVectors = (await Promise.all(selfieBase64s.map((s) => getFaceEmbeddings(s)))).flat();
    if (selfieVectors.length === 0) return [];

    const matches: FaceMatch[] = [];
    for (const photo of photos) {
      const photoEmbeddings = await getFaceEmbeddings(photo.url);
      if (photoEmbeddings.length === 0) continue;

      const score = bestSimilarity(selfieVectors, photoEmbeddings);
      if (score >= MATCH_THRESHOLD) {
        matches.push({ id: photo.id, score });
      }
    }

    return matches.sort((a, b) => b.score - a.score).map((match) => match.id);
  } catch (error) {
    console.error('Local face match error:', error);
    throw error;
  }
}
