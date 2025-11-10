import argparse
import json
import os
import pathlib
import hashlib
from datetime import datetime, timedelta, timezone, date
from typing import Any, Dict, List, Optional, Tuple
import sys
import requests
from dotenv import load_dotenv
from pydantic import BaseModel, ValidationError
from google import genai
from google.genai import types
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TimeElapsedColumn
from rich.panel import Panel
from rich.table import Table
from rich import box

# Add the project root to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import models
from models.customer_model import CustomerProfile, RadarOwningTeam
from models.radar_output_model import (
    ThreatIntelRadarResponse,
    RadarThreatPoint,
    ThreatStatus,
    TimeRange,
    ThreatRadarMeta,
)

# Import services
from services.mongo_service import MongoService

# ============================================================
# Helpers
# ============================================================

console = Console()

SURFACE_THETA_BASE: Dict[RadarOwningTeam, float] = {
    RadarOwningTeam.IDENTITY_ACCESS: 0,
    RadarOwningTeam.ENDPOINT_EMAIL: 30,
    RadarOwningTeam.WEB_APPS_API: 60,
    RadarOwningTeam.SUPPLY_CHAIN_DEPENDENCIES: 90,
    RadarOwningTeam.CLOUD_INFRA_K8S: 120,
    RadarOwningTeam.DATA_EXFILTRATION_INSIDER: 150,
    RadarOwningTeam.NETWORK_EDGE_OT: 180,
    RadarOwningTeam.LEGAL_REG_GEO: 210,
    RadarOwningTeam.THIRD_PARTY_VENDOR: 240,
    RadarOwningTeam.GOV_STATE_ACTOR: 270,
    RadarOwningTeam.FRAUD_PAYMENTS_ABUSE: 300,
    RadarOwningTeam.EMERGING_UNKNOWN: 330,
}

def fetch_threats_from_api(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Fetch raw threat data from API and return as a list of threat items.
    """
    url = os.getenv("THREAT_API_URL", "https://threatintel-internal.transilienceapp.com/get_threat_intel")
    api_key = os.getenv("THREAT_API_KEY", "").strip()

    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    with console.status("[bold blue]Fetching threats from API...", spinner="dots"):
        resp = requests.post(url, headers=headers, json=payload, timeout=45)
        resp.raise_for_status()
        data = resp.json()

    # Normalize to list format
    if isinstance(data, list):
        items = data
    elif isinstance(data, dict) and "items" in data:
        items = data["items"]
    else:
        items = [data]
    
    console.print(f"[green]✓[/green] Fetched [bold]{len(items)}[/bold] threat items from API")
    return items


def load_customer_profile(path: str) -> CustomerProfile:
    with open(path, "r", encoding="utf-8") as f:
        doc = json.load(f)
    return CustomerProfile(**doc)


def parse_date_loose(s: Optional[str]) -> date:
    if not s or s == "NA":
        return datetime.now(timezone.utc).date()
    s = s.strip()
    for fmt in ("%Y-%m-%d", "%m-%d-%Y", "%m/%d/%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(s, fmt).date()
        except Exception:
            continue
    try:
        return datetime.fromisoformat(s[:10]).date()
    except Exception:
        return datetime.now(timezone.utc).date()


def build_gemini_system_prompt(now_iso: str) -> str:
    """
    Instruct Gemini to compute theta/radius + scores for a SINGLE threat item.
    """
    return f"""
SYSTEM INSTRUCTIONS — THREAT RADAR SYNTHESIS (as of {now_iso})

You are given:
1) A CustomerProfile JSON file (the environment to protect).
2) A SINGLE ThreatFeedItem JSON (one threat from the feed).

Your task:
- Process this ONE threat and produce a SINGLE RadarThreatPoint (JSON only) that matches the provided Pydantic response schema.
- Compute radar geometry: primary_surface (one of 12 slices), theta_deg, radius_norm.
- Compute:
  - severity (critical/high/medium/low) and severity_score: critical=1.0, high=0.75, medium=0.5, low=0.25
  - relevance_score in [0,1] using the following heuristic:
      For each impacted asset:
        +0.25 if internet_facing
        +0.25 if business_criticality in ['high','mission_critical']
        +0.20 if data_sensitivity == 'high'
        +0.10 if asset is a crown jewel
      Cap asset sum at 0.8
      Org adjustments:
        +0.10 if risk_appetite == 'low'
        +0.10 if threat is server-side and patching_cadence_servers == 'ad_hoc'
        -0.10 if web threat and detection_coverage.web_app == true
      Clamp to [0,1].
  - prioritization_score = 0.6*severity_score + 0.4*relevance_score (clamp [0,1])
  - prioritization_band from score: >=0.8 critical, >=0.6 high, >=0.4 medium, else low
  - radius_norm = 1 - prioritization_score
- Determine impacted assets by matching threat content to products (name, vendor, technology) and any affected_products in the feed.
- Choose primary_surface = owning_team of the most important impacted asset
  (highest business_criticality; tie-breaker: internet_facing; else first).
- Base angles for slices (center angles):
  0: Identity / Access
  30: Endpoint / Email
  60: Web Apps / API
  90: Supply Chain / Dependencies
  120: Cloud / Infra / K8s
  150: Data / Exfiltration / Insider
  180: Network / Edge / OT
  210: Legal / Regulatory / Geo-Political
  240: Third-Party / Vendor Risk
  270: Gov / State-Actor Activity
  300: Fraud / Payments / Abuse
  330: Emerging / Unknown

- theta_deg = base_angle + small deterministic jitter in [-5°, +5°], but keep inside slice bounds
  (slice width 30°, keep at least 4° margin from edges).
- first_seen = normalized date from the threat item (date_published). last_updated = first_seen.
- status: 'new' if first_seen within last 24h of the provided current time; otherwise 'active'.
- Include cve_ids, mitre_tactics, mitre_techniques (best-effort normalization to lists of strings).
- Extract industries_affected from the threat item's 'industries_affected' field (normalize to list of strings, filter out "NA").
- Extract regions_or_countries_targeted from the threat item's 'regions_or_countries_targeted' field (normalize to list of strings, filter out "NA").
- Provide short 'summary' and a list of 'relevance_reasons'.
- Generate a unique 'id' for this threat (e.g., hash of threat_name + date_published).

Important:
- Return ONLY valid JSON for a SINGLE RadarThreatPoint (no Markdown, no comments, no wrapper object).
- If the threat cannot be matched to any asset, use primary_surface 'Emerging / Unknown' and empty assets_impacted list.
"""


def build_customer_markdown(customer: CustomerProfile) -> str:
    """
    Create a markdown file with the CustomerProfile JSON.
    """
    customer_json = json.dumps(json.loads(customer.model_dump_json()), indent=2, ensure_ascii=False)
    return f"""# Customer Profile

```json
{customer_json}
```
"""


def build_threat_markdown(threat_item: Dict[str, Any]) -> str:
    """
    Create a markdown file with a single threat item JSON.
    """
    threat_json = json.dumps(threat_item, indent=2, ensure_ascii=False)
    return f"""# Threat Feed Item

```json
{threat_json}
```
"""

def synthesize_single_threat_gemini(
    customer_md_path: str, 
    threat_md_path: str,
    threat_index: int,
    total_threats: int
) -> Optional[RadarThreatPoint]:
    """
    Calls Gemini with customer profile and a SINGLE threat item,
    requesting a response as a single RadarThreatPoint.
    """
    api_key = os.getenv("GOOGLE_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("GOOGLE_API_KEY not found in environment.")
    client = genai.Client(api_key=api_key)

    customer_filepath = pathlib.Path(customer_md_path)
    threat_filepath = pathlib.Path(threat_md_path)
    now_iso = datetime.now(timezone.utc).isoformat()
    prompt = build_gemini_system_prompt(now_iso)

    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=[
                types.Part.from_bytes(
                    data=customer_filepath.read_bytes(),
                    mime_type="text/md",
                ),
                types.Part.from_bytes(
                    data=threat_filepath.read_bytes(),
                    mime_type="text/md",
                ),
                prompt,
            ],
            config={
                "response_mime_type": "application/json",
                "response_schema": RadarThreatPoint,
            },
        )

        raw = response.text
        point_dict = json.loads(raw)
        return RadarThreatPoint(**point_dict)
    except Exception as e:
        console.print(f"[red]✗[/red] Failed to process threat {threat_index + 1}/{total_threats}: {str(e)}")
        return None

# ============================================================

# Validation & Jitter Fixups (post-Gemini)

# ============================================================

def clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))

def clamp_theta_to_slice(theta: float, surface: RadarOwningTeam, slice_width: float = 30.0, margin: float = 4.0) -> float:
    base = SURFACE_THETA_BASE[surface]
    min_theta = base - (slice_width / 2.0) + margin
    max_theta = base + (slice_width / 2.0) - margin
    return clamp(theta, min_theta, max_theta)

def small_jitter(key: str, max_deg: float = 2.0) -> float:
    """Deterministic tiny jitter for collision resolution."""
    h = hashlib.blake2b(key.encode(), digest_size=2).digest()
    n = int.from_bytes(h, "big") / 65535.0
    return (n - 0.5) * 2 * max_deg  # [-max,+max]

def resolve_collisions(points: List['RadarThreatPoint']) -> None:
    """
    If multiple dots share near-identical (surface, radius, theta), jitter theta slightly within slice.
    """
    # Group by (surface, radius_bucket)
    buckets: Dict[Tuple[str, int], List[int]] = {}
    for i, p in enumerate(points):
        key = (p.primary_surface.value, int(round(p.radius_norm * 100)))  # 1% radius buckets
        buckets.setdefault(key, []).append(i)

    for key, idxs in buckets.items():
        if len(idxs) <= 1:
            continue
        # Sort by theta, then spread
        idxs_sorted = sorted(idxs, key=lambda i: points[i].theta_deg)
        spread_deg = 0.8  # small spread between siblings
        center = sum(points[i].theta_deg for i in idxs_sorted) / len(idxs_sorted)
        start = center - spread_deg * (len(idxs_sorted) - 1) / 2.0
        for j, i in enumerate(idxs_sorted):
            p = points[i]
            desired = start + j * spread_deg
            # add deterministic tiny jitter based on id to avoid perfect alignment
            desired += small_jitter(p.id, max_deg=0.3)
            p.theta_deg = clamp_theta_to_slice(desired, p.primary_surface)

def validate_and_fix_radar(radar: 'ThreatIntelRadarResponse') -> 'ThreatIntelRadarResponse':
    # Clamp per-point radius, theta; ensure theta within its slice
    for p in radar.points:
        p.radius_norm = clamp(p.radius_norm, 0.0, 1.0)
        p.theta_deg = clamp_theta_to_slice(p.theta_deg, p.primary_surface)

    # Resolve overlaps within surface/radius buckets
    resolve_collisions(radar.points)

    # Re-count total
    radar.meta.total_threats = len(radar.points)
    return radar

# ============================================================

# CLI orchestration

# ============================================================

def main():
    # Get the backend root directory (parent of scripts/)
    backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    default_customer = os.path.join(backend_root, "data", "airtel.json")
    default_output_dir = os.path.join(backend_root, "data", "output")
    
    parser = argparse.ArgumentParser(description="Build Threat Intel Radar via Gemini (files upload API).")
    parser.add_argument("--customer", default=default_customer, help=f"Path to CustomerProfile JSON file (default: {default_customer}).")
    parser.add_argument("--out", default=None, help="Path to write final radar JSON (default: data/output/radar_<customer_id>_<timestamp>.json).")
    parser.add_argument("--customer-md", default="./gemini_customer.md", help="Path to write the customer markdown file for Gemini.")
    parser.add_argument("--threat-md-dir", default="./gemini_threats", help="Directory to write individual threat markdown files.")
    parser.add_argument("--api-payload", default=None, help="Optional JSON string to forward to the Threat Intel API POST. If not provided, an empty dict {} will be used.")
    args = parser.parse_args()

    # Print header
    console.print(Panel.fit(
        "[bold cyan]Threat Intelligence Radar Builder[/bold cyan]",
        border_style="cyan",
        box=box.ROUNDED
    ))

    load_dotenv()

    # --- Load Customer
    console.print(f"\n[bold]Loading customer profile...[/bold]")
    customer = load_customer_profile(args.customer)
    console.print(f"[green]✓[/green] Loaded customer: [bold]{customer.name}[/bold] (ID: {customer.id})")

    # --- Fetch Threats
    console.print(f"\n[bold]Fetching threats from API...[/bold]")
    if args.api_payload:
        try:
            payload = json.loads(args.api_payload)
        except Exception as e:
            console.print(f"[red]✗[/red] --api-payload must be valid JSON. Error: {e}")
            raise SystemExit(1)
    else:
        payload = {}

    threat_items = fetch_threats_from_api(payload)

    if not threat_items:
        console.print("[yellow]⚠[/yellow] No threats found. Exiting.")
        return

    # --- Build Customer Markdown
    console.print(f"\n[bold]Preparing customer profile for Gemini...[/bold]")
    customer_md = build_customer_markdown(customer)
    customer_md_path = pathlib.Path(args.customer_md)
    customer_md_path.write_text(customer_md, encoding="utf-8")
    console.print(f"[green]✓[/green] Customer markdown saved: {customer_md_path}")

    # --- Create threat markdown directory
    threat_md_dir = pathlib.Path(args.threat_md_dir)
    threat_md_dir.mkdir(parents=True, exist_ok=True)

    # --- Process each threat individually
    console.print(f"\n[bold]Processing {len(threat_items)} threats with Gemini...[/bold]")
    radar_points: List[RadarThreatPoint] = []
    
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
        TimeElapsedColumn(),
        console=console
    ) as progress:
        task = progress.add_task("[cyan]Processing threats...", total=len(threat_items))
        
        for idx, threat_item in enumerate(threat_items):
            # Build threat markdown
            threat_md = build_threat_markdown(threat_item)
            threat_md_path = threat_md_dir / f"threat_{idx}.md"
            threat_md_path.write_text(threat_md, encoding="utf-8")
            
            # Process with Gemini
            point = synthesize_single_threat_gemini(
                str(customer_md_path),
                str(threat_md_path),
                idx,
                len(threat_items)
            )
            
            if point:
                radar_points.append(point)
                progress.update(task, advance=1, description=f"[cyan]Processed {idx + 1}/{len(threat_items)} threats")
            else:
                progress.update(task, advance=1, description=f"[yellow]Skipped threat {idx + 1}/{len(threat_items)}")

    console.print(f"\n[green]✓[/green] Successfully processed [bold]{len(radar_points)}[/bold] out of {len(threat_items)} threats")

    # --- Combine results into final radar response
    console.print(f"\n[bold]Combining results and validating geometry...[/bold]")
    now = datetime.now(timezone.utc)
    
    radar = ThreatIntelRadarResponse(
        meta=ThreatRadarMeta(
            generated_at=now,
            customer_id=customer.id,
            total_threats=len(radar_points)
        ),
        points=radar_points
    )

    # --- Validate & fix geometric constraints, add collision jitter
    radar = validate_and_fix_radar(radar)
    console.print(f"[green]✓[/green] Geometry validated and collisions resolved")

    # --- Determine output path
    if args.out:
        out_path = pathlib.Path(args.out)
    else:
        output_dir = pathlib.Path(default_output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        
        timestamp = now.strftime("%Y%m%d_%H%M%S")
        filename = f"radar_{customer.id}_{timestamp}.json"
        out_path = output_dir / filename

    # --- Write final JSON
    out_path.parent.mkdir(parents=True, exist_ok=True)
    radar_json = json.loads(radar.model_dump_json())
    out_path.write_text(
        json.dumps(radar_json, indent=2, ensure_ascii=False),
        encoding="utf-8"
    )
    console.print(f"[green]✓[/green] Saved radar JSON to: {out_path}")

    # --- Upsert to MongoDB
    mongo_result = None
    try:
        console.print(f"\n[bold]Upserting radar data to MongoDB...[/bold]")
        with MongoService() as mongo:
            mongo_result = mongo.upsert_radar(radar_json)
            
        if mongo_result and mongo_result.get("success"):
            console.print(f"[green]✓[/green] {mongo_result.get('message')}")
            if mongo_result.get("document_id"):
                console.print(f"[dim]Document ID: {mongo_result.get('document_id')}[/dim]")
        else:
            error_msg = mongo_result.get("message", "Unknown error") if mongo_result else "No result returned"
            console.print(f"[yellow]⚠[/yellow] MongoDB upsert failed: {error_msg}")
    except ValueError as e:
        console.print(f"[yellow]⚠[/yellow] MongoDB not configured: {str(e)}")
        console.print("[dim]Skipping MongoDB upsert. Set MONGO_CONNECTION_STRING, MONGO_DB_NAME, and MONGO_COLLECTION_NAME to enable.[/dim]")
    except Exception as e:
        console.print(f"[red]✗[/red] MongoDB upsert error: {str(e)}")

    # --- Print summary
    console.print()
    summary_text = f"[bold green]✓ Radar Built Successfully[/bold green]\n\n"
    summary_text += f"[cyan]Points:[/cyan] {radar.meta.total_threats}\n"
    summary_text += f"[cyan]Output:[/cyan] {out_path}\n"
    summary_text += f"[cyan]Customer:[/cyan] {customer.name}"
    if mongo_result and mongo_result.get("success"):
        summary_text += f"\n[cyan]MongoDB:[/cyan] {mongo_result.get('operation', 'upserted').title()}"
    
    console.print(Panel.fit(
        summary_text,
        border_style="green",
        box=box.ROUNDED
    ))

if __name__ == "__main__":
    main()

