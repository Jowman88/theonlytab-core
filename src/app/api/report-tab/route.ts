import { NextResponse } from 'next/server';
import { Client } from 'pg';

export async function POST(request: Request) {
  try {
    const { slotId } = await request.json();

    if (!slotId) {
      return NextResponse.json({ error: "Missing slotId parameter." }, { status: 400 });
    }

    const pgClient = new Client({ connectionString: process.env.DATABASE_URL });
    await pgClient.connect();

    // Verhoog de report count in de database met 1 voor dit specifieke slot
    const updateRes = await pgClient.query(
      `UPDATE slots SET report_count = report_count + 1 WHERE id = $1 RETURNING report_count`,
      [slotId]
    );

    if (updateRes.rows.length === 0) {
      await pgClient.end();
      return NextResponse.json({ error: "Active slot not found." }, { status: 404 });
    }

    const currentCount = updateRes.rows[0].report_count;

    // Slasher-logica: Als de community 5 keer vlagt, bevriezen we de tab onmiddellijk!
    if (currentCount >= 5) {
      await pgClient.query(
        `UPDATE slots SET is_frozen = true, expires_at = NOW() WHERE id = $1`,
        [slotId]
      );
      await pgClient.end();
      return NextResponse.json({ status: 'slot_slashed_and_blacklisted', current_count: currentCount });
    }

    await pgClient.end();
    return NextResponse.json({ status: 'reported', current_count: currentCount });
  } catch (err: any) {
    console.error("Report Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
