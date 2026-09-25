// Shapes of the three JSON files the Python ETL writes to public/data/.

export type Direction = "higher" | "lower" | "neutral";
export type EntryStatus = "ok" | "no_data" | "not_applicable" | "source_error" | "pending";

export interface Source {
  label: string;
  url?: string;
  proxy?: boolean;
  proxyNote?: string;
}

export interface Indicator {
  id: string;
  pillar: string;
  domain: string;
  concept?: string;
  /** the report's exact wording */
  name: string;
  /** short label shown on the tile */
  label: string;
  explanation: string;
  unit: string;
  unitShort?: string;
  decimals: number;
  direction: Direction;
  tier: string;
  sdg?: string;
  scale?: [number, number];
  tags?: string[];
  limitations: string;
  why?: string;
  secondary?: string;
  hidden?: boolean;
  sources: Source[];
}

export interface Domain {
  id: string;
  name: string;
  why: string;
}

export interface Pillar {
  id: string;
  name: string;
  summary?: string;
  justification: string;
  ref: string;
  domains: Domain[];
}

export interface Tag {
  id: string;
  label: string;
  icon: string;
  short: string;
  long: string;
  auto?: boolean;
}

export interface Country {
  iso3: string;
  name: string;
  income?: string | null;
  incomeLabel?: string | null;
  region?: string | null;
}

export interface Registry {
  framework: {
    report: { title: string; publisher: string; year: number; url: string };
    pillars: Pillar[];
    notIncluded: { name: string; text: string; ref: string }[];
  };
  tags: Tag[];
  indicators: Indicator[];
  countries: Country[];
  defaultCountry?: string | null;
  defaultCompare?: string | null;
  outdatedAfterYears: number;
}

export interface PointMeta {
  /** source flag, e.g. "E" for estimate */
  n?: string;
  lo?: number;
  hi?: number;
}
export type Point = [year: number, value: number, meta?: PointMeta];

export interface Latest {
  year: number;
  value: number;
  nature?: string;
  lo?: number;
  hi?: number;
}

export interface Entry {
  status: EntryStatus;
  src?: number;
  proxy?: boolean;
  latest?: Latest;
  series?: Point[];
  tags?: string[];
  notes?: string[];
  meta?: { welfare?: string; [k: string]: unknown };
  stale?: { since: string; reason?: string };
}

export type OkEntry = Entry & { status: "ok"; latest: Latest; src: number };

export interface Dashboard {
  dataHash?: string;
  lastChanged?: string;
  demo?: boolean;
  values: Record<string, Record<string, Entry>>;
}

export interface SourceStatus {
  key: string;
  provider: string;
  label: string;
  url?: string;
  status: "ok" | "error" | "disabled";
  error: string | null;
  optional: boolean;
  indicators: string[];
  countries: string[];
  lastSuccess: string | null;
  consecutiveFailures: number;
}

export interface Status {
  lastChecked?: string;
  lastChanged?: string;
  sources: SourceStatus[];
}
