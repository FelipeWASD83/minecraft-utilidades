// Motor de receitas da mesa de trabalho. Sem DOM: roda no navegador e no Node (testes).
//
// Ingrediente de receita = "id" | "#grupo" | [alternativas...]
// Mesa = lista de 9 posições (linha a linha), cada uma com um id de item ou null.

const DANIFICAVEL = /(_pickaxe|_axe|_shovel|_hoe|_sword|_spear|_helmet|_chestplate|_leggings|_boots)$/;
const DANIFICAVEL_ID = new Set([
  "bow", "crossbow", "trident", "mace", "shield", "elytra", "fishing_rod", "shears",
  "flint_and_steel", "brush", "carrot_on_a_stick", "warped_fungus_on_a_stick", "wolf_armor",
]);

export const DESCRICAO_ESPECIAL = {
  armordye: "Tingir armadura: uma peça que aceita tinta (armadura de couro, armadura de lobo...) junto com de 1 a 8 corantes, em qualquer posição.",
  bannerduplicate: "Copiar estandarte: um estandarte com padrões e um estandarte em branco da mesma cor. O de padrões não se gasta.",
  bookcloning: "Copiar livro: um livro escrito e um ou mais livros e penas. Sai uma cópia para cada livro e pena.",
  decoratedpot: "Pote decorado: tijolos ou fragmentos de cerâmica nos quatro lados (em cima, embaixo, esquerda e direita), centro e cantos vazios.",
  fireworkrocket: "Foguete: 1 papel e de 1 a 3 pólvoras (cada pólvora aumenta o voo). Estrelas de fogos de artifício são opcionais. Rende 3 foguetes.",
  fireworkstar: "Estrela de fogos: 1 pólvora e pelo menos 1 corante. Opcionais: um formato (bola de fogo, pepita de ouro, pena ou cabeça), diamante (rastro) e pó de glowstone (cintilar).",
  fireworkstarfade: "Cor de dissipação: uma estrela de fogos e pelo menos 1 corante.",
  mapcloning: "Copiar mapa: um mapa preenchido e um ou mais mapas vazios. Rende uma cópia para cada mapa vazio.",
  mapextending: "Ampliar mapa: um mapa preenchido no centro rodeado por 8 papéis.",
  repairitem: "Reparar: duas peças iguais e danificadas. Sai uma peça com a durabilidade somada (mais um bônus de 5%).",
  shielddecoration: "Decorar escudo: um escudo e um estandarte, em qualquer posição.",
  tippedarrow: "Flecha de poção: 8 flechas em volta de uma poção persistente no centro. Rende 8.",
};

const SAIDA_ESPECIAL = {
  armordye: null, // o resultado é a própria peça tingida
  bannerduplicate: null,
  bookcloning: "written_book",
  decoratedpot: "decorated_pot",
  fireworkrocket: "firework_rocket",
  fireworkstar: "firework_star",
  fireworkstarfade: "firework_star",
  mapcloning: "filled_map",
  mapextending: "filled_map",
  repairitem: null,
  shielddecoration: "shield",
  tippedarrow: "tipped_arrow",
};

export function criarMotor(dados, receitas) {
  const grupos = {};
  for (const [nome, ids] of Object.entries(dados.tags)) grupos[nome] = new Set(ids);

  /** O id cabe nesse ingrediente? */
  function casa(ing, id) {
    if (Array.isArray(ing)) return ing.some((x) => casa(x, id));
    if (ing.startsWith("#")) return grupos[ing.slice(1)]?.has(id) ?? false;
    return ing === id;
  }

  /** Todas as opções que o ingrediente aceita, em ids. */
  function alternativas(ing) {
    if (Array.isArray(ing)) return [...new Set(ing.flatMap(alternativas))];
    if (ing.startsWith("#")) return [...(grupos[ing.slice(1)] ?? [])];
    return [ing];
  }

  const noGrupo = (nome, id) => grupos[nome]?.has(id) ?? false;
  const ehTinta = (id) => id.endsWith("_dye");
  const danificavel = (id) => DANIFICAVEL.test(id) || DANIFICAVEL_ID.has(id);

  /** Retângulo mínimo que contém os itens: { w, h, cel: [[...]] } */
  function recorte(mesa) {
    let l0 = 3, l1 = -1, c0 = 3, c1 = -1;
    for (let i = 0; i < 9; i++) {
      if (mesa[i]) {
        const l = Math.floor(i / 3), c = i % 3;
        l0 = Math.min(l0, l); l1 = Math.max(l1, l);
        c0 = Math.min(c0, c); c1 = Math.max(c1, c);
      }
    }
    if (l1 < 0) return null;
    const cel = [];
    for (let l = l0; l <= l1; l++) {
      const linha = [];
      for (let c = c0; c <= c1; c++) linha.push(mesa[l * 3 + c] ?? null);
      cel.push(linha);
    }
    return { w: c1 - c0 + 1, h: l1 - l0 + 1, cel };
  }

  function casaMoldada(r, rec) {
    const gh = r.g.length, gw = r.g[0].length;
    if (gh !== rec.h || gw !== rec.w) return false;
    for (const espelho of [false, true]) {
      let ok = true;
      for (let l = 0; l < gh && ok; l++) {
        for (let c = 0; c < gw; c++) {
          const ing = r.g[l][espelho ? gw - 1 - c : c];
          const item = rec.cel[l][c];
          if (ing === null) { if (item !== null) { ok = false; break; } }
          else if (item === null || !casa(ing, item)) { ok = false; break; }
        }
      }
      if (ok) return true;
    }
    return false;
  }

  /** Receita sem forma: cada item cai num ingrediente diferente (emparelhamento completo). */
  function casaSemForma(r, itens) {
    if (r.i.length !== itens.length) return false;
    const usado = new Array(itens.length).fill(false);
    function tenta(k) {
      if (k === r.i.length) return true;
      for (let j = 0; j < itens.length; j++) {
        if (!usado[j] && casa(r.i[k], itens[j])) {
          usado[j] = true;
          if (tenta(k + 1)) return true;
          usado[j] = false;
        }
      }
      return false;
    }
    return tenta(0);
  }

  const conta = (itens, f) => itens.filter(f).length;

  function casaEspecial(kind, mesa, itens) {
    switch (kind) {
      case "armordye": {
        const pecas = itens.filter((i) => noGrupo("dyeable", i));
        const tintas = itens.filter(ehTinta);
        if (pecas.length === 1 && tintas.length >= 1 && tintas.length <= 8 && pecas.length + tintas.length === itens.length) {
          return { id: pecas[0], n: 1, nota: "tingida" };
        }
        return null;
      }
      case "bannerduplicate": {
        if (itens.length === 2 && itens[0] === itens[1] && noGrupo("banners", itens[0])) {
          return { id: itens[0], n: 1, nota: "cópia" };
        }
        return null;
      }
      case "bookcloning": {
        const lidos = conta(itens, (i) => i === "written_book");
        const escreviveis = conta(itens, (i) => i === "writable_book");
        if (lidos === 1 && escreviveis >= 1 && lidos + escreviveis === itens.length) {
          return { id: "written_book", n: escreviveis, nota: "cópia" };
        }
        return null;
      }
      case "decoratedpot": {
        const lados = [1, 3, 5, 7];
        if (itens.length === 4 && lados.every((i) => mesa[i] && noGrupo("decorated_pot_ingredients", mesa[i]))) {
          return { id: "decorated_pot", n: 1 };
        }
        return null;
      }
      case "fireworkrocket": {
        const papel = conta(itens, (i) => i === "paper");
        const polvora = conta(itens, (i) => i === "gunpowder");
        const estrelas = conta(itens, (i) => i === "firework_star");
        if (papel === 1 && polvora >= 1 && polvora <= 3 && papel + polvora + estrelas === itens.length) {
          return { id: "firework_rocket", n: 3, nota: `voo ${polvora}` };
        }
        return null;
      }
      case "fireworkstar": {
        const polvora = conta(itens, (i) => i === "gunpowder");
        const tintas = conta(itens, ehTinta);
        const formas = conta(itens, (i) => i === "fire_charge" || i === "gold_nugget" || i === "feather" || /_(head|skull)$/.test(i));
        const rastro = conta(itens, (i) => i === "diamond");
        const brilho = conta(itens, (i) => i === "glowstone_dust");
        if (polvora === 1 && tintas >= 1 && formas <= 1 && rastro <= 1 && brilho <= 1 &&
            polvora + tintas + formas + rastro + brilho === itens.length) {
          return { id: "firework_star", n: 1 };
        }
        return null;
      }
      case "fireworkstarfade": {
        const estrelas = conta(itens, (i) => i === "firework_star");
        const tintas = conta(itens, ehTinta);
        if (estrelas === 1 && tintas >= 1 && estrelas + tintas === itens.length) {
          return { id: "firework_star", n: 1, nota: "com dissipação" };
        }
        return null;
      }
      case "mapcloning": {
        const cheios = conta(itens, (i) => i === "filled_map");
        const vazios = conta(itens, (i) => i === "map");
        if (cheios === 1 && vazios >= 1 && cheios + vazios === itens.length) {
          return { id: "filled_map", n: 1 + vazios, nota: "cópia" };
        }
        return null;
      }
      case "mapextending": {
        if (itens.length === 9 && mesa[4] === "filled_map" && mesa.every((x, i) => i === 4 || x === "paper")) {
          return { id: "filled_map", n: 1, nota: "ampliado" };
        }
        return null;
      }
      case "repairitem": {
        if (itens.length === 2 && itens[0] === itens[1] && danificavel(itens[0])) {
          return { id: itens[0], n: 1, nota: "reparada" };
        }
        return null;
      }
      case "shielddecoration": {
        if (itens.length === 2 && itens.includes("shield") && itens.some((i) => noGrupo("banners", i))) {
          return { id: "shield", n: 1, nota: "decorado" };
        }
        return null;
      }
      case "tippedarrow": {
        if (itens.length === 9 && mesa[4] === "lingering_potion" && mesa.every((x, i) => i === 4 || x === "arrow")) {
          return { id: "tipped_arrow", n: 8 };
        }
        return null;
      }
      default:
        return null;
    }
  }

  /** O que a mesa produz? { id, n, receita, nota? } ou null. */
  function resolver(mesa) {
    const itens = mesa.filter(Boolean);
    if (!itens.length) return null;
    const rec = recorte(mesa);
    for (const r of receitas) {
      if (r.t === "shaped") {
        if (casaMoldada(r, rec)) return { id: r.r, n: r.n, receita: r, nota: r.c ? "com efeito" : undefined };
      } else if (r.t === "shapeless") {
        if (casaSemForma(r, itens)) return { id: r.r, n: r.n, receita: r, nota: r.c ? "com efeito" : undefined };
      } else if (r.t === "special") {
        const s = casaEspecial(r.k, mesa, itens);
        if (s) return { ...s, receita: r };
      }
    }
    return null;
  }

  // índice: item -> receitas que produzem ele
  const porResultado = new Map();
  for (const r of receitas) {
    const alvo = r.t === "special" ? SAIDA_ESPECIAL[r.k] : r.r;
    if (!alvo) continue;
    if (!porResultado.has(alvo)) porResultado.set(alvo, []);
    porResultado.get(alvo).push(r);
  }

  /** Receitas da mesa que produzem esse item. */
  function receitasDe(id) {
    const lista = [...(porResultado.get(id) ?? [])];
    // as receitas especiais "para qualquer peça" valem para quem aceita tinta ou se repara
    for (const r of receitas) {
      if (r.t !== "special") continue;
      if (r.k === "armordye" && noGrupo("dyeable", id)) lista.push(r);
      else if (r.k === "repairitem" && danificavel(id)) lista.push(r);
      else if (r.k === "bannerduplicate" && noGrupo("banners", id)) lista.push(r);
    }
    return lista;
  }

  return { casa, alternativas, resolver, receitasDe, danificavel, recorte };
}
