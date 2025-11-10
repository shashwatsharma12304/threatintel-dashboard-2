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
 * GET /api/activity-chart
 * Get activity chart data (last 7 days only).
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

    const activityData = radarDoc.activity_chart || [];
    
    // Filter to last 7 days from today (including today)
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); // 7 days including today
    sevenDaysAgo.setHours(0, 0, 0, 0); // Start of that day
    
    const filtered = activityData.filter((point: any) => {
      const dateStr = point.date;
      if (!dateStr) return false;
      
      try {
        const pointDate = new Date(dateStr);
        pointDate.setHours(12, 0, 0, 0); // Normalize to noon for comparison
        return pointDate >= sevenDaysAgo && pointDate <= today;
      } catch {
        return false;
      }
    });

    return NextResponse.json(filtered, { headers: getCorsHeaders() });
  } catch (error) {
    console.error('Error fetching activity chart:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activity chart' },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

