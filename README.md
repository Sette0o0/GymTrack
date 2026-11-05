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
- Peso e repetições independentes por série, ou duração manual digitada em segundos com leitura complementar em `mm:ss`. Cronômetro por exercício baseado em timestamps, com recuperação após segundo plano/reabertura.
- Uma sessão ativa ou pausada por vez, inclusive entre abas. Salvamento automático, conclusão/desfazer, séries ignoradas e adição/remoção de séries.
- Sugestões da última sessão concluída do mesmo exercício e tipo. Sem referência, a carga começa em 0 kg; repetições e duração usam a meta.
- Histórico com snapshots de nomes, metas, tipos e observações, filtros por ficha/data e evolução textual por exercício.
- Agrupamentos musculares no catálogo e na importação `.xlsx`, com todos os grupos exibidos nas fichas e snapshots nas sessões.
- Importação e exportação CSV de fichas e histórico nas configurações, backup/restauração JSON e lembrete de backup após sete dias.
- PWA instalável, cache completo e atualização explícita quando não há treino pendente ou alterações não salvas.

Não há login, backend ou sincronização. Dados pertencem à origem (protocolo/domínio/porta) e ao navegador. Mantenha o mesmo domínio de uso e leve um backup JSON ao trocar de dispositivo, navegador ou origem. Limpar o armazenamento do navegador remove os registros locais. Solicitar persistência nas configurações depende da aprovação do navegador e não substitui backups.

## Registrar um treino no celular

Na página inicial, **Começar meu treino** abre a próxima ficha em ordem natural de código (A → B → C ou 1 → 2 → 10), considerando a sessão finalizada mais recentemente. Após a última, a sequência volta ao início; fichas arquivadas são ignoradas. Uma sessão pendente tem prioridade para retomada.

Toque em uma ficha para consultar exercícios, metas e observações. A consulta não cria uma sessão: o registro começa somente pelo botão **Começar treino** dentro da ficha. Fichas vazias ou arquivadas não podem ser iniciadas.

Todos os exercícios aparecem em cards na ordem da ficha, inicialmente recolhidos. Toque no card para abrir as séries; somente um fica aberto por vez. O resumo mostra a meta de repetições ou tempo e as quantidades concluídas, ignoradas e pendentes. Antes de recolher ou trocar, o aplicativo aguarda as gravações; campos inválidos ou falhas de armazenamento mantêm o card aberto.

**Concluir todas** pede confirmação e conclui somente as séries pendentes do exercício com os valores gravados. Preserva séries ignoradas e já concluídas, inclusive seus horários. A ação fica bloqueada com treino pausado, cronômetro ativo no exercício, campo inválido ou gravação pendente. É possível desfazer cada série individualmente. Pausa, retomada e finalização do treino permanecem fora dos cards.

**Cancelar treino** permite descartar uma sessão ativa ou pausada, mesmo com campos inválidos. A confirmação informa quantas séries concluídas serão perdidas. Os registros e observações dessa sessão são apagados definitivamente, sem contar no histórico ou avançar a sequência. A exclusão é atômica; em caso de falha, os dados são preservados para tentar novamente. Sessões já finalizadas não podem ser canceladas.

Na ficha, informe repetições mínimas e máximas; para meta fixa, use o mesmo valor nos dois campos. Não há meta de kg. Nas séries, a carga aceita vírgula ou ponto decimal, sem separador de milhares. Séries, repetições e segundos exigem inteiros positivos; carga admite zero. É possível limpar um campo durante a edição, mas ele deve ser preenchido antes de salvar ou concluir. Letras, notação científica e colagens inválidas são recusadas sem extrair números nem corrigir o valor silenciosamente.

A interface reserva espaço para a navegação e as áreas seguras do aparelho; a navegação inferior é ocultada quando o teclado reduz a área de edição. O comportamento do teclado nativo e de instalação deve ser conferido em aparelhos reais conforme [o roteiro de validação](docs/VALIDACAO.md).

## Importar uma planilha

Em **Importar Excel**, selecione um `.xlsx` de até 20 MB. Cada linha representa um exercício; cada aba pode representar uma ficha. Selecione as abas, a linha de cabeçalho e o mapeamento de colunas. O arquivo é lido localmente, inclusive offline.

Exemplo de cabeçalho e valores:

| Treino | Nome da ficha   | Exercício   | Tipo  | Séries | Repetições | Duração | Observações   |
| ------ | --------------- | ----------- | ----- | ------ | ---------- | ------- | ------------- |
| A      | Peito e abdômen | Supino reto | peso  | 3      | 8-12       |         | Banco 3       |
| A      | Peito e abdômen | Prancha     | tempo | 3      |            | 00:45   | Abdômen firme |

- Sem coluna de treino, o nome da aba vira o código. Sem nome da ficha, usa-se o nome existente ou `Treino <código>`.
- Séries e exercício são obrigatórios. Exercícios por peso exigem repetições positivas ou um intervalo crescente; as colunas de kg da planilha são ignoradas. As fichas não têm meta de carga: novas sessões usam os pesos anteriores ou começam em 0 kg. Tempo exige duração positiva. Escolha segundos ou minutos para valores numéricos; texto `mm:ss` independe dessa escolha.
- Mapeie **Agrupamento muscular** quando a coluna existir. Também reconhecemos “Grupo muscular”, “Grupos musculares” e “Músculos”. O campo é opcional, aceita até 200 caracteres e vários grupos separados por vírgula. Pode ser editado no catálogo. Classificações importadas preenchidas atualizam o catálogo; células vazias preservam a classificação existente. Sessões anteriores mantêm sua classificação histórica.
- Sem tipo explícito, duração preenchida indica tempo. A coluna de repetições também reconhece valores por tempo como `45 s`, `30–45 s`, `1–1,5 min` ou `00:45`. Intervalos usam o limite superior como meta única e preservam o texto original nas observações; a conversão aparece na prévia. Um tipo explícito e a coluna de duração mapeada têm prioridade. Intervalos sem unidade, como `8–12`, continuam sendo repetições.
- Sufixos `s`, `seg`, `segundos`, `min` e `minutos` definem a unidade independentemente do seletor da aba; texto `mm:ss` também independe dessa escolha. Datas do Excel não são durações: use valores numéricos ou texto.
- Corrija o mapeamento ou desmarque explicitamente as linhas inválidas. A confirmação é bloqueada enquanto houver erros incluídos.
- Para códigos existentes, escolha ignorar, atualizar a ficha ou criar outra com sufixo. A atualização substitui os exercícios da ficha e preserva sessões anteriores.
- Colunas separadas por série não são suportadas nesta versão. Ajuste-as para metas gerais antes de importar.

O CSV usa UTF-8 com BOM, `;`, vírgula decimal e proteção contra interpretação de textos como fórmulas. O histórico exporta uma linha por série, incluindo a carga realmente registrada, status, metas de repetições/tempo e observações. O CSV de fichas não contém carga e o histórico não contém meta de kg. Os novos CSVs incluem versão, IDs, agrupamentos musculares e ordem; o histórico preserva também os horários de conclusão das séries. Fichas vazias, sessões sem exercícios e exercícios sem séries têm linhas de referência para permitir sua importação.

### Importar os CSVs das configurações

Em **Configurações e dados**, use **Importar fichas CSV** ou **Importar histórico CSV**, selecione o arquivo, confira a prévia e confirme. O processamento funciona offline e grava o arquivo inteiro em uma transação. Erros informam a linha e impedem gravações parciais. Finalize ou cancele o treino pendente antes de importar.

- Fichas existentes com exercícios são preservadas por ID ou código. Fichas vazias podem ser preenchidas; as demais são acrescentadas. O catálogo existente é reutilizado e suas classificações preenchidas são preservadas.
- Sessões com o mesmo ID são ignoradas, preservando os dados locais. Reimportar o mesmo histórico não duplica séries. Os CSVs novos distinguem exercícios repetidos de mesmo nome por seus IDs.
- O histórico pode ser importado antes das fichas. Referências ausentes são criadas arquivadas e podem ser preenchidas depois pelo CSV de fichas. Sessões em andamento chegam pausadas; cronômetros não continuam contando durante a transferência.
- CSVs antigos exportados pelo GymTrack continuam aceitos. Campos que não estavam no arquivo não podem ser recuperados: a ordem dos exercícios segue a primeira ocorrência e o horário de conclusão das séries usa o fim/início da sessão. Exercícios repetidos ambíguos são recusados; use o JSON ou exporte novamente com a versão atual.

Para transferir **todos** os dados, incluindo configurações, exercícios avulsos e metadados completos, use o backup JSON. CSV importa somente o conteúdo de fichas ou histórico presente no arquivo.

## Backup e restauração

Em **Configurações**, baixe o backup completo `.json` e confira o arquivo nos downloads. Guarde uma cópia fora do navegador.

O formato `gymtrack-backup`, esquema 3, contém data de exportação e as sete tabelas com seus IDs, incluindo agrupamentos musculares e snapshots. Backups v1 e v2 são convertidos; metas antigas de kg são descartadas e pesos realmente registrados nas séries são preservados. O banco local migra para a versão 3 sem alterar medidas, estados ou cronômetros de sessões pendentes. Registros antigos sem classificação permanecem sem grupo, sem inferir a classificação histórica pelo catálogo atual. A restauração valida o formato, a versão, duplicações e relacionamentos antes de uma transação atômica. Arquivos de versão futura são recusados sem alterações.

- **Mesclar:** mantém registros locais com IDs existentes e acrescenta IDs novos. Conflitos de código de ficha, de séries ou mais de uma sessão pendente bloqueiam a operação completa.
- **Substituir:** exige baixar um backup nesta sessão ou digitar `SUBSTITUIR`, além da confirmação final.
- Encerre o treino local pendente antes de restaurar. Cronômetros importados ficam pausados no instante da exportação, evitando somar o tempo de transporte do arquivo.

Um arquivo com erro não altera parcialmente o banco. Backups aceitam até 50 MB. O aplicativo lembra de exportar novamente após sete dias desde o último backup gerado (ou desde os primeiros registros).

## Publicar no Cloudflare Workers com arquivos estáticos

Para o Worker `gymtrack` conectado ao GitHub, use o `wrangler.jsonc` da raiz. Ele define o nome do Worker, a data de compatibilidade, a pasta `apps/web/out` e o domínio `gymtrack.rafaelsette.com.br`, evitando a detecção automática na raiz do monorepo. O Worker serve os arquivos estáticos; os dados continuam no IndexedDB de cada navegador.

O endereço principal é **https://gymtrack.rafaelsette.com.br**. A rota usa `custom_domain: true`: a Cloudflare cria o registro DNS e o certificado HTTPS para esse subdomínio na zona ativa `rafaelsette.com.br`. O endereço `workers.dev` permanece habilitado para conferência e recuperação de backup. Use o domínio principal para a instalação e os registros diários; cada origem tem seu próprio armazenamento, sem sincronização automática. Se já tiver registros em outro endereço, transfira-os por backup JSON.

Em **Workers & Pages → gymtrack → Settings → Build**, configure:

| Campo             | Valor                         |
| ----------------- | ----------------------------- |
| Diretório raiz    | raiz do repositório           |
| Comando de build  | `npm run build`               |
| Comando de deploy | `npx wrangler@4.154.0 deploy` |
| `NODE_VERSION`    | `24`                          |
| `NPM_VERSION`     | `11.21.0`                     |

Envie o commit de configuração à branch conectada antes de repetir o build. Se mudar o nome do Worker, atualize também `name` no arquivo. A data `2026-10-23` é uma versão de compatibilidade do runtime, mantida fixa; não precisa acompanhar a data de cada publicação.

Para validar a configuração localmente sem publicar:

```sh
npm run build
npx wrangler@4.154.0 deploy --dry-run
```

Para reaplicar somente os vínculos de domínio, mantendo a versão já publicada do aplicativo, use `npx wrangler@4.154.0 triggers deploy`. Esse comando também aplica os agendamentos do Worker; o GymTrack não tem agendamentos.

Consulte a [configuração do Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/) e as [datas de compatibilidade](https://developers.cloudflare.com/workers/configuration/compatibility-dates/). Após publicar, use o endereço definitivo do Worker no celular, aguarde “Disponível offline” e adicione à tela inicial. Para levar os dados do computador, exporte e restaure um backup JSON.

## Publicar na Cloudflare Pages

O projeto usa `output: "export"`, sem código de aplicação no servidor, Functions, Server Actions ou APIs dinâmicas. A alternativa ao Worker estático é publicar no Pages seguindo o [guia de exportação estática da Cloudflare](https://developers.cloudflare.com/pages/framework-guides/nextjs/deploy-a-static-nextjs-site/).

Configure o projeto na raiz do repositório:

| Campo              | Valor               |
| ------------------ | ------------------- |
| Diretório raiz     | raiz do repositório |
| Versão Node        | 24                  |
| Comando de build   | `npm run build`     |
| Diretório de saída | `apps/web/out`      |

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

Para evoluir o banco, mantenha as versões já declaradas e acrescente `version(n + 1).stores(...).upgrade(...)`; nunca recrie nem apague o banco em uma atualização. Adicione fixtures da versão anterior e testes de migração/restauração antes de mudar o formato de backup. Qualquer nova tela ou recurso deve passar pelo teste offline sem visita prévia.

Gráficos, recordes, descanso cronometrado, superséries, duplicação de fichas, drag-and-drop e exportação XLSX ficam para uma próxima versão.
