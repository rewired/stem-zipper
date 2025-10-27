import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { LicenseId } from '@common/ipc';
import { MaterialIcon } from '../../components/icons/MaterialIcon';
import type { MetadataDraftData } from '../../state/metadataStore';

const LICENSE_IDS: LicenseId[] = ['CC0-1.0', 'CC-BY-4.0', 'CC-BY-SA-4.0', 'CC-BY-NC-4.0'];

type MetadataModalIntent = 'save' | 'save_and_pack';

interface MetadataModalProps {
  modalTitle: string;
  draft: MetadataDraftData;
  rememberDefault: boolean;
  lastAutoAttribution?: string;
  defaultArtist?: string;
  defaultArtistUrl?: string;
  defaultContactEmail?: string;
  recentArtists: string[];
  saveLabel: string;
  saveAndPackLabel: string;
  cancelLabel: string;
  rememberLabel: string;
  requiredHint: string;
  requiredError: string;
  emailWarning: string;
  titleLabel: string;
  artistLabel: string;
  licenseLabel: string;
  albumLabel: string;
  bpmLabel: string;
  keyLabel: string;
  attributionLabel: string;
  artistUrlLabel: string;
  contactEmailLabel: string;
  onChange: (updates: Partial<MetadataDraftData>) => void;
  onRememberDefaultChange: (remember: boolean) => void;
  onClose: () => void;
  onSave: (intent: MetadataModalIntent) => Promise<void> | void;
  onAutoAttributionChange: (value: string | undefined) => void;
  showSaveAndPack: boolean;
  saving: boolean;
  badgeRequiredLabel: string;
  prefillKey: string;
}

function isValidEmail(value: string): boolean {
  if (!value.trim()) {
    return true;
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(value.trim());
}

export function MetadataModal({
  modalTitle,
  draft,
  rememberDefault,
  lastAutoAttribution,
  defaultArtist,
  defaultArtistUrl,
  defaultContactEmail,
  recentArtists,
  saveLabel,
  saveAndPackLabel,
  cancelLabel,
  rememberLabel,
  requiredHint,
  requiredError,
  emailWarning,
  titleLabel,
  artistLabel,
  licenseLabel,
  albumLabel,
  bpmLabel,
  keyLabel,
  attributionLabel,
  artistUrlLabel,
  contactEmailLabel,
  onChange,
  onRememberDefaultChange,
  onClose,
  onSave,
  onAutoAttributionChange,
  showSaveAndPack,
  saving,
  badgeRequiredLabel,
  prefillKey
}: MetadataModalProps) {
  const labelId = useId();
  const [submitted, setSubmitted] = useState(false);
  const artistPrefilledRef = useRef(false);
  const artistUrlPrefilledRef = useRef(false);
  const contactEmailPrefilledRef = useRef(false);
  const prefillKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (prefillKeyRef.current !== prefillKey) {
      prefillKeyRef.current = prefillKey;
      artistPrefilledRef.current = false;
      artistUrlPrefilledRef.current = false;
      contactEmailPrefilledRef.current = false;
    }
  }, [prefillKey]);

  useEffect(() => {
    if (!artistPrefilledRef.current && !draft.artist.trim() && defaultArtist) {
      artistPrefilledRef.current = true;
      onChange({ artist: defaultArtist });
    }
  }, [defaultArtist, draft.artist, onChange]);

  useEffect(() => {
    if (!artistUrlPrefilledRef.current && !draft.artistUrl.trim() && defaultArtistUrl) {
      artistUrlPrefilledRef.current = true;
      onChange({ artistUrl: defaultArtistUrl });
    }
  }, [defaultArtistUrl, draft.artistUrl, onChange]);

  useEffect(() => {
    if (!contactEmailPrefilledRef.current && !draft.contactEmail.trim() && defaultContactEmail) {
      contactEmailPrefilledRef.current = true;
      onChange({ contactEmail: defaultContactEmail });
    }
  }, [defaultContactEmail, draft.contactEmail, onChange]);

  useEffect(() => {
    const trimmedAttribution = draft.attribution.trim();
    if (lastAutoAttribution && trimmedAttribution && trimmedAttribution !== lastAutoAttribution) {
      onAutoAttributionChange(undefined);
    }
    if (!trimmedAttribution && lastAutoAttribution) {
      onAutoAttributionChange(undefined);
    }
  }, [draft.attribution, lastAutoAttribution, onAutoAttributionChange]);

  useEffect(() => {
    const artist = draft.artist.trim();
    const title = draft.title.trim();
    if (!artist || !title) {
      return;
    }
    const suggestion = `${artist} — ${title}`;
    const current = draft.attribution.trim();
    if (!current || current === lastAutoAttribution) {
      onChange({ attribution: suggestion });
      onAutoAttributionChange(suggestion);
    }
  }, [draft.artist, draft.title, draft.attribution, lastAutoAttribution, onAutoAttributionChange, onChange]);

  const licenseOptions = useMemo(() => LICENSE_IDS, []);

  const emailInvalid = !isValidEmail(draft.contactEmail);

  const submit = useCallback(async (intent: MetadataModalIntent) => {
    setSubmitted(true);
    if (!draft.title.trim() || !draft.artist.trim() || !draft.licenseId) {
      return;
    }
    await onSave(intent);
  }, [draft, onSave]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && showSaveAndPack) {
        event.preventDefault();
        void submit('save_and_pack');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, showSaveAndPack, submit]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await submit('save');
  };

  const handleOverlayClick = () => {
    onClose();
  };

  const handleDialogClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelId}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm"
      onClick={handleOverlayClick}
    >
      <div
        className="w-full max-w-2xl rounded-lg border border-slate-700 bg-slate-900 p-6 text-slate-100 shadow-xl"
        onClick={handleDialogClick}
      >
        <h2 id={labelId} className="text-lg font-semibold">
          {modalTitle}
        </h2>
        <form className="mt-4 space-y-6" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field
              label={titleLabel}
              value={draft.title}
              onChange={(value) => onChange({ title: value })}
              required
              submitted={submitted}
              requiredHint={requiredHint}
              requiredError={requiredError}
              badgeRequiredLabel={badgeRequiredLabel}
            />
            <Field
              label={artistLabel}
              value={draft.artist}
              onChange={(value) => onChange({ artist: value })}
              required
              submitted={submitted}
              requiredHint={requiredHint}
              requiredError={requiredError}
              badgeRequiredLabel={badgeRequiredLabel}
              recentOptions={recentArtists}
            />
            <LicenseField
              label={licenseLabel}
              value={draft.licenseId}
              onChange={(value) => onChange({ licenseId: value })}
              required
              submitted={submitted}
              requiredHint={requiredHint}
              requiredError={requiredError}
              badgeRequiredLabel={badgeRequiredLabel}
              options={licenseOptions}
            />
            <Field label={albumLabel} value={draft.album} onChange={(value) => onChange({ album: value })} />
            <Field label={bpmLabel} value={draft.bpm} onChange={(value) => onChange({ bpm: value })} />
            <Field label={keyLabel} value={draft.key} onChange={(value) => onChange({ key: value })} />
            <Field
              label={attributionLabel}
              value={draft.attribution}
              onChange={(value) => onChange({ attribution: value })}
            />
            <Field
              label={artistUrlLabel}
              value={draft.artistUrl}
              onChange={(value) => onChange({ artistUrl: value })}
            />
            <Field
              label={contactEmailLabel}
              value={draft.contactEmail}
              onChange={(value) => onChange({ contactEmail: value })}
              invalid={emailInvalid}
              warningMessage={emailWarning}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="remember-artist"
              type="checkbox"
              checked={rememberDefault}
              onChange={(event) => onRememberDefaultChange(event.target.checked)}
              className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-400"
            />
            <label htmlFor="remember-artist" className="text-sm text-slate-200">
              {rememberLabel}
            </label>
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 rounded-md bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
            >
              <MaterialIcon icon="close" />
              {cancelLabel}
            </button>
            {showSaveAndPack ? (
              <button
                type="button"
                onClick={() => void submit('save_and_pack')}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-md bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-400 disabled:opacity-60"
              >
                <MaterialIcon icon="inventory" />
                {saveAndPackLabel}
              </button>
            ) : null}
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 disabled:opacity-60"
            >
              <MaterialIcon icon="save" />
              {saveLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  submitted?: boolean;
  requiredHint?: string;
  requiredError?: string;
  badgeRequiredLabel?: string;
  recentOptions?: string[];
  invalid?: boolean;
  warningMessage?: string;
}

function Field({
  label,
  value,
  onChange,
  required = false,
  submitted = false,
  requiredHint,
  requiredError,
  badgeRequiredLabel,
  recentOptions,
  invalid = false,
  warningMessage
}: FieldProps) {
  const fieldId = useId();
  const hasError = required && submitted && value.trim().length === 0;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={fieldId} className="text-sm font-medium text-slate-200">
        <span className="flex items-center gap-2">
          <span>{label}</span>
          {required ? (
            <span
              className="inline-flex items-center gap-1 text-xs font-semibold text-amber-300"
              title={badgeRequiredLabel}
              aria-label={badgeRequiredLabel}
            >
              <MaterialIcon icon="star" className="text-amber-300" />
              {requiredHint}
            </span>
          ) : null}
        </span>
      </label>
      <input
        id={fieldId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 shadow-inner focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
        required={required}
        list={recentOptions ? `${fieldId}-recent` : undefined}
        aria-invalid={hasError || invalid}
      />
      {recentOptions && recentOptions.length > 0 ? (
        <datalist id={`${fieldId}-recent`}>
          {recentOptions.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      ) : null}
      {hasError && requiredError ? (
        <p className="text-xs text-red-300">{requiredError}</p>
      ) : null}
      {!hasError && invalid && warningMessage ? (
        <p className="flex items-center gap-1 text-xs text-amber-300">
          <MaterialIcon icon="warning" className="text-amber-300" />
          {warningMessage}
        </p>
      ) : null}
    </div>
  );
}

interface LicenseFieldProps {
  label: string;
  value: LicenseId | '';
  onChange: (value: LicenseId) => void;
  required?: boolean;
  submitted?: boolean;
  requiredHint?: string;
  requiredError?: string;
  badgeRequiredLabel?: string;
  options: LicenseId[];
}

function LicenseField({
  label,
  value,
  onChange,
  required = false,
  submitted = false,
  requiredHint,
  requiredError,
  badgeRequiredLabel,
  options
}: LicenseFieldProps) {
  const fieldId = useId();
  const hasError = required && submitted && !value;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={fieldId} className="text-sm font-medium text-slate-200">
        <span className="flex items-center gap-2">
          <span>{label}</span>
          {required ? (
            <span
              className="inline-flex items-center gap-1 text-xs font-semibold text-amber-300"
              title={badgeRequiredLabel}
              aria-label={badgeRequiredLabel}
            >
              <MaterialIcon icon="star" className="text-amber-300" />
              {requiredHint}
            </span>
          ) : null}
        </span>
      </label>
      <select
        id={fieldId}
        value={value}
        onChange={(event) => onChange(event.target.value as LicenseId)}
        className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 shadow-inner focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
        required={required}
        aria-invalid={hasError}
      >
        <option value="" disabled>
          --
        </option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {hasError && requiredError ? <p className="text-xs text-red-300">{requiredError}</p> : null}
    </div>
  );
}
