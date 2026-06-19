import { getPlanes } from '../config/data/planes/index';

const PNG_HEADER_BYTES = 24;
const PNG_WIDTH_OFFSET = 16;
const PNG_HEIGHT_OFFSET = 20;
const RENDER_WIDTH = 460;

let cachedMaxHeight: Promise<number> | null = null;

async function readScaledHeight(file: string): Promise<number> {
  const url = `${import.meta.env.BASE_URL}${file}`;
  try {
    const response = await fetch(url, {
      headers: { Range: `bytes=0-${PNG_HEADER_BYTES - 1}` },
    });
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength < PNG_HEADER_BYTES) return 0;
    const view = new DataView(buffer);
    const width = view.getUint32(PNG_WIDTH_OFFSET);
    const height = view.getUint32(PNG_HEIGHT_OFFSET);
    if (width === 0) return 0;
    return (RENDER_WIDTH * height) / width;
  } catch {
    return 0;
  }
}

export function getMaxSpriteHeight(): Promise<number> {
  if (!cachedMaxHeight) {
    cachedMaxHeight = Promise.all(getPlanes().map((plane) => readScaledHeight(plane.file))).then(
      (heights) => Math.ceil(heights.reduce((max, height) => (height > max ? height : max), 0)),
    );
  }
  return cachedMaxHeight;
}
