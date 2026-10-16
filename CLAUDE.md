# CLAUDE.md: minecraft-utilidades ("Bancada")

Site de utilidades para Minecraft, de uso pessoal do Felipe. A meta de longo prazo é juntar tudo que
ajuda dentro do jogo (crafts, encantamentos, tutoriais de farm, guia para zerar...). **Hoje só existe
uma ferramenta, a primeira que ele pediu: o criador de crafts** (todos os itens do jogo + a mesa de
trabalho 3×3). O resto vem depois, uma coisa de cada vez, quando ele pedir.

## O que faz

- Lista os 1.502 itens do Minecraft Java **1.21.11**, com nome em português (o idioma do jogo dele) e
  em inglês, ícone de inventário de verdade, busca sem acento (várias palavras) e filtro por tipo.
- Mesa 3×3: ele coloca itens e vê o que sai (receita com forma, sem forma e as 12 especiais:
  tingir armadura, foguete, estrela de fogos, reparar, copiar mapa e livro, pote decorado...).
- Clicar num item mostra **como fazer** (todas as receitas da mesa), com botão "Montar na mesa".
  Ingrediente com várias opções (ex.: qualquer tábua) troca de item a cada segundo, como no jogo.
- A mesa fica salva no navegador (`localStorage`, chave `bancada.mesa`).
- Só receita de **mesa de trabalho**. Fornalha, cortapedra, ferraria e poção ficam fora por enquanto.

## Como rodar

- `abrir.bat` (sobe o servidor na porta **4349** e abre o navegador) ou o preview `minecraft-utilidades`
  do `.claude/launch.json` da raiz. Não abre por `file://` (precisa carregar JSON).
- Testes do motor de receitas: `node --test "testes/*.test.js"` na pasta (15 testes; um deles
  confere que toda receita com forma acha a si mesma na mesa).

## Estrutura

- `index.html`, `css/estilo.css`, `js/app.js` (tela), `js/motor.js` (receitas, sem DOM, roda no Node).
- `dados/itens.json` e `dados/receitas.json`: **gerados**, não editar à mão.
- `img/itens.png`: folha de ícones (40 por linha, 64 px cada), **gerada**. A ordem é a ordem de
  `dados/itens.json`: o ícone do item `i` está na posição `i`. Se mexer num, regerar o outro.
- `ferramentas/construir_dados.py`: lê o jar do Minecraft do Prism Launcher dele
  (`%APPDATA%\PrismLauncher\libraries\com\mojang\minecraft\<versão>\...client.jar` e os assets de
  idioma do Prism) e escreve os dois JSON. Nada é baixado.
- `ferramentas/renderizar_icones.py` + `ferramentas/especiais.py`: desenham os ícones a partir dos
  modelos e texturas do mesmo jar (itens planos, blocos isométricos, modelos de várias peças, e
  baú/caixa de shulker/cama/estandarte/cabeça/escudo montados à mão). Precisa de Pillow e numpy.
  `--ver id1 id2` salva só esses itens em `img/_teste.png` para conferir.
- Para outra versão do jogo: `python ferramentas/construir_dados.py --versao X` e depois
  `python ferramentas/renderizar_icones.py --versao X` (a versão precisa estar no Prism dele).

## Decisões que não se desfazem sem motivo

- **Fonte dos dados é o jogo dele, não um site.** Receita, tag e nome vêm do jar. Quando o Minecraft
  atualizar, é só regerar.
- **Ícones aproximados:** as 8 estátuas de golem de cobre (mostram o pedestal), a cabeça do dragão e
  o escudo/conduíte/pote decorado (caixas simples, sem os detalhes do modelo real). Todo o resto usa
  o modelo de verdade.
- **Receitas especiais que dependem de dados do item** (estandarte com padrão, livro escrito, mapa,
  poção) só aceitam o item base: o site não sabe se o estandarte está em branco ou se a poção é de
  cura. A tela diz isso na descrição da receita.
- Os nomes dos grupos de materiais ("Qualquer tábua") são escritos à mão em `NOME_TAG` no
  `construir_dados.py`; o jogo não traz isso.
- Direção visual "papel e inventário": miolo claro (papel), topo e rodapé em tinta escura, um laranja
  de cobre como única cor de ação, e os quadrados copiam o inventário do jogo (é o elemento único).
  Fontes: Schibsted Grotesk e IBM Plex Mono (Google Fonts).
- Conferido em 3440×1440, 1080×1920, 1440×900, 1024×768 e 390 px de largura (celular não era
  requisito, mas funciona).
- Texturas e modelos são da Mojang. Uso pessoal; **antes de publicar o site na internet, decidir
  isso** (o rodapé já avisa que é ferramenta de fã).
