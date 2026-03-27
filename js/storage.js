// ── persistence ────────────────────────────────────────────────────────────────

const LS_DISC  = 'nsky_v2_discovered';
const LS_NIGHT = 'nsky_v2_nightcount';
const LS_DATE  = 'nsky_v2_nightdate';

let discoveredSet = new Set(JSON.parse(localStorage.getItem(LS_DISC) || '[]'));
let nightCount    = parseInt(localStorage.getItem(LS_NIGHT) || '0', 10);

function saveDiscovered() {
  localStorage.setItem(LS_DISC, JSON.stringify([...discoveredSet]));
}

// ── gallery (IndexedDB) ────────────────────────────────────────────────────────

let galleryDB = null;
(function openGalleryDB() {
  const req = indexedDB.open('nsky_gallery', 1);
  req.onupgradeneeded = e =>
    e.target.result.createObjectStore('photos', { keyPath: 'id', autoIncrement: true });
  req.onsuccess = e => { galleryDB = e.target.result; };
})();

function galSavePhoto(blob, expSecs) {
  if (!galleryDB) return;
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    const scale = Math.min(1, 640 / img.width);
    const oc = document.createElement('canvas');
    oc.width = img.width * scale; oc.height = img.height * scale;
    oc.getContext('2d').drawImage(img, 0, 0, oc.width, oc.height);
    URL.revokeObjectURL(url);
    oc.toBlob(thumb => {
      // Read both thumbnail (JPEG, for display) and original (PNG, for saving)
      const rThumb = new FileReader(), rFull = new FileReader();
      let thumbData = null, fullData = null;
      function tryStore() {
        if (thumbData === null || fullData === null) return;
        galleryDB.transaction('photos', 'readwrite').objectStore('photos')
          .add({ data: thumbData, fullData, night: nightCount, date: Date.now(), expSecs: expSecs || 0 });
      }
      rThumb.onload = () => { thumbData = rThumb.result; tryStore(); };
      rFull.onload  = () => { fullData  = rFull.result;  tryStore(); };
      rThumb.readAsDataURL(thumb);
      rFull.readAsDataURL(blob);
    }, 'image/jpeg', 0.74);
  };
  img.src = url;
}

function galLoad(cb) {
  if (!galleryDB) { cb([]); return; }
  const req = galleryDB.transaction('photos','readonly').objectStore('photos').getAll();
  req.onsuccess = () => cb(req.result);
}

function galDelete(id, onDone) {
  if (!galleryDB) return;
  const tx = galleryDB.transaction('photos','readwrite');
  tx.objectStore('photos').delete(id);
  tx.oncomplete = onDone;
}

let _galActiveTab = 'photos';

function switchGalleryTab(tab) {
  _galActiveTab = tab;
  document.querySelectorAll('.gal-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  const photosPane  = document.getElementById('gallery-photos-pane');
  const rewardsPane = document.getElementById('gallery-rewards-pane');
  photosPane.style.display  = tab === 'photos'  ? 'flex' : 'none';
  rewardsPane.style.display = tab === 'rewards' ? 'flex' : 'none';
}

function openGalleryUI(tab) {
  const targetTab = (typeof tab === 'string') ? tab : 'photos';
  galLoad(photos => {
    // ── Photos tab ──────────────────────────────────────────────────────────
    const grid  = document.getElementById('gallery-grid');
    const empty = document.getElementById('gallery-empty');
    grid.innerHTML = '';
    photos.reverse();
    empty.style.display = photos.length ? 'none' : 'block';
    photos.forEach(p => {
      const item  = document.createElement('div');  item.className = 'gal-item';
      const img   = document.createElement('img');  img.src = p.data;
      const lbl   = document.createElement('div');  lbl.className = 'gal-label';
      const peaked = p.expSecs >= 0.82;
      lbl.textContent = `Nuit ${p.night}${peaked ? ' · ×3' : ''}`;

      const del  = document.createElement('button'); del.className = 'gal-del'; del.textContent = '✕';
      del.onclick = e => {
        e.stopPropagation();
        galDelete(p.id, () => { item.remove(); if (!grid.children.length) empty.style.display = 'block'; });
      };

      const save = document.createElement('button'); save.className = 'gal-save'; save.textContent = '↓';
      save.title = 'Enregistrer';
      save.onclick = e => {
        e.stopPropagation();
        const dataUrl = p.fullData || p.data;
        const ext = p.fullData ? 'png' : 'jpg';
        const filename = `nuit-${p.night}.${ext}`;
        function download() {
          const a = document.createElement('a'); a.download = filename; a.href = dataUrl; a.click();
        }
        if (navigator.canShare) {
          fetch(dataUrl).then(r => r.blob()).then(b => {
            const file = new File([b], filename, { type: b.type });
            if (navigator.canShare({ files: [file] })) navigator.share({ files: [file] }).catch(download);
            else download();
          }).catch(download);
        } else {
          download();
        }
      };

      item.onclick = () => {
        document.getElementById('gallery-full-img').src = p.fullData || p.data;
        document.getElementById('gallery-full').classList.add('open');
      };
      item.append(img, lbl, save, del);
      grid.appendChild(item);
    });

    // ── Rewards tab ─────────────────────────────────────────────────────────
    const rwGrid  = document.getElementById('rewards-grid');
    const rwEmpty = document.getElementById('rewards-empty');
    rwGrid.innerHTML = '';
    const purchasesList = typeof purchases !== 'undefined' ? purchases : [];
    rwEmpty.style.display = purchasesList.length ? 'none' : 'block';

    // Group by type — multiple purchases stack into one card
    const grouped = {};
    for (const p of purchasesList) {
      if (!grouped[p.type]) grouped[p.type] = { ...p, count: 0 };
      grouped[p.type].count++;
    }
    Object.values(grouped).forEach(g => {
      const card = document.createElement('div'); card.className = 'reward-card';

      if (g.count > 1) {
        const badge = document.createElement('div'); badge.className = 'reward-count';
        badge.textContent = `×${g.count}`;
        card.appendChild(badge);
      }

      const ico  = document.createElement('div'); ico.className = 'reward-icon'; ico.textContent = g.icon;
      const lbl  = document.createElement('div'); lbl.className = 'reward-label'; lbl.textContent = g.label;
      const desc = document.createElement('div'); desc.className = 'reward-desc'; desc.textContent = g.desc;

      card.append(ico, lbl, desc);
      rwGrid.appendChild(card);
    });

    document.getElementById('gallery').classList.add('open');
    switchGalleryTab(targetTab);
  });
}

document.getElementById('gallery-btn').addEventListener('click', () => openGalleryUI('photos'));
document.getElementById('gallery-close').addEventListener('click', () =>
  document.getElementById('gallery').classList.remove('open'));
document.getElementById('gallery-full').addEventListener('click', () =>
  document.getElementById('gallery-full').classList.remove('open'));

// ── toast ─────────────────────────────────────────────────────────────────────

let toastTimer = null;
const toastEl = document.getElementById('toast');
function showToast(msg, duration = 2800) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), duration);
}
