export function clampInt(rawValue: unknown, defaultValue: number, min: number, max: number): number;
export function getStreamFps(raw: unknown): number;
export function getJpegQuality(raw: unknown): number;
export function getStreamDimension(raw: unknown, defaultValue: number): number;
export function hashFrame(buffer: Uint8Array): string;
export function hasFrameChanged(previousHash: string | null, nextHash: string): boolean;
