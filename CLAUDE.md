# CLAUDE.md: minecraft-utilidades ("Bancada")

Site de utilidades para Minecraft, de uso pessoal do Felipe: tudo que ajuda dentro do jogo, num lugar
só. Versão 2.0.0. Começou só com o criador de crafts (1.0.0) e ganhou o resto na 2.0.0.

## Páginas

| Página | O que faz | De onde vem o dado |
|---|---|---|
| `index.html` (Crafts) | 1.502 itens com ícone e nome em português e inglês; mesa 3×3 que mostra o que sai (com forma, sem forma e as 12 receitas especiais); "Como fazer" com receitas de mesa, fornalha, alto-forno, defumador, fogueira, cortapedra e ferraria; "Usado em". `?item=id` abre direto num item. | jar do jogo (gerado) |
| `encantamentos.html` | os 43 encantamentos: o que fazem, nível máximo, o que não combina, onde saem (mesa, aldeão, loot, tesouro), poder necessário e custo na bigorna; filtra por item e mostra "tudo que cabe nele". | jar do jogo (gerado) + frase de cada um à mão |
| `pocoes.html` | 19 poções com ingrediente, passo a passo no suporte e duração (normal, estendida, nível II; beber, arremessar, prolongada). | à mão (Minecraft Wiki) |
| `aldeoes.html` | trocas de 13 profissões por nível; filtro "o que eles compram" e "o que eles vendem". | à mão (Minecraft Wiki, **versão 26.x**) |
| `farms.html` | 15 farms: o que rende, o que levar, passo a passo, dicas. | à mão (tabelas do jogo + wiki) |
| `zerar.html` | guia do primeiro dia até o Dragão, com tarefas que ficam marcadas (`localStorage`, chave `bancada.zerar`) e a tabela "Onde cavar" com a altura de cada minério. | à mão + `minerios.json` (gerado) |
| `calculadoras.html` | achar a fortaleza com 2 olhos de Ender, Overworld ↔ Nether, pilhas e baús, combustível da fornalha. | contas em `js/calc.js` |

A mesa de trabalho fica salva no `localStorage` (chave `bancada.mesa`).

## Versão do jogo (importante)

- Os dados gerados vêm do **Minecraft Java 1.21.11**, a mais nova que o Prism dele tem. **A versão
  atual do jogo é a 26.3** (15/09/2026, conforme a imprensa e a wiki), então faltam itens, receitas e
  trocas de 26.1 a 26.3 (ex.: as trocas dos aldeões viraram dados do jogo na 26.1). Só dá para
  regerar com o jar da versão nova no Prism (ou baixado, o que pede aprovação dele).
- As páginas escritas à mão (farms, guia, aldeões, poções) dizem a versão que usaram: aldeões é 26.x.

## Como rodar

- `abrir.bat` (servidor na porta **4349** e abre o navegador) ou o preview `minecraft-utilidades`
  do `.claude/launch.json` da raiz. Não abre por `file://` (carrega JSON).
- Testes: `node --test "testes/*.test.js"` na pasta (36). `motor.test.js` (receitas),
  `calc.test.js` (calculadoras) e `dados.test.js`, que confere que todo item citado nos textos à mão
  existe no jogo e que os conflitos de encantamento são simétricos. **Mexeu em texto à mão? Rodar.**

## Estrutura

- `index.html` e as outras páginas, `css/estilo.css`, `js/`: `comum.js` (topo, rodapé, ícones, dica),
  `app.js` (crafts), `motor.js` (receitas, sem DOM), `calc.js` (contas, sem DOM) e um `.js` por página.
- `dados/*.json`: **gerados** (`itens`, `receitas`, `encantamentos`, `minerios`; não editar à mão) e
  **escritos à mão** (`pocoes`, `farms`, `zerar`, `aldeoes`; cada um tem um `_leia` com a fonte).
- `img/itens.png`: folha de ícones (40 por linha, 64 px cada), **gerada**. A ordem é a de
  `dados/itens.json`: o ícone do item `i` está na posição `i`. Se regerar um, regerar o outro.
- `ferramentas/construir_dados.py`: lê o jar do Minecraft do Prism Launcher dele
  (`%APPDATA%\PrismLauncher\libraries\com\mojang\minecraft\<versão>\...client.jar` e os assets de
  idioma do Prism) e escreve `itens`, `receitas`, `encantamentos` e `minerios`. Nada é baixado. As
  frases dos encantamentos (`DESC_ENCANTAMENTO`) e os nomes dos grupos de materiais (`NOME_TAG`)
  são escritos à mão ali dentro.
- `ferramentas/renderizar_icones.py` + `especiais.py`: desenham os ícones a partir dos modelos e
  texturas do mesmo jar (itens planos, blocos isométricos, modelos de várias peças, e
  baú/shulker/cama/estandarte/cabeça/escudo montados à mão). Precisa de Pillow e numpy.
  `--ver id1 id2` salva só esses itens em `img/_teste.png` para conferir.
- Outra versão do jogo: `python ferramentas/construir_dados.py --versao X` e depois
  `python ferramentas/renderizar_icones.py --versao X` (a versão precisa estar no Prism dele).

## Decisões que não se desfazem sem motivo

- **Fonte dos dados é o jogo dele, não um site**, sempre que o jogo guarda o dado. O que o jogo não
  guarda (poções, farms, guia, trocas) foi escrito à mão com a wiki e conferido contra o jar quando
  deu (tabelas de drop dos mobs, altura dos minérios, spawners). Número de mecânica sem fonte não entra.
- **Farms são princípio, não planta bloco a bloco.** Cada pessoa monta no terreno que tem.
- **Ícones aproximados:** estátuas de golem de cobre (mostram o pedestal), cabeça do dragão e
  escudo, conduíte e pote decorado (caixas simples). O resto usa o modelo de verdade.
- **Receitas especiais que dependem de dados do item** (estandarte com padrão, livro escrito, mapa,
  poção) só aceitam o item base. A tela diz isso na descrição.
- **Conflito de encantamento vale nos dois sentidos** (o jogo checa A→B ou B→A; o dado só guarda
  um lado). O `construir_dados.py` simetriza, e a sugestão de "tudo que cabe" enumera as
  combinações que convivem (Lealdade + Condutividade, ou Correnteza).
- Direção visual "papel e inventário": miolo claro, topo e rodapé em tinta escura, um laranja de
  cobre como única cor de ação, e os quadrados copiam o inventário do jogo. Fontes: Schibsted
  Grotesk e IBM Plex Mono (Google Fonts). Cada página é um bloco claro só, entre topo e rodapé escuros.
- Conferido em 3440×1440 (só por medida), 1080×1920, 1440×900, 1024×768 e 390 px (celular não era
  requisito, mas não tem rolagem lateral em nenhuma página).
- Texturas e modelos são da Mojang. Uso pessoal; **antes de publicar na internet, decidir isso**
  (o rodapé já avisa que é ferramenta de fã). Por isso o repositório do GitHub não deve ser público
  sem ele pensar nisso: `img/itens.png` são texturas da Mojang.
