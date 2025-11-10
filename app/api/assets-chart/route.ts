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
 * GET /api/assets-chart
 * Get assets chart data (top 5 only).
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
      return NextResponse.json([], { headers: getCorsHeaders() });
    }

    const assetsData = radarDoc.assets_chart || [];
    
    // Already sorted by count descending from MongoDB, limit to top 5
    const top5 = assetsData.slice(0, 5);

    return NextResponse.json(top5, { headers: getCorsHeaders() });
  } catch (error) {
    console.error('Error fetching assets chart:', error);
    return NextResponse.json(
      { error: 'Failed to fetch assets chart' },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

