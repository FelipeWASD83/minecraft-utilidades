// Página de calculadoras. As contas estão em calc.js (com testes).
import { $, esc, carregarBase, slotItem, montaTopo, ligaDica, mostraErro } from "./comum.js";
import { triangular, paraNether, paraOverworld, pilhas, COMBUSTIVEIS, combustivelPara } from "./calc.js";

const num = (id) => {
  const t = $(id).value.trim().replace(",", ".");
  return t === "" ? NaN : Number(t);
};
const fmt = (n) => Math.round(n).toLocaleString("pt-BR");

// ------------------------------------------------------------------ fortaleza
function calcFortaleza() {
  const alvo = $("r-forte");
  const campos = ["a-x", "a-z", "a-yaw", "b-x", "b-z", "b-yaw"];
  if (campos.every((c) => $(c).value.trim() === "")) { alvo.textContent = ""; return; }
  if (campos.some((c) => $(c).value.trim() === "")) { alvo.className = "resultado vazio"; alvo.textContent = "Faltam números."; return; }
  const r = triangular({ x: num("a-x"), z: num("a-z"), yaw: num("a-yaw") }, { x: num("b-x"), z: num("b-z"), yaw: num("b-yaw") });
  if (r.erro) { alvo.className = "resultado erro"; alvo.textContent = r.erro[0].toUpperCase() + r.erro.slice(1) + "."; return; }
  const nx = Math.floor(r.x / 8), nz = Math.floor(r.z / 8);
  alvo.className = "resultado";
  alvo.innerHTML = `A fortaleza deve estar perto de <b>x ${fmt(r.x)}, z ${fmt(r.z)}</b>.
    <span class="nota-peq">Do 1º ponto são uns ${fmt(r.d1)} blocos e do 2º, uns ${fmt(r.d2)}. Se for pelo Nether, ande até x ${fmt(nx)}, z ${fmt(nz)}. A sala do portal fica bem fundo: cave quando o olho mergulhar no chão.</span>`;
}

// ------------------------------------------------------------------ Nether
function calcNether(origem) {
  if (origem === "o") {
    const x = num("o-x"), z = num("o-z");
    if (Number.isFinite(x) && Number.isFinite(z)) { const r = paraNether(x, z); $("n-x").value = r.x; $("n-z").value = r.z; }
    else { $("n-x").value = ""; $("n-z").value = ""; }
  } else {
    const x = num("n-x"), z = num("n-z");
    if (Number.isFinite(x) && Number.isFinite(z)) { const r = paraOverworld(x, z); $("o-x").value = r.x; $("o-z").value = r.z; }
    else { $("o-x").value = ""; $("o-z").value = ""; }
  }
}

// ------------------------------------------------------------------ pilhas
function calcPilhas() {
  const alvo = $("r-pilhas");
  const t = $("p-total").value.trim().replace(/\./g, "");
  if (t === "") { alvo.textContent = ""; return; }
  const r = pilhas(Number(t), Number($("p-tam").value));
  if (!r) { alvo.className = "resultado erro"; alvo.textContent = "Digite um número inteiro, sem negativo."; return; }
  const tam = Number($("p-tam").value);
  alvo.className = "resultado";
  alvo.innerHTML = `<b>${r.cheias.toLocaleString("pt-BR")}</b> ${r.cheias === 1 ? "pilha cheia" : "pilhas cheias"}${r.resto ? ` e mais <b>${r.resto}</b> solto${r.resto > 1 ? "s" : ""}` : ""}
    (${r.espacos.toLocaleString("pt-BR")} ${r.espacos === 1 ? "espaço" : "espaços"} de ${tam}).
    <span class="nota-peq">${r.baus.toLocaleString("pt-BR")} ${r.baus === 1 ? "baú simples" : "baús simples"} (27), ${r.bausDuplos.toLocaleString("pt-BR")} ${r.bausDuplos === 1 ? "baú duplo" : "baús duplos"} (54) ou ${r.shulkers.toLocaleString("pt-BR")} ${r.shulkers === 1 ? "caixa de shulker" : "caixas de shulker"} (27).</span>`;
}

// ------------------------------------------------------------------ combustível
function calcCombustivel() {
  const t = $("f-itens").value.trim().replace(/\./g, "");
  const n = t === "" ? 0 : Number(t);
  const valido = Number.isInteger(n) && n > 0;
  $("t-fuel").innerHTML = `<thead><tr><th></th><th>Combustível</th><th>Cozinha</th><th>${valido ? `Para ${n.toLocaleString("pt-BR")}` : "Precisa de"}</th></tr></thead><tbody>${
    COMBUSTIVEIS.map(([id, rot, rend]) =>
      `<tr><td>${slotItem(id, { link: true })}</td><td>${esc(rot)}</td><td class="mono">${String(rend).replace(".", ",")} ${rend === 1 ? "item" : "itens"}</td><td class="mono">${valido ? combustivelPara(n, rend).toLocaleString("pt-BR") : "-"}</td></tr>`).join("")
  }</tbody>`;
}

async function iniciar() {
  await carregarBase();
  montaTopo("calculadoras.html");
  ligaDica();
  for (const id of ["a-x", "a-z", "a-yaw", "b-x", "b-z", "b-yaw"]) $(id).addEventListener("input", calcFortaleza);
  for (const id of ["o-x", "o-z"]) $(id).addEventListener("input", () => calcNether("o"));
  for (const id of ["n-x", "n-z"]) $(id).addEventListener("input", () => calcNether("n"));
  $("p-total").addEventListener("input", calcPilhas);
  $("p-tam").addEventListener("change", calcPilhas);
  $("f-itens").addEventListener("input", calcCombustivel);
  calcCombustivel();
}

iniciar().catch(mostraErro);
