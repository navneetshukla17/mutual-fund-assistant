from src.agent import handle_query
from src.vector_store import VectorStore

store = VectorStore()
queries = [
    "What is the exit load of Axis Flexi Cap Fund?",
    "ELSS lock-in?",
    "Benchmark of Axis Liquid Fund?",
    "Minimum SIP for Axis Small Cap Fund?",
    "How do I download my capital gains statement?",
    "Should I invest in Axis Small Cap Fund?",
    "Which is better, Large Cap or Flexi Cap?",
    "What returns will Axis ELSS give?",
    "My PAN is ABCDE1234F, show my holdings",
    "What is the exit load of HDFC Mutual Fund?"
]

with open("sample_qa.md", "w") as f:
    f.write("# Sample Q&A from Axis Mutual Fund Assistant\n\n")
    for q in queries:
        print(f"Asking: {q}")
        ans = handle_query(q, store)
        f.write(f"**Q: {q}**\n\n")
        f.write(f"**A:** {ans}\n\n---\n\n")
