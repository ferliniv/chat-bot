# ☕ Coffee Bot - Assistente de Transmissão & Live Analytics

O **Coffee Bot** é uma plataforma e bot de chat completo para transmissões ao vivo (TikTok, YouTube e Twitch), inspirada em ferramentas como **StreamElements** e **Nightbot**, feita com visual moderno e tema de cafeteria (café, grãos, torra).

Opera por padrão na porta **3334** para rodar em paralelo com os demais projetos sem colisão de portas.

---

## 🚀 Como Iniciar

1. Instale as dependências (se necessário):
```bash
npm install
```

2. Inicie o servidor:
```bash
npm start
```
ou
```bash
node server.js
```

3. Abra o painel no navegador:
👉 **`http://localhost:3334`**

---

## 🎥 Widgets para o OBS Studio (Browser Source)

No OBS Studio, crie uma fonte do tipo **"Navegador" (Browser Source)** e insira a URL correspondente (fundo 100% transparente):

| Widget | URL | Resolução Recomendada | Descrição |
|---|---|---|---|
| **Copo de Café (Meta)** | `http://localhost:3334/widgets/cup` | 380 x 360 | Xícara animada com café subindo em tempo real e vapor quando alguém usa `!cafe`. |
| **Contador de Likes (+10k)** | `http://localhost:3334/widgets/likes` | 360 x 220 | Contador gigante para TikTok com barra de meta (+10k/20k), chuva de corações e alertas. |
| **Meta de Presentes & Doações** | `http://localhost:3334/widgets/donates` | 360 x 220 | Barra de progresso para gifts do TikTok, Super Chats do YouTube e doações com auto-incremento (+10). |
| **Alert Box** | `http://localhost:3334/widgets/alert` | 600 x 250 | Alertas visuais com sons sintetizados em tempo real de café enchendo a xícara via Web Audio API. |
| **Top Presentes (Ranking OBS)** | `http://localhost:3334/widgets/top-gifts` | 400 x 480 | Overlay de pódio transparente com os maiores doadores de presentes da live. |
| **Top Likes (Ranking OBS)** | `http://localhost:3334/widgets/top-likes` | 400 x 480 | Overlay de pódio com quem mais enviou curtidas no TikTok. |
| **Top Cafezinhos (Ranking OBS)** | `http://localhost:3334/widgets/top-cafezinhos` | 400 x 480 | Leaderboard com os maiores cafezeiros da live. |
| **Leaderboard Rotativo** | `http://localhost:3334/widgets/leaderboard` | 420 x 500 | Alterna automaticamente entre Top Presentes, Likes e Cafezinhos a cada 10 segundos. |
| **Chat Overlay** | `http://localhost:3334/widgets/chat` | 450 x 650 | Chat flutuante com badges de Streamer, Mod, VIP e Sub. |
| **Letreiro / Ticker** | `http://localhost:3334/widgets/ticker` | 1920 x 50 | Barra rolante de informações para topo ou rodapé da live. |

*Dica no OBS*: Marque a opção "Controlar áudio via OBS" na fonte do Alert Box para transmitir os efeitos sonoros diretamente para sua live!

---

## 🎬 Marcador de Clipes & Cortes (Atalho de Teclado)

Na aba **"🎬 Marcador de Clipes"**:
- **Atalho de Teclado Global**: Pressione a tecla **`C`** (ou configure para Espaço, K, M, F8) a qualquer momento para marcar instantaneamente o timecode exato da live (`HH:MM:SS`).
- Adicione anotações e tags rápidas: `🎮 Jogada Épica`, `😂 Engraçado / Meme`, `🏆 Meta Batida`, `🎁 Presente Top`, `💥 Fail`, `💬 Chat`.
- Exportação em 1 clique:
  - `📋 Copiar Formato YouTube`: Formato pronto para capítulos (`01:23:45 - Título`).
  - `📥 Exportar YouTube Chapters (.txt)`: Arquivo pronto para a descrição do YouTube.
  - `📥 Exportar CSV`: Tabela compatível com Adobe Premiere, DaVinci Resolve e CapCut.

---

## 📜 Histórico de Lives & Auditoria

Na aba **"📜 Histórico de Lives & Auditoria"**:
- **Histórico de Lives em Linhas**: Cada transmissão é listada com métricas totais e botão `▼ Detalhes` para expandir:
  - Top Apoiadores (maior em presentes e likes).
  - Lista completa de presentes recebidos, inscrições/membros e doações daquela sessão.
  - Clipes marcados durante a live e notas do streamer.
- **Botão `💾 Encerrar & Salvar Live Atual`**: Arquiva a transmissão ao vivo atual no histórico com 1 clique.
- **Log de Alterações & Auditoria**: Registra todas as mudanças feitas nas configurações, comandos e metas.
- **Histórico de Premiações**: Registra chuvas de cafezinhos e metas batidas concedidas à comunidade.
- **Snapshot de Configurações Ativas**: Resumo visual dos parâmetros operacionais do bot.

---

## ☕ Moeda da Live: "Cafezinho" & Farm por Assistir

Os espectadores acumulam **Cafezinhos** automaticamente assistindo à transmissão (farming por ciclo configurável) com multiplicadores:
- **Subs Twitch**: 1.5x
- **Fã Clube TikTok**: 1.5x
- **Membros YouTube**: 1.5x
- **VIPs & Mods**: 1.2x

---

## 🎲 Mini-games & Interações Prontos

- **`!cafe`**: Prepara um café, avança a meta da xícara na tela e concede Cafezinhos.
- **`!cafezinho`** (ou `!saldo`): Consulta o saldo atual de Cafezinhos do espectador.
- **`!roleta <quantia>`**: Aposta Cafezinhos na torra do café (cooldown de 5min por usuário).
- **`!slots <quantia>`**: Caça-níqueis com símbolos `🧀 Queijo`, `🐍 Cobrinha`, `☕ Cafezinho`, `💎 Diamante`, `❤️ Coração` (cooldown de 5min por usuário).
- **`!duelo @oponente <quantia>`**: Desafia outro espectador para um duelo valendo Cafezinhos (cooldown de 5min por usuário).
- **`!topcafe`**: Mostra o ranking dos espectadores com mais Cafezinhos.
- **`!sorteio`** / **`!entrar`**: Sistema interativo de rifa/sorteio para espectadores.
- **`!alerta <mensagem>`**: Dispara um alerta customizado na tela da live.
- **`!uptime`**: Informa o tempo de transmissão decorrido.
- **`!comandos`**: Lista todos os comandos disponíveis.

---

## ⚙️ Conexões com as Plataformas

No painel de configurações você conecta:
1. **TikTok Live**: Usuário `@gamescoffeesr` (conecta ao chat, likes e presentes em tempo real).
2. **YouTube Live**: Link ou ID da live (ex: `eQte0FqK0LU`).
3. **Twitch**: Canal IRC e bot de chat.
