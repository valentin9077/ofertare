"""T10: prețuri de material – în „Prețurile mele” și în fișa „De ce acest preț?” la țevi."""
import asyncio, sys
from playwright.async_api import async_playwright
from harness import new_page, make_offer_from_list, URL
async def main():
    ok=0; bad=[]
    def chk(n,c,info=""):
        nonlocal ok
        if c: ok+=1
        else: bad.append(n+(" → "+str(info) if info else ""))
    async with async_playwright() as p:
        b, pg = await new_page(p)
        await pg.goto(URL); await pg.wait_for_selector("#bNew", timeout=15000)
        await pg.click("#nav [data-v=prices]"); await pg.wait_for_timeout(1500)
        chips = await pg.locator(".fl button").all_inner_texts(); print(chips)
        chk("filtrul Materiale există", any(c.startswith("Materiale") for c in chips), chips)
        await pg.locator(".fl button", has_text="Materiale").click(); await pg.wait_for_timeout(600)
        rows = await pg.locator("#prl [data-a=pmat]").count(); chk("50 de materiale", rows >= 40, rows)
        await pg.screenshot(path="u5_materiale.png")
        await pg.locator("#prl [data-a=pmat]").first.click(); await pg.wait_for_timeout(400)
        w = await pg.inner_text("#ovl"); chk("fișa materialului are preț fără TVA", "Fără TVA" in w, w[:200])
        await pg.locator("#ovl h3 [data-a=x]").first.click()
        # fișa „De ce” la o țeavă PPR dintr-o listă
        await make_offer_from_list(pg, "/home/claude/ofertare/exemple/Cantitati Sanitare UTCB - Cantina.xlsx", "mat")
        await pg.locator("button.tr[data-a=cap]").first.click(); await pg.wait_for_timeout(800)
        await pg.fill("#pq", "PP-R"); await pg.wait_for_timeout(600)
        found = False
        for i in range(min(8, await pg.locator(".pos .mk").count())):
            await pg.locator(".pos .mk").nth(i).click(); await pg.wait_for_timeout(400)
            w = await pg.inner_text("#ovl")
            if "material, orientativ" in w.lower(): found = True; await pg.screenshot(path="u6_de_ce_material.png"); print(w[:900]); break
            await pg.locator("#ovl h3 [data-a=x]").first.click(); await pg.wait_for_timeout(200)
        chk("fișa De ce arată materialul la țeavă PPR", found)
        errs=[l for l in pg.logs if "PAGEERROR" in l]; chk("fără erori", not errs, errs[:3])
        await b.close()
    print(f"UI materiale: {ok} trecute, {len(bad)} picate"); [print("  ✗", x) for x in bad]; sys.exit(1 if bad else 0)
asyncio.run(main())
