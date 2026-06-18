import { google } from 'googleapis';

export default async function handler(req, res) {
  const { id } = req.query;
  if (!id || !/^[\w-]+$/.test(id)) {
    res.status(400).end('Invalid file ID');
    return;
  }

  // Cache each image at the CDN edge for 24 h
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');

  try {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
    const drive = google.drive({ version: 'v3', auth });

    const response = await drive.files.get(
      { fileId: id, alt: 'media' },
      { responseType: 'stream' },
    );

    res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg');
    response.data.pipe(res);
  } catch (err) {
    console.error('[api/photo]', err.message);
    res.status(404).end();
  }
}
