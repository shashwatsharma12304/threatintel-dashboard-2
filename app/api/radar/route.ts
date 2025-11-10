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
 * GET /api/radar
 * Get full radar data for a customer.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const customerId = searchParams.get('customer_id') || DEFAULT_CUSTOMER_ID;

    const collection = await getRadarCollection();
    
    // Query for latest radar data by customer_id, sorted by generated_at
    const radarDoc = await collection.findOne(
      { 'meta.customer_id': customerId },
      { sort: { 'meta.generated_at': -1 } }
    );

    if (!radarDoc) {
      return NextResponse.json(
        { error: 'Radar data not found' },
        { status: 404, headers: getCorsHeaders() }
      );
    }

    // Remove MongoDB _id and internal fields
    const { _id, _last_updated, _generated_at, ...radarData } = radarDoc;

    return NextResponse.json(radarData, { headers: getCorsHeaders() });
  } catch (error) {
    console.error('Error fetching radar data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch radar data' },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

