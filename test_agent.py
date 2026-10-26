from src.vector_store import VectorStore
from src.agent import handle_query

class MockVectorStore:
    def search(self, query, top_k=4, scheme_filter=None):
        return [{
            'distance': 0.5,
            'text': 'The exit load is 1% if redeemed within 1 year.',
            'metadata': {
                'url': 'https://example.com/axis-bluechip',
                'doc_date': '2023-01-01'
            }
        }]

store = MockVectorStore()
response = handle_query("What is the exit load for Axis Bluechip?", store)
print("RESPONSE:", response)
