const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const NodeCache = require('node-cache');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// Cache TTL: 1 Jam (3600 detik)
const cache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });

// Konfigurasi Environment
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || 'bb47332ceca91e3a2c97128a40c798a69306400072cc4b5a352800697069e45c';
const ANIMEKOMPI_BASE = 'https://animekompi.sbs';

// Middlewares
app.use(cors());
app.use(express.json());

// Rate Limiter: Maksimal 100 request per 15 menit per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { code: 429, message: 'Too many requests, please try again later.' }
});
app.use(limiter);

// Authentication Middleware
const apiKeyAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  if (!apiKey || apiKey !== API_KEY) {
    return res.status(401).json({ code: 401, message: 'Unauthorized: Invalid API Key' });
  }
  next();
};

// Axios Client Configured with Spoofed Headers
const httpClient = axios.create({
  timeout: 10000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
  }
});

// ==========================================
// SCRAPER ENGINES
// ==========================================

async function fetchAnimeDetail(path) {
  const url = `${ANIMEKOMPI_BASE}/${path}`;
  const { data: html } = await httpClient.get(url);
  const $ = cheerio.load(html);

  const title = $('.entry-title').text().trim() || $('h1.title').text().trim();
  const cover = $('.thumb img').attr('src') || $('.poster img').attr('src') || '';
  const synopsis = $('.synopsis, .entry-content p').first().text().trim();

  const episodes = [];
  $('.eplister ul li, .episodelist ul li, .eplister li').each((_, el) => {
    const link = $(el).find('a');
    const epTitle = link.text().trim();
    const epHref = link.attr('href') || '';
    
    // Extract slug dari URL
    const epSlug = epHref.replace(/\/$/, '').split('/').pop();
    const releaseDate = $(el).find('.epl-date, .date').text().trim();

    if (epSlug) {
      episodes.push({
        title: epTitle || epSlug,
        episode_id: epSlug,
        release_date: releaseDate || null
      });
    }
  });

  return { title, path, cover, synopsis, total_episodes: episodes.length, episodes };
}

async function fetchAnimeEpisode(episodeId) {
  const url = `${ANIMEKOMPI_BASE}/${episodeId}`;
  const { data: html } = await httpClient.get(url);
  const $ = cheerio.load(html);

  const title = $('.entry-title').text().trim();

  // 1. Extract Streaming iFrames / Mirrors
  const streamServers = [];
  $('iframe, select.mirror option').each((i, el) => {
    if ($(el).is('iframe')) {
      const src = $(el).attr('src');
      if (src && !src.includes('facebook')) {
        streamServers.push({ server_name: `Primary Stream ${i + 1}`, embed_url: src });
      }
    } else {
      const val = $(el).val();
      const name = $(el).text().trim();
      if (val && val !== '#' && val !== '') {
        streamServers.push({ server_name: name || `Server ${i + 1}`, embed_url: val });
      }
    }
  });

  // 2. Extract Subtitles (.vtt / .ass / .srt)
  const subtitles = [];
  $('a[href*=".vtt"], a[href*=".ass"], a[href*=".srt"]').each((_, el) => {
    const href = $(el).attr('href');
    subtitles.push({
      language: $(el).text().trim() || 'Indonesian',
      format: href.split('.').pop().toLowerCase(),
      url: href
    });
  });

  // 3. Extract Download Links & Qualities
  const downloadLinks = [];
  $('.download-eps, .moredl, .dlx, .soritlink').each((_, sec) => {
    const quality = $(sec).find('strong, b, h4').text().trim() || '720p';
    const servers = [];
    
    $(sec).find('a').each((_, a) => {
      const serverName = $(a).text().trim();
      const downloadUrl = $(a).attr('href');
      if (downloadUrl && downloadUrl !== '#') {
        servers.push({ name: serverName, url: downloadUrl });
      }
    });

    if (servers.length > 0) {
      downloadLinks.push({ quality, format: quality.includes('MP4') ? 'MP4' : 'MKV', servers });
    }
  });

  return { episode_id: episodeId, title, stream_servers: streamServers, subtitles, download_links: downloadLinks };
}

// ==========================================
// API ROUTES
// ==========================================

// 1. Anime Kompi - Detail & Episode List
app.get('/api/animekompi/detail', apiKeyAuth, async (req, res, next) => {
  try {
    const { path } = req.query;
    if (!path) return res.status(400).json({ code: 400, message: 'Query parameter "path" is required' });

    const cacheKey = `anime_detail_${path}`;
    if (cache.has(cacheKey)) {
      return res.json({ code: 0, message: 'ok (cache hit)', data: cache.get(cacheKey) });
    }

    const data = await fetchAnimeDetail(path);
    cache.set(cacheKey, data);
    res.json({ code: 0, message: 'ok', data });
  } catch (err) {
    next(err);
  }
});

// 2. Anime Kompi - Stream, Subtitle & Download Link
app.get('/api/animekompi/episode', apiKeyAuth, async (req, res, next) => {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ code: 400, message: 'Query parameter "id" is required' });

    const cacheKey = `anime_ep_${id}`;
    if (cache.has(cacheKey)) {
      return res.json({ code: 0, message: 'ok (cache hit)', data: cache.get(cacheKey) });
    }

    const data = await fetchAnimeEpisode(id);
    cache.set(cacheKey, data);
    res.json({ code: 0, message: 'ok', data });
  } catch (err) {
    next(err);
  }
});

// 3. Module Drakor - Endpoint Provider Modular
app.get('/api/drakor/episode', apiKeyAuth, async (req, res, next) => {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ code: 400, message: 'Query parameter "id" is required' });

    // Contoh penanganan scraping terpisah khusus layout portal Drakor
    const drakorData = {
      episode_id: id,
      title: `Drama Korea Episode ${id}`,
      stream_servers: [
        { server_name: 'FastServer Drakor', embed_url: `https://drakor.stream.example/${id}` }
      ],
      subtitles: [
        { language: 'Indonesian', format: 'srt', url: `https://sub.indocast.site/drakor/${id}.srt` }
      ],
      download_links: [
        { quality: '540p', format: 'MP4', servers: [{ name: 'Sendcm', url: `https://send.cm/${id}` }] },
        { quality: '720p', format: 'MKV', servers: [{ name: 'Sendcm', url: `https://send.cm/${id}-720` }] }
      ]
    };

    res.json({ code: 0, message: 'ok', data: drakorData });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// ERROR HANDLING & SERVER LAUNCH
// ==========================================

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[API EXCEPTION]', err.message);
  
  const statusCode = err.response?.status || 500;
  res.status(statusCode).json({
    code: statusCode,
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Production Server running on port ${PORT}`);
});
