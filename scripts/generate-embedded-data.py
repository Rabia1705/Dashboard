import base64

files = {
    2026: "data/ISO 27001 Maturity Assessments 2026.xlsx",
    2027: "data/ISO 27001 Maturity Assessments 2027.xlsx",
}

lines = ["window.EMBEDDED_WORKBOOKS = {"]
for year, path in files.items():
    with open(path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("ascii")
    lines.append(f'  "{year}": "{b64}",')
lines.append("};")

with open("docs/embedded-data.js", "w", encoding="utf-8") as out:
    out.write("\n".join(lines) + "\n")

print("done")
