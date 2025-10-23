import type { LicenseId, PackMetadata } from '@common/ipc';

export type LicenseSelection = LicenseId | '';

export interface MetadataDraftData {
  title: string;
  artist: string;
  licenseId: LicenseSelection;
  album: string;
  bpm: string;
  key: string;
  attribution: string;
  artistUrl: string;
  contactEmail: string;
}

export interface MetadataDraftState {
  data: MetadataDraftData;
  rememberDefault: boolean;
  everOpened: boolean;
  lastAutoAttribution?: string;
}

export function createEmptyDraft(): MetadataDraftState {
  return {
    data: {
      title: '',
      artist: '',
      licenseId: '',
      album: '',
      bpm: '',
      key: '',
      attribution: '',
      artistUrl: '',
      contactEmail: ''
    },
    rememberDefault: true,
    everOpened: false,
    lastAutoAttribution: undefined
  };
}

export function cloneDraft(state: MetadataDraftState): MetadataDraftState {
  return {
    data: { ...state.data },
    rememberDefault: state.rememberDefault,
    everOpened: state.everOpened,
    lastAutoAttribution: state.lastAutoAttribution
  };
}

export function hasRequiredMetadata(draft: MetadataDraftData): boolean {
  return (
    draft.title.trim().length > 0 &&
    draft.artist.trim().length > 0 &&
    Boolean(draft.licenseId)
  );
}

export function buildPackMetadata(draft: MetadataDraftData): PackMetadata {
  if (!hasRequiredMetadata(draft)) {
    throw new Error('Required metadata is missing');
  }

  const trim = (value: string) => value.trim();

  const metadata: PackMetadata = {
    title: trim(draft.title),
    artist: trim(draft.artist),
    license: { id: draft.licenseId as LicenseId }
  };

  const album = trim(draft.album);
  if (album) {
    metadata.album = album;
  }

  const bpm = trim(draft.bpm);
  if (bpm) {
    metadata.bpm = bpm;
  }

  const musicalKey = trim(draft.key);
  if (musicalKey) {
    metadata.key = musicalKey;
  }

  const attribution = trim(draft.attribution);
  if (attribution) {
    metadata.attribution = attribution;
  }

  const artistUrl = trim(draft.artistUrl);
  const contactEmail = trim(draft.contactEmail);
  if (artistUrl || contactEmail) {
    metadata.links = {};
    if (artistUrl) {
      metadata.links.artist_url = artistUrl;
    }
    if (contactEmail) {
      metadata.links.contact_email = contactEmail;
    }
  }

  return metadata;
}

export function mergeDraftData(
  state: MetadataDraftState,
  updates: Partial<MetadataDraftData>
): MetadataDraftState {
  return {
    ...state,
    data: {
      ...state.data,
      ...updates
    }
  };
}

export function updateAutoAttribution(
  state: MetadataDraftState,
  suggestion: string | undefined
): MetadataDraftState {
  return {
    ...state,
    lastAutoAttribution: suggestion
  };
}
