import { NextRequest, NextResponse } from 'next/server';
import { getRadarCollection } from '../../../../lib/mongodb';
import { getCorsHeaders } from '../../../../lib/cors';

const DEFAULT_CUSTOMER_ID = process.env.CUSTOMER_ID || 'cust-airtel-001';

/**
 * Handle OPTIONS request for CORS preflight
 */
export async function OPTIONS() {
  return NextResponse.json({}, { headers: getCorsHeaders() });
}

/**
 * GET /api/assets-chart/all
 * Get all assets chart data (no filtering).
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
    
    // Return all data without filtering
    return NextResponse.json(assetsData, { headers: getCorsHeaders() });
  } catch (error) {
    console.error('Error fetching all assets chart data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch assets chart data' },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

