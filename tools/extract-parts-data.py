#!/usr/bin/env python3
"""
Extract parts data from image filenames and generate data.js catalog.

Scans JPEG images in 6 NXT scooter model folders, parses filenames to extract
part name, price, and weight, cross-references with a price table for missing
prices, and generates a data.js file with the complete catalog.
"""

import os
import re
import json
from pathlib import Path

# --- Configuration ---

MODELS = {
    "kay":        {"nome": "Kay",          "folder": "J:/Meu Drive/SAC/PEÇAS/E-KAY PEÇAS"},
    "jaya":       {"nome": "JAYA",        "folder": "J:/Meu Drive/SAC/PEÇAS/JAYA PEÇAS"},
    "juna-smart": {"nome": "JUNA SMART",  "folder": "J:/Meu Drive/SAC/PEÇAS/JUNA SMART PEÇAS"},
    "luna":       {"nome": "LUNA",        "folder": "J:/Meu Drive/SAC/PEÇAS/LUNA PEÇAS"},
    "shaka":      {"nome": "SHAKA",       "folder": "J:/Meu Drive/SAC/PEÇAS/SHAKA PEÇAS"},
    "zilla":      {"nome": "ZILLA",       "folder": "J:/Meu Drive/SAC/PEÇAS/ZILLA PEÇAS"},
}

OUTPUT_FILE = "C:/Users/claud/Desktop/Documents/GitHub/NXT/sac-pecas/data.js"

# Price table (Cliente Final) - keys are lowercase for matching
PRICE_TABLE = {
    "bateria 12v 12ah chumbo": 298.80,
    "bateria 12v 20ah chumbo": 358.80,
    "bateria 12v 20ah grafeno": 450.00,
    "bateria 12v 35ah grafeno": 600.00,
    "carregador": 346.80,
    "chicote": 315.00,
    "conjunto cabos bateria": 25.00,
    "modulo controlador": 354.00,
    "tomada carregador": 35.00,
    "aro 10 dianteiro": 206.00,
    "camara de ar": 54.00,
    "pneu 10": 346.80,
    "pneu 12": 358.80,
    "motor 1000w": 1250.00,
    "cabo de freio": 106.80,
    "disco de freio": 52.00,
    "freio hidraulico": 225.00,
    "freio tambor": 118.80,
    "protetor de balanca": 144.00,
    "conjunto de direcao": 57.00,
    "mesa inferior": 211.00,
    "par suspensao traseira": 165.00,
    "pedaleira com chapa": 57.00,
    "quadro": 450.00,
    "assoalho": 125.00,
    "carenagem frontal/farol": 269.00,
    "carenagem lateral": 56.00,
    "carenagem escudo": 189.00,
    "paralama dianteiro": 190.80,
    "paralama traseiro": 166.80,
    "plastico lateral": 45.00,
    "farol dianteiro": 145.00,
    "lanterna traseira": 75.00,
    "par pisca": 66.00,
    "acelerador de punho": 125.00,
    "alarme completo": 126.00,
    "conjunto botoes": 58.80,
    "display lcd": 145.00,
    "ignicao": 126.00,
    "manete esquerdo com sensor": 107.00,
    "manete direito": 75.00,
    "par manete com sensor": 214.80,
    "encosto com alca": 126.00,
    "guidao": 115.00,
    "par bengala": 165.60,
    "buzina": 25.00,
    "conversor": 52.00,
    "disjuntor": 52.00,
    "eixo dianteiro": 48.00,
    "porta treco": 75.00,
    "rabeta": 55.00,
    "balanca": 220.00,
    "banco piloto": 75.00,
    "banco garupa": 45.00,
    "bau": 45.00,
    "caixa bateria": 45.00,
    "cavalete": 125.00,
    "descanso": 75.00,
    "tapete": 70.00,
    "manopla": 42.00,
    "carenagem guidao": 42.00,
    "carenagem painel": 42.00,
    "carenagem peitoral": 85.00,
    "carenagem bau": 89.00,
}


def normalize_for_price_lookup(name):
    """Normalize a part name for matching against the price table."""
    s = name.lower().strip()
    # Remove accents for matching
    replacements = {
        'á': 'a', 'à': 'a', 'ã': 'a', 'â': 'a',
        'é': 'e', 'è': 'e', 'ê': 'e',
        'í': 'i', 'ì': 'i', 'î': 'i',
        'ó': 'o', 'ò': 'o', 'õ': 'o', 'ô': 'o',
        'ú': 'u', 'ù': 'u', 'û': 'u', 'ü': 'u',
        'ç': 'c',
    }
    for old, new in replacements.items():
        s = s.replace(old, new)
    return s


def lookup_price(part_name):
    """Try to find a price in the price table by matching part name."""
    normalized = normalize_for_price_lookup(part_name)

    # Direct match
    if normalized in PRICE_TABLE:
        return PRICE_TABLE[normalized]

    # Try matching against each key - check if key is contained in part name or vice versa
    for key, price in PRICE_TABLE.items():
        if key in normalized or normalized in key:
            return price

    # Try matching first significant words
    # e.g., "alarme" should match "alarme completo"
    for key, price in PRICE_TABLE.items():
        key_words = set(key.split())
        name_words = set(normalized.split())
        # If all words in the part name are in the key, or vice versa for short names
        if len(name_words) >= 1 and name_words.issubset(key_words):
            return price

    return None


def parse_filename(filename):
    """
    Parse a filename to extract part name, price, and weight.

    Examples:
        "Alarme completo $126,00 5g.jpeg" -> ("Alarme completo", 126.00, "5g")
        "Farol 40gr.jpeg" -> ("Farol", None, "40gr")
        "Banco 1,60kg.jpeg" -> ("Banco", None, "1,60kg")
        "Bateria 12h.jpeg" -> ("Bateria 12h", None, None)
    """
    # Remove extension (handle trailing comma/dot in filenames like "foo.jpeg,")
    name = re.sub(r'\.(jpeg|jpg|png)[,.]?$', '', filename, flags=re.IGNORECASE)

    # Remove trailing dots and whitespace
    name = name.rstrip('. ')

    # Extract all prices: $XX,XX or $X.XXX,XX or $XXXX,XX patterns
    # Loop to remove ALL price occurrences from the name
    price = None
    while True:
        price_match = re.search(r'\$\.?\s*(\d{1,6}(?:\.\d{3})*,\d{2})', name)
        if not price_match:
            break
        price_str = price_match.group(1)
        # Convert Brazilian format to float: 1.250,00 -> 1250.00
        price_str = price_str.replace('.', '').replace(',', '.')
        price = float(price_str)  # Keep last price found
        # Remove the price (including the $ sign) from the name
        name = name[:price_match.start()] + name[price_match.end():]

    # Extract weight: patterns like "10gr", "1,60kg", "5g", "10 gr", "5 grama", "15GR"
    weight = None
    weight_match = re.search(
        r'[\s.](\d+(?:,\d+)?)\s*(?:kg|gr|g|grama|gramas)\b',
        name,
        re.IGNORECASE
    )
    if weight_match:
        weight_num = weight_match.group(1)
        weight_unit_match = re.search(r'(kg|gr|g|grama|gramas)', weight_match.group(0), re.IGNORECASE)
        weight_unit = weight_unit_match.group(1).lower() if weight_unit_match else 'g'

        # Normalize unit
        if weight_unit in ('grama', 'gramas'):
            weight_unit = 'gr'
        elif weight_unit == 'g':
            weight_unit = 'gr'
        elif weight_unit == 'kg':
            weight_unit = 'kg'
        else:
            weight_unit = 'gr'

        weight = f"{weight_num}{weight_unit}"

        # Remove weight from name
        name = name[:weight_match.start()] + name[weight_match.end():]

    # Clean up the remaining name
    # Remove notes in parentheses like "(foto de lado)", "(1)", "(atras)"
    name = re.sub(r'\((?:foto\s+(?:de\s+)?(?:lado|dentro|frente)|\d+|atras)\)', '', name, flags=re.IGNORECASE)

    # Remove trailing notes: "cada", "und", "o par", "cada lado", "o conjunto", "a unidade", "CADA", "PESO"
    name = re.sub(r'\s+(?:cada\s*(?:lado)?|und|o\s+par|o\s+conjunto|a\s+unidade|PESO)\s*$', '', name, flags=re.IGNORECASE)
    name = re.sub(r'\s+(?:cada\s*(?:lado)?|und|o\s+par|o\s+conjunto|a\s+unidade|PESO)\s*$', '', name, flags=re.IGNORECASE)

    # Remove "FOTO LADO" and similar notes
    name = re.sub(r'\s*foto\s+(?:de\s+)?(?:lado|dentro|frente)\s*', ' ', name, flags=re.IGNORECASE)

    # Remove stray punctuation: leading/trailing dots, commas, hyphens, dashes
    name = re.sub(r'[\s.,$]+$', '', name)
    name = re.sub(r'^[\s.,$]+', '', name)

    # Collapse multiple spaces
    name = re.sub(r'\s{2,}', ' ', name).strip()

    # Title case the name (capitalize first letter)
    if name:
        name = name[0].upper() + name[1:]

    return name, price, weight


def process_model(model_id, model_info):
    """Process all images in a model folder and return list of parts."""
    folder = model_info["folder"]
    parts = {}  # name_lower -> part dict (dedup by name)

    if not os.path.isdir(folder):
        print(f"  WARNING: Folder not found: {folder}")
        return []

    files = sorted(os.listdir(folder))

    for filename in files:
        # Skip non-image files
        if filename.lower() == 'desktop.ini':
            continue
        if not re.search(r'\.(jpeg|jpg|png)[,.]?$', filename, re.IGNORECASE):
            continue

        part_name, price, weight = parse_filename(filename)

        if not part_name:
            print(f"  WARNING: Could not parse name from: {filename}")
            continue

        # Dedup: keep first occurrence
        name_key = part_name.lower()
        if name_key in parts:
            continue

        # Price fallback from table
        if price is None:
            price = lookup_price(part_name)

        parts[name_key] = {
            "nome": part_name,
            "preco": price,
            "peso": weight,
            "img": f"img/{model_id}/{filename}"
        }

    # Sort alphabetically by name
    sorted_parts = sorted(parts.values(), key=lambda p: p["nome"].lower())
    return sorted_parts


def generate_data_js(catalogo):
    """Generate the data.js file content."""
    lines = []
    lines.append("const CATALOGO_MODELOS = {")

    model_ids = list(catalogo.keys())
    for i, model_id in enumerate(model_ids):
        model = catalogo[model_id]
        lines.append(f'  "{model_id}": {{')
        lines.append(f'    "nome": "{model["nome"]}",')
        lines.append(f'    "pecas": [')

        for j, peca in enumerate(model["pecas"]):
            preco_str = f"{peca['preco']:.2f}" if peca['preco'] is not None else "null"
            peso_str = f'"{peca["peso"]}"' if peca['peso'] is not None else "null"
            img_str = peca['img'].replace('\\', '/')

            comma = "," if j < len(model["pecas"]) - 1 else ""
            lines.append(
                f'      {{ "nome": "{peca["nome"]}", "preco": {preco_str}, "peso": {peso_str}, "img": "{img_str}" }}{comma}'
            )

        lines.append(f'    ]')
        comma = "," if i < len(model_ids) - 1 else ""
        lines.append(f'  }}{comma}')

    lines.append("};")
    return "\n".join(lines) + "\n"


def main():
    print("=" * 60)
    print("NXT Parts Data Extractor")
    print("=" * 60)

    catalogo = {}
    total_parts = 0
    no_price_count = 0
    no_weight_count = 0

    for model_id, model_info in MODELS.items():
        print(f"\nProcessing: {model_info['nome']} ({model_id})")
        print(f"  Folder: {model_info['folder']}")

        parts = process_model(model_id, model_info)

        catalogo[model_id] = {
            "nome": model_info["nome"],
            "pecas": parts
        }

        model_no_price = sum(1 for p in parts if p['preco'] is None)
        model_no_weight = sum(1 for p in parts if p['peso'] is None)

        print(f"  Parts found: {len(parts)}")
        print(f"  Without price: {model_no_price}")
        print(f"  Without weight: {model_no_weight}")

        total_parts += len(parts)
        no_price_count += model_no_price
        no_weight_count += model_no_weight

    # Generate output
    content = generate_data_js(catalogo)

    # Ensure output directory exists
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write(content)

    print(f"\n{'=' * 60}")
    print(f"SUMMARY")
    print(f"{'=' * 60}")
    print(f"Output: {OUTPUT_FILE}")
    print(f"Total parts: {total_parts}")
    print(f"Parts without price: {no_price_count}")
    print(f"Parts without weight: {no_weight_count}")
    print(f"\nPer model:")
    for model_id, model_data in catalogo.items():
        print(f"  {model_data['nome']:12s}: {len(model_data['pecas']):3d} parts")

    # List parts without price for review
    print(f"\n{'=' * 60}")
    print("PARTS WITHOUT PRICE:")
    print(f"{'=' * 60}")
    for model_id, model_data in catalogo.items():
        for p in model_data["pecas"]:
            if p["preco"] is None:
                print(f"  [{model_data['nome']}] {p['nome']}")


if __name__ == "__main__":
    main()
