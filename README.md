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
e clique em **Hospedar e Entrar**. Sozinho já funciona.

Para jogar com mais gente na mesma rede, os outros abrem o mesmo endereço na
máquina do anfitrião e usam **Entrar** com o IP que o terminal mostrou.

```bash
npm test     # 113 testes
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
| `Tab` | Abrir o mapa |
| `Esc` | Sair de uma tarefa |

## Como se joga

Seis jogadores. Um ou dois são **impostores** (o anfitrião escolhe), o resto é
**tripulação**.

**Tripulantes** completam tarefas espalhadas pela nave. Cada tarefa é uma
pergunta educativa: uma conta, ou um texto curto com pergunta de compreensão.
Errar tranca aquele console por alguns segundos e sorteia outra pergunta. No
lobby ainda há um **desafio de pesquisa** — uma pergunta para a criança ir
procurar a resposta, sem pressa e sem risco.

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
