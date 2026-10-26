from google import genai
import os
from dotenv import load_dotenv

load_dotenv()
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

res = client.models.embed_content(
    model="gemini-embedding-2",
    contents=["Hello", "World"]
)
print("Type of res.embeddings:", type(res.embeddings))
print("Len of res.embeddings:", len(res.embeddings))
