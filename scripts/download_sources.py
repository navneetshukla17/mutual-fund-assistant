import pandas as pd
import requests
import os

def download_sources():
    if not os.path.exists("sources.csv"):
        print("sources.csv not found")
        return
        
    df = pd.read_csv("sources.csv")
    
    for idx, row in df.iterrows():
        url = row['url']
        doc_id = row['id']
        if pd.isna(url): continue
        
        ext = "pdf" if ".pdf" in url.lower() else "html"
        filename = f"data/raw/{doc_id}_doc.{ext}"
        
        if os.path.exists(filename):
            print(f"File {filename} already exists. Skipping.")
            continue
            
        print(f"Downloading {url}...")
        try:
            headers = {'User-Agent': 'Mozilla/5.0'}
            response = requests.get(url, headers=headers, timeout=10)
            if response.status_code == 200:
                with open(filename, 'wb') as f:
                    f.write(response.content)
                print(f"Saved to {filename}")
            else:
                print(f"Failed to download {url}: Status {response.status_code}")
        except Exception as e:
            print(f"Error downloading {url}: {e}")

if __name__ == "__main__":
    download_sources()
