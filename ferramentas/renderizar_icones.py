"""Desenha o ícone de inventário de todo item e monta img/itens.png (folha de sprites).

Lê modelos e texturas direto do jar do Minecraft do Prism (nada é baixado) e faz
o mesmo que o jogo faz no inventário: item plano mostra a textura; bloco é um
cubo isométrico com a luz de cima, esquerda e direita; modelos com várias peças
(escada, laje, cerca, tocha...) passam pelo mesmo desenhista de caixas.

Uso:  python ferramentas/renderizar_icones.py [--versao 1.21.11] [--ver nome1 nome2 ...]
      --ver  salva só esses itens em img/_teste.png (para conferir sem refazer tudo)
"""
import argparse
import io
import json
import math
import os
import sys
import zipfile
from pathlib import Path

import numpy as np
from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent
PRISM = Path(os.environ["APPDATA"]) / "PrismLauncher"

TAM = 64          # lado do ícone final, em pixels
SS = 2            # super-amostragem (renderiza em TAM*SS e reduz)
COLUNAS = 40      # ícones por linha na folha

# brilho de cada face de bloco no inventário (cima, lado esquerdo, lado direito)
BRILHO = {"up": 1.0, "esq": 0.80, "dir": 0.62, "down": 0.5}

GRAMA = (0x91, 0xBD, 0x59)


class Jar:
    def __init__(self, versao):
        caminho = PRISM / "libraries" / "com" / "mojang" / "minecraft" / versao / f"minecraft-{versao}-client.jar"
        self.zf = zipfile.ZipFile(caminho)
        self.nomes = set(self.zf.namelist())
        self._json, self._img = {}, {}

    def json(self, caminho):
        if caminho not in self._json:
            self._json[caminho] = json.loads(self.zf.read(caminho).decode("utf-8")) if caminho in self.nomes else None
        return self._json[caminho]

    def textura(self, ref):
        """Textura como array RGBA (h, w, 4). Textura animada: só o primeiro quadro."""
        ref = ref.replace("minecraft:", "")
        if ref in self._img:
            return self._img[ref]
        caminho = f"assets/minecraft/textures/{ref}.png"
        if caminho not in self.nomes:
            self._img[ref] = None
            return None
        im = Image.open(io.BytesIO(self.zf.read(caminho))).convert("RGBA")
        w, h = im.size
        if h > w and h % w == 0:
            im = im.crop((0, 0, w, w))
        self._img[ref] = np.asarray(im, dtype=np.uint8)
        return self._img[ref]


# ---------------------------------------------------------------- modelos
def carrega_modelo(jar, ref, _prof=0):
    """Modelo com a cadeia de 'parent' já fundida."""
    ref = ref.replace("minecraft:", "")
    if ref.startswith("builtin/"):
        return {"builtin": ref.split("/")[1], "textures": {}, "display": {}, "elements": None}
    d = jar.json(f"assets/minecraft/models/{ref}.json")
    if d is None:
        return None
    pai = carrega_modelo(jar, d["parent"], _prof + 1) if "parent" in d else {"textures": {}, "display": {}, "elements": None, "builtin": None}
    if pai is None:
        pai = {"textures": {}, "display": {}, "elements": None, "builtin": None}
    return {
        "builtin": pai.get("builtin"),
        "textures": {**pai["textures"], **d.get("textures", {})},
        "display": {**pai["display"], **d.get("display", {})},
        "elements": d.get("elements", pai["elements"]),
        "gui_light": d.get("gui_light", pai.get("gui_light")),
        "ref": ref,
    }


def resolve_textura(modelo, v):
    seen = 0
    while isinstance(v, str) and v.startswith("#") and seen < 10:
        v = modelo["textures"].get(v[1:])
        seen += 1
    return v if isinstance(v, str) and not v.startswith("#") else None


def cor_tint(t):
    tp = t["type"].split(":")[-1]
    if tp == "constant":
        v = t["value"]
        if isinstance(v, list):
            return tuple(int(round(c * 255)) for c in v[:3])
    elif "default" in t:
        v = t["default"]
    elif tp == "grass":
        return GRAMA
    else:
        return (255, 255, 255)
    v &= 0xFFFFFFFF
    return ((v >> 16) & 255, (v >> 8) & 255, v & 255)


# ------------------------------------------------- definição do item (1.21.4+)
def resolve_def(no):
    """Devolve lista de ('model', ref, tints) ou ('special', no) para o inventário."""
    if no is None:
        return []
    t = no["type"].split(":")[-1]
    if t == "model":
        return [("model", no["model"], no.get("tints", []))]
    if t == "special":
        return [("special", no)]
    if t == "select":
        if no.get("property", "").endswith("display_context"):
            for c in no["cases"]:
                quando = c["when"] if isinstance(c["when"], list) else [c["when"]]
                if "gui" in quando:
                    return resolve_def(c["model"])
        if "fallback" in no:
            return resolve_def(no["fallback"])
        return resolve_def(no["cases"][0]["model"])
    if t == "condition":
        return resolve_def(no.get("on_false"))
    if t == "range_dispatch":
        if "fallback" in no:
            return resolve_def(no["fallback"])
        return resolve_def(no["entries"][0]["model"])
    if t == "composite":
        out = []
        for m in no["models"]:
            out += resolve_def(m)
        return out
    return []  # empty, bundle/selected_item...


# ---------------------------------------------------------------- desenho
def rot_x(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])


def rot_y(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])


def rot_z(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])


EIXO = {"x": rot_x, "y": rot_y, "z": rot_z}

FACES = ["north", "south", "east", "west", "up", "down"]
NORMAL = {"north": (0, 0, -1), "south": (0, 0, 1), "east": (1, 0, 0), "west": (-1, 0, 0), "up": (0, 1, 0), "down": (0, -1, 0)}


def geom_face(d, f, t):
    """Canto superior esquerdo e vetores u e v (inteiros) da face, como o jogo orienta a textura."""
    (x1, y1, z1), (x2, y2, z2) = f, t
    dx, dy, dz = x2 - x1, y2 - y1, z2 - z1
    if d == "north":
        return (x2, y2, z1), (-dx, 0, 0), (0, -dy, 0)
    if d == "south":
        return (x1, y2, z2), (dx, 0, 0), (0, -dy, 0)
    if d == "east":
        return (x2, y2, z2), (0, 0, -dz), (0, -dy, 0)
    if d == "west":
        return (x1, y2, z1), (0, 0, dz), (0, -dy, 0)
    if d == "up":
        return (x1, y2, z1), (dx, 0, 0), (0, 0, dz)
    return (x1, y1, z2), (dx, 0, 0), (0, 0, -dz)


def uv_padrao(d, f, t):
    (x1, y1, z1), (x2, y2, z2) = f, t
    if d == "north":
        return [16 - x2, 16 - y2, 16 - x1, 16 - y1]
    if d == "south":
        return [x1, 16 - y2, x2, 16 - y1]
    if d == "east":
        return [16 - z2, 16 - y2, 16 - z1, 16 - y1]
    if d == "west":
        return [z1, 16 - y2, z2, 16 - y1]
    if d == "up":
        return [x1, z1, x2, z2]
    return [x1, 16 - z2, x2, 16 - z1]


class Tela:
    def __init__(self):
        n = TAM * SS
        self.cor = np.zeros((n, n, 4), dtype=np.float32)
        self.z = np.full((n, n), -1e9, dtype=np.float32)
        self.n = n

    def reduz(self):
        c = self.cor
        a = c[..., 3:4]
        # média ponderada pela opacidade, para a borda não escurecer
        rgb = (c[..., :3] * a).reshape(TAM, SS, TAM, SS, 3).sum(axis=(1, 3))
        al = a.reshape(TAM, SS, TAM, SS, 1).sum(axis=(1, 3))
        out = np.zeros((TAM, TAM, 4), dtype=np.float32)
        ok = al[..., 0] > 0
        out[ok, :3] = rgb[ok] / al[ok]
        out[..., 3] = al[..., 0] / (SS * SS)
        out = np.clip(out, 0, 255).astype(np.uint8)
        # a borda do desenho fica nítida: opacidade acima de 50% vira opaca
        out[..., 3] = np.where(out[..., 3] > 127, 255, 0)
        return Image.fromarray(out, "RGBA")


def desenha_modelo(jar, modelo, tints, tela=None, display=None, uv_px=None, extra_brilho=None):
    """Desenha os elementos de um modelo de blocos na tela, com a transformação de inventário."""
    if tela is None:
        tela = Tela()
    disp = display if display is not None else modelo["display"].get("gui", {})
    rot = disp.get("rotation", [0, 0, 0])
    esc = disp.get("scale", [1, 1, 1])
    tra = disp.get("translation", [0, 0, 0])
    R = rot_x(math.radians(rot[0])) @ rot_y(math.radians(rot[1])) @ rot_z(math.radians(rot[2]))
    S = np.array(esc, dtype=float)
    px = tela.n / 16.0

    def para_tela(p):
        c = (np.array(p, dtype=float) - 8.0) / 16.0
        v = R @ (c * S)
        return np.array([8.0 * px + v[0] * 16 * px + tra[0] * px, 8.0 * px - (v[1] * 16 * px + tra[1] * px), v[2] * 16.0])

    for el in modelo["elements"] or []:
        f, t = el["from"], el["to"]
        rel = el.get("rotation")
        for d in FACES:
            fc = el.get("faces", {}).get(d)
            if not fc:
                continue
            p0, u, v = geom_face(d, f, t)
            p0, u, v = np.array(p0, float), np.array(u, float), np.array(v, float)
            n = np.array(NORMAL[d], float)
            if rel:
                Rm = EIXO[rel["axis"]](math.radians(rel["angle"]))
                o = np.array(rel["origin"], float)
                p0 = o + Rm @ (p0 - o)
                u, v, n = Rm @ u, Rm @ v, Rm @ n
            # visível? (normal rotacionada aponta para o observador)
            nz = (R @ n)[2]
            if nz <= 1e-6 and not el.get("_duplo"):
                continue
            ref = resolve_textura(modelo, fc.get("texture"))
            img = jar.textura(ref) if ref else None
            if img is None:
                continue
            uv = fc.get("uv") or uv_padrao(d, f, t)
            if uv_px:
                uv = [uv[0] / uv_px[0] * 16, uv[1] / uv_px[1] * 16, uv[2] / uv_px[0] * 16, uv[3] / uv_px[1] * 16]
            rf = fc.get("rotation", 0) % 360
            ti = fc.get("tintindex")
            cor_t = None
            if ti is not None and ti >= 0 and ti < len(tints):
                cor_t = np.array(cor_tint(tints[ti]), dtype=np.float32) / 255.0
            elif ti is not None and ti >= 0 and not tints:
                cor_t = np.array(GRAMA, dtype=np.float32) / 255.0
            # brilho pela direção na tela
            nv = R @ n
            if abs(nv[1]) > abs(nv[0]) and abs(nv[1]) > 1e-6:
                b = BRILHO["up"] if nv[1] > 0 else BRILHO["down"]
            else:
                b = BRILHO["esq"] if nv[0] < 0 else BRILHO["dir"]
            if el.get("shade") is False:
                b = 1.0
            if extra_brilho:
                b *= extra_brilho
            raster_face(tela, img, para_tela(p0), para_tela(p0 + u) - para_tela(p0), para_tela(p0 + v) - para_tela(p0), uv, rf, cor_t, b)
    return tela


def raster_face(tela, img, P0, PU, PV, uv, rf, cor_t, brilho):
    xs = [P0[0], P0[0] + PU[0], P0[0] + PV[0], P0[0] + PU[0] + PV[0]]
    ys = [P0[1], P0[1] + PU[1], P0[1] + PV[1], P0[1] + PU[1] + PV[1]]
    x0, x1 = max(int(math.floor(min(xs))), 0), min(int(math.ceil(max(xs))) + 1, tela.n)
    y0, y1 = max(int(math.floor(min(ys))), 0), min(int(math.ceil(max(ys))) + 1, tela.n)
    if x1 <= x0 or y1 <= y0:
        return
    det = PU[0] * PV[1] - PU[1] * PV[0]
    if abs(det) < 1e-6:
        return
    gx, gy = np.meshgrid(np.arange(x0, x1) + 0.5, np.arange(y0, y1) + 0.5)
    dx, dy = gx - P0[0], gy - P0[1]
    a = (dx * PV[1] - dy * PV[0]) / det
    b = (PU[0] * dy - PU[1] * dx) / det
    dentro = (a >= 0) & (a < 1) & (b >= 0) & (b < 1)
    if not dentro.any():
        return
    if rf == 90:
        su, sv = b, 1 - a
    elif rf == 180:
        su, sv = 1 - a, 1 - b
    elif rf == 270:
        su, sv = 1 - b, a
    else:
        su, sv = a, b
    h, w = img.shape[:2]
    u = (uv[0] + su * (uv[2] - uv[0])) / 16.0 * w
    v = (uv[1] + sv * (uv[3] - uv[1])) / 16.0 * h
    ti = np.clip(np.floor(u).astype(int), 0, w - 1)
    tj = np.clip(np.floor(v).astype(int), 0, h - 1)
    texel = img[tj, ti].astype(np.float32)
    rgb = texel[..., :3]
    if cor_t is not None:
        rgb = rgb * cor_t
    rgb = rgb * brilho
    alfa = texel[..., 3] / 255.0
    z = P0[2] + a * PU[2] + b * PV[2]
    sub_c = tela.cor[y0:y1, x0:x1]
    sub_z = tela.z[y0:y1, x0:x1]
    opaco = dentro & (alfa >= 0.99) & (z >= sub_z - 1e-4)
    sub_c[opaco, :3] = rgb[opaco]
    sub_c[opaco, 3] = 255.0
    sub_z[opaco] = z[opaco]
    # translúcido: mistura por cima do que já existe, sem gravar profundidade
    trans = dentro & (alfa > 0.03) & (alfa < 0.99) & (z > sub_z - 1e-3)
    if trans.any():
        al = alfa[trans][:, None]
        dst_a = sub_c[trans][:, 3:4] / 255.0
        novo_a = al + dst_a * (1 - al)
        mix = (rgb[trans] * al + sub_c[trans][:, :3] * dst_a * (1 - al)) / np.maximum(novo_a, 1e-6)
        sub_c[trans, :3] = mix
        sub_c[trans, 3:4] = novo_a * 255.0


# ----------------------------------------------------------- item plano
def desenha_plano(jar, modelo, tints):
    """builtin/generated: camadas layer0..N empilhadas, uma textura 16x16 em cada."""
    base = np.zeros((16, 16, 4), dtype=np.float32)
    achou = False
    for i in range(8):
        ref = resolve_textura(modelo, modelo["textures"].get(f"layer{i}"))
        if not ref:
            continue
        img = jar.textura(ref)
        if img is None:
            continue
        achou = True
        if img.shape[0] != 16:
            im = Image.fromarray(img).resize((16, 16), Image.NEAREST)
            img = np.asarray(im)
        im = img.astype(np.float32)
        if i < len(tints):
            im[..., :3] *= np.array(cor_tint(tints[i]), dtype=np.float32) / 255.0
        a = im[..., 3:4] / 255.0
        base[..., :3] = im[..., :3] * a + base[..., :3] * (1 - a)
        base[..., 3:4] = np.maximum(base[..., 3:4], im[..., 3:4])
    if not achou:
        return None
    img = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8), "RGBA")
    return img.resize((TAM, TAM), Image.NEAREST)


def empilha(destino, img):
    if img is None:
        return destino
    if destino is None:
        return img
    return Image.alpha_composite(destino, img)


# ------------------------------------------------------------ ícone de um item
class Renderizador:
    def __init__(self, versao):
        self.jar = Jar(versao)
        self.aproximados = []

    def icone(self, item_id):
        d = self.jar.json(f"assets/minecraft/items/{item_id}.json")
        if d is None:
            return None
        camadas = resolve_def(d["model"])
        out = None
        for c in camadas:
            if c[0] == "model":
                out = empilha(out, self.modelo(c[1], c[2]))
            else:
                out = empilha(out, self.especial(item_id, c[1]))
        return out

    def modelo(self, ref, tints):
        m = carrega_modelo(self.jar, ref)
        if m is None:
            return None
        if m.get("builtin") == "generated":
            return desenha_plano(self.jar, m, tints)
        if m.get("elements"):
            return desenha_modelo(self.jar, m, tints).reduz()
        return None

    def especial(self, item_id, no):
        from especiais import desenha_especial
        return desenha_especial(self, item_id, no)


def folha(imagens):
    linhas = math.ceil(len(imagens) / COLUNAS)
    sheet = Image.new("RGBA", (COLUNAS * TAM, linhas * TAM), (0, 0, 0, 0))
    for i, im in enumerate(imagens):
        if im is not None:
            sheet.paste(im, ((i % COLUNAS) * TAM, (i // COLUNAS) * TAM))
    return sheet


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--versao", default="1.21.11")
    p.add_argument("--ver", nargs="*")
    a = p.parse_args()
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    r = Renderizador(a.versao)
    dados = json.load(open(RAIZ / "dados" / "itens.json", encoding="utf-8"))
    ids = [i["id"] for i in dados["itens"]]
    if a.ver:
        imgs = [r.icone(i) for i in a.ver]
        fundo = Image.new("RGBA", (len(imgs) * TAM, TAM), (139, 139, 139, 255))
        for k, im in enumerate(imgs):
            if im is not None:
                fundo.alpha_composite(im, (k * TAM, 0))
        fundo.save(RAIZ / "img" / "_teste.png")
        print("falhou:", [i for i, im in zip(a.ver, imgs) if im is None])
        return
    imgs, falhas = [], []
    for k, i in enumerate(ids):
        try:
            im = r.icone(i)
        except Exception as e:  # um item com problema não derruba os 1500 outros
            print("erro", i, repr(e))
            im = None
        if im is None:
            falhas.append(i)
        imgs.append(im)
    sheet = folha(imgs)
    sheet.save(RAIZ / "img" / "itens.png", optimize=True)
    print(f"{len(ids) - len(falhas)} ícones feitos, {len(falhas)} sem ícone")
    print("sem ícone:", falhas)
    json.dump({"colunas": COLUNAS, "tam": TAM, "sem_icone": falhas}, open(RAIZ / "img" / "icones.json", "w"), indent=0)


if __name__ == "__main__":
    main()
