# Enxaqueca — Diário íntimo para minha irmã

Em 2023, minha irmã começou a ter crises de enxaqueca debilitantes. Ela tentou 3 apps diferentes, mas todos tinham cadastros enormes, anúncios ou vendiam dados.

Eu criei este PWA para ela. **Zero tracking. Zero firulas.** Apenas um calendário, um botão de +, e estatísticas que realmente importam para o neurologista.

## Stack (o mínimo necessário)
- Backend: Vercel Serverless + KV (Redis)
- Frontend: Vanilla JS (sem frameworks, para garantir longevidade)
- Hospedagem: Vercel (gratuito)

## Como rodar localmente (para contribuidores)
1. Clone
2. `npm install` (ou `pnpm install`)
3. Configure as variáveis `.env` (peça as keys no meu Telegram)
4. `vercel dev`

---
**Disclaimer**: Esse código é aberto para estudos. Se você tem enxaqueca, procure um médico. Esse app é um diário, não um diagnóstico.
