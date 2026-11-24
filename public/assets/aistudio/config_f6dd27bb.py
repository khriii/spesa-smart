"""
Struttura di categorie/sottocategorie che vuoi mostrare nell'app.

Per ogni sottocategoria:
- category_id: il parent_category_id da usare nella chiamata /ebsn/api/products
  (lo trovi guardando l'URL delle chiamate XHR quando navighi quella categoria
  sul sito, es. ?parent_category_id=22467)
- favorites: lista di productId che vuoi vedere SEMPRE per primi, in qualsiasi
  ordine tu preferisca (indipendentemente dal prezzo)

Se category_id è None, la sottocategoria viene mostrata con un avviso e
saltata, così puoi riempire il file gradualmente senza far crashare l'app.
"""

CATEGORIES = {
    "Frutta e verdura": {
        "Mele e pere": {
            "category_id": 22467,
            "favorites": [10169458, 10000534],  # Mele Gala Marlene
        },
        "Agrumi": {
            "category_id": 22514,  # <-- da compilare
            "favorites": [10059930],
        },
        "Banane": {
            "category_id": 22645,  # <-- da compilare
            "favorites": [9960300],
        },
    },
    "Gastronomia": {
        "Primi piatti pronti": {
            "category_id": 22561,
            "favorites": [10031882],  # Cannelloni di carne
        },
    },
}
