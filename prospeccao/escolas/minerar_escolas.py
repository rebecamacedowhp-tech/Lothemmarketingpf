#!/usr/bin/env python3
"""
Minerador de escolas com boa reputacao e SEM site.

Usa a Google Places API (New) para varrer regioes, e devolve apenas as escolas
que atendem ao ICP da campanha: nota alta, volume de avaliacoes relevante e
nenhum site cadastrado no perfil do Google.

A ausencia de site e o sinal de compra: a escola ja tem reputacao, mas nao
tem para onde mandar o pai que pesquisou. E o funil vazando no ultimo passo.

Uso:
    export GOOGLE_MAPS_API_KEY="sua-chave"
    python3 minerar_escolas.py --regioes regioes.txt --saida leads.csv
    python3 minerar_escolas.py --regioes "Campinas SP" "Sorocaba SP" --nota-min 4.5

A chave precisa da "Places API (New)" habilitada no Google Cloud.
"""

import argparse
import csv
import json
import math
import os
import sys
import time
import urllib.error
import urllib.request

ENDPOINT = "https://places.googleapis.com/v1/places:searchText"

CAMPOS = ",".join(
    "places." + c
    for c in (
        "id",
        "displayName",
        "formattedAddress",
        "rating",
        "userRatingCount",
        "websiteUri",
        "nationalPhoneNumber",
        "googleMapsUri",
        "businessStatus",
        "primaryTypeDisplayName",
    )
)

# Termos que cobrem os varios nomes que uma escola usa no Google.
TERMOS_PADRAO = [
    "escola particular",
    "colegio particular",
    "escola infantil",
    "creche",
    "berçario",
    "escola bilingue",
    "curso de idiomas",
]


def buscar(termo, regiao, chave, max_paginas=3):
    """Uma busca textual, paginada. A API devolve no maximo 20 por pagina e 3 paginas."""
    resultados = []
    token = None

    for pagina in range(max_paginas):
        corpo = {"textQuery": f"{termo} em {regiao}", "languageCode": "pt-BR", "pageSize": 20}
        if token:
            corpo["pageToken"] = token

        req = urllib.request.Request(
            ENDPOINT,
            data=json.dumps(corpo).encode(),
            headers={
                "Content-Type": "application/json",
                "X-Goog-Api-Key": chave,
                "X-Goog-FieldMask": CAMPOS + ",nextPageToken",
            },
        )

        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                dados = json.load(r)
        except urllib.error.HTTPError as e:
            detalhe = e.read().decode(errors="replace")[:300]
            print(f"  ! erro HTTP {e.code} em '{termo} / {regiao}': {detalhe}", file=sys.stderr)
            break
        except Exception as e:
            print(f"  ! falha em '{termo} / {regiao}': {e}", file=sys.stderr)
            break

        resultados.extend(dados.get("places", []))
        token = dados.get("nextPageToken")
        if not token:
            break
        time.sleep(2)  # o pageToken leva alguns instantes para ficar valido

    return resultados


def prioridade(nota, avaliacoes):
    """Reputacao ponderada pelo volume.

    Nota alta com 3 avaliacoes nao e reputacao, e acaso. O log evita que uma
    escola com 800 avaliacoes esmague todo o resto do ranking.
    """
    return round(nota * math.log10(avaliacoes + 1), 2)


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--regioes", nargs="+", required=True,
                   help="Cidades/bairros, ou o caminho de um arquivo .txt com uma por linha")
    p.add_argument("--termos", nargs="+", default=TERMOS_PADRAO)
    p.add_argument("--nota-min", type=float, default=4.3)
    p.add_argument("--avaliacoes-min", type=int, default=10)
    p.add_argument("--saida", default="leads-escolas.csv")
    p.add_argument("--incluir-com-site", action="store_true",
                   help="Mantem tambem quem ja tem site (util para dimensionar o mercado total)")
    args = p.parse_args()

    chave = os.environ.get("GOOGLE_MAPS_API_KEY")
    if not chave:
        sys.exit("Defina GOOGLE_MAPS_API_KEY (Places API New habilitada no Google Cloud).")

    regioes = args.regioes
    if len(regioes) == 1 and os.path.isfile(regioes[0]):
        with open(regioes[0], encoding="utf-8") as f:
            regioes = [l.strip() for l in f if l.strip() and not l.startswith("#")]

    vistos, leads = set(), []
    total_bruto = com_site = 0

    for regiao in regioes:
        print(f"\n== {regiao}")
        for termo in args.termos:
            achados = buscar(termo, regiao, chave)
            print(f"   {termo}: {len(achados)}")

            for lugar in achados:
                pid = lugar.get("id")
                if not pid or pid in vistos:
                    continue
                vistos.add(pid)
                total_bruto += 1

                if lugar.get("businessStatus") not in (None, "OPERATIONAL"):
                    continue

                tem_site = bool(lugar.get("websiteUri"))
                if tem_site:
                    com_site += 1
                    if not args.incluir_com_site:
                        continue

                nota = lugar.get("rating") or 0
                avaliacoes = lugar.get("userRatingCount") or 0
                if nota < args.nota_min or avaliacoes < args.avaliacoes_min:
                    continue

                leads.append({
                    "nome": lugar.get("displayName", {}).get("text", ""),
                    "nota": nota,
                    "avaliacoes": avaliacoes,
                    "prioridade": prioridade(nota, avaliacoes),
                    "telefone": lugar.get("nationalPhoneNumber", ""),
                    "endereco": lugar.get("formattedAddress", ""),
                    "tipo": lugar.get("primaryTypeDisplayName", {}).get("text", ""),
                    "site": lugar.get("websiteUri", ""),
                    "maps": lugar.get("googleMapsUri", ""),
                    "regiao": regiao,
                    "termo": termo,
                })

    leads.sort(key=lambda x: x["prioridade"], reverse=True)

    if leads:
        with open(args.saida, "w", newline="", encoding="utf-8-sig") as f:
            w = csv.DictWriter(f, fieldnames=list(leads[0].keys()))
            w.writeheader()
            w.writerows(leads)

    sem_telefone = sum(1 for l in leads if not l["telefone"])
    print(f"\n--- Resultado")
    print(f"Locais unicos varridos : {total_bruto}")
    print(f"Ja possuem site        : {com_site}")
    print(f"LEADS NO ICP           : {len(leads)}")
    print(f"  sem telefone         : {sem_telefone} (precisam de enriquecimento)")
    if total_bruto:
        print(f"Densidade do ICP       : {len(leads) / total_bruto:.1%} dos locais varridos")
    print(f"Arquivo                : {args.saida}")


if __name__ == "__main__":
    main()
