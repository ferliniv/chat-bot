// Script de Integração Direta: TikTok Live -> Coffee Bot
// Cole este script no Console (F12) da aba onde a live do TikTok está aberta!
(() => {
  console.log('%c☕ [Coffee Bot] Iniciando leitor de chat do TikTok...', 'color: #f59e0b; font-size: 14px; font-weight: bold;');

  const processed = new Set();

  function sendToCoffeeBot(user, message) {
    if (!user || !message) return;
    
    // Normalizar usuário (remover badges tipo "A 13", "GCOF", etc)
    let cleanUser = user.replace(/^[A-Z0-9\s]{1,5}\s+/, '').trim();
    if (!cleanUser) cleanUser = user.trim();

    const key = `${cleanUser}:${message}`;
    if (processed.has(key)) return;
    processed.add(key);

    if (processed.size > 200) {
      const first = processed.values().next().value;
      processed.delete(first);
    }

    console.log(`%c☕ [TikTok -> Coffee Bot] %c@${cleanUser}: %c${message}`, 'color:#f59e0b; font-weight:bold;', 'color:#22d3ee; font-weight:bold;', 'color:#fff;');

    fetch('http://localhost:3333/api/webhook/tiktok', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: cleanUser, comment: message })
    }).catch(err => {
      // Tentar via túnel se falhar direto
      fetch('https://evil-socks-wash.loca.lt/api/webhook/tiktok', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: cleanUser, comment: message })
      }).catch(e => console.error('Erro ao enviar mensagem:', e));
    });
  }

  function scanNode(node) {
    if (!node || node.nodeType !== 1) return;

    // Verificar se é item de comentário
    const text = node.innerText || '';
    if (!text || text.length < 2) return;

    const lines = text.split('\n').map(s => s.trim()).filter(Boolean);
    if (lines.length >= 2) {
      // Ignorar notificações de entrada e curtidas normais
      if (text.includes('entrou') || text.includes('curtiu')) return;
      
      const user = lines[0];
      const comment = lines.slice(1).join(' ');
      sendToCoffeeBot(user, comment);
    }
  }

  // Observar alterações no chat
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        scanNode(node);
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  console.log('%c✅ [Coffee Bot] CONECTADO AO VIVO COM SUCESSO!', 'color: #10b981; font-size: 16px; font-weight: bold;');
  console.log('%cQualquer mensagem digitada no chat do TikTok será capturada agora!', 'color: #34d399;');
})();
