from src.agent import handle_query, generate_response, SYSTEM_PROMPT
from src.vector_store import VectorStore
store = VectorStore()
query = "What is the exit load of Axis Flexi Cap Fund?"
results = store.search(query, top_k=4)
best_source = results[0]
prompt = f"Context:\n{best_source['text']}\n\nQuestion: {query}\nSource URL to cite: {best_source['metadata']['url']}\nDocument Date: {best_source['metadata']['doc_date']}"
print("Prompt:")
print(prompt)
print("---")
res = generate_response(prompt, system_instruction=SYSTEM_PROMPT)
print("Response:", res)
