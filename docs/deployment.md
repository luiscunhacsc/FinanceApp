# Publicação sem serviços pagos

Configuração verificada em 05/10/2026. Não é necessário comprar domínio. O projeto não efetua publicações automaticamente nem subscreve serviços.

## Opção A — Apenas no computador

1. Instale Node.js 22.12 ou superior.
2. Abra `Iniciar.cmd` para usar a versão compilada, ou execute `npm ci` e `npm run dev` para desenvolver na pasta do projeto.
3. Use preços manuais, importação de cotações e backups sem configurar serviços externos.

Para instalar a PWA e usar offline, execute `npm run build` e `npm run preview`, visite `http://127.0.0.1:4173` online uma vez e use a opção de instalação do navegador. A instalação é opcional e depende do navegador. IndexedDB está associado à origem: as portas 5173 e 4173 têm dados separados. Transfira-os por backup quando necessário.

## Opção B — Cloudflare Pages Free

1. Execute `npm ci` e `npm run build`. O site fica em `dist`.
2. Numa conta Cloudflare Free, abra Workers & Pages e crie um projeto Pages de carregamento direto.
3. Carregue a pasta `dist`. Use o subdomínio gratuito `nome.pages.dev`.
4. Abra o site e, após carregar, instale-o pelo menu do navegador, se desejar.

Alternativamente, ligue um repositório Git ao Pages: comando de compilação `npm run build`, diretório de saída `dist`, versão Node 22.12 ou superior. O projeto é estático, sem Pages Functions, KV, R2, D1, base de dados ou serviços de análise.

As alterações ao site requerem nova compilação e carregamento. A aplicação avisa quando deteta uma nova versão; o utilizador decide quando a carregar.

## Worker Yahoo opcional

O frontend funciona sem este passo. Para consultar dados gratuitamente:

1. Confirme em Cloudflare que a conta usa **Workers Free**. Não ative Workers Paid, complementos ou domínio pago. A configuração do código não pode substituir a escolha do plano da conta.
2. Edite `apps/proxy/wrangler.jsonc`. Em `ALLOWED_ORIGINS`, acrescente a origem exata do seu site, por exemplo `https://nome.pages.dev`. Separe várias origens por vírgula e não coloque barra final. Este é um controlo do navegador, não autenticação nem garantia contra utilização por clientes externos.
3. Na pasta do projeto, execute:

```powershell
npx wrangler login
npx wrangler deploy --config apps/proxy/wrangler.jsonc
```

4. Copie o endereço `https://patrimonio-dados.<conta>.workers.dev` apresentado.
5. Na app, abra **Dados e definições**, cole o endereço em **Fonte de cotações**, teste e guarde.
6. Prima **Consultar cotações agora**. Não existe atualização periódica oculta.

Para testar sem publicar: `npm run proxy:dev`; configure `http://127.0.0.1:8787` na aplicação. O ficheiro inclui as origens locais de desenvolvimento e pré-visualização.

O Worker permite apenas `/api/health` e `/api/market?symbol=...`; não funciona como proxy de URLs arbitrários. Consulta um destino Yahoo fixo, impõe timeout e limite de resposta, valida os dados e aplica cache de 15 minutos (bolsa) ou 6 horas (NAV). Não envia nem recebe a carteira pessoal.

Workers Free tem uma quota diária de pedidos partilhada pela conta. Pedidos falhados ou bloqueados não apagam dados locais. A aplicação não inicia adesão a um plano pago quando os limites são atingidos. A disponibilidade e os termos das fontes podem mudar; continue com importação/preços manuais se o acesso gratuito deixar de funcionar.

- [Preços e quotas de Workers](https://developers.cloudflare.com/workers/platform/pricing/)
- [Pedidos estáticos em Pages](https://developers.cloudflare.com/pages/functions/pricing/)
- [Cobertura, atrasos e condições do Yahoo](https://help.yahoo.com/kb/finance/article-exchanges-data-delays-sln2310.html)

O Yahoo não fornece uma API contratual neste projeto e impõe condições sobre os seus dados. O proxy destina-se ao uso pessoal; não constitui uma autorização de redistribuição comercial dos dados.

## Opção C — GitHub Pages

1. Crie um repositório público numa conta GitHub Free (não coloque backups pessoais no repositório).
2. Carregue o projeto e ative GitHub Pages com origem **GitHub Actions**.
3. Execute manualmente o workflow `Publicar GitHub Pages` no separador Actions.
4. A compilação usa caminhos relativos, adequados a `https://utilizador.github.io/repositorio/`. A navegação usa fragmentos de URL e não precisa de regras de redirecionamento.
5. Se utilizar o Worker, autorize a origem `https://utilizador.github.io`, sem o caminho do repositório.

O workflow só é executado por pedido manual. Num repositório privado ou conta com outro plano, confirme primeiro que Pages e Actions não implicam despesas; a configuração gratuita documentada usa repositório público. Prefira o carregamento direto em Cloudflare Pages se não quiser usar Actions.

## Salvaguarda dos dados

Não há sincronização entre dispositivos. Cada navegador e origem têm dados próprios. A exportação JSON é a forma mais simples de transferência. O backup CSV também preserva todos os dados deste marco. Ocultar valores não remove os números dos ficheiros exportados. O modo privado do navegador pode apagar IndexedDB ao fechar a sessão.
