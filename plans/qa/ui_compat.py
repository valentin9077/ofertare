"""Compatibilitate: oferte făcute cu versiunea publicată acum se deschid în versiunea nouă cu aceleași sume."""
import asyncio, sys, json
from playwright.async_api import async_playwright
import harness
from harness import new_page, make_offer_from_list, lei
LISTS = ["/home/claude/ofertare/exemple/Cantitati Sanitare UTCB - Cantina.xlsx", "/home/claude/ofertare/exemple/Cantitati Termice Cantina.xlsx", "/home/claude/ofertare/exemple/Instalatii Sani+Term+Hidr Cez.xlsx", "/home/claude/ofertare/exemple/Oferta Greenfield - KI.xlsx"]
OLD = "http://127.0.0.1:8766/scv/ofertare/"; NEW = "http://127.0.0.1:8765/scv/ofertare/"
async def main():
    ok=0; bad=[]
    def chk(n,c,info=""):
        nonlocal ok
        if c: ok+=1
        else: bad.append(n+(" → "+str(info) if info else ""))
    async with async_playwright() as p:
        harness.URL = OLD
        b, pg = await new_page(p)
        sums = {}
        for L in LISTS:
            await make_offer_from_list(pg, L, L.split("/")[-1][:30])
            # o poziție cu preț pus de mână și un adaos de 7%, ca să testăm și astea
            await pg.click("[data-a=menu]"); await pg.get_by_text("Rotunjire și adaos").first.click(); await pg.fill("#oAd", "7"); await pg.click("#ovl [data-a=optsok]"); await pg.wait_for_timeout(500)
            sums[L] = (await pg.inner_text("#tSub")).strip()
            await pg.click("[data-a=back]"); await pg.wait_for_timeout(500)
        await pg.wait_for_timeout(2500)
        db = await pg.evaluate("localStorage.getItem('mock-db')")
        await b.close()
        print("sume vechi:", sums)
        harness.URL = NEW
        b, pg = await new_page(p, seed=json.loads(db))
        await pg.goto(NEW); await pg.wait_for_selector("#bNew", timeout=15000); await pg.wait_for_timeout(1500)
        for L in LISTS:
            nm = L.split("/")[-1][:30]
            await pg.get_by_text(nm).first.click(); await pg.wait_for_timeout(1500)
            s2 = (await pg.inner_text("#tSub")).strip()
            chk("aceeași sumă: " + nm, s2 == sums[L], (sums[L], s2))
            await pg.click("[data-a=back]"); await pg.wait_for_timeout(500)
        errs=[l for l in pg.logs if "PAGEERROR" in l]; chk("fără erori", not errs, errs[:3])
        await b.close()
    print(f"Compatibilitate: {ok} trecute, {len(bad)} picate"); [print("  ✗", x) for x in bad]; sys.exit(1 if bad else 0)
asyncio.run(main())
