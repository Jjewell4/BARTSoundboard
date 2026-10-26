const $ = selector => document.querySelector(selector);
const paths = {
  doors: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M12 3v18M8 12h1m6 0h1"/>',
  pin: '<path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  horn: '<path d="m4 10 10-3 5-4v18l-5-4-10-3zM7 15v5h4l-1-4M22 9v6"/>',
  wave: '<path d="M3 10v4m4-8v12m5-16v20m5-16v12m4-8v4"/>',
  train: '<rect x="5" y="2" width="14" height="17" rx="4"/><path d="M5 11h14M12 3v8M8 19l-2 3m10-3 2 3M8 15h1m6 0h1"/>',
  plane: '<path d="m21 3-6 18-4-8-8-4zM11 13 21 3"/>',
  flag: '<path d="M5 22V3c5-5 9 5 15 0v11c-6 5-10-5-15 0"/>',
  spark: '<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3z"/>',
  moon: '<path d="M21 14a9 9 0 0 1-11-11A9 9 0 1 0 21 14Z"/>'
};
let sounds = [], audio = null, activeId = null, loop = false, frame, db, updating = false;
const custom = new Map();
function render() {
  $('#sounds').style.setProperty('--rows', Math.ceil(sounds.length / 2));
  $('#sounds').replaceChildren(...sounds.map(sound => {
    const button = document.createElement('button');
    button.className = `sound-card ${sound.color}`;
    button.dataset.id = sound.id;
    button.setAttribute('aria-pressed', String(activeId === sound.id));
    button.setAttribute('aria-label', `${sound.title}, ${custom.has(sound.id) ? 'your recording' : sound.kind}`);
    button.innerHTML = `<span class="sound-icon" aria-hidden="true"><svg viewBox="0 0 24 24">${paths[sound.icon]}</svg></span><span class="play-glyph" aria-hidden="true">${activeId === sound.id ? '■' : '▶'}</span><span class="sound-title"></span><span class="sound-subtitle"></span><span class="sound-kind"></span>`;
    button.querySelector('.sound-title').textContent = sound.title;
    button.querySelector('.sound-subtitle').textContent = sound.subtitle;
    button.querySelector('.sound-kind').textContent = custom.has(sound.id) ? 'Your recording' : sound.kind;
    button.addEventListener('click', () => play(sound));
    return button;
  }));
  $('#sounds').setAttribute('aria-busy', 'false');
}
function updateButtons() {
  document.querySelectorAll('.sound-card').forEach(button => {
    const selected = button.dataset.id === activeId;
    button.setAttribute('aria-pressed', String(selected));
    button.querySelector('.play-glyph').textContent = selected ? '■' : '▶';
  });
}
function stop(message = 'Ready when you are') {
  if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load(); audio = null; }
  cancelAnimationFrame(frame); activeId = null;
  $('#playing-title').textContent = message;
  $('#equalizer').classList.remove('active'); $('#stop').disabled = true;
  $('#progress').style.width = '0%'; updateButtons();
}
function play(sound) {
  if (activeId === sound.id) { stop(); return; }
  stop();
  const current = new Audio(custom.get(sound.id)?.url || sound.url);
  audio = current; activeId = sound.id; current.loop = loop;
  $('#playing-title').textContent = `Loading ${sound.title}…`;
  $('#stop').disabled = false; updateButtons();
  current.addEventListener('playing', () => {
    if (audio !== current) return;
    $('#playing-title').textContent = sound.title; $('#equalizer').classList.add('active');
  });
  current.addEventListener('ended', () => { if (audio === current) stop(); });
  current.addEventListener('error', () => { if (audio === current) stop('Couldn’t play. Try again online.'); });
  // Call play directly inside the tap handler to keep iOS user activation.
  current.play().catch(() => { if (audio === current) stop('Tap to retry · check your audio file'); });
  function progress() {
    if (audio !== current) return;
    $('#progress').style.width = `${Number.isFinite(current.duration) && current.duration > 0 ? current.currentTime / current.duration * 100 : 0}%`;
    frame = requestAnimationFrame(progress);
  }
  progress();
}
$('#stop').addEventListener('click', () => stop());
$('#repeat').addEventListener('click', () => {
  loop = !loop; $('#repeat').setAttribute('aria-pressed', String(loop));
  if (audio) audio.loop = loop;
});
document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
window.addEventListener('pagehide', () => stop());
const dialog = $('#info');
$('#install').addEventListener('click', () => dialog.showModal());
for (const selector of ['.close', '.done']) $(selector).addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog && (event.clientX < dialog.getBoundingClientRect().left || event.clientX > dialog.getBoundingClientRect().right || event.clientY < dialog.getBoundingClientRect().top || event.clientY > dialog.getBoundingClientRect().bottom)) dialog.close(); });
function selectTab(tab) {
  document.querySelectorAll('[data-tab]').forEach(button => {
    const selected = button === tab;
    button.setAttribute('aria-selected', String(selected)); button.tabIndex = selected ? 0 : -1;
    $(`#${button.dataset.tab}`).hidden = !selected;
  });
  $('.dialog-content').scrollTop = 0;
}
const tabs = [...document.querySelectorAll('[data-tab]')];
tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectTab(tab));
  tab.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    selectTab(tabs[next]); tabs[next].focus();
  });
});
selectTab(tabs[0]);

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('bart-party-recordings', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('sounds', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
}
async function transaction(mode, action) {
  if (!db) throw new Error('Recording storage is unavailable in this browser.');
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sounds', mode); const request = action(tx.objectStore('sounds'));
    tx.oncomplete = () => resolve(request.result); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
  });
}
$('#audio-file').addEventListener('change', async event => {
  const file = event.target.files[0], id = $('#custom-sound').value;
  if (!file) return;
  const status = $('#custom-status');
  try {
    if (file.size > 20 * 1024 * 1024) throw new Error('Choose a recording smaller than 20 MB.');
    if (!file.size) throw new Error('That file is empty.');
    status.textContent = 'Checking recording…';
    const url = URL.createObjectURL(file);
    const check = new Audio();
    try {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Couldn’t read this audio. Try MP3 or WAV.')), 10000);
        check.onloadedmetadata = () => { clearTimeout(timer); resolve(); };
        check.onerror = () => { clearTimeout(timer); reject(new Error('This audio format cannot play here. Try MP3 or WAV.')); };
        check.preload = 'metadata'; check.src = url;
      });
      await transaction('readwrite', store => store.put({ id, file }));
    } catch (error) { URL.revokeObjectURL(url); throw error; }
    finally { check.removeAttribute('src'); check.load(); }
    if (activeId === id) stop();
    if (custom.has(id)) URL.revokeObjectURL(custom.get(id).url);
    custom.set(id, { file, url }); render(); status.textContent = 'Saved on this device. Your button is ready.';
  } catch (error) { status.textContent = error.message || 'Couldn’t save. Device storage may be full.'; }
  event.target.value = '';
});
$('#reset-sound').addEventListener('click', async () => {
  const id = $('#custom-sound').value;
  try {
    await transaction('readwrite', store => store.delete(id));
    if (activeId === id) stop();
    if (custom.has(id)) URL.revokeObjectURL(custom.get(id).url);
    custom.delete(id); render(); $('#custom-status').textContent = 'Original sound restored.';
  } catch { $('#custom-status').textContent = 'Couldn’t restore. Please try reopening the app.'; }
});

async function offlineStatus() {
  const label = $('#offline-status');
  if (!navigator.serviceWorker?.controller) return;
  const channel = new MessageChannel();
  channel.port1.onmessage = event => {
    label.classList.toggle('ready', event.data.ready);
    label.textContent = event.data.ready ? 'Saved for offline' : 'Not saved yet · reopen online';
    channel.port1.close();
  };
  navigator.serviceWorker.controller.postMessage('STATUS', [channel.port2]);
}
async function init() {
  try {
    const response = await fetch('/sounds.json');
    if (!response.ok) throw new Error('Sound list failed');
    sounds = await response.json();
    $('#excerpt-credit').hidden = !sounds.some(sound => sound.id.startsWith('announcer'));
    for (const sound of sounds) $('#custom-sound').add(new Option(sound.title, sound.id));
    try {
      db = await openDatabase();
      const saved = await transaction('readonly', store => store.getAll());
      for (const item of saved) custom.set(item.id, { file: item.file, url: URL.createObjectURL(item.file) });
    } catch { $('#custom-status').textContent = 'Custom recording storage is unavailable. Built-in sounds still work.'; }
    render();
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        offlineStatus();
      });
      const registration = await navigator.serviceWorker.register('/sw.js');
      const showUpdate = () => { $('#update').hidden = !registration.waiting; };
      showUpdate();
      $('#update').addEventListener('click', () => {
        if (!registration.waiting) return;
        stop(); updating = true;
        $('#update').disabled = true; $('#update').textContent = 'Updating…';
        registration.waiting.postMessage('ACTIVATE_UPDATE');
      });
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        worker?.addEventListener('statechange', () => {
          showUpdate();
          if (worker.state === 'redundant') $('#offline-status').textContent = 'Couldn’t save offline · reconnect and reopen';
        });
      });
      await navigator.serviceWorker.ready;
      await offlineStatus();
    } else $('#offline-status').textContent = 'Offline saving requires HTTPS or localhost';
  } catch { $('#offline-status').textContent = 'Couldn’t load or save. Reconnect and refresh.'; }
}
init();
