document.addEventListener('DOMContentLoaded', () => {
    initApp();

    // Efek Transisi Navbar saat Scroll
    window.addEventListener('scroll', () => {
        const navbar = document.getElementById('navbar');
        if (window.scrollY > 50) {
            navbar.classList.add('nav-scrolled');
        } else {
            navbar.classList.remove('nav-scrolled');
        }
    });

    // Event Listener Pencarian
    const searchInput = document.getElementById('searchInput');
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();
        if (query.length > 2) {
            searchTimeout = setTimeout(() => handleSearch(query), 500);
        }
    });
});

async function initApp() {
    loadAnime();
    loadDrakor();
    loadFilms();
}

async function loadAnime() {
    const data = await API.fetchCategory('anime', '/home');
    const container = document.getElementById('animeRow');
    if (!data) return;

    // Render Hero Banner dengan Item Pertama
    const items = data.data || data.result || [];
    if (items.length > 0) {
        setupHero(items[0], 'anime');
    }

    renderCards(container, items, 'anime');
}

async function loadDrakor() {
    const data = await API.fetchCategory('drakor', '/tab');
    const container = document.getElementById('drakorRow');
    const items = data.data || data.result || [];
    renderCards(container, items, 'drakor');
}

async function loadFilms() {
    const data = await API.fetchCategory('films', '/home');
    const container = document.getElementById('filmsRow');
    const items = data.data || data.result || [];
    renderCards(container, items, 'films');
}

function renderCards(container, items, category) {
    container.innerHTML = '';
    items.forEach(item => {
        const title = item.title || item.name || 'Untitled';
        const poster = item.poster || item.cover || item.image || 'https://via.placeholder.com/300x450';
        const id = item.id || item.slug || item.endpoint;

        const card = document.createElement('div');
        card.className = 'media-card flex-shrink-0 cursor-pointer group relative rounded-lg overflow-hidden bg-gray-900';
        card.innerHTML = `
            <img src="${poster}" alt="${title}" class="w-full h-60 md:h-72 object-cover rounded-lg group-hover:opacity-80 transition">
            <div class="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-0 group-hover:opacity-100 transition p-3 flex flex-col justify-end">
                <p class="text-xs font-bold line-clamp-2">${title}</p>
                <span class="text-[10px] text-orange-400 mt-1 uppercase">${category}</span>
            </div>
        `;
        card.onclick = () => openPlayer(title, id, category);
        container.appendChild(card);
    });
}

function setupHero(item, category) {
    document.getElementById('heroTitle').innerText = item.title || item.name;
    document.getElementById('heroDesc').innerText = item.synopsis || item.description || 'Saksikan penayangan episode lengkapnya di STREAM RAYLIZIIE OFFICIAL.';
    
    if (item.banner || item.poster) {
        document.getElementById('heroSection').style.backgroundImage = `url('${item.banner || item.poster}')`;
    }

    document.getElementById('heroPlayBtn').onclick = () => openPlayer(item.title, item.id || item.slug, category);
}

function openPlayer(title, id, category) {
    const modal = document.getElementById('playerModal');
    const modalTitle = document.getElementById('modalTitle');
    const iframe = document.getElementById('videoIframe');

    modalTitle.innerText = title;
    
    // Set URL Stream langsung mengarah ke endpoint Worker Play Anda
    iframe.src = `${API_BASE_URL}/${category}/play?id=${id}`;
    
    modal.classList.remove('hidden');
}

function closeModal() {
    const modal = document.getElementById('playerModal');
    const iframe = document.getElementById('videoIframe');
    iframe.src = ''; 
    modal.classList.add('hidden');
}
