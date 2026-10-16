// Contas das calculadoras. Sem DOM: roda no navegador e no Node (testes).

/** Direção horizontal para um ângulo de F3 (yaw): 0 = sul (+z), 90 = oeste (-x), 180 = norte (-z), -90 = leste (+x). */
export function direcao(yawGraus) {
  const r = (yawGraus * Math.PI) / 180;
  return { x: -Math.sin(r), z: Math.cos(r) };
}

/**
 * Onde as duas direções se cruzam. Cada lançamento: { x, z, yaw }.
 * Devolve { x, z, d1, d2 } (d1 e d2 são as distâncias a andar de cada ponto), ou { erro }.
 */
export function triangular(a, b) {
  for (const v of [a.x, a.z, a.yaw, b.x, b.z, b.yaw]) {
    if (!Number.isFinite(v)) return { erro: "preencha os seis números" };
  }
  const da = direcao(a.yaw);
  const db = direcao(b.yaw);
  const det = da.x * db.z - da.z * db.x;
  if (Math.abs(det) < 1e-3) return { erro: "as duas direções são quase paralelas: jogue de outro lugar, bem mais afastado e em outra direção" };
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const t = (dx * db.z - dz * db.x) / det;
  const s = (dx * da.z - dz * da.x) / det;
  if (t < 0 || s < 0) return { erro: "as direções se cruzam atrás de um dos pontos: confira os ângulos (o ângulo é para onde o olho foi)" };
  return { x: a.x + t * da.x, z: a.z + t * da.z, d1: t, d2: s };
}

/** Overworld -> Nether: divide por 8, arredondando para baixo como o jogo. */
export const paraNether = (x, z) => ({ x: Math.floor(x / 8), z: Math.floor(z / 8) });
/** Nether -> Overworld: multiplica por 8. */
export const paraOverworld = (x, z) => ({ x: x * 8, z: z * 8 });

/** Quantas pilhas (espaços de inventário) e baús para uma quantidade de itens. */
export function pilhas(total, tamanho) {
  if (!Number.isInteger(total) || total < 0 || !Number.isInteger(tamanho) || tamanho < 1) return null;
  const cheias = Math.floor(total / tamanho);
  const resto = total % tamanho;
  const espacos = cheias + (resto ? 1 : 0);
  return {
    cheias,
    resto,
    espacos,
    baus: Math.ceil(espacos / 27),        // baú simples: 27 espaços
    bausDuplos: Math.ceil(espacos / 54),  // baú duplo: 54 espaços
    shulkers: Math.ceil(espacos / 27),    // caixa de shulker: 27 espaços
  };
}

/** Itens que cada combustível cozinha numa fornalha (10 s por item). */
export const COMBUSTIVEIS = [
  ["lava_bucket", "Balde de lava", 100],
  ["coal_block", "Bloco de carvão", 80],
  ["dried_kelp_block", "Bloco de alga seca", 20],
  ["blaze_rod", "Vareta de blaze", 12],
  ["coal", "Carvão", 8],
  ["charcoal", "Carvão vegetal", 8],
  ["oak_boat", "Barco", 6],
  ["oak_log", "Tronco", 1.5],
  ["oak_planks", "Tábua", 1.5],
  ["oak_slab", "Laje de madeira", 0.75],
  ["stick", "Graveto", 0.5],
  ["oak_sapling", "Muda", 0.5],
];

/** Quantas unidades de um combustível cozinham `itens` itens (sempre arredondando para cima). */
export const combustivelPara = (itens, rendimento) => Math.ceil(itens / rendimento);
