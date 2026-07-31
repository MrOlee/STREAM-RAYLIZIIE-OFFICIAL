export default async function handler(req, res) {
    const { path } = req.query;
    const subPath = Array.isArray(path) ? path.join('/') : (path || '');
    
    // Ambil semua parameter query tambahan
    const urlParams = new URLSearchParams(req.query);
    urlParams.delete('path');
    const queryString = urlParams.toString();
    
    // URL Base API utama tujuan kamu (sesuaikan dengan API backend sumber kamu)
    const targetBase = "https://v8.animekompi.sbs"; 
    const targetUrl = `${targetBase}/${subPath}${queryString ? '?' + queryString : ''}`;

    try {
        const response = await fetch(targetUrl, {
            method: req.method,
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': req.headers['x-api-key'] || ''
            }
        });

        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            const data = await response.json();
            return res.status(response.status).json(data);
        } else {
            const text = await response.text();
            return res.status(response.status).send(text);
        }
    } catch (error) {
        return res.status(500).json({ error: "Gateway Proxy Error", details: error.message });
    }
}
