import chromadb
from src.config import config
client = chromadb.PersistentClient(path=config.CHROMA_PERSIST_DIR)
col = client.get_or_create_collection("mf_documents")
print(f"Total documents in ChromaDB: {col.count()}")
