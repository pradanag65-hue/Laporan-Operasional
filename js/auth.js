/* =========================================================
   auth.js — login & pembatasan role (Admin / Input / Guest)
   ---------------------------------------------------------
   PENTING: ini proteksi ringan di sisi browser saja (client-side), BUKAN
   keamanan tingkat enterprise. PIN disimpan di config/config.json yang
   bisa diunduh siapa pun yang tahu URL-nya. Cocok untuk membatasi akses
   tim internal secara informal, TAPI JANGAN dipakai untuk melindungi data
   yang benar-benar rahasia. Untuk itu, pakai autentikasi server sungguhan
   (mis. login Google lewat Apps Script, atau Supabase Auth).
   ========================================================= */

let currentRole = null;
let pendingLoginRole = null;

function rolePins(){ return window.CFG.auth.pins; }
function roleLabels(){ return window.CFG.auth.labels; }

function initAuth(){
  const saved = localStorage.getItem('tj-role');
  if(saved && roleLabels()[saved]){
    currentRole = saved;
    hideLogin();
    try{ applyRole(); }catch(e){}
  } else {
    showLogin();
  }

  document.querySelectorAll('.role-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const role = btn.dataset.role;
      if(role === 'guest'){ loginAs('guest'); return; }
      pendingLoginRole = role;
      document.getElementById('loginRoleLabel').textContent = '(' + roleLabels()[role] + ')';
      document.getElementById('loginPinWrap').style.display = 'block';
      document.getElementById('loginMsg').textContent = '';
      const pinInput = document.getElementById('loginPin');
      pinInput.value = '';
      pinInput.focus();
    });
  });

  document.getElementById('btnLoginSubmit').addEventListener('click', submitLoginPin);
  document.getElementById('loginPin').addEventListener('keydown', (e)=>{
    if(e.key === 'Enter') submitLoginPin();
  });
  document.getElementById('btnLoginBack').addEventListener('click', ()=>{
    document.getElementById('loginPinWrap').style.display = 'none';
    pendingLoginRole = null;
  });
  document.getElementById('btnLogout').addEventListener('click', logout);
}

function submitLoginPin(){
  const pin = document.getElementById('loginPin').value;
  const msg = document.getElementById('loginMsg');
  if(pendingLoginRole && pin === rolePins()[pendingLoginRole]){
    loginAs(pendingLoginRole);
  } else {
    msg.textContent = 'PIN salah, coba lagi.';
  }
}

function loginAs(role){
  currentRole = role;
  localStorage.setItem('tj-role', role);
  hideLogin(); // tampilkan dashboard dulu, apa pun yang terjadi setelah ini
  try{ applyRole(); }catch(e){ /* jangan sampai dashboard nyangkut kalau ini gagal */ }
}

function logout(){
  currentRole = null;
  localStorage.removeItem('tj-role');
  document.body.classList.remove('role-admin','role-input','role-guest','authed');
  document.querySelectorAll('nav.tabs button').forEach(b=>b.classList.remove('active'));
  document.querySelector('nav.tabs button[data-tab="ringkasan"]').classList.add('active');
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
  document.getElementById('panel-ringkasan').classList.add('active');
  showLogin();
}

function showLogin(){
  document.getElementById('loginOverlay').style.display = 'flex';
  document.getElementById('appShell').style.display = 'none';
}
function hideLogin(){
  document.getElementById('loginOverlay').style.display = 'none';
  document.getElementById('appShell').style.display = 'grid';
}

function applyRole(){
  document.body.classList.remove('role-admin','role-input','role-guest');
  document.body.classList.add('role-' + currentRole, 'authed');
  const badge = document.getElementById('userRoleBadge');
  if(badge) badge.textContent = roleLabels()[currentRole];
  renderInputTable(); // render ulang supaya tombol Hapus muncul/hilang sesuai role
}

// Admin: bebas tambah & timpa data apa saja.
// Input: hanya boleh menambah baris BARU (trayek+bulan yang belum ada).
// Guest: tidak boleh menulis apa pun.
function canWriteEntry(route, monthIndex){
  if(currentRole === 'admin') return true;
  if(currentRole === 'input'){
    return !entries.some(e=>e.route===route && e.monthIndex===monthIndex);
  }
  return false;
}
