export const DEFAULT_MAX_SIZE_MB = 48;
export const MAX_SIZE_LIMIT_MB = 500;
export const SUPPORTED_EXTENSIONS = ['.wav', '.flac', '.mp3', '.aiff', '.ogg', '.aac', '.wma'] as const;

export type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number];
type StripLeadingDot<T extends string> = T extends `.${infer Kind}` ? Kind : T;
export type SupportedAudioKind = StripLeadingDot<SupportedExtension>;
