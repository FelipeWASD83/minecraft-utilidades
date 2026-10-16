"""Gera dados/itens.json e dados/receitas.json a partir do jar do Minecraft.

Lê o jar e os assets que o Prism Launcher dele já tem no disco (nada é baixado):
  - lista de itens: assets/minecraft/items/*.json
  - receitas da mesa de trabalho: data/minecraft/recipe/*.json
  - grupos de materiais (tags): data/minecraft/tags/item/**/*.json
  - nomes: en_us (dentro do jar) e pt_br (nos assets, pelo índice do Prism)

Uso:  python ferramentas/construir_dados.py [--versao 1.21.11]
"""
import argparse
import json
import os
import re
import sys
import zipfile
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
PRISM = Path(os.environ["APPDATA"]) / "PrismLauncher"

# Nomes em português dos grupos de materiais usados nas receitas (o jogo não traz isso).
NOME_TAG = {
    "acacia_logs": "Troncos de acácia",
    "bamboo_blocks": "Blocos de bambu",
    "birch_logs": "Troncos de bétula",
    "bundles": "Qualquer trouxa",
    "cherry_logs": "Troncos de cerejeira",
    "coals": "Carvão ou carvão vegetal",
    "copper_tool_materials": "Cobre (material de ferramenta)",
    "crimson_stems": "Hifas carmesim",
    "dark_oak_logs": "Troncos de carvalho escuro",
    "diamond_tool_materials": "Diamante (material de ferramenta)",
    "eggs": "Qualquer ovo",
    "gold_tool_materials": "Ouro (material de ferramenta)",
    "iron_tool_materials": "Ferro (material de ferramenta)",
    "jungle_logs": "Troncos de selva",
    "leaves": "Qualquer folha",
    "logs_that_burn": "Qualquer tronco (que queima)",
    "netherite_tool_materials": "Netherite (material de ferramenta)",
    "smelts_to_glass": "Qualquer areia",
    "logs": "Qualquer tronco",
    "mangrove_logs": "Troncos de mangue",
    "oak_logs": "Troncos de carvalho",
    "pale_oak_logs": "Troncos de carvalho pálido",
    "planks": "Qualquer tábua",
    "shulker_boxes": "Qualquer caixa de shulker",
    "soul_fire_base_blocks": "Areia ou solo das almas",
    "spruce_logs": "Troncos de pinheiro",
    "stone_crafting_materials": "Pedra (material de ferramenta)",
    "stone_tool_materials": "Pedra (material de ferramenta)",
    "warped_stems": "Hifas distorcidas",
    "wooden_slabs": "Qualquer laje de madeira",
    "wooden_tool_materials": "Qualquer tábua",
    "wool": "Qualquer lã",
}

ESPECIAIS = {
    "minecraft:crafting_special_armordye": "armordye",
    "minecraft:crafting_special_bannerduplicate": "bannerduplicate",
    "minecraft:crafting_special_bookcloning": "bookcloning",
    "minecraft:crafting_decorated_pot": "decoratedpot",
    "minecraft:crafting_special_firework_rocket": "fireworkrocket",
    "minecraft:crafting_special_firework_star": "fireworkstar",
    "minecraft:crafting_special_firework_star_fade": "fireworkstarfade",
    "minecraft:crafting_special_mapcloning": "mapcloning",
    "minecraft:crafting_special_mapextending": "mapextending",
    "minecraft:crafting_special_repairitem": "repairitem",
    "minecraft:crafting_special_shielddecoration": "shielddecoration",
    "minecraft:crafting_special_tippedarrow": "tippedarrow",
}

# Receitas de cozinhar: tipo do jogo -> bloco que faz
COZINHAR = {
    "minecraft:smelting": "furnace",
    "minecraft:blasting": "blast_furnace",
    "minecraft:smoking": "smoker",
    "minecraft:campfire_cooking": "campfire",
}

# Itens que são só de teste interno do jogo: não entram na lista.
OCULTOS = {"air", "test_block", "test_instance_block"}

COMIDA = {
    "apple", "golden_apple", "enchanted_golden_apple", "melon_slice", "sweet_berries", "glow_berries",
    "chorus_fruit", "carrot", "golden_carrot", "potato", "baked_potato", "poisonous_potato", "beetroot",
    "dried_kelp", "bread", "cookie", "cake", "pumpkin_pie", "mushroom_stew", "beetroot_soup",
    "rabbit_stew", "suspicious_stew", "honey_bottle", "milk_bucket", "beef", "cooked_beef", "porkchop",
    "cooked_porkchop", "chicken", "cooked_chicken", "mutton", "cooked_mutton", "rabbit", "cooked_rabbit",
    "cod", "cooked_cod", "salmon", "cooked_salmon", "tropical_fish", "pufferfish", "rotten_flesh",
    "spider_eye", "ominous_bottle", "pumpkin_seeds",
}
REDSTONE = {
    "redstone", "repeater", "comparator", "piston", "sticky_piston", "observer", "hopper", "dropper",
    "dispenser", "lever", "tripwire_hook", "daylight_detector", "target", "lightning_rod",
    "redstone_lamp", "note_block", "sculk_sensor", "calibrated_sculk_sensor", "sculk_shrieker",
    "rail", "powered_rail", "detector_rail", "activator_rail", "tnt", "crafter", "slime_block",
    "honey_block", "redstone_block", "jukebox", "bell", "trapped_chest", "tripwire", "string",
}


def pasta_assets():
    meta = json.load(open(PRISM / "meta" / "net.minecraft" / f"{ARGS.versao}.json", encoding="utf-8"))
    return meta["assetIndex"]["id"]


def ler_lang(zf):
    en = json.loads(zf.read("assets/minecraft/lang/en_us.json").decode("utf-8"))
    indice = json.load(open(PRISM / "assets" / "indexes" / f"{pasta_assets()}.json", encoding="utf-8"))["objects"]
    h = indice["minecraft/lang/pt_br.json"]["hash"]
    pt = json.load(open(PRISM / "assets" / "objects" / h[:2] / h, encoding="utf-8"))
    return en, pt


def limpa(x):
    """Tira o 'minecraft:' dos ids, deixa '#' nas tags. Aceita texto ou lista de alternativas."""
    if isinstance(x, list):
        return [limpa(y) for y in x]
    if isinstance(x, dict):
        x = x.get("item") or ("#" + x["tag"] if "tag" in x else None)
    if x is None:
        return None
    return x.replace("minecraft:", "")


def categoria(i, eh_bloco):
    if re.search(r"(_helmet|_chestplate|_leggings|_boots|_horse_armor|_nautilus_armor)$", i) or i in ("elytra", "wolf_armor", "turtle_helmet", "turtle_scute"):
        return "armaduras" if i != "turtle_scute" else "outros"
    if re.search(r"(_sword|_spear)$", i) or i in ("bow", "crossbow", "trident", "mace", "arrow", "spectral_arrow", "tipped_arrow", "shield", "wind_charge", "fire_charge", "totem_of_undying"):
        return "combate"
    if re.search(r"(_pickaxe|_axe|_shovel|_hoe|_bucket)$", i) or i in ("bucket", "fishing_rod", "shears", "flint_and_steel", "brush", "spyglass", "compass", "recovery_compass", "clock", "carrot_on_a_stick", "warped_fungus_on_a_stick", "lead", "name_tag", "map", "filled_map", "saddle", "debug_stick", "bundle"):
        return "ferramentas"
    if i in COMIDA:
        return "comida"
    if i in REDSTONE or re.search(r"(_button|_pressure_plate|_bulb)$", i):
        return "redstone"
    return "blocos" if eh_bloco else "outros"


def main():
    jar = PRISM / "libraries" / "com" / "mojang" / "minecraft" / ARGS.versao / f"minecraft-{ARGS.versao}-client.jar"
    if not jar.exists():
        sys.exit(f"jar não encontrado: {jar}")
    zf = zipfile.ZipFile(jar)
    nomes = zf.namelist()
    en, pt = ler_lang(zf)

    ids = sorted(
        Path(n).stem for n in nomes
        if n.startswith("assets/minecraft/items/") and n.endswith(".json")
    )
    ids = [i for i in ids if i not in OCULTOS]
    existentes = set(ids)

    # --- receitas --------------------------------------------------------
    receitas = []
    craftaveis = set()
    for n in sorted(nomes):
        if not (n.startswith("data/minecraft/recipe/") and n.endswith(".json")):
            continue
        d = json.loads(zf.read(n).decode("utf-8"))
        t = d["type"]
        arquivo = Path(n).stem
        if t == "minecraft:crafting_shaped":
            linhas = d["pattern"]
            larg = max(len(l) for l in linhas)
            grade = []
            for l in linhas:
                l = l.ljust(larg)
                grade.append([None if c == " " else limpa(d["key"][c]) for c in l])
            # o jogo ignora linhas e colunas vazias nas bordas do molde
            while grade and all(c is None for c in grade[0]):
                grade.pop(0)
            while grade and all(c is None for c in grade[-1]):
                grade.pop()
            while grade and all(l[0] is None for l in grade):
                grade = [l[1:] for l in grade]
            while grade and all(l[-1] is None for l in grade):
                grade = [l[:-1] for l in grade]
            r = {"t": "shaped", "g": grade}
        elif t == "minecraft:crafting_shapeless":
            r = {"t": "shapeless", "i": [limpa(x) for x in d["ingredients"]]}
        elif t == "minecraft:crafting_transmute":
            r = {"t": "shapeless", "i": [limpa(d["input"]), limpa(d["material"])]}
        elif t in COZINHAR:
            res = d["result"]
            r = {"t": "cozinhar", "e": COZINHAR[t], "i": limpa(d["ingredient"]),
                 "r": limpa(res["id"] if isinstance(res, dict) else res), "n": 1,
                 "x": d.get("experience", 0), "s": d.get("cookingtime", 200) / 20, "id": arquivo}
            receitas.append(r)
            continue
        elif t == "minecraft:stonecutting":
            res = d["result"]
            r = {"t": "cortapedra", "i": limpa(d["ingredient"]), "r": limpa(res["id"]),
                 "n": res.get("count", 1), "id": arquivo}
            receitas.append(r)
            continue
        elif t == "minecraft:smithing_transform":
            res = d["result"]
            r = {"t": "ferraria", "m": limpa(d["template"]), "b": limpa(d["base"]), "a": limpa(d["addition"]),
                 "r": limpa(res["id"]), "n": res.get("count", 1), "id": arquivo}
            receitas.append(r)
            continue
        elif t in ESPECIAIS:
            r = {"t": "special", "k": ESPECIAIS[t]}
            # os especiais não trazem resultado fixo; o motor do site calcula
            r["id"] = arquivo
            receitas.append(r)
            continue
        else:
            continue  # fornalha, cortapedra, ferraria: não são da mesa de trabalho
        res = d["result"]
        r["r"] = limpa(res["id"])
        r["n"] = res.get("count", 1)
        r["id"] = arquivo
        if "components" in res:
            r["c"] = True  # resultado com dados extras (ex.: ensopado suspeito)
        craftaveis.add(r["r"])
        receitas.append(r)

    # --- tags usadas pelas receitas -------------------------------------
    tags_brutas = {}
    for n in nomes:
        if n.startswith("data/minecraft/tags/item/") and n.endswith(".json"):
            chave = n[len("data/minecraft/tags/item/"):-5]
            tags_brutas[chave] = json.loads(zf.read(n).decode("utf-8"))["values"]

    def expande(chave, vistos=()):
        out = []
        for v in tags_brutas.get(chave, []):
            v = v["id"] if isinstance(v, dict) else v
            v = v.replace("minecraft:", "")
            if v.startswith("#"):
                if v[1:] not in vistos:
                    out += expande(v[1:], vistos + (chave,))
            else:
                out.append(v)
        return out

    usadas = set()

    def coleta(x):
        if isinstance(x, str) and x.startswith("#"):
            usadas.add(x[1:])
        elif isinstance(x, list):
            for y in x:
                coleta(y)

    for r in receitas:
        if r["t"] == "shaped":
            for linha in r["g"]:
                for c in linha:
                    coleta(c)
        elif r["t"] == "shapeless":
            for c in r["i"]:
                coleta(c)
        elif r["t"] in ("cozinhar", "cortapedra"):
            coleta(r["i"])
        elif r["t"] == "ferraria":
            for c in (r["m"], r["b"], r["a"]):
                coleta(c)
    # tags que os receitas especiais usam (peças do vaso, estandartes, etc.)
    usadas |= {"decorated_pot_sherds", "banners", "dyeable", "book_cloning_target", "decorated_pot_ingredients"}
    tags = {}
    for chave in sorted(usadas):
        membros = [m for m in dict.fromkeys(expande(chave)) if m in existentes]
        tags[chave] = membros

    nomes_tag = {t: NOME_TAG[t] for t in tags if t in NOME_TAG}
    faltam = [t for t in tags if t not in NOME_TAG]

    # --- itens ------------------------------------------------------------
    itens = []
    sem_nome = []
    for i in ids:
        chave_item, chave_bloco = f"item.minecraft.{i}", f"block.minecraft.{i}"
        eh_bloco = chave_item not in en and chave_bloco in en
        if chave_item in en:
            k = chave_item
        elif chave_bloco in en:
            k = chave_bloco
        else:
            sem_nome.append(i)
            k = None
        nome_en = en.get(k) if k else i.replace("_", " ").title()
        nome_pt = pt.get(k, nome_en) if k else nome_en
        itens.append({
            "id": i,
            "pt": nome_pt,
            "en": nome_en,
            "cat": categoria(i, eh_bloco),
            "cr": 1 if i in craftaveis else 0,
        })
    itens.sort(key=lambda x: x["pt"].lower())

    (RAIZ / "dados").mkdir(exist_ok=True)
    saida = {"versao": ARGS.versao, "itens": itens, "tags": tags, "nomesTag": nomes_tag}
    (RAIZ / "dados" / "itens.json").write_text(json.dumps(saida, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (RAIZ / "dados" / "receitas.json").write_text(json.dumps(receitas, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    enc = construir_encantamentos(zf, set(nomes), en, pt, existentes, tags_brutas, expande)
    (RAIZ / "dados" / "encantamentos.json").write_text(json.dumps(enc, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (RAIZ / "dados" / "minerios.json").write_text(json.dumps(construir_minerios(zf, set(nomes)), ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(enc['encantamentos'])} encantamentos, {len(enc['itensTag'])} grupos de itens encantáveis")
    print(f"{len(itens)} itens, {len(receitas)} receitas, {len(tags)} grupos de materiais")
    print("craftáveis:", len(craftaveis))
    print("sem nome no idioma:", sem_nome)
    print("tags sem nome pt:", faltam)
    resultados_fora = sorted(r for r in craftaveis if r not in existentes)
    print("resultado que não é item:", resultados_fora)


# O que cada encantamento faz, em uma frase (o jogo só traz o nome). Escrito à mão.
DESC_ENCANTAMENTO = {
    "aqua_affinity": "Quebra blocos debaixo d'água na velocidade normal.",
    "bane_of_arthropods": "Mais dano contra aranhas, traças, endermites e abelhas, e deixa o alvo lento.",
    "binding_curse": "A peça não sai do corpo enquanto você estiver vivo (só se ela quebrar).",
    "blast_protection": "Reduz o dano e o recuo de explosões.",
    "breach": "Maça: faz a armadura do alvo valer menos.",
    "channeling": "Tridente: invoca um raio ao acertar um mob durante tempestade.",
    "density": "Maça: aumenta o dano do golpe de queda.",
    "depth_strider": "Anda mais rápido debaixo d'água.",
    "efficiency": "Quebra blocos mais rápido.",
    "feather_falling": "Reduz o dano de queda.",
    "fire_aspect": "Põe fogo no alvo.",
    "fire_protection": "Reduz o dano de fogo e o tempo em chamas.",
    "flame": "Arco: as flechas incendeiam o alvo.",
    "fortune": "Blocos como minérios e folhas soltam mais itens.",
    "frost_walker": "Transforma a água sob seus pés em gelo.",
    "impaling": "Tridente: mais dano contra mobs aquáticos.",
    "infinity": "Arco: a flecha comum não é gasta ao atirar.",
    "knockback": "Empurra o alvo para trás.",
    "looting": "Mobs soltam mais itens.",
    "loyalty": "Tridente: volta sozinho para a sua mão depois de arremessado.",
    "luck_of_the_sea": "Pesca: mais chance de tesouro e menos de lixo.",
    "lunge": "Lança: o golpe de estocada lança você para a frente, ao custo de fome e durabilidade.",
    "lure": "Pesca: o peixe morde mais rápido.",
    "mending": "A experiência que você coleta conserta o item.",
    "multishot": "Besta: dispara três flechas de uma vez, gastando uma.",
    "piercing": "Besta: a flecha atravessa os mobs.",
    "power": "Arco: mais dano nas flechas.",
    "projectile_protection": "Reduz o dano de flechas e outros projéteis.",
    "protection": "Reduz quase todo tipo de dano.",
    "punch": "Arco: a flecha empurra o alvo para trás.",
    "quick_charge": "Besta: carrega mais rápido.",
    "respiration": "Aguenta mais tempo debaixo d'água e enxerga melhor lá.",
    "riptide": "Tridente: em água ou chuva, lança você junto com ele em vez de arremessar.",
    "sharpness": "Mais dano corpo a corpo.",
    "silk_touch": "Quebra o bloco inteiro (minério, vidro, grama...) em vez dos itens dele.",
    "smite": "Mais dano contra mortos-vivos.",
    "soul_speed": "Anda mais rápido em areia e solo das almas, gastando a bota.",
    "sweeping_edge": "Espada: aumenta o dano do ataque em arco.",
    "swift_sneak": "Anda mais rápido agachado.",
    "thorns": "Devolve dano a quem bate em você, gastando durabilidade.",
    "unbreaking": "Chance de o item não gastar durabilidade.",
    "vanishing_curse": "O item some quando você morre.",
    "wind_burst": "Maça: depois do golpe de queda, joga você para cima.",
}


def construir_encantamentos(zf, nomes, en, pt, existentes, tags_brutas, expande):
    """dados/encantamentos.json: tudo que o jogo guarda de cada encantamento."""
    def tag_ench(caminho):
        n = f"data/minecraft/tags/enchantment/{caminho}.json"
        return json.loads(zf.read(n).decode("utf-8"))["values"] if n in nomes else []

    def expande_ench(vals, vistos=()):
        out = []
        for v in vals:
            v = v.replace("minecraft:", "")
            if v.startswith("#"):
                out += expande_ench(tag_ench(v[1:]), vistos)
            else:
                out.append(v)
        return out

    nao_tesouro = set(expande_ench(tag_ench("non_treasure")))
    tabela = set(expande_ench(tag_ench("in_enchanting_table")))
    troca = set(expande_ench(tag_ench("tradeable")))
    tesouro = set(expande_ench(tag_ench("treasure")))
    loot = set(expande_ench(tag_ench("on_random_loot")))
    maldicao = set(expande_ench(tag_ench("curse")))

    itens_tag = {}

    def tag_itens(ref):
        if not ref:
            return None
        nome = ref.replace("#minecraft:", "")
        if nome not in itens_tag:
            itens_tag[nome] = [m for m in dict.fromkeys(expande(nome)) if m in existentes]
        return nome

    lista = []
    for n in sorted(nomes):
        if not (n.startswith("data/minecraft/enchantment/") and n.endswith(".json")):
            continue
        i = Path(n).stem
        d = json.loads(zf.read(n).decode("utf-8"))
        excl = d.get("exclusive_set")
        exclusivos = []
        if excl:
            exclusivos = [e for e in expande_ench(tag_ench(excl.replace("#minecraft:", ""))) if e != i]
        chave = f"enchantment.minecraft.{i}"
        lista.append({
            "id": i,
            "pt": pt.get(chave, en.get(chave, i)),
            "en": en.get(chave, i),
            "max": d["max_level"],
            "peso": d["weight"],
            "bigorna": d["anvil_cost"],
            "min": [d["min_cost"]["base"], d["min_cost"]["per_level_above_first"]],
            "maxc": [d["max_cost"]["base"], d["max_cost"]["per_level_above_first"]],
            "desc": DESC_ENCANTAMENTO.get(i, ""),
            "itens": tag_itens(d["supported_items"]),
            "principais": tag_itens(d.get("primary_items")),
            "exclusivos": exclusivos,
            "tabela": i in tabela,
            "troca": i in troca,
            "loot": i in loot,
            "tesouro": i in tesouro,
            "maldicao": i in maldicao,
        })
    # O jogo trata o conflito nos dois sentidos (A barra B se A lista B ou B lista A),
    # mas cada encantamento só guarda o próprio conjunto: a Correnteza lista a Lealdade, e a Lealdade não lista nada.
    por_id = {e["id"]: e for e in lista}
    for e in lista:
        for x in e["exclusivos"]:
            if e["id"] not in por_id[x]["exclusivos"]:
                por_id[x]["exclusivos"].append(e["id"])
    lista.sort(key=lambda x: x["pt"].lower())
    return {"encantamentos": lista, "itensTag": itens_tag}


# Minérios: onde o jogo os gera (a faixa de altura sai direto das regras de geração do jogo).
MINERIOS = [
    # (id do item, nome da regra de geração, dimensão)
    ("coal_ore", ["ore_coal_lower", "ore_coal_upper"], "overworld"),
    ("copper_ore", ["ore_copper"], "overworld"),
    ("iron_ore", ["ore_iron_middle", "ore_iron_small", "ore_iron_upper"], "overworld"),
    ("lapis_ore", ["ore_lapis", "ore_lapis_buried"], "overworld"),
    ("gold_ore", ["ore_gold", "ore_gold_lower"], "overworld"),
    ("redstone_ore", ["ore_redstone", "ore_redstone_lower"], "overworld"),
    ("diamond_ore", ["ore_diamond", "ore_diamond_buried", "ore_diamond_medium"], "overworld"),
    ("emerald_ore", ["ore_emerald"], "overworld"),
    ("nether_gold_ore", ["ore_gold_nether", "ore_gold_deltas"], "nether"),
    ("nether_quartz_ore", ["ore_quartz_nether", "ore_quartz_deltas"], "nether"),
    ("ancient_debris", ["ore_ancient_debris_large", "ore_debris_small"], "nether"),
]
LIMITES = {"overworld": (-64, 320), "nether": (0, 128)}


def construir_minerios(zf, nomes):
    def y(ref, dim):
        fundo, topo = LIMITES[dim]
        if "absolute" in ref:
            return ref["absolute"]
        if "above_bottom" in ref:
            return fundo + ref["above_bottom"]
        return topo - ref["below_top"]

    out = []
    for item, regras, dim in MINERIOS:
        faixas = []
        fundo, topo = LIMITES[dim]
        for r in regras:
            d = json.loads(zf.read(f"data/minecraft/worldgen/placed_feature/{r}.json").decode("utf-8"))
            h = [p for p in d["placement"] if p["type"].endswith("height_range")][0]["height"]
            lo, hi = y(h["min_inclusive"], dim), y(h["max_inclusive"], dim)
            tipo = h["type"].replace("minecraft:", "")
            faixas.append({"regra": r, "min": max(lo, fundo), "max": min(hi, topo - 1), "pico": round(max(min((lo + hi) / 2, topo - 1), fundo)) if tipo == "trapezoid" else None, "tipo": tipo})
        out.append({"id": item, "dim": dim, "faixas": faixas})
    return out


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--versao", default="1.21.11")
    ARGS = p.parse_args()
    main()
