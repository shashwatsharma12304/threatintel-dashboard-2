// MongoDB schema-compatible types
export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low';
export type StatusType = 'new' | 'active' | 'mitigated';

// Quadrant-based radar types
export type AttackStage = 'pre' | 'post';
export type DefenderFunction = 'protect' | 'detect_respond';
export type QuadrantType = 'pre_protect' | 'pre_detect' | 'post_protect' | 'post_detect';

// MITRE tactics categorized by attack stage
export const PRE_COMPROMISE_TACTICS = [
  'reconnaissance',
  'resource development',
  'initial access',
  'execution',
  'tactic for reconnaissance',
  'tactic for resource development',
  'tactic for initial access',
  'tactic for execution',
];

export const POST_COMPROMISE_TACTICS = [
  'persistence',
  'privilege escalation',
  'defense evasion',
  'credential access',
  'discovery',
  'lateral movement',
  'collection',
  'command and control',
  'exfiltration',
  'impact',
  'c2',
  'tactic for persistence',
  'tactic for privilege escalation',
  'tactic for defense evasion',
  'tactic for credential access',
  'tactic for discovery',
  'tactic for lateral movement',
  'tactic for collection',
  'tactic for command and control',
  'tactic for exfiltration',
  'tactic for impact',
];

// Quadrant descriptions for UI labels
export const QUADRANT_INFO: Record<QuadrantType, { title: string; description: string }> = {
  pre_protect: {
    title: 'Pre × Protect',
    description: 'Patch, harden, WAF rules, secure config, attack-surface reduction',
  },
  pre_detect: {
    title: 'Pre × Detect/Respond',
    description: 'Early-warning detections, hunts, canary/telemetry uplift',
  },
  post_protect: {
    title: 'Post × Protect',
    description: 'Eradication, durable fixes, close root cause',
  },
  post_detect: {
    title: 'Post × Detect/Respond',
    description: 'Live IR: contain, comms, forensics, recovery',
  },
};

export interface RadarThreatAsset {
  product_id: string;
  product_name: string;
  owning_team: string;
  is_crown_jewel: boolean;
  internet_facing: boolean;
  data_sensitivity: 'low' | 'medium' | 'high';
}

export interface Threat {
  // MongoDB RadarThreatPoint schema
  id: string;
  threat_name: string;
  title: string;
  severity: SeverityLevel;
  status: StatusType;
  severity_score: number;
  relevance_score: number;
  prioritization_score: number;
  prioritization_band: 'critical' | 'high' | 'medium' | 'low';
  primary_surface: string;
  theta_deg: number;
  radius_norm: number;
  assets_impacted: RadarThreatAsset[];
  cve_ids: string[];
  mitre_tactics: string[];
  mitre_techniques: string[];
  source: string;
  source_link: string;
  first_seen: string;
  last_updated: string;
  summary: string;
  relevance_reasons: string[];
  industries_affected: string[];
  regions_or_countries_targeted: string[];
}

export interface FilterState {
  search: string;
  severity: SeverityLevel[];  // Now lowercase: 'critical', 'high', etc.
  assets: string[];
  sources: string[];
  statuses: StatusType[];  // Now lowercase: 'new', 'active', 'mitigated'
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

// Utility functions for quadrant mapping
export function getAttackStage(mitreTactics: string[]): AttackStage {
  if (!mitreTactics || mitreTactics.length === 0) {
    // Default to 'pre' if no tactics specified
    return 'pre';
  }
  
  const normalizedTactics = mitreTactics.map(t => t.toLowerCase());
  
  // Check if any post-compromise tactics are present
  // Handle both "Tactic for X" format and direct tactic names
  const hasPostTactic = normalizedTactics.some(tactic => {
    return POST_COMPROMISE_TACTICS.some(postTactic => {
      // Check if tactic contains the post-compromise keyword
      return tactic.includes(postTactic.toLowerCase());
    });
  });
  
  if (hasPostTactic) {
    return 'post';
  }
  
  // Check if any pre-compromise tactics are present
  const hasPreTactic = normalizedTactics.some(tactic => {
    return PRE_COMPROMISE_TACTICS.some(preTactic => {
      // Check if tactic contains the pre-compromise keyword
      return tactic.includes(preTactic.toLowerCase());
    });
  });
  
  return hasPreTactic ? 'pre' : 'pre'; // Default to pre
}

export function getDefenderFunction(status: StatusType, threatId?: string): DefenderFunction {
  // Mitigated threats = Protect (preventive work done)
  // New/Active threats = Detect/Respond (requires monitoring/IR)
  
  // If status is mitigated, always return protect
  if (status === 'mitigated') {
    return 'protect';
  }
  
  // For new/active threats, distribute them between Protect and Detect/Respond
  // This ensures we have threats in all quadrants even if no threats are mitigated
  // Use threat ID hash to deterministically assign
  if (threatId) {
    let hash = 0;
    for (let i = 0; i < threatId.length; i++) {
      hash = ((hash << 5) - hash) + threatId.charCodeAt(i);
      hash = hash & hash;
    }
    // Assign ~40% to Protect, 60% to Detect/Respond
    return Math.abs(hash % 10) < 4 ? 'protect' : 'detect_respond';
  }
  
  return 'detect_respond';
}

export function getQuadrant(threat: Threat): QuadrantType {
  const stage = getAttackStage(threat.mitre_tactics);
  const defenderFn = getDefenderFunction(threat.status, threat.id);
  
  if (stage === 'pre' && defenderFn === 'protect') return 'pre_protect';
  if (stage === 'pre' && defenderFn === 'detect_respond') return 'pre_detect';
  if (stage === 'post' && defenderFn === 'protect') return 'post_protect';
  return 'post_detect';
}
