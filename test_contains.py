from src.vector_store import VectorStore
store = VectorStore()
res = store.collection.get(where={"scheme": {"$contains": "Flexi Cap"}})
print("Matches:", len(res['ids']))
