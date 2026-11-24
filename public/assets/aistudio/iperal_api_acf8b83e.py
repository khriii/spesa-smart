"""
Wrapper minimale per le API non ufficiali di iperalspesaonline.it.

Uso privato/personale. I cookie di sessione NON vanno mai scritti qui dentro
o committati: si leggono da variabili d'ambiente (vedi .env.example).
"""

import os
from typing import List, Optional

import requests
from dotenv import load_dotenv

load_dotenv()

BASE_URL = "https://www.iperalspesaonline.it"

DEFAULT_HEADERS = {
    "accept": "application/json",
    "x-ebsn-client": "site",
    "x-ebsn-client-redirect": "site",
    "x-ebsn-version": "5.12.1",
    "referer": f"{BASE_URL}/",
    "user-agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36"
    ),
}


def update_session_cookies(session: requests.Session, jsessionid: str, ebsn_account: str) -> None:
    """Aggiorna i cookie di una sessione già esistente (senza doverne creare una nuova)."""
    session.cookies.set("JSESSIONID", jsessionid, domain="iperalspesaonline.it")
    session.cookies.set("X-Ebsn-Account", ebsn_account, domain="iperalspesaonline.it")


def get_session(jsessionid: Optional[str] = None, ebsn_account: Optional[str] = None) -> requests.Session:
    """Crea una sessione autenticata.

    Se jsessionid/ebsn_account non sono passati esplicitamente, li legge da
    variabili d'ambiente (utile come default/fallback all'avvio del server).
    """
    session = requests.Session()

    jsessionid = jsessionid or os.environ.get("IPERAL_JSESSIONID")
    ebsn_account = ebsn_account or os.environ.get("IPERAL_EBSN_ACCOUNT")

    if not jsessionid or not ebsn_account:
        raise RuntimeError(
            "Cookie mancanti: passali esplicitamente oppure crea un file .env "
            "(parti da .env.example) con IPERAL_JSESSIONID e IPERAL_EBSN_ACCOUNT."
        )

    update_session_cookies(session, jsessionid, ebsn_account)
    session.headers.update(DEFAULT_HEADERS)
    return session


def fetch_category_products(
    session: requests.Session,
    category_id: int,
    sort: str = "pri_um_asc",
    page_size: int = 100,
    max_pages: int = 100,
) -> List[dict]:
    """Scarica TUTTI i prodotti di una (sotto)categoria.

    L'API di Iperal è paginata (il server ignora spesso il page_size
    richiesto e restituisce una pagina di 24 elementi per volta, con
    totPages/totItems nei metadati). Per non "tagliare" i prodotti delle
    categorie grandi (es. "Merendine"), qui scorriamo tutte le pagine e
    uniamo i risultati rimuovendo i duplicati per productId.

    sort="pri_um_asc" ordina per prezzo al kg/litro crescente (quello che
    usa il sito quando ordini per convenienza).
    """
    all_products: List[dict] = []
    seen_ids: set = set()
    page = 1
    total_pages = 1

    while page <= total_pages and page <= max_pages:
        response = session.get(
            f"{BASE_URL}/ebsn/api/products",
            params={
                "parent_category_id": category_id,
                "page": page,
                "page_size": page_size,
                "sort": sort,
                "promo": "false",
                "hash": "x",  # cache-buster, valore arbitrario: non serve calcolarlo
            },
            timeout=10,
        )
        response.raise_for_status()
        data = response.json()

        payload = data.get("data", {})
        page_info = payload.get("page", {}) or {}
        total_pages = int(page_info.get("totPages") or total_pages or 1)
        tot_items = int(page_info.get("totItems") or 0)

        batch = payload.get("products", []) or []
        if not batch:
            break

        for product in batch:
            pid = product.get("productId") or product.get("id")
            if pid is not None:
                if pid in seen_ids:
                    continue
                seen_ids.add(pid)
            all_products.append(product)

        # Se conosciamo il totale di articoli, interrompi quando li abbiamo tutti.
        if tot_items and len(all_products) >= tot_items:
            break

        page += 1
        # Evita ripetizioni in caso di metadati incoerenti.
        if page > total_pages:
            break

    return all_products


def _simplify_category(category: dict) -> dict:
    """Estrae solo i campi utili e scende ricorsivamente nelle sottocategorie."""
    children = category.get("categories") or []
    return {
        "categoryId": category["categoryId"],
        "name": category["name"],
        "children": [_simplify_category(c) for c in children],
    }


def fetch_categories(session: requests.Session) -> List[dict]:
    """Scarica l'albero completo delle categorie Iperal, ripulito e ricorsivo.

    A differenza di un ciclo while che consuma la lista con pop(), questa
    versione ricorsiva non muta i dati e gestisce alberi con più livelli
    senza rischio di loop o di perdere sottocategorie profonde.
    """
    response = session.get(f"{BASE_URL}/ebsn/api/category", timeout=10)
    response.raise_for_status()
    data = response.json()

    if data.get("response", {}).get("status") != 0:
        raise RuntimeError(f"Errore Iperal: {data['response'].get('errorsMessage')}")

    categories = data.get("data", {}).get("categories", [])
    return [_simplify_category(c) for c in categories]


def add_products_to_cart(session: requests.Session, items: List[dict]) -> dict:
    """Aggiunge una lista di prodotti al carrello Iperal.

    items: [{"productId": int, "quantity": int, "infos": {"accept_alternatives": False}}, ...]
    """
    response = session.post(
        f"{BASE_URL}/ebsn/api/cart/add",
        params={"show_sectors": "true"},
        json={"items": items},
        timeout=10,
    )
    response.raise_for_status()
    data = response.json()

    if data.get("response", {}).get("status") != 0:
        raise RuntimeError(f"Errore Iperal: {data['response'].get('errorsMessage')}")

    return data
