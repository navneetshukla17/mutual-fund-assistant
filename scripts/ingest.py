import pandas as pd
import fitz # PyMuPDF
import os
import time
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
    if not os.path.exists("sources.csv"):
        print("No sources.csv found")
        return
        
    df = pd.read_csv("sources.csv")
    store = VectorStore()
    
    # Optional: Clear existing collection if you want a fresh start
    # store.client.delete_collection("mf_documents")
    # store.collection = store.client.get_or_create_collection(name="mf_documents")

    for idx, row in df.iterrows():
        doc_id = row['id']
        url = row['url']
        scheme = row.get('scheme', 'general')
        doc_date = row.get('doc_date', 'Unknown Date')
        
        ext = "pdf" if ".pdf" in str(url).lower() else "html"
        filename = f"data/raw/{doc_id}_doc.{ext}"
        
        if not os.path.exists(filename):
            print(f"File {filename} not found locally. Skipping.")
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
            
            # Check if this document is already largely embedded to skip re-doing it
            # We just check the first chunk id
            existing = store.collection.get(ids=[ids[0]])
            if existing and existing['ids'] and len(existing['ids']) > 0:
                print(f"Document {doc_id} already seems to be embedded (found chunk 0). Skipping.")
                continue

            print(f"Adding {len(chunks)} chunks for {doc_id} to vector store...")
            
            # Reduce batch size and add sleep to avoid rate limits
            batch_size = 20
            for i in range(0, len(chunks), batch_size):
                batch_chunks = chunks[i:i+batch_size]
                batch_metadatas = metadatas[i:i+batch_size]
                batch_ids = ids[i:i+batch_size]
                
                try:
                    store.add_chunks(batch_chunks, batch_metadatas, batch_ids)
                    time.sleep(1) # Sleep to avoid rate limits
                except Exception as batch_e:
                    print(f"  Failed on batch {i} for {doc_id}. Waiting 10s and retrying... Error: {batch_e}")
                    time.sleep(10)
                    store.add_chunks(batch_chunks, batch_metadatas, batch_ids)
                    
        except Exception as e:
            print(f"Failed to process {filename}: {e}")

if __name__ == "__main__":
    process_sources()
