import { NextRequest, NextResponse } from 'next/server';
import { getRadarCollection } from '../../../lib/mongodb';
import { getCorsHeaders } from '../../../lib/cors';

const DEFAULT_CUSTOMER_ID = process.env.CUSTOMER_ID || 'cust-airtel-001';

/**
 * Handle OPTIONS request for CORS preflight
 */
export async function OPTIONS() {
  return NextResponse.json({}, { headers: getCorsHeaders() });
}

/**
 * GET /api/filter-options
 * Get unique values for filter dropdowns.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const customerId = searchParams.get('customer_id') || DEFAULT_CUSTOMER_ID;

    const collection = await getRadarCollection();
    
    // Get latest radar data
    const radarDoc = await collection.findOne(
      { 'meta.customer_id': customerId },
      { sort: { 'meta.generated_at': -1 } }
    );

    if (!radarDoc) {
      return NextResponse.json({ assets: [], sources: [] }, { headers: getCorsHeaders() });
    }

    const points = radarDoc.points || [];
    
    // Extract unique assets
    const uniqueAssets = new Set<string>();
    points.forEach((point: any) => {
      const assetsImpacted = point.assets_impacted || [];
      assetsImpacted.forEach((asset: any) => {
        const productName = asset.product_name;
        if (productName) {
          uniqueAssets.add(productName);
        }
      });
    });

    // Extract unique sources
    const uniqueSources = new Set<string>();
    points.forEach((point: any) => {
      const source = point.source;
      if (source) {
        uniqueSources.add(source);
      }
    });

    return NextResponse.json({
      assets: Array.from(uniqueAssets).sort(),
      sources: Array.from(uniqueSources).sort()
    }, { headers: getCorsHeaders() });
  } catch (error) {
    console.error('Error fetching filter options:', error);
    return NextResponse.json(
      { error: 'Failed to fetch filter options' },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

