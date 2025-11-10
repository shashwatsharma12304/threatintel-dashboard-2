"""
Main Orchestrator Script
Coordinates API call, radar chart generation, activity chart generation, assets chart generation,
and MongoDB upsertion.
"""
import argparse
import json
import os
import pathlib
import sys
from datetime import datetime, timezone
from typing import Dict, Any, List
from dotenv import load_dotenv
from rich.console import Console
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TimeElapsedColumn
from rich import box

# Add the project root to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import chart generators
from scripts.activity_chart_script import generate_activity_chart
from scripts.assets_chart_script import generate_assets_chart_from_radar

# Import radar chart functions
from scripts.main import (
    fetch_threats_from_api,
    load_customer_profile,
    build_customer_markdown,
    build_threat_markdown,
    synthesize_single_threat_gemini,
    validate_and_fix_radar,
)

# Import models
from models.customer_model import CustomerProfile
from models.radar_output_model import (
    ThreatIntelRadarResponse,
    ThreatRadarMeta,
)
from models.activity_chart_model import ActivityDataPoint
from models.assets_chart_model import AssetImpact

# Import services
from services.mongo_service import MongoService

console = Console()


def generate_radar_chart(
    customer: CustomerProfile,
    threat_items: List[Dict[str, Any]],
    customer_md_path: str,
    threat_md_dir: str
) -> List[Any]:
    """
    Generate radar chart data by processing threats with Gemini.
    
    Returns:
        List of RadarThreatPoint objects
    """
    # Build customer markdown
    customer_md = build_customer_markdown(customer)
    customer_md_path_obj = pathlib.Path(customer_md_path)
    customer_md_path_obj.parent.mkdir(parents=True, exist_ok=True)
    customer_md_path_obj.write_text(customer_md, encoding="utf-8")
    
    # Create threat markdown directory
    threat_md_dir_obj = pathlib.Path(threat_md_dir)
    threat_md_dir_obj.mkdir(parents=True, exist_ok=True)
    
    # Process each threat individually
    console.print(f"\n[bold]Processing {len(threat_items)} threats with Gemini for radar chart...[/bold]")
    radar_points = []
    
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
            threat_md_path = threat_md_dir_obj / f"threat_{idx}.md"
            threat_md_path.write_text(threat_md, encoding="utf-8")
            
            # Process with Gemini
            point = synthesize_single_threat_gemini(
                str(customer_md_path_obj),
                str(threat_md_path),
                idx,
                len(threat_items)
            )
            
            if point:
                radar_points.append(point)
                progress.update(task, advance=1, description=f"[cyan]Processed {idx + 1}/{len(threat_items)} threats")
            else:
                progress.update(task, advance=1, description=f"[yellow]Skipped threat {idx + 1}/{len(threat_items)}")
    
    console.print(f"[green]✓[/green] Successfully processed [bold]{len(radar_points)}[/bold] out of {len(threat_items)} threats")
    
    # Clean up temporary markdown files after processing
    console.print(f"\n[bold]Cleaning up temporary files...[/bold]")
    try:
        if customer_md_path_obj.exists():
            customer_md_path_obj.unlink()
            console.print(f"[dim]Removed: {customer_md_path_obj}[/dim]")
        
        # Remove all threat markdown files
        if threat_md_dir_obj.exists():
            threat_files = list(threat_md_dir_obj.glob("threat_*.md"))
            for threat_file in threat_files:
                threat_file.unlink()
            if threat_files:
                console.print(f"[dim]Removed {len(threat_files)} threat markdown files[/dim]")
            
            # Remove the directory if empty
            try:
                threat_md_dir_obj.rmdir()
                console.print(f"[dim]Removed directory: {threat_md_dir_obj}[/dim]")
            except OSError:
                pass  # Directory not empty or doesn't exist
        
        console.print(f"[green]✓[/green] Cleanup complete")
    except Exception as e:
        console.print(f"[yellow]⚠[/yellow] Error during cleanup: {str(e)}")
    
    return radar_points


def main():
    """Main orchestrator function."""
    # Get the backend root directory
    backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    default_customer = os.path.join(backend_root, "data", "airtel.json")
    default_output_dir = os.path.join(backend_root, "data", "output")
    
    parser = argparse.ArgumentParser(description="Orchestrate threat intelligence processing: API -> Radar + Charts -> MongoDB")
    parser.add_argument("--customer", default=default_customer, help=f"Path to CustomerProfile JSON file (default: {default_customer}).")
    parser.add_argument("--out", default=None, help="Path to write final radar JSON (default: data/output/radar_<customer_id>_<timestamp>.json).")
    parser.add_argument("--api-payload", default=None, help="Optional JSON string to forward to the Threat Intel API POST. If not provided, an empty dict {} will be used.")
    args = parser.parse_args()
    
    # Print header
    console.print(Panel.fit(
        "[bold cyan]Threat Intelligence Orchestrator[/bold cyan]",
        border_style="cyan",
        box=box.ROUNDED
    ))
    
    load_dotenv()
    
    # Step 1: Load Customer
    console.print(f"\n[bold]Step 1: Loading customer profile...[/bold]")
    customer = load_customer_profile(args.customer)
    console.print(f"[green]✓[/green] Loaded customer: [bold]{customer.name}[/bold] (ID: {customer.id})")
    
    # Step 2: Fetch Threats from API
    console.print(f"\n[bold]Step 2: Fetching threats from API...[/bold]")
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
    
    # Step 3: Generate Activity Chart
    console.print(f"\n[bold]Step 3: Generating activity chart data...[/bold]")
    console.print("[dim]Using 'threat_severity' field from API response[/dim]")
    activity_data = generate_activity_chart(threat_items)
    activity_data_points = [ActivityDataPoint(**d) for d in activity_data]
    console.print(f"[green]✓[/green] Generated [bold]{len(activity_data_points)}[/bold] activity data points")
    
    # Step 4: Generate Radar Chart (must be done before assets chart)
    console.print(f"\n[bold]Step 4: Generating radar chart data...[/bold]")
    customer_md_path = os.path.join(backend_root, "gemini_customer.md")
    threat_md_dir = os.path.join(backend_root, "gemini_threats")
    
    radar_points = generate_radar_chart(
        customer,
        threat_items,
        customer_md_path,
        threat_md_dir
    )
    
    if not radar_points:
        console.print("[yellow]⚠[/yellow] No radar points generated. Exiting.")
        return
    
    # Step 5: Generate Assets Chart from Radar Output
    console.print(f"\n[bold]Step 5: Generating assets chart data from radar output...[/bold]")
    console.print("[dim]Using 'assets_impacted' from radar chart points (company product names)[/dim]")
    assets_data = generate_assets_chart_from_radar(radar_points)
    assets_impacts = [AssetImpact(**d) for d in assets_data]
    console.print(f"[green]✓[/green] Generated [bold]{len(assets_impacts)}[/bold] asset entries")
    
    # Step 6: Combine all results
    console.print(f"\n[bold]Step 6: Combining results and validating...[/bold]")
    now = datetime.now(timezone.utc)
    
    radar = ThreatIntelRadarResponse(
        meta=ThreatRadarMeta(
            generated_at=now,
            customer_id=customer.id,
            total_threats=len(radar_points)
        ),
        points=radar_points
    )
    
    # Validate & fix geometric constraints
    radar = validate_and_fix_radar(radar)
    console.print(f"[green]✓[/green] Geometry validated and collisions resolved")
    
    # Step 7: Combine all outputs into final JSON
    console.print(f"\n[bold]Step 7: Combining all outputs...[/bold]")
    radar_json = json.loads(radar.model_dump_json())
    
    # Add chart data to the final output
    radar_json["activity_chart"] = [dp.model_dump() for dp in activity_data_points] if activity_data_points else []
    radar_json["assets_chart"] = [ai.model_dump() for ai in assets_impacts] if assets_impacts else []
    
    # Step 8: Determine output path
    if args.out:
        out_path = pathlib.Path(args.out)
    else:
        output_dir = pathlib.Path(default_output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        
        timestamp = now.strftime("%Y%m%d_%H%M%S")
        filename = f"radar_{customer.id}_{timestamp}.json"
        out_path = output_dir / filename
    
    # Step 9: Write final JSON
    console.print(f"\n[bold]Step 9: Saving output to file...[/bold]")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(
        json.dumps(radar_json, indent=2, ensure_ascii=False),
        encoding="utf-8"
    )
    console.print(f"[green]✓[/green] Saved radar JSON to: {out_path}")
    
    # Step 10: Upsert to MongoDB
    console.print(f"\n[bold]Step 9: Upserting to MongoDB...[/bold]")
    mongo_result = None
    try:
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
    
    # Print final summary
    console.print()
    summary_text = f"[bold green]✓ Processing Complete[/bold green]\n\n"
    summary_text += f"[cyan]Radar Points:[/cyan] {radar.meta.total_threats}\n"
    summary_text += f"[cyan]Activity Data Points:[/cyan] {len(activity_data_points)}\n"
    summary_text += f"[cyan]Asset Entries:[/cyan] {len(assets_impacts)}\n"
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

