import pandas as pd
import os
from bs4 import BeautifulSoup
from src.vector_store import VectorStore

def process():
    store = VectorStore()
    doc_id = "21"
    url = "https://www.mutualfundssahihai.com/en/how-get-capital-gain-statement-mutual-funds"
    filename = f"data/raw/{doc_id}_doc.html"
    
    with open(filename, 'r', encoding='utf-8') as f:
        soup = BeautifulSoup(f.read(), 'html.parser')
        text = soup.get_text(separator=' ', strip=True)
    
    chunks = [text[i:i+800] for i in range(0, len(text), 700)]
    metadatas = [{"url": url, "scheme": "general", "doc_date": "Unknown Date", "id": doc_id} for _ in chunks]
    ids = [f"{doc_id}_{i}" for i in range(len(chunks))]
    
    print(f"Adding {len(chunks)} chunks...")
    store.add_chunks(chunks, metadatas, ids)

if __name__ == "__main__":
    process()
