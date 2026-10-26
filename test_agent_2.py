from src.agent import handle_query
from src.vector_store import VectorStore

store = VectorStore()
print("Querying: What is the exit load of Axis Flexi Cap Fund?")
print(handle_query("What is the exit load of Axis Flexi Cap Fund?", store))
