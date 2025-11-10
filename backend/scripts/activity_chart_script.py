"""
Activity Chart Script
Generates activity chart data (severity over time) from raw API threat data.
"""
import json
from datetime import datetime, date
from typing import List, Dict, Any, Optional
from collections import defaultdict
from rich.console import Console
from rich.panel import Panel
from rich import box

console = Console()


def parse_date_loose(date_str: Any) -> Optional[date]:
    """Parse date string with multiple formats. Returns None if date cannot be parsed."""
    if not date_str or date_str == "NA" or not isinstance(date_str, str):
        return None
    
    date_str = date_str.strip()
    formats = ["%Y-%m-%d", "%m-%d-%Y", "%m/%d/%Y", "%Y/%m/%d", "%d-%m-%Y", "%d/%m/%Y"]
    
    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt).date()
        except ValueError:
            continue
    
    # If all formats fail, return None
    return None


def normalize_severity(severity: Any) -> str:
    """Normalize severity to standard format."""
    if not severity or severity == "NA":
        return "Low"
    
    severity_str = str(severity).lower().strip()
    if severity_str in ["critical", "crit"]:
        return "Critical"
    elif severity_str in ["high", "h"]:
        return "High"
    elif severity_str in ["medium", "med", "moderate"]:
        return "Medium"
    else:
        return "Low"


def generate_activity_chart(threat_items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Generate activity chart data from raw threat items.
    Only includes items with valid dates. Items without dates are skipped.
    
    Args:
        threat_items: List of raw threat items from API
        
    Returns:
        List of ActivityDataPoint dictionaries with date and severity counts
    """
    # Group by date and severity
    date_severity_counts: Dict[date, Dict[str, int]] = defaultdict(lambda: {
        "Critical": 0,
        "High": 0,
        "Medium": 0,
        "Low": 0
    })
    
    for item in threat_items:
        # Parse date - skip if None
        date_published = item.get("date_published")
        threat_date = parse_date_loose(date_published)
        
        if threat_date is None:
            continue  # Skip items without valid dates
        
        # Normalize severity
        severity = normalize_severity(item.get("threat_severity"))
        
        # Increment count
        date_severity_counts[threat_date][severity] += 1
    
    # Convert to list and sort by date
    activity_data = []
    for threat_date in sorted(date_severity_counts.keys()):
        counts = date_severity_counts[threat_date]
        activity_data.append({
            "date": threat_date.isoformat(),
            "Critical": counts["Critical"],
            "High": counts["High"],
            "Medium": counts["Medium"],
            "Low": counts["Low"]
        })
    
    return activity_data


def main():
    """Main function for testing."""
    import sys
    import os
    
    # Get the backend root directory
    backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    # Load sample API response
    sample_file = os.path.join(backend_root, "sample_response.json")
    
    if not os.path.exists(sample_file):
        console.print(f"[red]✗[/red] Sample file not found: {sample_file}")
        return
    
    console.print(Panel.fit(
        "[bold cyan]Activity Chart Generator[/bold cyan]",
        border_style="cyan",
        box=box.ROUNDED
    ))
    
    console.print(f"\n[bold]Loading threat data from:[/bold] {sample_file}")
    with open(sample_file, "r", encoding="utf-8") as f:
        threat_items = json.load(f)
    
    console.print(f"[green]✓[/green] Loaded [bold]{len(threat_items)}[/bold] threat items")
    
    # Generate activity chart
    console.print(f"\n[bold]Generating activity chart data...[/bold]")
    activity_data = generate_activity_chart(threat_items)
    
    console.print(f"[green]✓[/green] Generated [bold]{len(activity_data)}[/bold] data points")
    
    # Display summary
    total_critical = sum(d["Critical"] for d in activity_data)
    total_high = sum(d["High"] for d in activity_data)
    total_medium = sum(d["Medium"] for d in activity_data)
    total_low = sum(d["Low"] for d in activity_data)
    
    console.print()
    console.print(Panel.fit(
        f"[bold green]Activity Chart Data Generated[/bold green]\n\n"
        f"[cyan]Data Points:[/cyan] {len(activity_data)}\n"
        f"[cyan]Date Range:[/cyan] {activity_data[0]['date']} to {activity_data[-1]['date']}\n\n"
        f"[cyan]Total Counts:[/cyan]\n"
        f"  Critical: {total_critical}\n"
        f"  High: {total_high}\n"
        f"  Medium: {total_medium}\n"
        f"  Low: {total_low}",
        border_style="green",
        box=box.ROUNDED
    ))
    
    return activity_data


if __name__ == "__main__":
    main()

