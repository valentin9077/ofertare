"""T8+T9: verificarea înainte de trimitere – lucrări uitate după tipul lucrării + sumă pe aparat."""
import asyncio, sys
from playwright.async_api import async_playwright
from harness import new_page, make_offer_from_list
LISTS = ["/home/claude/ofertare/exemple/Cantitati Sanitare UTCB - Cantina.xlsx", "/home/claude/ofertare/exemple/Cantitati Termice Cantina.xlsx", "/home/claude/ofertare/exemple/Instalatii Sani+Term+Hidr Cez.xlsx"]
async def main():
    ok=0; bad=[]
    def chk(n,c,info=""):
        nonlocal ok
        if c: ok+=1
        else: bad.append(n+(" → "+str(info) if info else ""))
    async with async_playwright() as p:
        b, pg = await new_page(p)
        for L in LISTS:
            await make_offer_from_list(pg, L, L.split("/")[-1][:30])
            await pg.click("#bChk"); await pg.wait_for_timeout(600)
            titles = await pg.locator("#ovl .chk b").all_inner_texts()
            print("==", L.split("/")[-1]); [print("   -", t) for t in titles]
            chk("verificarea se deschide: "+L[-25:], await pg.locator("#ovl h3").count() > 0)
            if "Cez" in L:
                io = await pg.evaluate("OFAPP.indOf()")
                chk("indicator sanitare pe capitol (59 obiecte)", io.get("obiecte",{}).get("n") == 59, io)
                chk("indicator hidranți pe capitol (14 cutii)", io.get("cuti",{}).get("n") == 14, io)
            # „Nu e în preț” pe prima lucrare uitată nouă, dacă există → se scrie la „nu include”
            nb = pg.locator("#ovl [data-a=chknu]")
            if await nb.count():
                before = len(titles); await nb.first.click(); await pg.wait_for_timeout(500)
                after = await pg.locator("#ovl .chk b").count(); chk("după „Nu e în preț” scade lista", after == before - 1, (before, after))
            await pg.locator("#ovl h3 [data-a=x]").first.click(); await pg.wait_for_timeout(300)
            await pg.click("[data-a=back]"); await pg.wait_for_timeout(600)
        errs=[l for l in pg.logs if "PAGEERROR" in l]; chk("fără erori", not errs, errs[:3])
        await b.close()
    print(f"UI verificare: {ok} trecute, {len(bad)} picate"); [print("  ✗", x) for x in bad]; sys.exit(1 if bad else 0)
asyncio.run(main())
