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

    print(f"{len(itens)} itens, {len(receitas)} receitas da mesa, {len(tags)} grupos de materiais")
    print("craftáveis:", len(craftaveis))
    print("sem nome no idioma:", sem_nome)
    print("tags sem nome pt:", faltam)
    resultados_fora = sorted(r for r in craftaveis if r not in existentes)
    print("resultado que não é item:", resultados_fora)


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--versao", default="1.21.11")
    ARGS = p.parse_args()
    main()
