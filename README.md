# Património

Aplicação pessoal de acompanhamento de investimentos, em português europeu. **Marco 2:** várias carteiras, dinheiro, compras/vendas, comissões, lotes FIFO ou selecionados, posições iniciais, lista de observação e painel patrimonial. Inclui a base do Marco 1: cotações, preços manuais, dados locais, backups e PWA.

## Começar

Instale [Node.js](https://nodejs.org/) 22.12 ou superior. Na pasta do projeto:

```powershell
npm ci
npm run dev
```

Abra o endereço apresentado no terminal, normalmente `http://127.0.0.1:5173`. No Windows, também pode abrir `Iniciar.cmd` com duplo clique: este atalho abre a versão compilada, com suporte offline, em `http://127.0.0.1:4173`. O primeiro arranque instala as dependências gratuitas e compila, se necessário; os seguintes reutilizam os ficheiros existentes. Mantenha a janela aberta enquanto utiliza o servidor local.

1. Em **Carteiras e transações**, crie uma carteira e registe uma entrada de dinheiro em EUR.
2. Registe compras, comissões e vendas. Para começar sem histórico completo, use Posição inicial.
3. Em **Instrumentos**, introduza preços manuais ou configure o Worker gratuito em **Dados e definições**.
4. Consulte **Visão geral** para ver património, posições, dinheiro, ganhos e evolução do capital.
5. Guarde um backup JSON ou CSV. Os dados permanecem no navegador deste dispositivo.

**Já usa My Portfolio no Yahoo Finance?** Em **Carteiras e transações → Importar movimentos CSV**, selecione diretamente o ficheiro exportado. A aplicação reconhece o formato e apresenta uma revisão de moedas, comissões, compras/vendas e cotações. Registe primeiro as entradas de dinheiro reais: o CSV Yahoo não as contém. Consulte [as regras da importação Yahoo](docs/milestone2.md#importação-do-yahoo-finance).

Não são necessários login, cartão bancário, chave de API ou subscrição para usar a aplicação localmente. Nenhuma consulta externa é feita até configurar a fonte e pedir uma atualização. Fontes tipográficas e bibliotecas são servidas com a aplicação; não há CDN, publicidade ou telemetria.

## Compilar e verificar

```powershell
npm run check
npx playwright install chromium
npm run test:e2e
npm run proxy:check
```

`npm run check` executa testes unitários e de integração, valida TypeScript e produz `dist`. Para testar a PWA/offline, use `npm run build` e depois `npm run preview`; a versão de desenvolvimento não instala o service worker.

## Publicar gratuitamente

Siga [as instruções de publicação](docs/deployment.md). O frontend é estático; o Worker é opcional. Use Cloudflare Pages Free e Workers Free, com os subdomínios fornecidos. Os comandos deste projeto não alteram planos nem ativam serviços pagos. Se um limite gratuito bloquear a fonte, os preços guardados e o modo manual continuam disponíveis.

## Documentação

- [Arquitetura](docs/architecture.md)
- [Modelo de dados e formatos](docs/data-model.md)
- [Metodologia do Marco 1](docs/methodology.md)
- [Entrega e próximos marcos](docs/milestones.md)
- [Marco 2: utilização, fórmulas, CSV e migração](docs/milestone2.md)
- [Verificações da entrega](docs/validation.md)

Os exemplos numéricos nos testes são sintéticos e não são carregados na aplicação. As designações dos instrumentos são obtidas da fonte, nunca incorporadas como metadados presumidos.
