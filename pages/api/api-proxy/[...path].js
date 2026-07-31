export default async function handler(req, res) {
  const API_KEY = "bb47332ceca91e3a2c97128a40c798a69306400072cc4b5a352800697069e45c";

  // Tangkap path dinamis dari catch-all [...path].js
  const { path, ...queryParams } = req.query;
  const endpointPath = Array.isArray(path) ? path.join('/') : (path || '');

  // Susun URL tujuan ke server eksternal beserta query string-nya (misal: ?path=...)
  const queryStr = new URLSearchParams(queryParams).toString();
  const targetUrl = `https://indocast.site/api/animekompi/${endpointPath}${queryStr ? '?' + queryStr : ''}`;

  try {
    const apiResponse = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      }
    });

    // Izinkan akses CORS
    res.setHeader('Access-Control-Allow-Origin', '*');

    const contentType = apiResponse.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const data = await apiResponse.json();
      return res.status(apiResponse.status).json(data);
    } else {
      const text = await apiResponse.text();
      return res.status(apiResponse.status).send(text);
    }
  } catch (error) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ 
      code: 1, 
      message: 'Gagal terhubung ke server eksternal', 
      error: error.message 
    });
  }
}
