"""Itens que o jogo desenha com modelo de entidade (baú, cama, caixa de shulker, estandarte,
cabeça, escudo...). Não há JSON de blocos para eles, então montamos as caixas à mão com as
medidas e o mapa de textura do próprio jogo e passamos pelo mesmo desenhista.
"""
from renderizar_icones import Tela, carrega_modelo, desenha_modelo

COR_DYE = {
    "white": 0xF9FFFE, "orange": 0xF9801D, "magenta": 0xC74EBD, "light_blue": 0x3AB3DA,
    "yellow": 0xFED83D, "lime": 0x80C71F, "pink": 0xF38BAA, "gray": 0x474F52,
    "light_gray": 0x9D9D97, "cyan": 0x169C9C, "purple": 0x8932B8, "blue": 0x3C44AA,
    "brown": 0x835432, "green": 0x5E7C16, "red": 0xB02E26, "black": 0x1D1D21,
}


def caixa(x, y, z, w, h, d, u, v, tex, tint=None):
    """Caixa com a frente voltada para o sul e o mapa de textura de caixa do jogo (u, v em pixels)."""
    elem = {
        "from": [x, y, z], "to": [x + w, y + h, z + d],
        "faces": {
            "south": {"uv": [u + d, v + d, u + d + w, v + d + h], "texture": "#t"},
            "north": {"uv": [u + 2 * d + w, v + d, u + 2 * d + 2 * w, v + d + h], "texture": "#t"},
            "west": {"uv": [u, v + d, u + d, v + d + h], "texture": "#t"},
            "east": {"uv": [u + d + w, v + d, u + 2 * d + w, v + d + h], "texture": "#t"},
            "up": {"uv": [u + d, v, u + d + w, v + d], "texture": "#t"},
            "down": {"uv": [u + d + w, v + d, u + d + 2 * w, v], "texture": "#t"},
        },
    }
    if tint is not None:
        for f in elem["faces"].values():
            f["tintindex"] = tint
    return elem


def gui(r, base):
    m = carrega_modelo(r.jar, base.replace("minecraft:", ""))
    return (m or {"display": {}})["display"].get("gui", {})


def monta(r, tex, elementos, disp, tamanho=(64, 64), tints=None, brilho=None):
    modelo = {"textures": {"t": tex}, "elements": elementos, "display": {}}
    return desenha_modelo(r.jar, modelo, tints or [], display=disp, uv_px=tamanho, extra_brilho=brilho).reduz()


def desenha_especial(r, item_id, no):
    tipo = no["model"]["type"].split(":")[-1]
    base = no.get("base", "")
    disp = gui(r, base)
    mod = no["model"]

    if tipo == "chest":
        tex = "entity/chest/" + mod["texture"].replace("minecraft:", "")
        els = [
            caixa(1, 0, 1, 14, 10, 14, 0, 19, tex),
            caixa(1, 9, 1, 14, 5, 14, 0, 0, tex),
            caixa(7, 7, 15, 2, 4, 1, 0, 0, tex),
        ]
        return monta(r, tex, els, disp)

    if tipo == "shulker_box":
        tex = "entity/shulker/" + mod["texture"].replace("minecraft:", "")
        els = [caixa(0, 0, 0, 16, 8, 16, 0, 28, tex), caixa(0, 4, 0, 16, 12, 16, 0, 0, tex)]
        return monta(r, tex, els, disp)

    if tipo == "bed":
        tex = "entity/bed/" + mod["texture"].replace("minecraft:", "")
        # cabeça (z 0..16) e pés (z 16..32), deitados; o "topo" do colchão é a região frontal da caixa
        def parte(z0, v, pe):
            top = {"uv": [6, v + 6, 22, v + 22], "texture": "#t"}
            return {
                "from": [0, 3, z0], "to": [16, 9, z0 + 16],
                "faces": {
                    "up": top,
                    "north": {"uv": [6, v, 22, v + 6], "texture": "#t"} if not pe else {"uv": [22, v, 38, v + 6], "texture": "#t"},
                    "south": {"uv": [22, v, 38, v + 6], "texture": "#t"} if not pe else {"uv": [6, v, 22, v + 6], "texture": "#t"},
                    "west": {"uv": [0, v + 6, 6, v + 22], "texture": "#t", "rotation": 90},
                    "east": {"uv": [22, v + 6, 28, v + 22], "texture": "#t", "rotation": 270},
                },
            }
        els = [parte(0, 0, False), parte(16, 22, True)]
        for (lx, lz, lv) in ((0, 0, 0), (13, 0, 6), (0, 29, 12), (13, 29, 18)):
            els.append(caixa(lx, 0, lz, 3, 3, 3, 50, lv, tex))
        return monta(r, tex, els, disp)

    if tipo == "banner":
        tex = "entity/banner_base"
        cor = COR_DYE.get(mod["color"], 0xFFFFFF)
        flag = caixa(-2, -13, 9, 20, 40, 1, 0, 0, tex, tint=0)
        els = [
            caixa(7, -13, 7, 2, 42, 2, 44, 0, tex),
            caixa(-2, 27, 7, 20, 2, 2, 0, 42, tex),
            flag,
        ]
        d_ = {"rotation": [30, 20, 0], "translation": [0, 0, 0], "scale": [0.37, 0.37, 0.37]}
        return monta(r, tex, els, d_, tints=[{"type": "minecraft:constant", "value": cor}], brilho=1.25)

    if tipo in ("head", "player_head"):
        kind = mod.get("kind", "player")
        if kind == "dragon":
            tex, tam, args = "entity/enderdragon/dragon", (256, 256), (-4, 0, 0, 16, 16, 16, 112, 30)
        else:
            tex, tam = {
                "creeper": ("entity/creeper/creeper", (64, 32)),
                "skeleton": ("entity/skeleton/skeleton", (64, 32)),
                "wither_skeleton": ("entity/skeleton/wither_skeleton", (64, 32)),
                "zombie": ("entity/zombie/zombie", (64, 64)),
                "piglin": ("entity/piglin/piglin", (64, 64)),
                "player": ("entity/player/wide/steve", (64, 64)),
            }[kind]
            args = (4, 0, 4, 8, 8, 8, 0, 0)
        x, y, z, w, h, d, u, v = args
        d_ = dict(disp)
        d_["rotation"] = [30, 315, 0]  # rosto virado para o lado esquerdo
        return monta(r, tex, [caixa(x, y, z, w, h, d, u, v, tex)], d_, tamanho=tam)

    if tipo == "conduit":
        tex = "entity/conduit/base"
        return monta(r, tex, [caixa(4, 4, 4, 8, 8, 8, 0, 0, tex)], disp, tamanho=(32, 16))

    if tipo == "shield":
        tex = "entity/shield_base_nopattern"
        els = [caixa(2, -3, 7, 12, 22, 1, 0, 0, tex), caixa(7, 5, 5, 2, 6, 2, 26, 0, tex)]
        return monta(r, tex, els, disp, brilho=1.25)

    if tipo == "decorated_pot":
        els = [
            {"from": [1, 0, 1], "to": [15, 16, 15], "faces": {k: {"uv": [0, 0, 16, 16], "texture": "#t"} for k in ("north", "south", "east", "west")}},
            {"from": [5, 16, 5], "to": [11, 20, 11], "faces": {k: {"uv": [0, 0, 16, 16], "texture": "#t"} for k in ("north", "south", "east", "west")}},
            {"from": [4, 20, 4], "to": [12, 22, 12], "faces": {k: {"uv": [0, 0, 16, 16], "texture": "#t"} for k in ("north", "south", "east", "west", "up")}},
            {"from": [1, 16, 1], "to": [15, 16.01, 15], "faces": {"up": {"uv": [0, 0, 16, 16], "texture": "#t"}}},
        ]
        return monta(r, "entity/decorated_pot/decorated_pot_side", els, disp, tamanho=(16, 16))

    if tipo == "copper_golem_statue":
        # aproximação: o pedestal de cobre (a estátua inteira não tem modelo de blocos)
        estado = item_id.replace("waxed_", "").replace("copper_golem_statue", "").strip("_")
        bloco = {"": "copper_block", "exposed": "exposed_copper", "weathered": "weathered_copper", "oxidized": "oxidized_copper"}[estado]
        modelo = {"textures": {"t": f"block/{bloco}"}, "elements": [{"from": [3, 0, 3], "to": [13, 12, 13], "faces": {k: {"texture": "#t"} for k in ("north", "south", "east", "west", "up", "down")}}], "display": {}}
        r.aproximados.append(item_id)
        return desenha_modelo(r.jar, modelo, [], display={"rotation": [30, 225, 0], "scale": [0.8, 0.8, 0.8]}).reduz()

    return None
