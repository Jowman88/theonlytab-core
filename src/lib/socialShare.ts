export function generateShareLinks(url: string, text: string) {
  return {
    twitter: `https://twitter.com{encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
    facebook: `https://facebook.com{encodeURIComponent(url)}`,
    whatsapp: `https://whatsapp.com{encodeURIComponent(text + ' ' + url)}`
  };
}
