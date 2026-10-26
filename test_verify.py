from src.guardrails import verify_response
ans = """If redeemed or switched-out within 3 months from the date of allotment, the exit load is NIL for 10% of investments and 1% for the remaining investments. If redeemed or switched-out after 3 months from the date of allotment, the exit load is NIL.

https://www.axismf.com/1/5/1423/1484/1487/2872/4655/Axis_Fund_Factsheet_September_2026_ab18df095e.pdf
Last updated from sources: Sep 2026"""
print(verify_response(ans))
import re
sentences = re.split(r'[.!?]+', ans.strip())
sentences = [s for s in sentences if s.strip()]
print(sentences)
print(len(sentences))
