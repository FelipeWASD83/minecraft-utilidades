import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { criarMotor } from "../js/motor.js";

const dados = JSON.parse(readFileSync(new URL("../dados/itens.json", import.meta.url), "utf8"));
const receitas = JSON.parse(readFileSync(new URL("../dados/receitas.json", import.meta.url), "utf8"));
const m = criarMotor(dados, receitas);
const N = null;

test("tronco vira 4 tábuas", () => {
  const r = m.resolver([N, N, N, N, "oak_log", N, N, N, N]);
  assert.equal(r.id, "oak_planks");
  assert.equal(r.n, 4);
});

test("a posição na mesa não importa (2x2 de tábuas = mesa de trabalho)", () => {
  for (const pos of [[0, 1, 3, 4], [4, 5, 7, 8], [1, 2, 4, 5]]) {
    const mesa = Array(9).fill(N);
    for (const p of pos) mesa[p] = "birch_planks";
    assert.equal(m.resolver(mesa).id, "crafting_table");
  }
});

test("picareta de diamante", () => {
  const D = "diamond", S = "stick";
  const r = m.resolver([D, D, D, N, S, N, N, S, N]);
  assert.equal(r.id, "diamond_pickaxe");
});

test("receita espelhada também vale (machado)", () => {
  const P = "iron_ingot", S = "stick";
  assert.equal(m.resolver([P, P, N, P, S, N, N, S, N]).id, "iron_axe");
  assert.equal(m.resolver([N, P, P, N, S, P, N, S, N]).id, "iron_axe");
});

test("baú precisa do buraco no meio", () => {
  const T = "spruce_planks";
  assert.equal(m.resolver([T, T, T, T, N, T, T, T, T]).id, "chest");
  assert.equal(m.resolver([T, T, T, T, T, T, T, T, T]), null);
});

test("sem forma: tinta + lã", () => {
  const r = m.resolver(["white_wool", "red_dye", N, N, N, N, N, N, N]);
  assert.equal(r.id, "red_wool");
});

test("grupo de materiais: ingrediente com sobra não casa", () => {
  assert.equal(m.resolver(["oak_planks", N, N, "oak_planks", N, N, N, N, N]).id, "stick");
  assert.equal(m.resolver(["oak_planks", "oak_planks", N, N, N, N, N, N, N]).id, "oak_pressure_plate");
  assert.equal(m.resolver(["oak_planks", "oak_planks", N, "oak_planks", N, N, N, N, N]), null);
});

test("cama: lã e tábua", () => {
  const W = "red_wool", T = "oak_planks";
  assert.equal(m.resolver([W, W, W, T, T, T, N, N, N]).id, "red_bed");
});

test("foguete: papel + pólvora", () => {
  const r = m.resolver(["paper", "gunpowder", "gunpowder", N, N, N, N, N, N]);
  assert.equal(r.id, "firework_rocket");
  assert.equal(r.n, 3);
});

test("reparar: duas picaretas iguais", () => {
  const r = m.resolver(["iron_pickaxe", "iron_pickaxe", N, N, N, N, N, N, N]);
  assert.equal(r.id, "iron_pickaxe");
  assert.equal(m.resolver(["iron_pickaxe", "gold_pickaxe", N, N, N, N, N, N, N]), null);
});

test("tingir armadura de couro", () => {
  const r = m.resolver(["leather_helmet", "blue_dye", N, N, N, N, N, N, N]);
  assert.equal(r.id, "leather_helmet");
});

test("pote decorado com 4 tijolos", () => {
  const B = "brick";
  assert.equal(m.resolver([N, B, N, B, N, B, N, B, N]).id, "decorated_pot");
});

test("mesa vazia não produz nada", () => {
  assert.equal(m.resolver(Array(9).fill(N)), null);
});

test("toda receita com forma acha a si mesma na mesa", () => {
  let falhas = [];
  for (const r of receitas) {
    if (r.t === "special") continue;
    const mesa = Array(9).fill(N);
    const pick = (ing) => m.alternativas(ing)[0];
    if (r.t === "shaped") {
      r.g.forEach((linha, l) => linha.forEach((ing, c) => { if (ing) mesa[l * 3 + c] = pick(ing); }));
    } else {
      r.i.forEach((ing, k) => { mesa[k] = pick(ing); });
    }
    const res = m.resolver(mesa);
    // outra receita pode vencer por vir antes (resultado diferente só é falha se NENHUMA bate)
    if (!res) falhas.push(r.id);
  }
  assert.deepEqual(falhas, []);
});

test("receitasDe lista as receitas de um item", () => {
  assert.ok(m.receitasDe("crafting_table").length >= 1);
  assert.ok(m.receitasDe("oak_planks").length >= 1);
  assert.equal(m.receitasDe("diamond_ore").length, 0);
});
