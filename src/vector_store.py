import chromadb
from src.config import config
from src.llm import get_embedding, get_embeddings

class VectorStore:
    def __init__(self):
        self.client = chromadb.PersistentClient(path=config.CHROMA_PERSIST_DIR)
        self.collection = self.client.get_or_create_collection(name="mf_documents")

    def add_chunks(self, chunks: list[str], metadatas: list[dict], ids: list[str]):
        batch_size = 100
        for i in range(0, len(chunks), batch_size):
            batch_chunks = chunks[i:i+batch_size]
            batch_metadatas = metadatas[i:i+batch_size]
            batch_ids = ids[i:i+batch_size]
            
            embeddings = get_embeddings(batch_chunks)
            self.collection.upsert(
                documents=batch_chunks,
                embeddings=embeddings,
                metadatas=batch_metadatas,
                ids=batch_ids
            )

    def search(self, query: str, top_k: int = 5, scheme_filter: str = None) -> list[dict]:
        query_embedding = get_embedding(query)
        # We rely on semantic search rather than brittle metadata filtering, 
        # since metadata fields can be comma separated and $contains is finicky in this Chroma version.
        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
        )
        
        output = []
        if results['documents'] and len(results['documents']) > 0:
            for i in range(len(results['documents'][0])):
                output.append({
                    "text": results['documents'][0][i],
                    "metadata": results['metadatas'][0][i],
                    "distance": results['distances'][0][i]
                })
        return output
