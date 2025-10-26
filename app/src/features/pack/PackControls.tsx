import { MaterialIcon } from '../../components/icons/MaterialIcon';
import { MetadataButton } from '../../components/MetadataButton';
import type { PackMethod } from '@common/ipc';

interface PackControlsProps {
  canPack: boolean;
  isPacking: boolean;
  packLabel: string;
  onPack: () => void;
  onExit: () => void;
  exitLabel: string;
  infoLabel: string;
  onShowInfo?: () => void;
  metadataLabel: string;
  metadataBadgeLabel: string;
  showMetadataBadge: boolean;
  metadataDisabled: boolean;
  onShowMetadata?: () => void;
  devMode: boolean;
  onCreateTestData?: () => void;
  createTestDataLabel: string;
  packMethod: PackMethod;
  packMethodLabel: string;
  packMethodOptions: Array<{ value: PackMethod; label: string }>;
  onPackMethodChange: (method: PackMethod) => void;
}

export function PackControls({
  canPack,
  isPacking,
  packLabel,
  onPack,
  onExit,
  exitLabel,
  infoLabel,
  onShowInfo,
  metadataLabel,
  metadataBadgeLabel,
  showMetadataBadge,
  metadataDisabled,
  onShowMetadata,
  devMode,
  onCreateTestData,
  createTestDataLabel,
  packMethod,
  packMethodLabel,
  packMethodOptions,
  onPackMethodChange
}: PackControlsProps) {
  return (
    <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPack}
            disabled={!canPack || isPacking}
            className="btn btn-success focus-visible:ring-offset-slate-950"
            aria-label={packLabel}
          >
            <MaterialIcon icon="inventory_2" />
            {isPacking ? `${packLabel}…` : packLabel}
          </button>
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <span className="font-medium">{packMethodLabel}</span>
            <select
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
              value={packMethod}
              onChange={(event) => onPackMethodChange(event.target.value as PackMethod)}
            >
              {packMethodOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {onShowMetadata ? (
            <MetadataButton
              onClick={onShowMetadata}
              label={metadataLabel}
              badgeLabel={metadataBadgeLabel}
              showBadge={showMetadataBadge}
              disabled={metadataDisabled}
            />
          ) : null}
          {onShowInfo ? (
            <button
              type="button"
              onClick={onShowInfo}
              className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 shadow transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
              aria-label={infoLabel}
              title={infoLabel}
            >
              <MaterialIcon icon="info" />
              <span>{infoLabel}</span>
            </button>
          ) : null}
        </div>
        {devMode && onCreateTestData ? (
          <button
            type="button"
            onClick={onCreateTestData}
            className="inline-flex items-center gap-2 rounded-md border border-amber-400/60 bg-amber-500/20 px-4 py-2 text-sm font-semibold text-amber-200 transition hover:bg-amber-500/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
          >
            <MaterialIcon icon="science" />
            {createTestDataLabel}
          </button>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onExit}
        className="inline-flex items-center gap-2 rounded-md bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
      >
        <MaterialIcon icon="logout" />
        {exitLabel}
      </button>
    </div>
  );
}
