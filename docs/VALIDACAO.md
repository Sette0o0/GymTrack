# Validação antes do uso diário

## Automação disponível

`npm test` cobre regras de negócio com IndexedDB simulado. `npm run test:e2e`, após `npm run build`, cobre o fluxo em Chromium desktop, Chromium com perfil Android e WebKit com perfil iPhone. A CI executa esses comandos sem publicar.

Os testes verificam snapshots históricos, transações, concorrência ao iniciar sessões, sugestões de valores anteriores, falhas de gravação, recuperação, tempos, importação com erro, backup/mesclagem e atualização de cache sem perda de registros. Consulte a saída da execução para o resultado real; este documento não presume aprovação.

### Execução local em 26/10/2026

Ambiente: Windows, Node.js 24.14.0 e npm 11.21.0.

- Instalação reproduzível com `npm ci`: aprovada, sem vulnerabilidades reportadas pelo npm.
- `npm run lint` e `npm run typecheck`: aprovados.
- `npm test`: 22 testes aprovados, incluindo migração e rollback por falha de armazenamento.
- `npm run build`: aprovado; 72 recursos no precache, aproximadamente 1,55 MB.
- `npm run test:e2e`: 12 cenários aprovados (4 em Chromium desktop, 4 no perfil Android e 4 em WebKit com perfil iPhone).
- Revisão visual em desktop e celular, incluindo tema escuro; sem rolagem horizontal da página.

A CI está configurada, mas sua execução no GitHub depende do envio do repositório. Os itens em aparelhos reais abaixo permanecem pendentes.

### Regressão de importação por tempo — 26/10/2026

- Reproduzida a linha 33 de “Treino revisado”: ficha E, Sábado, Prancha, 2 séries e `30–45 s` na coluna de repetições.
- A importação reconhece a duração, usa 45 segundos como meta e preserva `30–45 s` nas observações. A prévia explica a conversão; intervalos sem unidade continuam sendo repetições.
- Lint, tipos, build e 33 testes de dados aprovados.
- O cenário de Excel foi repetido offline em Chromium desktop, perfil Android e WebKit com perfil iPhone: 3 testes aprovados, incluindo a importação e execução da prancha por tempo.

### Experiência de treino no celular e esquema v2 — 27/10/2026

Ambiente: Windows, Node.js 24.14.0 e npm 11.21.0.

- `npm run lint`, `npm run typecheck` e `npm run build`: aprovados. O artefato estático inclui 73 recursos no precache, aproximadamente 1,54 MB.
- `npm test`: 56 testes aprovados. Incluem migração real de um banco IndexedDB v1 para v2, conversão/restauração de JSON v1, preservação de cargas reais e recuperação de sessão pendente, descarte de metas antigas e recusa de versões futuras.
- Conclusão em lote validada com preservação de ignoradas/concluídas e horários, chamadas concorrentes em conexões diferentes, idempotência, bloqueios de pausa/cronômetro, validação prévia e rollback integral por falha na segunda gravação.
- Excel com carga preenchida ou inválida continua importável; kg é ignorado. A regressão `30–45 s` continua válida. CSV de fichas não contém carga; histórico mantém carga real e não exporta meta de kg.
- `npm run test:e2e`: **24 testes aprovados**, sendo 8 em Chromium desktop, 8 no perfil Android e 8 em WebKit com perfil iPhone. Incluem treino/arquivos offline, recuperação, cards, confirmação em lote, concorrência entre abas, erros de gravação e atualização de duas versões na mesma origem.
- Controles numéricos testados com letras, notação científica, colagem e arraste inválidos, vírgula/ponto, precisão sem arredondamento, zero, vazio, mínimo maior que máximo e atalhos de edição. O teste de recuperação aguarda a confirmação de gravação antes de forçar a recarga.
- Todas as telas, incluindo editor, histórico preenchido e mapeamento/prévia de Excel, foram verificadas em **320, 360, 390 e 430 px**, horizontal **844 × 390** e desktop **1280 × 900**, nos três perfis. Sem rolagem horizontal da página, controles menores que 44 × 44 px ou texto de input menor que 16 px. Tabelas amplas mantêm rolagem interna.
- Capturas revisadas em claro/escuro com nomes longos. Cards não cortam séries ou ações; Enter/Tab abrem e acessam os campos. A redução da área de edição foi simulada por redimensionamento com campo focado, verificando a ocultação da navegação inferior. Isso não substitui o teste do teclado nativo em aparelho real.

O gráfico de médias simples por sessão permanece registrado no `PLANO.md` como melhoria futura, com acesso por modal, sheet ou drawer e prioridade para celular.

## Aparelhos reais — pendente

É necessário executar os itens abaixo em um Android/Chrome e em um iPhone/Safari, usando o domínio HTTPS definitivo. Testes com Playwright não substituem estes itens. Anote aparelho, versão do sistema/navegador e data ao validar.

- [ ] Instalar pelo domínio e conferir nome/ícone; no iOS, usar Compartilhar → Adicionar à Tela de Início.
- [ ] Aguardar “Disponível offline”, ativar modo avião, fechar e abrir pelo ícone.
- [ ] Visitar todas as telas offline, incluindo importação e configurações, sem carregá-las antes individualmente.
- [ ] Criar uma ficha com supino e prancha. Digitar carga com vírgula usando o teclado do aparelho.
- [ ] Conferir repetições mínimas/máximas, duração em segundos e teclados inteiro/decimal. Verificar colagem de letras, ponto/vírgula e campos temporariamente vazios.
- [ ] Conferir as telas em 320, 360, 390 e 430 px, modo horizontal, claro/escuro e com o teclado aberto. Confirmar que teclado, recortes e áreas seguras não encobrem campos ou ações.
- [ ] Abrir/recolher cards, trocar de exercício e concluir todas as séries pendentes após confirmação. Conferir preservação das ignoradas, desfazer individual e bloqueios com cronômetro, pausa ou erro de gravação.
- [ ] Concluir/desfazer uma série, ignorar outra, adicionar/remover séries e inserir observações.
- [ ] Fechar durante um treino e recuperar os valores ao reabrir. Verificar também outra aba do mesmo navegador.
- [ ] Cronometrar, bloquear a tela ou trocar de app, retornar e conferir tempo; pausar e retomar.
- [ ] Finalizar com série pendente e conferir que ela aparece como ignorada no histórico.
- [ ] Alterar/arquivar a ficha e um exercício sem mudar o histórico anterior.
- [ ] Importar um XLSX local com duas abas, corrigir/desmarcar uma linha inválida e conferir a prévia antes de confirmar.
- [ ] Baixar JSON e os dois CSVs. Abrir os CSVs no Excel em português e conferir acentos e decimais.
- [ ] Copiar o JSON para outro navegador/dispositivo e restaurar; conferir fichas, histórico, séries e observações.
- [ ] Restaurar um JSON v1 em uma instalação v2 e conferir que apenas as metas antigas de kg foram removidas, preservando as cargas reais e a recuperação da sessão.
- [ ] Solicitar persistência e conferir a resposta do navegador; confirmar que o app funciona se a solicitação não for concedida.
- [ ] Publicar nova revisão na mesma origem durante um treino. Confirmar que o botão de atualização permanece bloqueado até encerrar.
- [ ] Atualizar após encerrar, reabrir offline e conferir que os registros permanecem.
- [ ] Conferir toque, foco, contraste e ausência de rolagem horizontal da página em tema claro e escuro.

## Publicação — pendente por escopo

Conta, domínio e publicação real na Cloudflare não são configurados por esta implementação. A pasta exportada e as instruções estão no README. A aprovação dos itens de instalação/publicação depende dessa hospedagem e do acesso aos aparelhos reais.
