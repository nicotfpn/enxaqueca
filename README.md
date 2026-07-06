# Diário de Enxaqueca

Aplicativo PWA para registro e acompanhamento de crises de enxaqueca. Projetado para uso em iPhone, com suporte a "Adicionar à Tela de Início" e funcionamento parcial offline.

## Stack

- **Frontend:** HTML/CSS/JS vanilla
- **Backend:** Vercel Serverless Functions (API routes em `/api`)
- **Storage:** Vercel KV (Redis)
- **Auth:** PIN numérico de 4 dígitos

## Estrutura de pastas

```
/
├── api/
│   ├── pin.js                     # POST /api/pin — criar/verificar PIN
│   └── crises/
│       └── [pin]/
│           ├── month.js            # GET /api/crises/:pin/month — crises do mês
│           └── [data].js           # GET/PUT/DELETE /api/crises/:pin/:data — crise individual
├── icons/
│   ├── icon-192.svg
│   └── icon-512.svg
├── index.html
├── style.css
├── app.js
├── manifest.json
├── sw.js
├── offline.html
├── vercel.json
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

## Deploy no Vercel

### 1. Criar projeto no Vercel

```bash
npm i -g vercel
vercel login
vercel
```

Siga as instruções para importar o repositório.

### 2. Configurar Vercel KV

No dashboard do Vercel:
1. Acesse **Storage → Create Database → Vercel KV**
2. Escolha o projeto e a região mais próxima
3. Após criar, vá em **Settings → Environment Variables** — as variáveis `KV_URL`, `KV_REST_API_URL` e `KV_REST_API_TOKEN` são automaticamente injetadas no projeto

### 3. Deploy

```bash
vercel --prod
```

Ou conecte o repositório ao Vercel para deploys automáticos a cada push.

## Desenvolvimento local

1. Clone o repositório
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Crie um arquivo `.env` com as variáveis do Vercel KV (disponível em **Storage → Seu KV → Quick Start**)
4. Use o Vercel CLI para rodar localmente:
   ```bash
   vercel dev
   ```

## Uso

1. Abra o app pela primeira vez
2. Digite um PIN de 4 dígitos — ele será criado para você
3. Nas próximas vezes, digite o mesmo PIN para acessar seus dados
4. Toque em um dia no calendário para adicionar ou ver uma crise
5. Use o botão **+** no canto inferior direito para registrar a crise de hoje rapidamente
6. Adicione o app à tela inicial do iPhone: Safari → Compartilhar → Adicionar à Tela de Início

## Modelo de dados (KV)

Chave `crises:{pin}:{YYYY-MM-DD}` com valor:

```json
{
  "data": "2026-07-06",
  "intensidade": 7,
  "hora_inicio": "14:30",
  "tomou_medicamento": true,
  "medicamentos": ["Dipirona 1g"],
  "foi_hospital": false,
  "teve_gatilho": true,
  "gatilho": "noite mal dormida"
}
```

## Licença

MIT
