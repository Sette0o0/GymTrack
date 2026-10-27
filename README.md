# GymTrack

PWA pessoal para fichas e registros de musculação. Funciona offline depois do primeiro carregamento completo e mantém todos os dados no IndexedDB do dispositivo. Interface em português, para celular e desktop, com temas claro e escuro.

## Executar

Use Node.js 24 e npm 11.21.0 (versão declarada em `packageManager`). Na raiz:

```sh
npm ci
npm run dev
```

Se o projeto foi movido de pasta, execute `npm ci` novamente para reconstruir os links dos workspaces. Não copie `node_modules` entre diretórios ou sistemas operacionais.

O modo de desenvolvimento não registra Service Worker. Para testar instalação e offline, use o artefato de produção:

```sh
npm run build
npm run preview
```

Abra http://127.0.0.1:4173. Aguarde **Disponível offline** antes de desligar a rede. A prévia serve somente arquivos de `apps/web/out`; não requer um servidor Next.js. O script de prévia escuta apenas no loopback. Para aparelhos reais use uma hospedagem HTTPS ou um túnel HTTPS para esse endereço.

## Funcionalidades

- Catálogo reutilizável de exercícios, fichas com código/nome, metas gerais e observações fixas. Ordenação dos exercícios por subir/descer e arquivamento sem apagar histórico.
- Peso e repetições independentes por série, ou duração manual em segundos/`mm:ss`. Cronômetro por exercício baseado em timestamps, com recuperação após segundo plano/reabertura.
- Uma sessão ativa ou pausada por vez, inclusive entre abas. Salvamento automático, conclusão/desfazer, séries ignoradas e adição/remoção de séries.
- Sugestões da última sessão concluída do mesmo exercício e tipo. Metas usadas quando não há uma série anterior concluída com o mesmo número.
- Histórico com snapshots de nomes, metas, tipos e observações, filtros por ficha/data e evolução textual por exercício.
- Importação `.xlsx`, exportação CSV, backup/restauração JSON e lembrete de backup após sete dias.
- PWA instalável, cache completo e atualização explícita quando não há treino pendente ou alterações não salvas.

Não há login, backend ou sincronização. Dados pertencem à origem (protocolo/domínio/porta) e ao navegador. Mantenha o mesmo domínio de uso e leve um backup JSON ao trocar de dispositivo, navegador ou origem. Limpar o armazenamento do navegador remove os registros locais. Solicitar persistência nas configurações depende da aprovação do navegador e não substitui backups.

## Importar uma planilha

Em **Importar Excel**, selecione um `.xlsx` de até 20 MB. Cada linha representa um exercício; cada aba pode representar uma ficha. Selecione as abas, a linha de cabeçalho e o mapeamento de colunas. O arquivo é lido localmente, inclusive offline.

Exemplo de cabeçalho e valores:

| Treino | Nome da ficha | Exercício | Tipo | Séries | Repetições | Carga | Duração | Observações |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A | Peito e abdômen | Supino reto | peso | 3 | 8-12 | 57,5 | | Banco 3 |
| A | Peito e abdômen | Prancha | tempo | 3 | | | 00:45 | Abdômen firme |

- Sem coluna de treino, o nome da aba vira o código. Sem nome da ficha, usa-se o nome existente ou `Treino <código>`.
- Séries e exercício são obrigatórios. Exercícios por peso exigem repetições positivas ou um intervalo crescente; as colunas de kg da planilha são ignoradas. As fichas não têm meta de carga: novas sessões usam os pesos anteriores ou começam em 0 kg. Tempo exige duração positiva. Escolha segundos ou minutos para valores numéricos; texto `mm:ss` independe dessa escolha.
- Sem tipo explícito, duração preenchida indica tempo. A coluna de repetições também reconhece valores por tempo como `45 s`, `30–45 s`, `1–1,5 min` ou `00:45`. Intervalos usam o limite superior como meta única e preservam o texto original nas observações; a conversão aparece na prévia. Um tipo explícito e a coluna de duração mapeada têm prioridade. Intervalos sem unidade, como `8–12`, continuam sendo repetições.
- Sufixos `s`, `seg`, `segundos`, `min` e `minutos` definem a unidade independentemente do seletor da aba; texto `mm:ss` também independe dessa escolha. Datas do Excel não são durações: use valores numéricos ou texto.
- Corrija o mapeamento ou desmarque explicitamente as linhas inválidas. A confirmação é bloqueada enquanto houver erros incluídos.
- Para códigos existentes, escolha ignorar, atualizar a ficha ou criar outra com sufixo. A atualização substitui os exercícios da ficha e preserva sessões anteriores.
- Colunas separadas por série não são suportadas nesta versão. Ajuste-as para metas gerais antes de importar.

O CSV usa UTF-8 com BOM, `;`, vírgula decimal e proteção contra interpretação de textos como fórmulas. O histórico exporta uma linha por série, incluindo status, metas e observações. O CSV é para consulta; o formato de restauração é JSON.

## Backup e restauração

Em **Configurações**, baixe o backup completo `.json` e confira o arquivo nos downloads. Guarde uma cópia fora do navegador.

O formato `gymtrack-backup`, esquema 2, contém data de exportação e as sete tabelas com seus IDs. Backups v1 são convertidos, removendo apenas as antigas metas de kg; pesos realmente registrados nas séries são preservados. O banco local também migra para a versão 2 sem alterar sessões pendentes. A restauração valida o formato, a versão, duplicações e relacionamentos antes de uma transação atômica. Arquivos de versão futura são recusados sem alterações.

- **Mesclar:** mantém registros locais com IDs existentes e acrescenta IDs novos. Conflitos de código de ficha, de séries ou mais de uma sessão pendente bloqueiam a operação completa.
- **Substituir:** exige baixar um backup nesta sessão ou digitar `SUBSTITUIR`, além da confirmação final.
- Encerre o treino local pendente antes de restaurar. Cronômetros importados ficam pausados no instante da exportação, evitando somar o tempo de transporte do arquivo.

Um arquivo com erro não altera parcialmente o banco. Backups aceitam até 50 MB. O aplicativo lembra de exportar novamente após sete dias desde o último backup gerado (ou desde os primeiros registros).

## Publicar na Cloudflare Pages

O projeto usa `output: "export"`, sem Workers, Functions, Server Actions ou APIs dinâmicas. Siga o [guia de exportação estática da Cloudflare](https://developers.cloudflare.com/pages/framework-guides/nextjs/deploy-a-static-nextjs-site/).

Configure o projeto na raiz do repositório:

| Campo | Valor |
| --- | --- |
| Diretório raiz | raiz do repositório |
| Versão Node | 24 |
| Comando de build | `npm run build` |
| Diretório de saída | `apps/web/out` |

O npm deve instalar os workspaces da raiz com o lockfile. A alternativa é gerar a pasta localmente e enviar **todo o conteúdo** de `apps/web/out` pelo Direct Upload. Não publique apenas `.next` nem apenas arquivos HTML.

O pós-build usa [Workbox](https://developer.chrome.com/docs/workbox/modules/workbox-build) para gerar `sw.js`, o precache e `offline-assets.json`. O build falha se faltar algum recurso essencial no cache. Rotas usam documentos estáticos e query strings; a normalização de parâmetros ocorre somente no cache, sem remover IDs da URL visível.

`public/_headers` é copiado para a saída e configura o worker para revalidação, recursos com hash como imutáveis e cabeçalhos básicos de segurança. Depois da publicação, confirme HTTPS, manifest, ícones e navegação direta a uma rota com ID. Instale somente pelo domínio definitivo: uma instalação no domínio `pages.dev` tem outro banco local.

Para atualizar, publique a pasta completa gerada por outro build na **mesma origem**. O app mantém a versão anterior até oferecer a atualização. Encerre o treino, salve as alterações e use o botão no topo. Cache e IndexedDB são separados; atualizar o aplicativo não apaga o banco. Não use limpeza geral de armazenamento como procedimento de atualização.

## Validação

```sh
npm run lint
npm run typecheck
npm test
npm run build
cd apps/web
npx playwright install chromium webkit
cd ../..
npm run test:e2e
```

Os testes E2E usam o build exportado em `out`, um servidor estático e contextos de navegador isolados. Incluem Chromium desktop, perfil Android no Chromium e perfil iPhone no WebKit. O teste de atualização gera uma segunda revisão de cache temporária na mesma origem e restaura os artefatos ao terminar. Não execute duas suítes E2E simultaneamente sobre a mesma pasta `out`.

A CI executa lint, tipos, testes de dados, build e testes de navegador. Não publica automaticamente. Evidências de falhas do Playwright são preservadas como artefatos.

Consulte [o roteiro de validação em aparelhos reais](docs/VALIDACAO.md). Emulação de navegador não certifica instalação ou comportamento do sistema operacional.

## Organização e manutenção

- `apps/web/app`: rotas estáticas e metadados.
- `apps/web/components`: telas, formulários e fila de gravação da interface.
- `apps/web/db`: esquema Dexie e leitura consistente dos dados.
- `apps/web/services`: regras transacionais de fichas, sessões, arquivos e restauração.
- `apps/web/lib/schema.ts`: contratos TypeScript derivados de schemas Zod.
- `packages/ui`: componentes shadcn e estilos compartilhados.

Adicione componentes pela raiz com `npx shadcn add <componente> -c apps/web`. Leia `AGENTS.md` e os guias da versão instalada em `node_modules/next/dist/docs` antes de alterar APIs do Next.js.

Para evoluir o banco, mantenha a definição de `version(1)` e acrescente `version(2).stores(...).upgrade(...)`; nunca recrie nem apague o banco em uma atualização. Adicione fixtures da versão anterior e testes de migração/restauração antes de mudar o formato de backup. Qualquer nova tela ou recurso deve passar pelo teste offline sem visita prévia.

Gráficos, recordes, descanso cronometrado, superséries, duplicação de fichas, drag-and-drop e exportação XLSX ficam para uma próxima versão.
