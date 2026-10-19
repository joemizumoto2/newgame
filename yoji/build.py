"""熟語データを作り、index.html の DATA・DICT・CHARS の行を書き換える。

使い方: python3 build.py <unihan.db> <jamdict.db>

- unihan.db … npm パッケージ cjk-unihan の data/unihan.db。画数は日本の字形
  （kRSAdobe_Japan1_6）、部首は康熙部首（kRSUnicode）を使う
- jamdict.db … PyPI パッケージ jamdict-data の jamdict.db（JMdict）。
  「yojijukugo」の印が付いた漢字4字の語を、一枚勝負で入力できる辞書にする

出力
- DATA  … idioms.tsv の手札用の熟語（読み・型・意味つき）
- DICT  … 入力で使える熟語と読み。"*" 付きは CPU が選ぶ候補（よく使われる語）
- CHARS … 字ごとの [画数, 部首番号]
"""
import json, re, sqlite3, sys
from pathlib import Path

HERE = Path(__file__).parent
HAN4 = re.compile(r"^[一-鿿々]{4}$")

def char_table(unihan, chars):
    table = {}
    for ch in sorted(chars):
        if ch == "々":
            continue
        row = unihan.execute(
            "select kRSAdobe_Japan1_6, kTotalStrokes, SUnicode from unihan where character=?", (ch,)).fetchone()
        if not row:
            continue
        adobe, tot, rsu = row
        if adobe:
            _, rad_strokes, rest = adobe.split()[0].split("+")[2].split(".")
            strokes = int(rad_strokes) + int(rest)
        else:
            strokes = int(tot.split()[0])
        table[ch] = [strokes, int(rsu.split()[0].split(".")[0].rstrip("'"))]
    return table

def dictionary(jmdict):
    ids = [r[0] for r in jmdict.execute(
        "select distinct s.idseq from Sense s join misc m on m.sid = s.ID where m.text = 'yojijukugo'")]
    words = {}
    for idseq in ids:
        kana = [t for (t,) in jmdict.execute("select text from Kana where idseq = ? order by ID", (idseq,))]
        if not kana:
            continue
        for kid, w in jmdict.execute("select ID, text from Kanji where idseq = ? order by ID", (idseq,)):
            if HAN4.match(w) and w not in words:
                common = jmdict.execute("select count(*) from KJP where kid = ?", (kid,)).fetchone()[0] > 0
                words[w] = (kana[0], common)
    return words

def main(unihan_db, jmdict_db):
    curated = []
    for line in (HERE / "idioms.tsv").read_text(encoding="utf-8").splitlines():
        w, y, t, m = line.split("\t")
        curated.append(dict(w=w, y=y, t=t, m=m))
    words = dictionary(sqlite3.connect(jmdict_db))
    for c in curated:  # 手札の熟語は、辞書になくても入力できるようにする
        words[c["w"]] = (c["y"], True)
    chars = set("".join(words))
    table = char_table(sqlite3.connect(unihan_db), chars)
    usable = {w: v for w, v in words.items() if all(ch in table or ch == "々" for ch in w)}
    dict_str = "|".join(("*" if common else "") + f"{w} {y}" for w, (y, common) in sorted(usable.items()))

    page = HERE / "index.html"
    html = page.read_text(encoding="utf-8")
    for name, value in [("DATA", curated), ("DICT", dict_str), ("CHARS", table)]:
        js = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
        html, n = re.subn(rf"^const {name} = .*;$", lambda _: f"const {name} = {js};", html, count=1, flags=re.M)
        assert n == 1, name
    page.write_text(html, encoding="utf-8")
    print(f"手札 {len(curated)} 語、辞書 {len(usable)} 語、字 {len(table)} 字を書き込みました")

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
