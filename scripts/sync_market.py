#!/usr/bin/env python3
"""Baixa exclusivamente dados públicos reais do Cartola, sem gerar atletas fictícios."""
import datetime as dt
import json
import pathlib
import time
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1] / "public" / "data"
ORIGINS = ("https://api.cartola.globo.com", "https://api.cartolafc.globo.com")
ENDPOINTS = {"atletas": "/atletas/mercado", "status": "/mercado/status", "partidas": "/partidas"}
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; CartoleiroDedicacao/2.1; public-data-sync)", "Accept": "application/json"}

def retrieve(path):
    errors = []
    for base in ORIGINS:
        for attempt in range(2):
            try:
                req = urllib.request.Request(base + path, headers=HEADERS)
                with urllib.request.urlopen(req, timeout=22) as response:
                    if response.status != 200:
                        raise ValueError("Status HTTP " + str(response.status))
                    data = json.load(response)
                    if not isinstance(data, dict):
                        raise ValueError("Resposta nao e um objeto JSON")
                    return data, base
            except (OSError, ValueError, json.JSONDecodeError) as exc:
                errors.append(base + ": " + type(exc).__name__ + " " + str(exc)[:90])
                if attempt == 0:
                    time.sleep(1)
    raise RuntimeError("Todas as origens falharam para " + path + ": " + "; ".join(errors))

def main():
    values = {}
    sources = {}
    for key, path in ENDPOINTS.items():
        values[key], sources[key] = retrieve(path)
    athletes = values["atletas"].get("atletas")
    if not isinstance(athletes, list) or len(athletes) < 100:
        raise ValueError("Mercado incompleto: menos de 100 atletas reais")
    if not isinstance(values["atletas"].get("clubes"), dict):
        raise ValueError("Clubes ausentes do mercado")
    if not isinstance(values["status"].get("rodada_atual"), int):
        raise ValueError("Numero da rodada ausente")
    if not isinstance(values["partidas"].get("partidas"), list):
        raise ValueError("Lista de partidas invalida")
    ROOT.mkdir(parents=True, exist_ok=True)
    now = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    for key, value in values.items():
        (ROOT / (key + ".json")).write_text(
            json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8"
        )
    meta = {
        "fetched_at": now,
        "round": values["status"]["rodada_atual"],
        "season": values["status"].get("temporada"),
        "market_open": values["status"].get("status_mercado") == 1,
        "athletes": len(athletes),
        "sources": sources
    }
    (ROOT / "meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8"
    )
    print("Atualizacao oficial bem-sucedida:", json.dumps(meta, ensure_ascii=False))

if __name__ == "__main__":
    main()
