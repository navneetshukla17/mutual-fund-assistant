import pandas as pd
import fitz # PyMuPDF
import os
from bs4 import BeautifulSoup
from src.vector_store import VectorStore

def chunk_text(text: str, chunk_size: int = 800, overlap: int = 100):
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        start += chunk_size - overlap
    return chunks

def process_sources():
    df = pd.read_csv("sources.csv")
    store = VectorStore()
    
    # process only the last few documents which didn't finish
    for idx, row in df.iterrows():
        doc_id = row['id']
        if int(doc_id) < 12: continue
        url = row['url']
        scheme = row.get('scheme', 'general')
        doc_date = row.get('doc_date', 'Unknown Date')
        
        ext = "pdf" if ".pdf" in str(url).lower() else "html"
        filename = f"data/raw/{doc_id}_doc.{ext}"
        
        if not os.path.exists(filename):
            continue
            
        text = ""
        try:
            if ext == "pdf":
                doc = fitz.open(filename)
                for page in doc:
                    text += page.get_text()
            else:
                with open(filename, 'r', encoding='utf-8') as f:
                    soup = BeautifulSoup(f.read(), 'html.parser')
                    text = soup.get_text(separator=' ', strip=True)
                    
            chunks = chunk_text(text)
            metadatas = [{"url": url, "scheme": scheme, "doc_date": doc_date, "id": str(doc_id)} for _ in chunks]
            ids = [f"{doc_id}_{i}" for i in range(len(chunks))]
            
            print(f"Adding {len(chunks)} chunks for {doc_id} to vector store...")
            store.add_chunks(chunks, metadatas, ids)
        except Exception as e:
            print(f"Failed to process {filename}: {e}")

if __name__ == "__main__":
    process_sources()
