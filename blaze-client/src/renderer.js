const pages={home:['Welcome back.','Your worlds and profiles, all in one place.'],profiles:['Your profiles','Separate instances for different Minecraft setups.'],mods:['Mods & resource packs','Discover and manage compatible content.'],security:['Security scan','Inspect files in your selected instance.'],settings:['Blaze settings','Launcher preferences and diagnostics.']};
function showPage(id){document.querySelectorAll('.page').forEach(x=>x.classList.toggle('hidden',x.id!==id));document.querySelectorAll('nav button').forEach(x=>x.classList.toggle('active',x.dataset.page===id));document.getElementById('heading').textContent=pages[id][0];document.getElementById('subheading').textContent=pages[id][1];if(id==='profiles'||id==='security')refreshProfiles();}
document.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>showPage(b.dataset.page)));
document.getElementById('openProfiles').onclick=()=>showPage('profiles');
async function refreshProfiles(){const profiles=await window.blaze.listProfiles();document.getElementById('profileCount').textContent=profiles.length;const list=document.getElementById('profilesList');list.innerHTML='';const sel=document.getElementById('scanProfile');sel.innerHTML='<option value="">Choose profile…</option>';for(const p of profiles){const row=document.createElement('div');row.className='profileitem';const name=document.createElement('b');name.textContent=p;const meta=document.createElement('small');meta.textContent='Blaze managed instance';const left=document.createElement('div');left.append(name,meta);row.append(left);list.append(row);const opt=document.createElement('option');opt.value=p;opt.textContent=p;sel.append(opt);}}
document.getElementById('newProfile').onclick=async()=>{const name=prompt('Name your new profile:');if(!name)return;try{await window.blaze.createProfile(name);await refreshProfiles();}catch(e){alert(e.message)}};
document.getElementById('scanButton').onclick=async()=>{const p=document.getElementById('scanProfile').value;if(!p){alert('Choose a profile first.');return;}const out=document.getElementById('scanResults');out.textContent='Scanning files and calculating hashes…';try{const r=await window.blaze.scanInstance(p);out.textContent=`Profile: ${r.profile}\nScanned: ${r.scannedAt}\nFiles: ${r.files.length}\n\n${r.warning}\n\n`+r.files.map(f=>`${f.status.toUpperCase()}  ${f.path}\n  ${f.sha256||'No hash'}\n  ${f.reason}`).join('\n\n');}catch(e){out.textContent=`Scan failed: ${e.message}`}};
for(const id of ['openLogs','openLogs2'])document.getElementById(id).onclick=()=>window.blaze.openFolder('logs');
for(const id of ['openInstances','openInstances2'])document.getElementById(id).onclick=()=>window.blaze.openFolder('instances');
refreshProfiles();

const modProfile = document.getElementById('modProfile');
async function refreshModProfiles(){
  const profiles=await window.blaze.listProfiles();
  const current=modProfile.value;
  modProfile.innerHTML='<option value="">Choose profile…</option>';
  for(const name of profiles){const o=document.createElement('option');o.value=name;o.textContent=name;modProfile.append(o);}
  if(profiles.includes(current)) modProfile.value=current;
}
const resultsEl=document.getElementById('modResults');
document.getElementById('searchModrinth').onclick=async()=>{
  const profile=modProfile.value;
  if(!profile){alert('Create or choose a profile first.');return;}
  const args={query:document.getElementById('modQuery').value,type:document.getElementById('contentType').value,gameVersion:document.getElementById('gameVersion').value,loader:document.getElementById('gameLoader').value};
  resultsEl.textContent='Searching Modrinth…';
  try{
    const items=await window.blaze.modrinthSearch(args);
    resultsEl.replaceChildren();
    if(!items.length){resultsEl.textContent='No matching projects found for these filters.';return;}
    for(const item of items){
      const card=document.createElement('article');card.className='modcard';
      if(item.icon){const img=document.createElement('img');img.src=item.icon;img.alt='';img.referrerPolicy='no-referrer';card.append(img);}
      const body=document.createElement('div');body.className='modbody';
      const title=document.createElement('b');title.textContent=item.title;
      const desc=document.createElement('p');desc.textContent=item.description||'No description provided.';
      const meta=document.createElement('small');meta.textContent=`${Number(item.downloads||0).toLocaleString()} downloads · ${item.type}`;
      body.append(title,desc,meta);card.append(body);
      const install=document.createElement('button');install.className='secondary';install.textContent='Install';
      install.onclick=async()=>{install.disabled=true;install.textContent='Installing…';try{const done=await window.blaze.modrinthInstall({...args,profile,projectId:item.id});install.textContent='Installed';alert(`Installed ${done.filename} into ${profile}.`);}catch(e){install.disabled=false;install.textContent='Install';alert(e.message);}};
      card.append(install);resultsEl.append(card);
    }
  }catch(e){resultsEl.textContent=`Modrinth search failed: ${e.message}`;}
};
const originalRefreshProfiles=refreshProfiles;
refreshProfiles=async()=>{await originalRefreshProfiles();await refreshModProfiles();};

const versionSelect=document.getElementById('gameVersion');
const loaderSelect=document.getElementById('gameLoader');
function syncLoaderRule(){
  const legacy=['1.8','1.8.9'].includes(versionSelect.value);
  loaderSelect.value=legacy?'forge':'fabric';
  for(const option of loaderSelect.options){option.disabled=legacy?option.value!=='forge':option.value!=='fabric';}
}
versionSelect.addEventListener('change',syncLoaderRule);
syncLoaderRule();
