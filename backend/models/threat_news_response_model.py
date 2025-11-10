# ============================================================
# Threat Feed Models (input)
# ============================================================

from enum import Enum
from typing import List, Optional, Any
from pydantic import BaseModel

class ThreatSeverity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class ThreatFeedItem(BaseModel):
    source: str
    source_link: Optional[str] = None
    threat_information_available: Optional[bool] = None
    threat_severity: Optional[str] = None
    threat_article_url: Optional[str] = None
    threat_article_title: Optional[str] = None
    date_published: Optional[str] = None
    author: Optional[str] = None
    company_targeted: Optional[str] = None
    threat_time_range: Optional[str] = None
    threat_name: Optional[str] = None
    primary_industry_affected: Optional[str] = None
    primary_threat_actor: Optional[str] = None
    threat_actor_group: Optional[str] = None
    threat_actor_ttps: Optional[List[str]] = None
    exploited_tools_techniques: Optional[List[str]] = None
    vulnerabilities_targeted: Optional[List[str]] = None
    immediate_impact: Optional[str] = None
    industries_affected: Optional[List[str]] = None
    regions_or_countries_targeted: Optional[List[str]] = None
    response_actions_taken: Optional[str] = None
    mitigation_measures_recommended: Optional[str] = None
    technical_details: Optional[List[str]] = None
    behavioral_indicators: Optional[List[Any]] = None
    software_exploited: Optional[str] = None
    product_exploited: Optional[str] = None
    software_version_exploited: Optional[str] = None
    indicators_found: Optional[Any] = None
    search_items_for_compromise: Optional[List[Any]] = None
    intelligence_type: Optional[str] = None
    intelligence_type_justification: Optional[str] = None
    mitre_attack_tactics: Optional[List[str]] = None
    mitre_attack_techniques: Optional[Any] = None
    cve_id: Optional[str] = None
    cve_ids: Optional[Any] = None
    affected_products: Optional[Any] = None
    remediated_products: Optional[Any] = None  # Can be string, list, or None
    cpe_and_cwe_information: Optional[Any] = None
    summary_from_llm: Optional[str] = None


class ThreatFeedResponse(BaseModel):
    items: List[ThreatFeedItem]