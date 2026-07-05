import { callApi } from '../../services/api.js';
import { getUserWHP } from '../../state/authState.js';

let chatAiHistory = [];

export function renderChatBubble(role, text) {
  const box = document.getElementById('chat-ai-messages');
  const isUser = role === 'user';
  const bubble = document.createElement('div');
  bubble.className = isUser ? 'flex justify-end' : 'flex justify-start';
  bubble.innerHTML = '<div class="max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ' +
    (isUser ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-800') + '">' +
    text.replace(/\n/g, '<br>') + '</div>';
  box.appendChild(bubble);
  box.scrollTop = box.scrollHeight;
}

export function sendChatAI() {
  const input = document.getElementById('chat-ai-input');
  const btn = document.getElementById('btn-chat-ai-send');
  const pesan = input.value.trim();
  if (!pesan) return;

  renderChatBubble('user', pesan);
  chatAiHistory.push({ role: 'user', text: pesan });
  input.value = '';
  btn.disabled = true;

  const box = document.getElementById('chat-ai-messages');
  const loadingBubble = document.createElement('div');
  loadingBubble.id = 'chat-ai-loading';
  loadingBubble.className = 'flex justify-start';
  loadingBubble.innerHTML = '<div class="bg-slate-100 text-slate-500 rounded-2xl px-4 py-2.5 text-sm"><div class="inline-block animate-spin rounded-full h-3 w-3 border-2 border-slate-400 border-t-transparent mr-1"></div>Mengetik...</div>';
  box.appendChild(loadingBubble);
  box.scrollTop = box.scrollHeight;

  const riwayat = chatAiHistory.slice(-10);

  callApi('chatWithSalesAI', pesan, riwayat, getUserWHP()).then(function(resp) {
    btn.disabled = false;
    const loading = document.getElementById('chat-ai-loading');
    if (loading) loading.remove();
    if (resp.status === 'error') {
      renderChatBubble('model', 'Maaf, AI sedang sibuk. Coba lagi sebentar lagi.');
      return;
    }
    renderChatBubble('model', resp.message);
    chatAiHistory.push({ role: 'model', text: resp.message });
  }).catch(function(err) {
    btn.disabled = false;
    const loading = document.getElementById('chat-ai-loading');
    if (loading) loading.remove();
    renderChatBubble('model', 'Maaf, AI sedang sibuk. Coba lagi sebentar lagi.');
  });
}
