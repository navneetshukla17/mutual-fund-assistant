from src.vector_store import VectorStore
store = VectorStore()
res = store.search("What is the exit load of Axis Flexi Cap Fund?", top_k=2)
print(res)
