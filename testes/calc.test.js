import { test } from "node:test";
import assert from "node:assert/strict";
import { direcao, triangular, paraNether, paraOverworld, pilhas, combustivelPara, COMBUSTIVEIS } from "../js/calc.js";

const perto = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} != ${b}`);

test("direções cardeais do F3", () => {
  const sul = direcao(0), oeste = direcao(90), norte = direcao(180), leste = direcao(-90);
  perto(sul.x, 0); perto(sul.z, 1);
  perto(oeste.x, -1); perto(oeste.z, 0);
  perto(norte.x, 0); perto(norte.z, -1);
  perto(leste.x, 1); perto(leste.z, 0);
});

test("triangulação acha um ponto conhecido", () => {
  // alvo em (1000, 2000). De (0,0) e de (500, 0) apontando para ele.
  const alvo = { x: 1000, z: 2000 };
  const yawPara = (ox, oz) => (Math.atan2(-(alvo.x - ox), alvo.z - oz) * 180) / Math.PI;
  const r = triangular({ x: 0, z: 0, yaw: yawPara(0, 0) }, { x: 500, z: 0, yaw: yawPara(500, 0) });
  assert.equal(r.erro, undefined);
  perto(r.x, 1000, 1e-6);
  perto(r.z, 2000, 1e-6);
  perto(r.d1, Math.hypot(1000, 2000), 1e-6);
});

test("ângulos com voltas a mais dão o mesmo resultado", () => {
  const a = triangular({ x: 0, z: 0, yaw: -26.565 }, { x: 500, z: 0, yaw: 26.565 });
  const b = triangular({ x: 0, z: 0, yaw: -26.565 + 360 }, { x: 500, z: 0, yaw: 26.565 - 360 });
  assert.equal(a.erro, undefined);
  perto(a.x, 250, 0.01);
  perto(a.z, 500, 0.01);
  perto(a.x, b.x, 1e-6);
  perto(a.z, b.z, 1e-6);
});

test("direções paralelas pedem outro lançamento", () => {
  const r = triangular({ x: 0, z: 0, yaw: 10 }, { x: 100, z: 0, yaw: 10 });
  assert.match(r.erro, /paralelas/);
});

test("cruzamento atrás do ponto é avisado", () => {
  // as duas linhas se cruzam em (0, 100), mas o jogador olha para o lado contrário
  const r = triangular({ x: -100, z: 0, yaw: 90 }, { x: 100, z: 0, yaw: -90 });
  assert.ok(r.erro);
});

test("campo vazio é recusado", () => {
  assert.ok(triangular({ x: NaN, z: 0, yaw: 0 }, { x: 1, z: 1, yaw: 1 }).erro);
});

test("Nether: divide por 8 e volta", () => {
  assert.deepEqual(paraNether(800, -160), { x: 100, z: -20 });
  assert.deepEqual(paraNether(-1, 7), { x: -1, z: 0 });
  assert.deepEqual(paraOverworld(100, -20), { x: 800, z: -160 });
});

test("pilhas e baús", () => {
  assert.deepEqual(pilhas(1000, 64), { cheias: 15, resto: 40, espacos: 16, baus: 1, bausDuplos: 1, shulkers: 1 });
  assert.equal(pilhas(64 * 27, 64).baus, 1);
  assert.equal(pilhas(64 * 27 + 1, 64).baus, 2);
  assert.equal(pilhas(64 * 54 + 1, 64).bausDuplos, 2);
  assert.equal(pilhas(0, 64).espacos, 0);
  assert.equal(pilhas(33, 16).espacos, 3);
  assert.equal(pilhas(5, 1).espacos, 5);
  assert.equal(pilhas(-1, 64), null);
});

test("combustível: arredonda para cima", () => {
  assert.equal(combustivelPara(64, 8), 8);
  assert.equal(combustivelPara(65, 8), 9);
  assert.equal(combustivelPara(64, 1.5), 43);
  assert.equal(combustivelPara(1, 100), 1);
  assert.ok(COMBUSTIVEIS.every(([, , r]) => r > 0));
});
