import { validateTargetUrl } from './urlValidation';

export async function checkUrlWithWebRisk(url: string): Promise<boolean> {
  if (process.env.WEB_RISK_DISABLED === 'true') {
    return true;
  }

  return validateTargetUrl(url).ok;
}
