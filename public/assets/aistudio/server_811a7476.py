"""
Backend Flask: fa da ponte tra il frontend React e le API di Iperal.

React non chiama mai Iperal direttamente (bloccato da CORS + cookie di
sessione legati al dominio Iperal): chiama questo server, che a sua volta
usa la sessione autenticata per parlare con Iperal.

Avvio:
    pip install flask flask-cors
    python server.py
Di default gira su http://localhost:5000
"""

import re

from flask import Flask, jsonify, request
from flask_cors import CORS

from iperal_api import (
    add_products_to_cart,
    fetch_categories,
    fetch_category_products,
    get_session,
)

app = Flask(__name__)

CORS(app, origins=[
    "http://localhost:3000",
    "http://localhost:5173",
    "http://192.168.1.193:3000",
    re.compile(r"^chrome-extension://.*$"),  # accetta qualsiasi estensione Chrome
])

# La sessione parte "vuota": se hai un .env valido la crea subito,
# altrimenti resta None finché non arriva un POST /api/session da React.
try:
    current_session = get_session()
except RuntimeError:
    current_session = None


def _require_session():
    """Ritorna (session, None) se autenticati, altrimenti (None, response_errore)."""
    if current_session is None:
        return None, (jsonify({"error": "Nessuna sessione attiva. Chiama POST /api/session prima."}), 401)
    return current_session, None


@app.route("/api/session", methods=["POST"])
def post_session():
    """
    Imposta o aggiorna i cookie di sessione da React.

    Body atteso (JSON):
    { "jsessionid": "...", "ebsnAccount": "..." }
    """
    global current_session

    body = request.get_json(silent=True) or {}
    jsessionid = body.get("jsessionid")
    ebsn_account = body.get("ebsnAccount")

    if not jsessionid or not ebsn_account:
        return jsonify({"error": "jsessionid e ebsnAccount sono entrambi obbligatori"}), 400

    try:
        current_session = get_session(jsessionid=jsessionid, ebsn_account=ebsn_account)
        return jsonify({"status": "ok"})
    except Exception as e:
        return jsonify({"error": str(e)}), 502


@app.route("/api/categories", methods=["GET"])
def get_categories():
    session, error = _require_session()
    if error:
        return error
    try:
        categories = fetch_categories(session)
        return jsonify(categories)
    except Exception as e:
        return jsonify({"error": str(e)}), 502


@app.route("/api/products", methods=["GET"])
def get_products():
    """Esempio: GET /api/products?category_id=22467&sort=pri_um_asc"""
    session, error = _require_session()
    if error:
        return error

    category_id = request.args.get("category_id", type=int)
    sort = request.args.get("sort", default="pri_um_asc")

    if not category_id:
        return jsonify({"error": "category_id mancante"}), 400

    try:
        products = fetch_category_products(session, category_id, sort=sort)
        return jsonify(products)
    except Exception as e:
        return jsonify({"error": str(e)}), 502


@app.route("/api/cart", methods=["POST"])
def post_cart():
    """
    Body atteso (JSON):
    {
      "items": [
        {"productId": 10169458, "quantity": 2}
      ]
    }
    """
    session, error = _require_session()
    if error:
        return error

    body = request.get_json(silent=True) or {}
    raw_items = body.get("items", [])

    if not raw_items:
        return jsonify({"error": "items mancante o vuoto"}), 400

    items = [
        {
            "productId": item["productId"],
            "quantity": item["quantity"],
            "infos": {"accept_alternatives": False},
        }
        for item in raw_items
    ]

    try:
        result = add_products_to_cart(session, items)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 502


if __name__ == "__main__":
    # host="0.0.0.0" necessario per essere raggiungibile da fuori il container Docker
    app.run(debug=True, host="0.0.0.0", port=5000)
