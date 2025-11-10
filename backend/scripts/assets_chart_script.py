"""
Assets Chart Script
Generates assets chart data (threats per product) from raw API threat data.
"""
import json
from typing import List, Dict, Any
from collections import defaultdict
from rich.console import Console
from rich.panel import Panel
from rich import box

console = Console()


def extract_product_names(item: Dict[str, Any]) -> List[str]:
    """
    Extract product names from a threat item.
    Tries multiple fields to find product information.
    """
    products = set()
    
    # Try affected_products field
    affected_products = item.get("affected_products")
    if affected_products and affected_products != "NA":
        if isinstance(affected_products, list):
            for product in affected_products:
                if isinstance(product, dict):
                    product_name = product.get("product_name") or product.get("software_name")
                    if product_name and product_name != "NA":
                        products.add(str(product_name))
                elif isinstance(product, str) and product != "NA":
                    products.add(product)
        elif isinstance(affected_products, str) and affected_products != "NA":
            products.add(affected_products)
    
    # Try product_exploited
    product_exploited = item.get("product_exploited")
    if product_exploited and product_exploited != "NA":
        products.add(str(product_exploited))
    
    # Try software_exploited
    software_exploited = item.get("software_exploited")
    if software_exploited and software_exploited != "NA":
        products.add(str(software_exploited))
    
    # Try remediated_products
    remediated_products = item.get("remediated_products")
    if remediated_products and remediated_products != "NA":
        if isinstance(remediated_products, list):
            for product in remediated_products:
                if isinstance(product, dict):
                    product_name = product.get("product_name") or product.get("software_name")
                    if product_name and product_name != "NA":
                        products.add(str(product_name))
                elif isinstance(product, str) and product != "NA":
                    products.add(product)
        elif isinstance(remediated_products, str) and remediated_products != "NA":
            products.add(remediated_products)
    
    # Return list (empty if no products found)
    return list(products)


def generate_assets_chart_from_radar(radar_points: List[Any]) -> List[Dict[str, Any]]:
    """
    Generate assets chart data from radar chart output.
    Uses the 'assets_impacted' array from each radar point to count threats per asset.
    This ensures we use the company's product names (from customer profile) instead of raw API names.
    
    Args:
        radar_points: List of RadarThreatPoint objects from radar chart generation
        
    Returns:
        List of AssetImpact dictionaries with asset name and count
    """
    # Count threats per product using assets_impacted from radar points
    product_counts: Dict[str, int] = defaultdict(int)
    
    for point in radar_points:
        # Each point has an assets_impacted list
        if hasattr(point, 'assets_impacted') and point.assets_impacted:
            for asset in point.assets_impacted:
                # Use product_name from the asset
                if hasattr(asset, 'product_name'):
                    product_name = asset.product_name
                    product_counts[product_name] += 1
                elif isinstance(asset, dict):
                    product_name = asset.get('product_name')
                    if product_name:
                        product_counts[product_name] += 1
    
    # Convert to list and sort by count (descending)
    assets_data = [
        {"asset": product, "count": count}
        for product, count in sorted(product_counts.items(), key=lambda x: x[1], reverse=True)
    ]
    
    # Limit to top 20 products
    return assets_data[:20]


def generate_assets_chart(threat_items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    DEPRECATED: Use generate_assets_chart_from_radar instead.
    This function is kept for backward compatibility but should not be used.
    """
    # Count threats per product
    product_counts: Dict[str, int] = defaultdict(int)
    
    for item in threat_items:
        products = extract_product_names(item)
        # Only count if products were found
        if products:
            for product in products:
                product_counts[product] += 1
    
    # Convert to list and sort by count (descending)
    assets_data = [
        {"asset": product, "count": count}
        for product, count in sorted(product_counts.items(), key=lambda x: x[1], reverse=True)
    ]
    
    # Limit to top 20 products
    return assets_data[:20]


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
        "[bold cyan]Assets Chart Generator[/bold cyan]",
        border_style="cyan",
        box=box.ROUNDED
    ))
    
    console.print(f"\n[bold]Loading threat data from:[/bold] {sample_file}")
    with open(sample_file, "r", encoding="utf-8") as f:
        threat_items = json.load(f)
    
    console.print(f"[green]✓[/green] Loaded [bold]{len(threat_items)}[/bold] threat items")
    
    # Generate assets chart
    console.print(f"\n[bold]Generating assets chart data...[/bold]")
    assets_data = generate_assets_chart(threat_items)
    
    console.print(f"[green]✓[/green] Generated [bold]{len(assets_data)}[/bold] asset entries")
    
    # Display summary
    total_threats = sum(d["count"] for d in assets_data)
    top_assets = assets_data[:5]
    
    summary_text = f"[bold green]Assets Chart Data Generated[/bold green]\n\n"
    summary_text += f"[cyan]Total Assets:[/cyan] {len(assets_data)}\n"
    summary_text += f"[cyan]Total Threat Count:[/cyan] {total_threats}\n\n"
    summary_text += f"[cyan]Top 5 Assets:[/cyan]\n"
    for asset in top_assets:
        summary_text += f"  {asset['asset']}: {asset['count']} threats\n"
    
    console.print()
    console.print(Panel.fit(
        summary_text,
        border_style="green",
        box=box.ROUNDED
    ))
    
    return assets_data


if __name__ == "__main__":
    main()

