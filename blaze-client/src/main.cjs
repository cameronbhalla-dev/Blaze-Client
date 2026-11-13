const { app, BrowserWindow, ipcMain, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const userData = app.getPath('userData');
const instancesDir = path.join(userData, 'instances');
const logsDir = path.join(userData, 'logs');
fs.mkdirSync(instancesDir, { recursive: true });
fs.mkdirSync(logsDir, { recursive: true });

function createWindow() {
  const win = new BrowserWindow({
    width: 1180, height: 760, minWidth: 900, minHeight: 620,
    backgroundColor: '#090909', title: 'Blaze Client',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  win.loadFile(path.join(__dirname, 'index.html'));
  win.webContents.on('render-process-gone', (_event, details) => {
    const report = { type: 'renderer-crash', reason: details.reason, exitCode: details.exitCode, at: new Date().toISOString() };
    fs.writeFileSync(path.join(logsDir, `renderer-${Date.now()}.json`), JSON.stringify(report, null, 2));
  });
}


const MODRINTH_API = 'https://api.modrinth.com/v2';
async function modrinthJson(url) {
  const u = new URL(url);
  if (u.hostname !== 'api.modrinth.com' || u.protocol !== 'https:') throw new Error('Blocked unexpected Modrinth URL.');
  const res = await fetch(u, { headers: { 'User-Agent': 'BlazeClient/0.2.0 (launcher)' } });
  if (!res.ok) throw new Error(`Modrinth request failed (${res.status}).`);
  return res.json();
}
function profilePath(name) {
  const safe = String(name || '').trim();
  const root = path.resolve(instancesDir);
  const target = path.resolve(root, safe);
  if (!safe || !target.startsWith(root + path.sep)) throw new Error('Invalid profile.');
  if (!fs.existsSync(target) || fs.lstatSync(target).isSymbolicLink() || !fs.statSync(target).isDirectory()) throw new Error('Profile folder not found or is not a safe directory.');
  return target;
}
ipcMain.handle('blaze:modrinth-search', async (_e, args = {}) => {
  const query = String(args.query || '').trim().slice(0, 100);
  const type = args.type === 'resourcepack' ? 'resourcepack' : 'mod';
  const version = String(args.gameVersion || '').trim().slice(0, 20);
  const loader = String(args.loader || 'fabric').toLowerCase();
  if (!['fabric', 'forge', 'neoforge', 'quilt'].includes(loader)) throw new Error('Unsupported loader filter.');
  const facets = [[`project_type:${type}`]];
  if (version) facets.push([`versions:${version}`]);
  if (type === 'mod') facets.push([`categories:${loader}`]);
  const url = new URL(`${MODRINTH_API}/search`);
  url.searchParams.set('query', query);
  url.searchParams.set('limit', '20');
  url.searchParams.set('facets', JSON.stringify(facets));
  const data = await modrinthJson(url);
  return (data.hits || []).map(x => ({ id: x.project_id, slug: x.slug, title: x.title, description: x.description, downloads: x.downloads, icon: x.icon_url, type }));
});
ipcMain.handle('blaze:modrinth-install', async (_e, args = {}) => {
  const root = profilePath(args.profile);
  const projectId = String(args.projectId || '').trim();
  const type = args.type === 'resourcepack' ? 'resourcepack' : 'mod';
  const gameVersion = String(args.gameVersion || '').trim();
  const loader = String(args.loader || 'fabric').toLowerCase();
  if (!/^[A-Za-z0-9_-]{2,64}$/.test(projectId)) throw new Error('Invalid Modrinth project ID.');
  if (!/^[0-9.]{1,20}$/.test(gameVersion)) throw new Error('Choose a valid Minecraft version.');
  const versionsUrl = new URL(`${MODRINTH_API}/project/${encodeURIComponent(projectId)}/version`);
  versionsUrl.searchParams.set('game_versions', JSON.stringify([gameVersion]));
  if (type === 'mod') versionsUrl.searchParams.set('loaders', JSON.stringify([loader]));
  const versions = await modrinthJson(versionsUrl);
  if (!versions.length) throw new Error('No compatible file was found for this Minecraft version and loader.');
  const version = versions[0];
  const file = (version.files || []).find(f => f.primary) || (version.files || [])[0];
  if (!file || !file.url || !file.filename) throw new Error('Modrinth did not provide an installable file.');
  const fileUrl = new URL(file.url);
  if (fileUrl.protocol !== 'https:' || !['cdn.modrinth.com', 'cdn-raw.modrinth.com'].includes(fileUrl.hostname)) throw new Error('Blocked download from an untrusted file host.');
  const response = await fetch(fileUrl);
  if (!response.ok) throw new Error(`Download failed (${response.status}).`);
  const declaredSize = Number(response.headers.get('content-length') || 0);
  const maxDownload = 200 * 1024 * 1024;
  if (declaredSize > maxDownload) throw new Error('File is larger than the 200 MiB safety limit.');
  const chunks = []; let received = 0;
  for await (const chunk of response.body) { received += chunk.length; if (received > maxDownload) throw new Error('File exceeded the 200 MiB safety limit while downloading.'); chunks.push(chunk); }
  const bytes = Buffer.concat(chunks);
  const expectedSha512 = file.hashes && file.hashes.sha512;
  if (expectedSha512) {
    const actualSha512 = crypto.createHash('sha512').update(bytes).digest('hex');
    if (actualSha512.toLowerCase() !== expectedSha512.toLowerCase()) throw new Error('Downloaded file failed Modrinth SHA-512 integrity verification.');
  } else { throw new Error('Modrinth did not provide a SHA-512 hash; refusing installation.'); }
  const folder = path.join(root, type === 'mod' ? 'mods' : 'resourcepacks');
  fs.mkdirSync(folder, { recursive: true });
  const safeName = path.basename(file.filename).replace(/[^A-Za-z0-9._-]/g, '_');
  const destination = path.join(folder, safeName);
  if (!destination.startsWith(folder + path.sep)) throw new Error('Invalid destination.');
  if (fs.existsSync(destination)) throw new Error('That file is already installed in this profile.');
  const temp = `${destination}.download`;
  fs.writeFileSync(temp, bytes, { flag: 'wx' });
  fs.renameSync(temp, destination);
  return { filename: safeName, version: version.version_number, path: destination, bytes: bytes.length };
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

ipcMain.handle('blaze:get-info', () => ({ version: app.getVersion(), platform: process.platform, arch: process.arch, home: os.homedir(), instancesDir, logsDir }));
ipcMain.handle('blaze:open-folder', async (_e, which) => {
  const target = which === 'logs' ? logsDir : instancesDir;
  await shell.openPath(target);
  return target;
});
ipcMain.handle('blaze:create-profile', async (_e, name) => {
  const safe = String(name || '').trim().replace(/[^a-zA-Z0-9 _.-]/g, '').slice(0, 40);
  if (!safe) throw new Error('Enter a valid profile name.');
  const dir = path.join(instancesDir, safe);
  if (!dir.startsWith(instancesDir + path.sep)) throw new Error('Invalid profile path.');
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(path.join(dir, 'mods'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'resourcepacks'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'config'), { recursive: true });
  return { name: safe, path: dir };
});
ipcMain.handle('blaze:list-profiles', () => fs.readdirSync(instancesDir, { withFileTypes: true }).filter(x => x.isDirectory()).map(x => x.name));
ipcMain.handle('blaze:scan-instance', async (_e, profile) => {
  const safe = String(profile || '').trim();
  const root = path.resolve(instancesDir, safe);
  if (!root.startsWith(path.resolve(instancesDir) + path.sep)) throw new Error('Invalid profile.');
  const results = [];
  const maxBytes = 100 * 1024 * 1024;
  function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      const st = fs.lstatSync(full);
      if (st.isSymbolicLink()) { results.push({ path: path.relative(root, full), status: 'skipped', reason: 'Symbolic link not followed' }); continue; }
      if (st.isDirectory()) walk(full);
      else if (st.isFile()) {
        const item = { path: path.relative(root, full), bytes: st.size, sha256: null, status: 'unclassified', reason: 'Integrity inventory only; no malware verdict available in this starter build.' };
        if (st.size <= maxBytes) item.sha256 = crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex');
        else { item.status = 'not-hashed'; item.reason = 'File exceeds 100 MiB hashing limit.'; }
        results.push(item);
      }
    }
  }
  if (!fs.existsSync(root)) throw new Error('Profile folder not found.');
  walk(root);
  return { profile: safe, scannedAt: new Date().toISOString(), files: results, warning: 'This is an inventory and hash scan, not antivirus detection. It cannot certify files as safe or identify malware by itself.' };
});
