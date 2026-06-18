import { google } from 'googleapis';

// Persists across warm Lambda invocations — geocoding only runs on cold starts
const geocodeCache = new Map();

async function geocode(query) {
  if (geocodeCache.has(query)) return geocodeCache.get(query);
  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1&lang=en`;
    const res = await fetch(url, { headers: { 'User-Agent': 'photo-portfolio/1.0' } });
    const { features } = await res.json();
    if (!features?.length) { geocodeCache.set(query, null); return null; }
    // GeoJSON coordinates are [lng, lat]
    const [lng, lat] = features[0].geometry.coordinates;
    const result = { lat, lng };
    geocodeCache.set(query, result);
    return result;
  } catch {
    geocodeCache.set(query, null);
    return null;
  }
}

function photoUrl(fileId) {
  return `/api/photo?id=${fileId}`;
}

export default async function handler(req, res) {
  // CDN caches the response for 1 hour; serves stale while revalidating for up to 24 h
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');

  try {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
    const drive = google.drive({ version: 'v3', auth });
    const folderId = process.env.DRIVE_PORTFOLIO_FOLDER_ID;

    // List all subfolders inside the portfolio folder
    const { data: { files: folders = [] } } = await drive.files.list({
      q: `'${folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id,name)',
      pageSize: 100,
    });

    // Geocode + list photos for every folder in parallel
    const locations = await Promise.all(
      folders.map(async (folder) => {
        const [coords, photosRes] = await Promise.all([
          geocode(folder.name),
          drive.files.list({
            q: `'${folder.id}' in parents and mimeType contains 'image/' and trashed=false`,
            fields: 'files(id,name)',
            orderBy: 'name',
            pageSize: 50,
          }),
        ]);

        if (!coords) {
          console.warn(`[locations] Could not geocode "${folder.name}" — skipping`);
          return null;
        }

        return {
          id:     folder.id,
          name:   folder.name,
          lat:    coords.lat,
          lng:    coords.lng,
          photos: photosRes.data.files.map(f => ({
            id:      f.id,
            src:     photoUrl(f.id),
            caption: f.name.replace(/\.[^.]+$/, ''), // strip file extension
          })),
        };
      })
    );

    res.json(locations.filter(Boolean));
  } catch (err) {
    console.error('[api/locations]', err);
    res.status(500).json({ error: 'Failed to load locations' });
  }
}
