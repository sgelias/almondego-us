# AlmondegoUs

Um jogo de dedução social em **primeira pessoa**, inspirado em Among Us, com
**tarefas educativas** para crianças até ~10 anos. Roda no navegador, em rede
local, e dá para jogar **sozinho** — as vagas que sobram viram bots.

Feito em JavaScript puro: sem build, sem bundler, sem framework.

## Como rodar

```bash
npm install
npm start
```

Abra o endereço que aparecer no terminal (por padrão `http://localhost:8843`)
e clique em **Entrar na partida**. Sozinho já funciona — as vagas que sobrarem
viram bots.

**Para jogar com mais gente na mesma rede:** só uma máquina roda `npm start`.
As outras abrem, no navegador, o endereço de rede que o terminal mostrou
(algo como `http://192.168.1.10:8843`) e clicam no mesmo **Entrar na partida**.
Não existe escolher entre hospedar ou entrar: cada um se conecta ao servidor
que serviu a página, e quem entrar primeiro vira o anfitrião — é quem vê o
botão **Iniciar Partida**.

```bash
npm test     # 184 testes
npm run server  # só o servidor de partida
npm run web     # só o servidor do cliente
```

## Controles

| Tecla | Ação |
| --- | --- |
| `W` `A` `S` `D` | Andar |
| Mouse | Olhar |
| `Shift` | Correr |
| `E` | Interagir: tarefa, duto, botão de emergência, atacar |
| `Q` | Usar sua magia (tripulantes) |
| `Tab` | Abrir o mapa (do deck em que você está) |
| `Esc` | Sair de uma tarefa / pausar |
| `M` | Silenciar a música |
| `−` `+` | Abaixar / aumentar a música |

## Como se joga

Seis jogadores. Um ou dois são **impostores** (o anfitrião escolhe), o resto é
**tripulação**.

**Tripulantes** completam tarefas espalhadas pela nave. Cada sala tem sua
própria atividade, e todas são educativas:

| Sala | Atividade |
| --- | --- |
| Elétrica | Ligar cada conta ao seu resultado |
| Armas | Atirar no asteroide com o resultado certo |
| Navegação | Ler o relatório e escolher a rota |
| Reator | Tocar os números do menor para o maior |
| Admin | Consultar a tabela e responder |

**O deck superior.** Duas escadas — uma a vante, outra a ré — levam a um
segundo andar com cinco salas e objetivos próprios:

| Sala | Atividade |
| --- | --- |
| Observatório | Ler as horas num relógio de ponteiros |
| Laboratório | Equilibrar a balança |
| Estufa | Dizer que fração dos canteiros foi regada |
| Arquivo | Arquivar fichas em ordem alfabética |
| Torre de Rádio | Descobrir o número que continua o padrão |

As salas do deck superior têm janelas: dá para parar no Observatório e olhar
as estrelas. Subir leva uns cinco segundos, num poço com uma saída só — quem te viu ir
para a escada sabe onde você está. Você não enxerga entre andares, e o mapa
mostra só o deck em que você está.

Duas tarefas atravessam a nave: buscar o fusível no Depósito para instalar na
Elétrica, e coletar a amostra na Enfermaria para analisar no Reator. Outras duas
atravessam os andares: a amostra da Enfermaria vai para o Laboratório, e a
antena do Depósito sobe até a Torre de Rádio. Setas
flutuantes, visíveis através das paredes, mostram onde é a sua próxima etapa.

Errar tranca aquele console por alguns segundos e sorteia outro exercício. No
lobby ainda há um **desafio de pesquisa** — uma pergunta para a criança ir
procurar a resposta, sem pressa e sem risco.

**Emergências** interrompem todo mundo de tempos em tempos: uma queda de
energia que cega a tripulação (mas não os impostores) até alguém religar o
painel da Elétrica, e um vazamento de oxigênio que exige dois tripulantes
acionando painéis em salas diferentes quase ao mesmo tempo — resolver cura a
tripulação inteira. Falhar nunca mata ninguém.

**Impostores** eliminam a tripulação. Não é um toque: são **três golpes**, e de
perto. Quem apanha vê a tela piscar em vermelho e tem tempo de fugir. Impostores
também usam dutos para se deslocar sem ser vistos.

**Você só enxerga quem está na mesma sala.** Vale para os bots também — eles
usam exatamente a mesma regra de visão que você.

**Magias** (só tripulantes, uma sorteada por partida, um uso):

- **Clarão** — cega quem está te vendo e te deixa mais rápido. É a fuga. Mas
  quem está cego não testemunha nada: usar perto de um assassinato apaga a prova.
- **Radar** — revela todos no mapa por alguns segundos. Prova para a reunião.
- **Embaralhar** — teleporta todo mundo para salas aleatórias.

Como impostores não têm magia, lançar uma é admitir que você é da tripulação.

**Reuniões** começam pelo botão de emergência no Refeitório, ou quando alguém
descobre uma morte. Discussão, votação por retrato, e o mais votado é ejetado.

A tripulação vence completando todas as tarefas ou ejetando todos os impostores.
Os impostores vencem quando restam tantos deles quanto tripulantes.

## Recados do mestre

Quem hospeda tem um mural no lobby: uma caixinha para mandar indicações a
todo mundo que está esperando — por onde começar, as regras da casa, o que
combinar antes de começar. `Enter` envia, `Shift+Enter` quebra a linha.

Só o anfitrião escreve, e só antes da partida começar: durante o jogo o mural
fecha, senão ele seria um canal para furar a regra de só enxergar quem está na
mesma sala. Quem chega atrasado recebe os recados anteriores.

## Música

O jogo toca uma trilha de fundo, baixinho, com o que estiver em `assets/`
(`.mp3`, `.ogg`, `.m4a`, `.wav`) — sorteada e encadeada durante a partida, e
abaixada durante reuniões e tarefas. Basta colocar arquivos na pasta: o
servidor lista o que existe, então não há código para mexer. Com a pasta
vazia, o jogo simplesmente fica sem música.

As faixas vão no repositório via **Git LFS**. Para cloná-las junto:

```bash
git lfs install
git clone https://github.com/sgelias/almondego-us.git
```

Sem o `git lfs`, o clone traz ponteiros de texto no lugar dos áudios e o jogo
roda em silêncio — nada quebra.

O volume fica em `M` e `−`/`+` durante o jogo, e num controle deslizante na
tela de pausa (`Esc`). A escolha é lembrada entre partidas.

## Como está organizado

```
shared/    dados e lógica pura, usados pelo cliente e pelo servidor
           (mapa, corredores, tarefas, perguntas, magias, protocolo)
server/    servidor de partida: regras, estado, e a simulação dos bots
src/       cliente: render 3D, entrada, interface, áudio
tools/     servidores de desenvolvimento
.specs/    planejamento, decisões de projeto e lições aprendidas
```

Os bots são simulados no servidor e chegam ao cliente como jogadores comuns —
nenhum módulo do cliente sabe que eles existem. As decisões deles ficam num
módulo que **nunca recebe o estado da partida**: um bot vota a partir do que
poderia ter testemunhado, não de quem é o impostor de verdade.

## Testes

Lógica pura tem teste unitário; o que depende de navegador é verificado à mão.
A geometria do mapa é testada de verdade — que dá para atravessar cada corredor
com um corpo do tamanho do jogador, e que as 14 salas estão todas conectadas.
Esse teste existe porque esse bug já apareceu duas vezes.
