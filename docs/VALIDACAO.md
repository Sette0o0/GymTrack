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

## Aparelhos reais — pendente

É necessário executar os itens abaixo em um Android/Chrome e em um iPhone/Safari, usando o domínio HTTPS definitivo. Testes com Playwright não substituem estes itens. Anote aparelho, versão do sistema/navegador e data ao validar.

- [ ] Instalar pelo domínio e conferir nome/ícone; no iOS, usar Compartilhar → Adicionar à Tela de Início.
- [ ] Aguardar “Disponível offline”, ativar modo avião, fechar e abrir pelo ícone.
- [ ] Visitar todas as telas offline, incluindo importação e configurações, sem carregá-las antes individualmente.
- [ ] Criar uma ficha com supino e prancha. Digitar carga com vírgula usando o teclado do aparelho.
- [ ] Concluir/desfazer uma série, ignorar outra, adicionar/remover séries e inserir observações.
- [ ] Fechar durante um treino e recuperar os valores ao reabrir. Verificar também outra aba do mesmo navegador.
- [ ] Cronometrar, bloquear a tela ou trocar de app, retornar e conferir tempo; pausar e retomar.
- [ ] Finalizar com série pendente e conferir que ela aparece como ignorada no histórico.
- [ ] Alterar/arquivar a ficha e um exercício sem mudar o histórico anterior.
- [ ] Importar um XLSX local com duas abas, corrigir/desmarcar uma linha inválida e conferir a prévia antes de confirmar.
- [ ] Baixar JSON e os dois CSVs. Abrir os CSVs no Excel em português e conferir acentos e decimais.
- [ ] Copiar o JSON para outro navegador/dispositivo e restaurar; conferir fichas, histórico, séries e observações.
- [ ] Solicitar persistência e conferir a resposta do navegador; confirmar que o app funciona se a solicitação não for concedida.
- [ ] Publicar nova revisão na mesma origem durante um treino. Confirmar que o botão de atualização permanece bloqueado até encerrar.
- [ ] Atualizar após encerrar, reabrir offline e conferir que os registros permanecem.
- [ ] Conferir toque, foco, contraste e ausência de rolagem horizontal da página em tema claro e escuro.

## Publicação — pendente por escopo

Conta, domínio e publicação real na Cloudflare não são configurados por esta implementação. A pasta exportada e as instruções estão no README. A aprovação dos itens de instalação/publicação depende dessa hospedagem e do acesso aos aparelhos reais.
