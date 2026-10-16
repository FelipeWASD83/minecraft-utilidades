// Confere que os textos escritos à mão (farms, guia, poções, aldeões) só citam itens que existem no jogo,
// e que os dados gerados do jar estão coerentes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { COMBUSTIVEIS } from "../js/calc.js";

const ler = (nome) => JSON.parse(readFileSync(new URL(`../dados/${nome}.json`, import.meta.url), "utf8"));
const itens = ler("itens");
const ids = new Set(itens.itens.map((i) => i.id));
const faltando = (lista) => [...new Set(lista.filter((x) => !ids.has(x)))];

test("itens: sem repetição e com nome", () => {
  assert.equal(ids.size, itens.itens.length);
  assert.ok(itens.itens.every((i) => i.pt && i.en && i.cat));
});

test("farms só citam itens que existem", () => {
  const d = ler("farms");
  const usados = d.farms.flatMap((f) => [f.icone, ...f.rende, ...f.materiais.map((m) => m[0])]);
  assert.deepEqual(faltando(usados), []);
  assert.ok(d.farms.every((f) => f.passos.length >= 3 && f.resumo));
  assert.ok(d.farms.every((f) => d.grupos.some(([g]) => g === f.grupo)));
});

test("guia para zerar só cita itens que existem", () => {
  const d = ler("zerar");
  const usados = d.fases.flatMap((f) => f.tarefas.flatMap((t) => t.itens.map((i) => i[0])));
  assert.deepEqual(faltando(usados), []);
  const idsTarefa = d.fases.flatMap((f) => f.tarefas.map((_, k) => `${f.id}-${k}`));
  assert.equal(new Set(idsTarefa).size, idsTarefa.length);
});

test("poções: ingredientes existem e as origens são poções", () => {
  const d = ler("pocoes");
  const pocoes = new Set(d.pocoes.map((p) => p.id));
  assert.deepEqual(faltando([...d.pocoes.filter((p) => p.ingr).map((p) => p.ingr), ...d.modificadores.map((m) => m.item), ...d.bases.map((b) => b.ingr)]), []);
  for (const p of d.pocoes) {
    assert.ok(p.ingr || p.de, `${p.id} sem ingrediente nem origem`);
    for (const o of p.de ?? []) assert.ok(pocoes.has(o), `${p.id}: origem ${o} não existe`);
    for (const t of [p.dur, p.ext, p.n2?.dur].filter(Boolean)) assert.match(t, /^\d+:\d\d$/);
  }
});

test("aldeões só citam itens que existem", () => {
  const d = ler("aldeoes");
  const usados = [];
  for (const p of d.profissoes) {
    usados.push(p.estacao);
    assert.equal(p.niveis.length, 5, p.id);
    for (const nv of p.niveis) for (const t of nv) {
      if (t.texto) continue;
      usados.push(...t.da.map((x) => x[0]), t.recebe[0]);
    }
  }
  assert.deepEqual(faltando(usados), []);
});

test("combustíveis existem", () => {
  assert.deepEqual(faltando(COMBUSTIVEIS.map((c) => c[0])), []);
});

test("encantamentos: conflitos são simétricos e as listas de itens existem", () => {
  const d = ler("encantamentos");
  const por = new Map(d.encantamentos.map((e) => [e.id, e]));
  for (const e of d.encantamentos) {
    for (const x of e.exclusivos) {
      assert.ok(por.has(x), `${e.id} cita ${x}`);
      assert.ok(por.get(x).exclusivos.includes(e.id), `${e.id} <-> ${x} não é simétrico`);
    }
    assert.ok(d.itensTag[e.itens]?.length > 0, `${e.id} sem itens`);
    assert.ok(e.desc, `${e.id} sem descrição`);
    assert.ok(e.max >= 1);
  }
  for (const lista of Object.values(d.itensTag)) assert.deepEqual(faltando(lista), []);
});

test("minérios: faixas dentro do mundo", () => {
  const m = ler("minerios");
  for (const o of m) {
    assert.ok(ids.has(o.id), o.id);
    for (const f of o.faixas) {
      assert.ok(f.min <= f.max, `${o.id} ${f.regra}`);
      assert.ok(f.min >= (o.dim === "nether" ? 0 : -64) && f.max <= (o.dim === "nether" ? 127 : 319), `${o.id} ${f.regra}`);
    }
  }
});

test("receitas: todo resultado e ingrediente existe (itens ou grupos)", () => {
  const rec = ler("receitas");
  const grupos = new Set(Object.keys(itens.tags));
  const vistos = [];
  const coleta = (x) => {
    if (x == null) return;
    if (Array.isArray(x)) return x.forEach(coleta);
    if (x.startsWith("#")) { assert.ok(grupos.has(x.slice(1)), `grupo ${x}`); return; }
    vistos.push(x);
  };
  for (const r of rec) {
    if (r.r) vistos.push(r.r);
    if (r.t === "shaped") r.g.flat().forEach(coleta);
    else if (r.t === "shapeless") r.i.forEach(coleta);
    else if (r.t === "cozinhar" || r.t === "cortapedra") coleta(r.i);
    else if (r.t === "ferraria") [r.m, r.b, r.a].forEach(coleta);
  }
  assert.deepEqual(faltando(vistos), []);
});
