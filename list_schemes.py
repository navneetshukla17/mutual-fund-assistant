from src.vector_store import VectorStore
store = VectorStore()
res = store.collection.get()
schemes = set(m.get('scheme') for m in res['metadatas'])
print("Schemes in DB:", schemes)
