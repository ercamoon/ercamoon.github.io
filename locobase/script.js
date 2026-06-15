// --- CONFIGURACIÓN DE CONEXIÓN A SUPABASE ---
const SUPABASE_URL = "https://qdgvablwuebyzdkzodsl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkZ3ZhYmx3dWVieXpka3pvZHNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0NzI1MDcsImV4cCI6MjA5NzA0ODUwN30.ADE0dnQNxgdDLG-VCYxWSW3-YhV1x4mAL_kWWq7s6sg";
const S_DOMAIN = "@loco.com";

supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- ESTADO ---
let locomotives = [];
let currentCategoryFilter = "all";
let currentSession = null;

// --- SELECTORES DOM ---
const locoGrid = document.getElementById('locoGrid');
const searchInput = document.getElementById('searchInput');
const categoryFilters = document.getElementById('categoryFilters');
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const addLocoBtn = document.getElementById('addLocoBtn');
const loginForm = document.getElementById('loginForm');
const locoForm = document.getElementById('locoForm');

let fileImg = null, filePdf = null, fileZ21 = null;

document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    setupEventListeners();
    await checkExistingSession(); 
    await fetchLocomotives();     
});

// NUEVA LÓGICA CON CLASES DE ANIMACIÓN
function mostrarModal(idModal) {
    const modal = document.getElementById(idModal);
    if(modal) {
        modal.classList.add('show');
    }
}

function cerrarModal(idModal) {
    const modal = document.getElementById(idModal);
    if(modal) {
        modal.classList.remove('show');
    }
}

function setupEventListeners() {
    searchInput.addEventListener('input', renderLocomotives);
    
    categoryFilters.addEventListener('click', (e) => {
        if(e.target.classList.contains('tab')) {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            currentCategoryFilter = e.target.dataset.category;
            renderLocomotives();
        }
    });

    themeToggle.addEventListener('click', toggleTheme);
    loginBtn.addEventListener('click', () => mostrarModal('loginModal'));
    addLocoBtn.addEventListener('click', () => openLocoModal());

    loginForm.addEventListener('submit', handleLogin);
    locoForm.addEventListener('submit', handleLocoSubmit);
    logoutBtn.addEventListener('click', handleLogout);

    // ESCUCHA DE CLICS DE LA REJILLA
    locoGrid.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.edit-badge');
        if (editBtn) {
            const id = editBtn.getAttribute('data-id');
            openLocoModal(id);
            return;
        }

        const soundBtn = e.target.closest('.btn-sounds');
        if (soundBtn) {
            const id = soundBtn.getAttribute('data-id');
            openSoundListModal(id);
            return;
        }

        const downloadBtn = e.target.closest('.btn-download-z21');
        if (downloadBtn) {
            const url = downloadBtn.getAttribute('data-url');
            const name = downloadBtn.getAttribute('data-filename');
            forceDownload(url, name);
            return;
        }
    });

    // CERRAR AUTOMÁTICAMENTE AL PULSAR EN EL FONDO OSCURO OUTSIDE
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            cerrarModal(e.target.id);
        }
    });

    document.getElementById('locoImg').addEventListener('change', (e) => {
        fileImg = e.target.files[0];
        if (fileImg) {
            document.getElementById('imgPreview').src = URL.createObjectURL(fileImg);
            document.getElementById('imgPreviewContainer').classList.remove('hidden');
        }
    });

    document.getElementById('locoSoundPdf').addEventListener('change', (e) => {
        filePdf = e.target.files[0];
        if(filePdf) document.getElementById('pdfFileStatus').innerText = `Listo: ${filePdf.name}`;
    });

    document.getElementById('locoZ21').addEventListener('change', (e) => {
        fileZ21 = e.target.files[0];
        if(fileZ21) document.getElementById('z21FileStatus').innerText = `Listo: ${fileZ21.name}`;
    });

    document.getElementById('deleteLocoBtn').addEventListener('click', async () => {
        const id = document.getElementById('locoId').value;
        if(id && confirm("¿Estás seguro de eliminar esta locomotora de la nube?")) {
            const { error } = await supabase.from('locomotives').delete().eq('id', parseInt(id));
            if (error) alert("Error al borrar: " + error.message);
            else {
                await fetchLocomotives();
                cerrarModal('locoModal');
            }
        }
    });
}

async function fetchLocomotives() {
    try {
        const { data, error } = await supabase.from('locomotives').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        locomotives = data || [];
        renderLocomotives();
    } catch (err) {
        console.error("Error cargando base de datos:", err.message);
    }
}

function renderLocomotives() {
    locoGrid.innerHTML = "";
    const query = searchInput.value.toLowerCase().trim();
    const isUserAdmin = currentSession !== null;

    const filtered = locomotives.filter(loco => {
        const matchSearch = loco.name.toLowerCase().includes(query);
        const matchCat = currentCategoryFilter === "all" || loco.category === currentCategoryFilter;
        return matchSearch && matchCat;
    });

    if(filtered.length === 0) {
        locoGrid.innerHTML = `<p class="text-muted" style="grid-column: 1/-1; text-align:center; padding: 3rem;">No hay locomotoras registradas en la nube.</p>`;
        return;
    }

    filtered.forEach(loco => {
        let cleanZ21Name = "config.z21";
        if (loco.z21_url) {
            const urlParts = loco.z21_url.split('/');
            cleanZ21Name = urlParts[urlParts.length - 1]; 
        }

        const card = document.createElement('div');
        card.classList.add('loco-card');
        
        card.innerHTML = `
            <div class="card-img-wrapper">
                ${loco.image_url ? `<img src="${loco.image_url}" alt="${loco.name}">` : `
                    <div class="no-img">
                        <span class="material-icons-round" style="font-size:3rem">train</span>
                        <span>Sin foto</span>
                    </div>`}
                <span class="tag-cat">${loco.category}</span>
                ${!isUserAdmin ? '' : `<button class="edit-badge" data-id="${loco.id}"><span class="material-icons-round" style="font-size:18px">edit</span></button>`}
            </div>
            <div class="card-body">
                <h4>${loco.name}</h4>
                <div class="card-actions">
                    <button class="btn primary btn-sounds" data-id="${loco.id}">
                        <span class="material-icons-round">volume_up</span> Lista de sonidos
                    </button>
                    <button class="btn success btn-download-z21" data-url="${loco.z21_url || '#'}" data-filename="${cleanZ21Name}" style="${!loco.z21_url ? 'opacity:0.4; cursor:not-allowed; pointer-events:none;' : ''}">
                        <span class="material-icons-round">download</span> Z21
                    </button>
                </div>
            </div>
        `;
        locoGrid.appendChild(card);
    });
}

async function forceDownload(url, filename) {
    if (!url || url === '#') return;
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename; 
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
        window.open(url, '_blank');
    }
}

function openSoundListModal(id) {
    const loco = locomotives.find(l => String(l.id) === String(id));
    if (!loco) return;

    document.getElementById('soundModalTitle').innerText = `Lista de Sonidos - ${loco.name}`;
    const pdfContainer = document.getElementById('pdfLinkContainer');
    const viewPdfBtn = document.getElementById('viewPdfBtn');
    
    if (loco.pdf_url) {
        pdfContainer.classList.remove('hidden');
        viewPdfBtn.onclick = () => window.open(loco.pdf_url, '_blank');
    } else {
        pdfContainer.classList.add('hidden');
    }

    const tableBody = document.getElementById('soundTableBody');
    tableBody.innerHTML = "";

    if (loco.sounds && loco.sounds.trim() !== "") {
        const lines = loco.sounds.split('\n');
        lines.forEach(line => {
            if (line.trim() === "") return;
            let parts = line.split(':');
            let funcion = parts[0] ? parts[0].trim() : "";
            let description = parts[1] ? parts.slice(1).join(':').trim() : "";

            const row = document.createElement('tr');
            row.innerHTML = `<td style="font-weight:bold; color:var(--primary); width:30%;">${funcion}</td><td>${description}</td>`;
            tableBody.appendChild(row);
        });
    } else {
        tableBody.innerHTML = `<tr><td colspan="2" style="text-align:center; color:var(--text-muted); padding:1.5rem;">No hay funciones cargadas.</td></tr>`;
    }
    mostrarModal('soundListModal');
}

async function uploadToStorage(file, folder) {
    if (!file) return null;
    const shortRandom = Math.floor(Math.random() * 1000);
    const filePath = `${folder}/${shortRandom}_${file.name}`; 

    const { error } = await supabase.storage.from('locobase-media').upload(filePath, file, { cacheControl: '3600', upsert: true });
    if (error) {
        console.error("Error al subir archivo:", error.message);
        return null;
    }
    const { data } = supabase.storage.from('locobase-media').getPublicUrl(filePath);
    return data.publicUrl;
}

async function handleLocoSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('locoId').value;
    const name = document.getElementById('locoName').value;
    const category = document.getElementById('locoCategory').value;
    const sounds = document.getElementById('locoSoundText').value;

    const imgUrl = fileImg ? await uploadToStorage(fileImg, 'images') : (id ? locomotives.find(l=>String(l.id)===String(id)).image_url : null);
    const pdfUrl = filePdf ? await uploadToStorage(filePdf, 'manuals') : (id ? locomotives.find(l=>String(l.id)===String(id)).pdf_url : null);
    const z21Url = fileZ21 ? await uploadToStorage(fileZ21, 'z21') : (id ? locomotives.find(l=>String(l.id)===String(id)).z21_url : null);

    const locoData = { name, category, sounds, image_url: imgUrl, pdf_url: pdfUrl, z21_url: z21Url };

    let result;
    if(id) {
        result = await supabase.from('locomotives').update(locoData).eq('id', parseInt(id));
    } else {
        result = await supabase.from('locomotives').insert([locoData]);
    }

    if (result.error) alert("Error guardando datos: " + result.error.message);
    else {
        await fetchLocomotives();
        cerrarModal('locoModal');
    }
}

function openLocoModal(id = null) {
    locoForm.reset();
    fileImg = null; filePdf = null; fileZ21 = null;
    document.getElementById('imgPreviewContainer').classList.add('hidden');
    document.getElementById('pdfFileStatus').innerText = "";
    document.getElementById('z21FileStatus').innerText = "";
    
    if(id) {
        const loco = locomotives.find(l => String(l.id) === String(id));
        document.getElementById('modalTitle').innerText = "Editar Locomotora";
        document.getElementById('locoId').value = loco.id;
        document.getElementById('locoName').value = loco.name;
        document.getElementById('locoCategory').value = loco.category;
        document.getElementById('locoSoundText').value = loco.sounds || "";
        document.getElementById('deleteLocoBtn').classList.remove('hidden');

        if(loco.image_url) {
            document.getElementById('imgPreview').src = loco.image_url;
            document.getElementById('imgPreviewContainer').classList.remove('hidden');
        }
        if(loco.pdf_url) document.getElementById('pdfFileStatus').innerText = "Manual guardado en la nube.";
        if(loco.z21_url) document.getElementById('z21FileStatus').innerText = "Archivo Z21 guardado en la nube.";
    } else {
        document.getElementById('modalTitle').innerText = "Nueva Locomotora";
        document.getElementById('locoId').value = "";
        document.getElementById('deleteLocoBtn').classList.add('hidden');
    }
    mostrarModal('locoModal');
}

async function handleLogin(e) {
    e.preventDefault();
    const userInput = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const finalEmail = userInput.includes('@') ? userInput : `${userInput}${S_DOMAIN}`;

    const { data, error } = await supabase.auth.signInWithPassword({ email: finalEmail, password });

    if (error) {
        document.getElementById('loginError').classList.remove('hidden');
    } else {
        currentSession = data.session;
        setAdminUI(true);
        cerrarModal('loginModal');
        loginForm.reset();
        document.getElementById('loginError').classList.add('hidden');
    }
}

async function handleLogout() {
    await supabase.auth.signOut();
    currentSession = null;
    setAdminUI(false);
}

async function checkExistingSession() {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        currentSession = session;
        setAdminUI(!!session);
    } catch {
        currentSession = null;
        setAdminUI(false);
    }
}

function setAdminUI(logged) {
    if(logged) {
        loginBtn.classList.add('hidden');
        logoutBtn.classList.remove('hidden');
        addLocoBtn.classList.remove('hidden');
    } else {
        loginBtn.classList.remove('hidden');
        logoutBtn.classList.add('hidden');
        addLocoBtn.classList.add('hidden');
    }
    renderLocomotives();
}

// --- MANEJO DEL TEMA (OSCURO / CLARO) ---
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    themeIcon.innerText = savedTheme === 'dark' ? 'light_mode' : 'dark_mode';
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    let newTheme = currentTheme === 'light' ? 'dark' : 'light';
    themeIcon.innerText = newTheme === 'dark' ? 'light_mode' : 'dark_mode';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
}