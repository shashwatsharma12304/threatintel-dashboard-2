from enum import Enum
from typing import List, Literal
from pydantic import BaseModel, Field


class RadarOwningTeam(str, Enum):
    """Teams / responsibility surfaces that map 1:1 to the 12 radar slices."""
    IDENTITY_ACCESS = "Identity / Access"                        # 0°
    ENDPOINT_EMAIL = "Endpoint / Email"                          # 30°
    WEB_APPS_API = "Web Apps / API"                              # 60°
    SUPPLY_CHAIN_DEPENDENCIES = "Supply Chain / Dependencies"    # 90°
    CLOUD_INFRA_K8S = "Cloud / Infra / K8s"                      # 120°
    DATA_EXFILTRATION_INSIDER = "Data / Exfiltration / Insider"  # 150°
    NETWORK_EDGE_OT = "Network / Edge / OT"                      # 180°
    LEGAL_REG_GEO = "Legal / Regulatory / Geo-Political"         # 210°
    THIRD_PARTY_VENDOR = "Third-Party / Vendor Risk"             # 240°
    GOV_STATE_ACTOR = "Gov / State-Actor Activity"               # 270°
    FRAUD_PAYMENTS_ABUSE = "Fraud / Payments / Abuse"            # 300°
    EMERGING_UNKNOWN = "Emerging / Unknown"                      # 330°


class EnvironmentTier(str, Enum):
    """Deployment environment tier for a product."""
    PROD = "prod"
    STAGING = "staging"
    DEV = "dev"
    POC = "poc"


class NetworkZone(str, Enum):
    """Network exposure level for an asset."""
    PUBLIC_INTERNET = "public_internet"
    DMZ = "dmz"
    INTERNAL = "internal"
    RESTRICTED = "restricted"


class LoggingCoverageLevel(str, Enum):
    """How well this asset is logged/monitored."""
    NONE = "none"
    MINIMAL = "minimal"
    MODERATE = "moderate"
    GOOD = "good"
    EXCELLENT = "excellent"


class HostingType(str, Enum):
    """How the product is hosted / delivered."""
    ON_PREM = "OnPrem"
    IAAS = "IaaS"
    PAAS = "PaaS"
    SAAS = "SaaS"
    HYBRID = "Hybrid"


class CustomerProduct(BaseModel):
    """A single product / asset that should appear on the radar when targeted."""

    id: str = Field(
        ...,
        description="Stable internal identifier for this product/asset, e.g. 'prod-web-01'.",
    )
    name: str = Field(
        ...,
        description="Human-readable name for the product/asset, e.g. 'Public Careers Portal'.",
    )
    vendor: str = Field(
        ...,
        description="Vendor or platform name, e.g. 'Microsoft', 'WordPress', 'Redis'.",
    )
    technology: str = Field(
        ...,
        description=(
            "Product or technology label as it will appear in advisories, "
            "e.g. 'WordPress JobMonster theme', 'Windows Server Update Services (WSUS)'."
        ),
    )
    category: Literal[
        "WebApp",
        "API",
        "Server",
        "Endpoint",
        "Mobile",
        "CloudService",
        "Identity",
        "Email",
        "Network",
        "Database",
        "ICS_OT",
        "Other",
    ] = Field(
        ...,
        description="High-level technical category of this product (used for filtering and analytics).",
    )
    owning_team: RadarOwningTeam = Field(
        ...,
        description=(
            "Primary team / responsibility surface for incidents on this product. "
            "Must map to one of the 12 radar slices (e.g. 'Web Apps / API', 'Endpoint / Email')."
        ),
    )
    environment: EnvironmentTier = Field(
        ...,
        description="Deployment environment for this asset, e.g. 'prod', 'staging', 'dev', 'poc'.",
    )
    hosting_type: HostingType = Field(
        ...,
        description=(
            "How this product is hosted / delivered: OnPrem, IaaS, PaaS, SaaS or Hybrid. "
            "Helps decide exposure and patching control."
        ),
    )
    internet_facing: bool = Field(
        ...,
        description="True if this asset is reachable from the public internet.",
    )
    network_zone: NetworkZone = Field(
        ...,
        description=(
            "Network zone where this asset lives (public_internet, dmz, internal, restricted). "
            "Used to assess likelihood of external exploitation."
        ),
    )
    has_waf_or_reverse_proxy: bool = Field(
        ...,
        description="True if this asset is fronted by a WAF or reverse proxy with security rules enabled.",
    )
    has_strict_auth: bool = Field(
        ...,
        description=(
            "True if strong authentication is enforced (SSO/MFA/service accounts) "
            "for access to this asset."
        ),
    )
    business_criticality: Literal["low", "medium", "high", "mission_critical"] = Field(
        ...,
        description=(
            "Business impact if this asset is compromised. "
            "Used as a main factor in the prioritization score."
        ),
    )
    data_sensitivity: Literal["low", "medium", "high"] = Field(
        ...,
        description=(
            "Sensitivity of data processed/stored by this asset, e.g. PII/financial data => 'high'. "
            "Drives impact weighting for relevance scoring."
        ),
    )
    logging_coverage: LoggingCoverageLevel = Field(
        ...,
        description=(
            "How well activity on this asset is logged and monitored. "
            "Lower coverage increases risk because detection is harder."
        ),
    )
    tags: List[str] = Field(
        ...,
        description=(
            "Free-form labels for extra context, e.g. ['PII', 'payments', 'customer-facing', 'redis', 'legacy']."
        ),
    )


class DetectionCoverage(BaseModel):
    """Layered visibility of the environment, used to adjust detection likelihood."""

    endpoint: bool = Field(
        ...,
        description="Endpoint detection/response coverage for servers and user endpoints.",
    )
    email: bool = Field(
        ...,
        description="Detection controls on email (phishing, malicious attachments, etc.).",
    )
    identity: bool = Field(
        ...,
        description="Detection around identity (impossible travel, MFA fatigue, risky sign-ins, etc.).",
    )
    network: bool = Field(
        ...,
        description="Network security monitoring / NDR on key segments.",
    )
    cloud: bool = Field(
        ...,
        description="Cloud-native detections on major cloud providers (CloudTrail, Defender for Cloud, etc.).",
    )
    web_app: bool = Field(
        ...,
        description="WAF, RASP or application security logging for major web apps/APIs.",
    )
    ics_ot: bool = Field(
        ...,
        description="Any dedicated monitoring for ICS/OT environments, if applicable.",
    )


class RiskAppetite(str, Enum):
    """How aggressively the org is willing to accept risk."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class TimeToDetectBucket(str, Enum):
    """Coarse bucket for mean time to detect (MTTD)."""
    UNKNOWN = "unknown"
    MORE_THAN_7D = ">7d"
    BETWEEN_2_AND_7D = "2-7d"
    LESS_THAN_48H = "<48h"
    LESS_THAN_4H = "<4h"


class TimeToRespondBucket(str, Enum):
    """Coarse bucket for mean time to respond (MTTR)."""
    UNKNOWN = "unknown"
    MORE_THAN_7D = ">7d"
    BETWEEN_2_AND_7D = "2-7d"
    LESS_THAN_48H = "<48h"
    LESS_THAN_4H = "<4h"


class SecurityOperationsContext(BaseModel):
    """How mature the customer's detection & response capabilities are."""

    soc_model: Literal["none", "partial", "8x5", "24x7"] = Field(
        ...,
        description=(
            "Level of SOC coverage: 'none' (no dedicated SOC), 'partial' (on-call only), "
            "'8x5' (business hours), or '24x7' (around-the-clock)."
        ),
    )
    team_size: int = Field(
        ...,
        description="Approximate number of people in security operations (SOC + blue team).",
    )
    risk_appetite: RiskAppetite = Field(
        ...,
        description=(
            "Qualitative risk appetite of the organization: low, medium, or high. "
            "Low appetite means threats get higher prioritization for the same severity."
        ),
    )
    mean_time_to_detect: TimeToDetectBucket = Field(
        ...,
        description="Approximate mean time to detect incidents in this environment.",
    )
    mean_time_to_respond: TimeToRespondBucket = Field(
        ...,
        description="Approximate mean time to respond/contain incidents.",
    )
    has_ir_runbooks: bool = Field(
        ...,
        description="True if formal incident response runbooks/playbooks exist and are used.",
    )
    has_threat_hunting: bool = Field(
        ...,
        description="True if proactive threat hunting is performed regularly.",
    )
    has_ti_platform: bool = Field(
        ...,
        description="True if the customer already uses a dedicated Threat Intelligence platform or feeds.",
    )
    edr_products: List[str] = Field(
        ...,
        description="Endpoint/Extended Detection & Response tools deployed, e.g. ['Defender for Endpoint', 'CrowdStrike'].",
    )
    siem_products: List[str] = Field(
        ...,
        description="SIEM / log analytics platforms in use, e.g. ['Splunk Cloud', 'Elastic Security'].",
    )
    email_security: List[str] = Field(
        ...,
        description="Email security solutions, e.g. ['M365 Defender', 'Proofpoint'].",
    )
    vulnerability_mgmt: List[str] = Field(
        ...,
        description="Vulnerability management / scanning tools, e.g. ['Qualys', 'Tenable', 'Nessus'].",
    )
    patching_cadence_servers: Literal["ad_hoc", "monthly", "weekly"] = Field(
        ...,
        description="Typical patch deployment frequency for servers.",
    )
    patching_cadence_endpoints: Literal["ad_hoc", "monthly", "weekly"] = Field(
        ...,
        description="Typical patch deployment frequency for endpoints / user devices.",
    )
    has_mfa_everywhere: bool = Field(
        ...,
        description="True if MFA is enforced for most users and all privileged/admin accounts.",
    )
    has_ews_or_wsus_internet_exposed: bool = Field(
        ...,
        description=(
            "True if WSUS, Exchange Web Services, or similar management services are exposed "
            "directly to the internet (increases risk for certain CVEs)."
        ),
    )
    detection_coverage: DetectionCoverage = Field(
        ...,
        description="Layered view of where the org actually has detection/monitoring in place.",
    )
    notes: str = Field(
        ...,
        description="Free-text notes about security operations maturity, gaps, or constraints.",
    )


class ThirdPartyProvider(BaseModel):
    """Key third-party or SaaS platform that is critical to the customer's operations."""

    name: str = Field(
        ...,
        description="Name of the third-party provider, e.g. 'Okta', 'Salesforce', 'Stripe'.",
    )
    service_type: str = Field(
        ...,
        description="Type of service provided, e.g. 'IdP', 'CRM', 'Payments', 'HRIS'.",
    )
    criticality: Literal["low", "medium", "high", "mission_critical"] = Field(
        ...,
        description="Business criticality of this third-party to the organization.",
    )


class CustomerProfile(BaseModel):
    """Core onboarding profile for a customer/tenant used to personalize the radar."""

    id: str = Field(
        ...,
        description="Stable internal identifier for the customer/tenant, e.g. 'cust-123'.",
    )
    name: str = Field(
        ...,
        description="Official customer name as shown in UI and reports, e.g. 'JobBridge Talent Cloud'.",
    )
    sector: Literal[
        "SaaS",
        "Ecommerce",
        "FinancialServices",
        "Healthcare",
        "Government",
        "Education",
        "Manufacturing",
        "Energy",
        "Telecom",
        "Transportation",
        "Media",
        "Other",
    ] = Field(
        ...,
        description="Primary business sector of the customer.",
    )
    sub_sector: str = Field(
        ...,
        description="More specific industry niche, e.g. 'Online Job Marketplace', 'Digital Banking'.",
    )
    regions: List[str] = Field(
        ...,
        description="Regions/countries where the customer operates or is regulated, e.g. ['US', 'EU'].",
    )
    employee_count: int = Field(
        ...,
        description="Approximate number of employees; used as a size / complexity indicator.",
    )
    cloud_providers: List[str] = Field(
        ...,
        description="Cloud providers used by the customer, e.g. ['AWS', 'Azure', 'GCP'].",
    )
    regulatory_env: List[str] = Field(
        ...,
        description="Key regulatory/compliance regimes, e.g. ['GDPR', 'PCI-DSS', 'HIPAA'].",
    )
    critical_business_services: List[str] = Field(
        ...,
        description=(
            "Plain-language descriptions of the top business services that must stay up, "
            "e.g. ['Candidate application portal', 'Payment processing', 'Care delivery systems']."
        ),
    )
    crown_jewel_products: List[str] = Field(
        ...,
        description=(
            "List of product IDs from 'products' that are considered crown jewels. "
            "Threats impacting these get additional relevance weight."
        ),
    )
    products: List[CustomerProduct] = Field(
        ...,
        description="List of key products/assets to be monitored and shown on the Threat Intelligence Radar.",
    )
    third_party_providers: List[ThirdPartyProvider] = Field(
        ...,
        description="Key external platforms and third parties that are critical to operations.",
    )
    security_ops: SecurityOperationsContext = Field(
        ...,
        description="Summary of the customer's security operations maturity and tooling.",
    )
