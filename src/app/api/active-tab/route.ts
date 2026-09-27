import { GET as getActiveTab } from '../get-active-tab/route';

export const dynamic = 'force-dynamic';

export async function GET() {
  return getActiveTab();
}
