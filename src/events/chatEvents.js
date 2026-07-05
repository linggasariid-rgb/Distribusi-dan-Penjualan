import { sendChatAI } from '../modules/chat/chatAI.js';

export function initChatEvents() {
  const sendBtn = document.getElementById('btn-chat-ai-send');
  if (sendBtn) sendBtn.addEventListener('click', sendChatAI);

  const input = document.getElementById('chat-ai-input');
  if (input) input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') sendChatAI();
  });
}
