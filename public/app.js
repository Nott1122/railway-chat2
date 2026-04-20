const API = '';
let token = localStorage.getItem('token');
let socket = null;
let me = null;

const $ = s => document.querySelector(s);
const authDiv = $('#auth');
const profileDiv = $('#profile');
const appDiv = $('#app');

async function api(path, opts={}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers||{}) };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(API + path, { ...opts, headers });
  if (!res.ok) throw new Error((await res.json()).error || 'Erro');
  return res.json();
}

$('#loginBtn').onclick = async () => {
  try {
    const data = await api('/api/login', { method:'POST', body: JSON.stringify({ email: $('#email').value, password: $('#password').value }) });
    token = data.token; localStorage.setItem('token', token); await init();
  } catch(e){ $('#authError').textContent = e.message }
};
$('#registerBtn').onclick = async () => {
  try {
    const data = await api('/api/register', { method:'POST', body: JSON.stringify({ email: $('#email').value, password: $('#password').value }) });
    token = data.token; localStorage.setItem('token', token); await init();
  } catch(e){ $('#authError').textContent = e.message }
};

$('#avatar').onchange = e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => $('#preview').src = reader.result;
  reader.readAsDataURL(file);
};

$('#saveProfile').onclick = async () => {
  const nick = $('#nick').value.trim();
  const avatar = $('#preview').src || '';
  if (!nick) return alert('Escolha um nick');
  me = await api('/api/profile', { method:'POST', body: JSON.stringify({ nick, avatar }) });
  profileDiv.classList.add('hidden');
  startChat();
};

async function init() {
  try {
    me = await api('/api/me');
    authDiv.classList.add('hidden');
    if (!me.nick) {
      profileDiv.classList.remove('hidden');
    } else {
      startChat();
    }
  } catch { localStorage.removeItem('token'); }
}

async function startChat() {
  appDiv.classList.remove('hidden');
  $('#myNick').textContent = me.nick;
  $('#myAvatar').src = me.avatar || 'https://api.dicebear.com/7.x/initials/svg?seed=' + encodeURIComponent(me.nick);

  const history = await api('/api/messages');
  renderMessages(history);

  socket = io({ auth: { token } });
  socket.on('new_message', m => renderMessages([m]));
  socket.on('online_users', users => {
    $('#onlineCount').textContent = users.length;
    $('#onlineList').innerHTML = users.map(u => `
      <div class="user">
        <img src="${u.avatar || 'https://api.dicebear.com/7.x/initials/svg?seed='+encodeURIComponent(u.nick)}">
        <span>${u.nick}</span>
      </div>`).join('');
  });
}

function renderMessages(msgs) {
  const box = $('#messages');
  msgs.forEach(m => {
    const div = document.createElement('div');
    div.className = 'msg';
    div.innerHTML = `
      <img src="${m.user.avatar || 'https://api.dicebear.com/7.x/initials/svg?seed='+encodeURIComponent(m.user.nick)}">
      <div class="bubble">
        <div class="meta">${m.user.nick} • ${new Date(m.createdAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</div>
        <div>${escapeHtml(m.content)}</div>
      </div>`;
    box.appendChild(div);
  });
  box.scrollTop = box.scrollHeight;
}

function escapeHtml(s){ return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])) }

$('#sendBtn').onclick = send;
$('#msgInput').onkeydown = e => { if(e.key==='Enter') send() };
function send(){
  const v = $('#msgInput').value.trim();
  if(!v || !socket) return;
  socket.emit('send_message', { content: v });
  $('#msgInput').value = '';
}

$('#toggleSidebar').onclick = () => $('#sidebar').classList.toggle('open');

if (token) init();