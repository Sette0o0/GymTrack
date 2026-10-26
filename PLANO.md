# Plano de desenvolvimento — PWA de Treinos de Academia

Offline-first

Next.js + IndexedDB

Android e iOS

## 1. Visão geral do projeto

Desenvolver um aplicativo pessoal para gerenciamento de treinos de musculação, instalado como PWA no celular, com foco na facilidade de registrar séries, cargas, repetições, exercícios por tempo e acompanhar a evolução.

O aplicativo deverá funcionar 100% offline após a instalação e o armazenamento dos arquivos necessários, com todos os dados registrados no próprio dispositivo.

O domínio público na Cloudflare será utilizado somente para distribuir o aplicativo e disponibilizar atualizações quando houver internet.

### Funcionalidades previstas

| Funcionalidade                        | Prioridade    |
| ------------------------------------- | ------------- |
| Treinos separados por A, B, C, D etc. | Essencial     |
| Cadastro e edição de exercícios       | Essencial     |
| Exercícios por peso e repetições      | Essencial     |
| Exercícios por tempo                  | Essencial     |
| Registro individual de cada série     | Essencial     |
| Histórico de treinos realizados       | Essencial     |
| Histórico de cargas por exercício     | Essencial     |
| Observações por exercício             | Essencial     |
| Importação de planilhas Excel         | Essencial     |
| Exportação dos treinos e registros    | Essencial     |
| Backup e restauração dos dados        | Essencial     |
| Recuperação de treinos interrompidos  | Essencial     |
| Gráficos de evolução                  | Segunda etapa |
| Cronômetro de descanso                | Segunda etapa |
| Duplicação e reorganização de treinos | Segunda etapa |
| Recordes pessoais e estatísticas      | Segunda etapa |

A principal regra de produto será: durante o treino, registrar uma série deve exigir o mínimo possível de interações.

## 2. Arquitetura técnica

Cloudflare Pages

Hospedagem estática · HTTPS · Domínio personalizado

Instalação e atualizações, quando online

PWA no celular

Next.js

Telas e navegação

Service Worker

Arquivos offline

Dexie.js + IndexedDB

Treinos · Exercícios · Séries · Histórico · Configurações

Todas as operações de treino são locais

### Stack escolhida

| Tecnologia           | Utilização                         |
| -------------------- | ---------------------------------- |
| Next.js + TypeScript | Estrutura do aplicativo            |
| Tailwind CSS         | Estilização responsiva             |
| shadcn/ui            | Componentes de interface           |
| Dexie.js             | Acesso tipado ao IndexedDB         |
| dexie-react-hooks    | Atualização reativa das telas      |
| Serwist ou Workbox   | Cache e funcionamento offline      |
| read-excel-file      | Importação de arquivos `.xlsx`     |
| Recharts             | Gráficos de evolução               |
| Zod                  | Validação de importações e backups |
| Cloudflare Pages     | Hospedagem estática                |

O Next.js será configurado com `output: "export"`, gerando a pasta `out/` para publicação. Sem servidor, não utilizaremos Server Actions, autenticação ou APIs dinâmicas. A documentação atual do Next.js e da Cloudflare confirma essa arquitetura para aplicações estáticas.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://nextjs.org\&sz=32)

Next.js+1



Para o Service Worker, a implementação escolhida deverá ser validada com o build estático e a versão do Next.js utilizada. O Next.js documenta Serwist como uma opção de suporte offline, com atenção especial à configuração do Webpack.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://nextjs.org\&sz=32)

Next.js+1



## 3. Regras funcionais do aplicativo

### 3.1. Organização dos treinos

O usuário poderá criar quantos treinos desejar, identificados inicialmente por letras.

Exemplo:

## A

Peito e tríceps

Supino reto · Supino inclinado · Tríceps corda

## B

Costas e bíceps

Puxada alta · Remada baixa · Rosca direta

## C

Pernas e abdômen

Agachamento · Leg press · Prancha

Cada treino terá um identificador interno, uma letra ou código, um nome, uma descrição opcional e uma lista ordenada de exercícios.

Será possível adicionar, remover, renomear, duplicar, arquivar e reorganizar treinos. Arquivar um treino não apaga seu histórico.

### 3.2. Tipos de exercícios

O modelo inicial terá dois tipos principais, com possibilidade de adicionar outros no futuro.

| Característica       | Peso + repetições         | Tempo               |
| -------------------- | ------------------------- | ------------------- |
| Exemplo              | Supino reto               | Prancha             |
| Valor registrado     | 60 kg                     | 45 segundos         |
| Repetições           | 10                        | Não aplicável       |
| Quantidade de séries | 3                         | 3                   |
| Meta                 | 8–12 reps                 | 30–60 segundos      |
| Progresso            | Evolução de cargas e reps | Evolução de duração |

Para exercícios de peso, cada série terá carga e repetições independentes. Para exercícios de tempo, cada série terá sua própria duração, em segundos, com visualização em `mm:ss`.

É importante armazenar o tempo numericamente em segundos e os pesos em uma unidade padronizada, preferencialmente quilogramas.

Uma futura extensão poderá incluir exercícios de peso corporal, séries por repetições sem carga e exercícios que combinam peso com duração.

### 3.3. Observações

Haverá dois tipos diferentes de observações:

- Observação fixa do exercício: instruções que devem aparecer sempre. Ex.: "Ajustar o banco na posição 3" ou "Não estender completamente os cotovelos".
- Observação do exercício realizado: anotação de uma sessão específica. Ex.: "Senti desconforto no ombro" ou "Aumentar 2,5 kg na próxima sessão".

As observações do treino realizado ficam preservadas no histórico, mesmo que a observação fixa seja alterada posteriormente.

Também será possível registrar uma observação geral da sessão, como "Treino mais leve hoje".

### 3.4. Histórico permanente

O sistema fará distinção entre a ficha de treino e o treino realizado.

Isso evita um erro comum: alterar uma ficha e, sem querer, modificar os registros históricos.

Por exemplo, se você fizer o Treino A com supino a 60 kg hoje e editar a ficha para 65 kg amanhã, o treino de hoje continuará registrando 60 kg.

Cada sessão deverá guardar a data, horários, treino de origem, exercícios realizados, séries, pesos ou durações, observações e status de conclusão.

Sessões interrompidas permanecerão salvas para que possam ser retomadas.

## 4. Modelagem do banco de dados

Essa é uma das partes mais importantes do projeto, pois a estrutura deve permitir alterar fichas sem perder dados antigos.

Eu utilizaria sete tabelas no IndexedDB.

exerciseDefinitions

Catálogo de exercícios e seus tipos

workoutTemplates

Treinos A, B, C...

templateExercises

Exercícios de cada ficha e suas metas

workoutSessions

Cada treino iniciado em uma data

sessionExercises

Cópia histórica dos exercícios da sessão

setRecords

Cada série com carga, repetições, tempo e status

settings

Preferências, unidades e versão dos dados

### Campos essenciais

| Tabela                | Campos principais                                                                                   |
| --------------------- | --------------------------------------------------------------------------------------------------- |
| `exerciseDefinitions` | id, name, defaultType, notes                                                                        |
| `workoutTemplates`    | id, code, name, description, order, archived                                                        |
| `templateExercises`   | id, templateId, exerciseId, order, type, targetSets, targetReps, targetSeconds, targetWeight, notes |
| `workoutSessions`     | id, templateId, workoutName, startedAt, finishedAt, status, notes                                   |
| `sessionExercises`    | id, sessionId, exerciseId, nameSnapshot, typeSnapshot, order, notesSnapshot, sessionNotes           |
| `setRecords`          | id, sessionExerciseId, setNumber, weightKg, repetitions, durationSeconds, status, completedAt       |
| `settings`            | key, value                                                                                          |

Todas as entidades principais utilizarão UUIDs. Os dados terão campos de criação e atualização quando necessário.

Em `workoutSessions`, eu também guardaria a data local do treino, além dos timestamps, para permitir filtros por dia sem problemas de fuso horário.

### Regras de integridade

1. A ficha pode ser alterada sem modificar sessões passadas.
2. Excluir um exercício da ficha não exclui seus registros históricos.
3. Um exercício pode aparecer em diversos treinos.
4. Cada série pertence a um exercício realizado, que pertence a uma sessão.
5. Uma sessão incompleta pode ser retomada.
6. A exclusão definitiva de histórico precisa de confirmação.
7. Alterações que envolvem múltiplas tabelas devem utilizar transações do IndexedDB.
8. Mudanças futuras no esquema devem ter migrações versionadas.

## 5. Telas do aplicativo

Eu desenvolveria a interface começando pelo celular, priorizando botões grandes e poucas etapas.

### Tela 1 — Início

### Meus treinos

Escolha o treino de hoje

Treino A

Peito e tríceps

Última realização: 22/10

Treino B

Costas e bíceps

Última realização: 24/10

Treino C

Pernas e abdômen

Última realização: 20/10

Histórico

Configurações

Exemplo visual da tela inicial.

Funcionalidades: visualizar os treinos cadastrados, iniciar um treino, retomar uma sessão incompleta, acessar o histórico e gerenciar as fichas.

### Tela 2 — Executar treino

Esta será a tela central do aplicativo.

Ela deverá permitir:

- Ver o exercício atual, as metas e a observação fixa.
- Consultar os valores usados na última sessão daquele exercício.
- Alterar peso e repetições de cada série independentemente.
- Marcar séries como concluídas ou desfazer a conclusão.
- Registrar duração em exercícios por tempo, manualmente ou com cronômetro.
- Adicionar ou remover séries.
- Registrar observações da sessão.
- Navegar para o exercício anterior ou seguinte.
- Finalizar, pausar ou retomar o treino.

Comportamento fundamental: ao iniciar um treino, o aplicativo sugere as cargas e durações da última sessão concluída, sem obrigar o usuário a digitá-las novamente.

Por exemplo, se na última sessão do supino você realizou 60 kg × 10, 60 kg × 9 e 57,5 kg × 8, esses valores poderão aparecer como sugestões para as três séries.

Cada alteração deve ser salva no IndexedDB imediatamente ou através de uma estratégia controlada de gravação, com indicação de sucesso. O botão Finalizar treino não pode ser o único momento em que os dados são persistidos.

### Tela 3 — Editar fichas

Permitirá cadastrar treinos, escolher exercícios, definir o tipo de medição, configurar séries e metas e escrever observações.

Exemplo de configuração de exercício:

## Configurar exercício

Nome

Tipo de exercício

Peso + repsTempo

Séries

Meta (segundos)

Observações

Manter o abdômen contraído e a coluna neutra.

Exemplo estático do formulário de configuração.

### Tela 4 — Histórico de treinos

Uma lista cronológica com filtros por período e por treino A, B, C etc.

Ao abrir uma sessão, o aplicativo mostrará exatamente o que foi realizado, incluindo séries ignoradas, observações, duração e alterações em relação às metas.

### Tela 5 — Evolução por exercício

Exibirá todas as sessões de um exercício, permitindo visualizar se a carga, repetições ou duração estão aumentando.

## Evolução — Supino reto

Exemplo ilustrativo: maior carga concluída por sessão

45 kg51,25 kg57,5 kg63,75 kg70 kg01/1008/1015/1022/10

Valores fictícios para demonstrar a funcionalidade

Para exercícios de tempo, o gráfico poderá mostrar a maior duração de uma série ou a duração total concluída na sessão.

Outras métricas, como volume total de treino, recordes e frequência, ficarão em uma etapa de evolução do produto.

## 6. Importação e exportação de dados

Esse módulo deverá funcionar inteiramente no navegador, inclusive offline.

### Importação

Teremos dois formatos principais:

| Formato            | Objetivo                     |
| ------------------ | ---------------------------- |
| Excel `.xlsx`      | Importar fichas existentes   |
| JSON do aplicativo | Restaurar fichas e histórico |

O processo de importação do Excel terá as seguintes etapas:

1. Selecionar um arquivo armazenado no dispositivo.
2. Ler suas abas e identificar as colunas disponíveis.
3. Permitir mapear campos como treino, exercício, séries, repetições, carga, tempo e observações.
4. Exibir uma prévia dos treinos encontrados.
5. Validar valores, tipos de exercícios e linhas incompletas.
6. Identificar possíveis duplicações e oferecer as opções de ignorar, atualizar ou criar uma nova ficha.
7. Confirmar a importação e gravar tudo em uma transação, sem sobrescrever o histórico inadvertidamente.

O mapeamento exato dependerá da estrutura da sua planilha atual, especialmente se cada treino estiver em uma aba diferente ou se houver colunas próprias para cada série.

### Exportação

Recomendo três opções:

| Exportação              | Conteúdo                                                                            |
| ----------------------- | ----------------------------------------------------------------------------------- |
| Backup completo `.json` | Fichas, exercícios, sessões, séries, observações, configurações e versão do esquema |
| Treinos `.csv`          | Fichas atuais, para visualizar e editar no Excel                                    |
| Histórico `.csv`        | Todos os registros realizados, com uma linha por série                              |

Os arquivos CSV deverão ser compatíveis com Excel em português, com tratamento adequado de acentos, separadores e decimais. Uma exportação `.xlsx` estruturada também pode ser adicionada posteriormente.

O JSON será o formato oficial de backup e restauração, porque consegue preservar relacionamentos entre tabelas e informações que não cabem bem em uma planilha.

A restauração terá validação de versão e integridade, pré-visualização dos dados e opções explícitas de mesclar ou substituir. Antes de substituir dados existentes, o aplicativo exigirá um backup ou uma confirmação reforçada.

## 7. Plano de execução por fases

A ordem abaixo busca entregar rapidamente um aplicativo utilizável sem deixar o armazenamento e a segurança dos dados para o final.

01

Estrutura e ambiente

Criar projeto Next.js, TypeScript, Tailwind, componentes de interface, repositório Git e exportação estática. Configurar Cloudflare Pages, domínio HTTPS, manifest e Service Worker.

Entrega: PWA instalável que abre em modo avião após o cache inicial.

02

Banco local e camada de dados

Implementar Dexie, tabelas, tipos TypeScript, UUIDs, operações CRUD, transações e versionamento do esquema. Criar tratamento de erros de armazenamento.

Entrega: dados persistem após fechar e reabrir o aplicativo.

03

Cadastro de fichas e exercícios

Criar telas de treinos A/B/C, catálogo de exercícios, edição, ordenação, metas de séries, tipo peso ou tempo, observações e arquivamento.

Entrega: cadastrar e editar uma ficha completa no celular.

04

Execução e registro de treino

Iniciar sessões, criar cópias históricas dos exercícios, registrar séries, salvar automaticamente, sugerir cargas anteriores, controlar tempo e recuperar sessões incompletas.

Entrega: realizar um treino real e preservar todos os registros.

05

Importação, exportação e backup

Implementar importação Excel, prévia, validação, exportação JSON e CSV, restauração e proteção contra substituições acidentais.

Entrega: importar sua planilha e restaurar todos os dados em outro navegador.

06

Histórico e evolução

Criar listagem de sessões, detalhes históricos, filtros, últimas cargas por exercício, comparação entre sessões e gráficos de evolução.

Entrega: consultar todos os treinos e acompanhar a progressão.

07

Validação offline e publicação

Testar instalação, atualização, persistência, migrações, recuperação de dados, uso em iOS e Android, navegação offline e comportamento durante uma sessão aberta.

Entrega: versão estável para uso diário na academia.

## 8. Estratégia de funcionamento offline e segurança dos dados

Existem alguns cuidados especialmente importantes para um aplicativo sem servidor.

### Cache do aplicativo

O Service Worker deverá armazenar previamente todas as páginas necessárias, arquivos JavaScript, CSS, fontes, ícones e demais recursos.

Não dependeremos de fontes, imagens ou scripts de CDNs externas para o funcionamento básico.

A instalação deve oferecer uma indicação de "Disponível offline" somente depois que o cache essencial estiver pronto. Ter um ícone na tela inicial, por si só, não garante que todos os arquivos estejam disponíveis offline.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://developer.mozilla.org\&sz=32)

MDN+1



### Persistência do IndexedDB

O armazenamento do navegador é normalmente persistente entre sessões, mas pode ser removido pelo usuário ou pelo próprio navegador em certas condições.

O aplicativo deverá solicitar armazenamento persistente via `navigator.storage.persist()` quando disponível, verificar o resultado e oferecer exportação de backup periódica. Essa solicitação não garante aprovação em todos os navegadores.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://developer.mozilla.org\&sz=32)

MDN+1



Também será importante usar sempre o mesmo domínio, pois os dados do IndexedDB pertencem à origem do site.

### Atualizações

As atualizações do aplicativo só serão baixadas quando houver internet. Elas não deverão apagar os dados locais.

O aplicativo deverá detectar uma nova versão, avisar o usuário e permitir a atualização em momento seguro, preferencialmente sem interromper um treino ativo.

## 9. Plano de testes

Antes de considerar o projeto concluído, estes cenários devem passar.

| Teste                                  | Resultado esperado                          |
| -------------------------------------- | ------------------------------------------- |
| Instalar e ativar modo avião           | Aplicativo abre e navega normalmente        |
| Registrar um peso e fechar o app       | Peso permanece salvo                        |
| Registrar uma prancha de 45 segundos   | Duração aparece corretamente no histórico   |
| Interromper um treino pela metade      | Sessão pode ser retomada                    |
| Editar uma ficha antiga                | Histórico permanece inalterado              |
| Remover exercício da ficha             | Histórico do exercício continua disponível  |
| Realizar o mesmo treino várias vezes   | Sessões permanecem separadas por data e ID  |
| Importar Excel com linha inválida      | Erro indicado sem corromper os dados        |
| Exportar e restaurar backup            | Registros e relacionamentos são preservados |
| Publicar uma atualização na Cloudflare | Nova versão instala sem perder dados        |
| Alternar entre online e offline        | Não ocorre duplicação de séries             |
| Acionar conclusão duas vezes           | Não são criados registros duplicados        |

Os testes de instalação, armazenamento e atualização devem ser executados em aparelhos reais, especialmente se você for usar iPhone. Também validaremos o comportamento do cronômetro quando o aplicativo vai para segundo plano.

## 10. Organização sugerida do projeto

```
src/
├── app/
│   ├── page.tsx
│   ├── treinos/
│   ├── executar/
│   ├── historico/
│   ├── exercicios/
│   ├── importar/
│   ├── configuracoes/
│   └── manifest.ts
│
├── components/
│   ├── layout/
│   ├── workouts/
│   ├── exercises/
│   ├── session/
│   ├── history/
│   └── ui/
│
├── db/
│   ├── database.ts
│   ├── schema.ts
│   ├── migrations.ts
│   └── repositories/
│
├── services/
│   ├── workout-service.ts
│   ├── session-service.ts
│   ├── history-service.ts
│   ├── import-service.ts
│   └── export-service.ts
│
├── hooks/
├── types/
├── utils/
└── lib/

public/
├── icons/
└── ...
```

Usaremos rotas estáticas, como `/executar` com um ID de sessão na URL ou no estado local, em vez de depender da geração dinâmica de páginas no servidor. Isso mantém a navegação compatível com o export estático.

A lógica do aplicativo ficará separada dos componentes visuais para facilitar testes, migrações do banco e eventuais mudanças de interface.

## 11. Escopo da primeira versão e futuras melhorias

## Versão 1 — Aplicativo utilizável

MVP

Funcionalidades necessárias para substituir sua planilha e usar o app diariamente na academia.

Cadastro e edição de fichas A/B/C

Exercícios por peso/repetições ou duração

Séries individuais e observações

Histórico completo e recuperação de sessões

Importação Excel e backup/restauração JSON

Exportação CSV de fichas e registros

Instalação PWA e funcionamento offline

## Versão 2 — Melhorias de experiência

Depois que o fluxo de registro estiver validado:

Cronômetro de descanso entre séries

Gráficos avançados e recordes pessoais

Duplicação de fichas e superséries

Sugestões de progressão de carga

Exportação Excel .xlsx formatada

Mais tipos de exercícios e métricas

## 12. Critério de conclusão do projeto

Considerarei a primeira versão pronta quando você conseguir instalar o aplicativo pelo seu domínio, desligar completamente a internet, iniciar o Treino A, registrar séries por peso e por tempo, adicionar observações, finalizar o treino e encontrar tudo no histórico.

Além disso, você deverá conseguir importar suas fichas do Excel, exportar um backup completo, restaurá-lo em outro navegador e receber atualizações sem perder seus registros.
