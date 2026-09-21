import { NextResponse } from 'next/server';
import { Client } from 'pg';
import crypto from 'crypto';

export async function POST(request: Request) {
  const { slotId } = await request.json();
  const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
  const ipHash = crypto.createHash('sha256').update(ip).digest('hex');

  const pgClient = new Client({ connectionString: process.env.DATABASE_URL });
  await pgClient.connect();

  try {
    await pgClient.query('BEGIN');
    await pgClient.query(`INSERT INTO system_reports (slot_id, reporter_ip_hash) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [slotId, ipHash]);
    const check = await pgClient.query(`SELECT COUNT(*) FROM system_reports WHERE slot_id = $1`, [slotId]);
    const totalReports = parseInt(check.rows[0].count);

    if (totalReports >= 5) {
      await pgClient.query(`UPDATE slots SET is_frozen = TRUE, expires_at = NOW() WHERE id = $1`, [slotId]);
      await pgClient.query('COMMIT');
      return NextResponse.json({ status: 'slot_slashed_and_blacklisted' });
    }
    await pgClient.query('COMMIT');
    return NextResponse.json({ status: 'report_logged', current_count: totalReports });
  } catch (err: any) {
    await pgClient.query('ROLLBACK');
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    await pgClient.end();
  }
}
