export type SeverityLevel = 'Critical' | 'High' | 'Medium' | 'Low';
export type StatusType = 'New' | 'Active' | 'Mitigated';

export interface IOC {
  type: string;
  value: string;
  first_seen?: string;
  last_seen?: string;
}

export interface Geo {
  lat: number;
  lon: number;
}

export interface Threat {
  id: string;
  name: string;
  asset: string;
  severity: SeverityLevel;
  status: StatusType;
  first_seen: string;
  last_updated: string;
  score?: number;
  description: string;
  source: string;
  cves?: string[];
  kill_chain_phase?: string;
  iocs?: IOC[];
  geo?: Geo;
  recommended_actions?: string[];
  affected_versions?: string[];
  confidence?: string;
}

export interface FilterState {
  search: string;
  severity: SeverityLevel[];
  assets: string[];
  sources: string[];
  statuses: StatusType[];
  tags: string[];
  timeRange: 'last24h' | 'last7d' | 'last30d' | 'custom';
}

export interface KpiData {
  active: number;
  critical: number;
  high: number;
  newLast24h: number;
  assetsImpacted: number;
}

export interface ActivityDataPoint {
  date: string;
  Critical: number;
  High: number;
  Medium: number;
  Low: number;
}

export interface AssetImpact {
  asset: string;
  count: number;
}
