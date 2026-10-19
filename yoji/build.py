"""idioms.tsv から画数・部首・数字・読みを計算し、index.html の DATA 行を書き換える。

使い方: python3 build.py <unihan.db>
unihan.db は npm パッケージ cjk-unihan の data/unihan.db。画数は日本の字形
（kRSAdobe_Japan1_6）、部首は康熙部首（kRSUnicode）を使う。
"""
import collections, json, re, sqlite3, sys
from pathlib import Path

HERE = Path(__file__).parent
NUM = dict(zip("一二三四五六七八九十百千万", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 100, 1000, 10000]))
SMALL = set("ゃゅょぁぃぅぇぉ")

def main(db):
    c = sqlite3.connect(db)
    out = []
    for line in (HERE / "idioms.tsv").read_text(encoding="utf-8").splitlines():
        w, yomi, t, mean = line.split("\t")
        strokes, rads = [], []
        for ch in w:
            adobe, tot, rsu = c.execute(
                "select kRSAdobe_Japan1_6, kTotalStrokes, SUnicode from unihan where character=?", (ch,)).fetchone()
            if adobe:
                _, rad_strokes, rest = adobe.split()[0].split("+")[2].split(".")
                strokes.append(int(rad_strokes) + int(rest))
            else:
                strokes.append(int(tot.split()[0]))
            rads.append(int(rsu.split()[0].split(".")[0].rstrip("'")))
        rad, rn = collections.Counter(rads).most_common(1)[0]
        out.append(dict(w=w, y=yomi, t=t, m=mean, s=strokes, rad=rad if rn >= 2 else 0, rn=rn,
                        num=sum(NUM.get(ch, 0) for ch in w), mora=sum(k not in SMALL for k in yomi)))
    page = HERE / "index.html"
    data = json.dumps(out, ensure_ascii=False, separators=(",", ":"))
    html = re.sub(r"^const DATA = .*;$", lambda _: f"const DATA = {data};", page.read_text(encoding="utf-8"), count=1, flags=re.M)
    page.write_text(html, encoding="utf-8")
    print(f"{len(out)} 語を書き込みました")

if __name__ == "__main__":
    main(sys.argv[1])
