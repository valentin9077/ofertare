"""Flux UI: ofertă nouă din listă (Excel exemplu) → poziții → semafor, piață, „De ce acest preț?”."""
import asyncio, sys, re
from playwright.async_api import async_playwright
from harness import new_page, URL
EX = "/home/claude/ofertare/exemple/Cantitati Sanitare UTCB - Cantina.xlsx"
async def click_text(pg, t, timeout=8000):
    await pg.get_by_text(t, exact=False).first.click(timeout=timeout)
async def main():
    ok=0; bad=[]
    def chk(n,c):
        nonlocal ok
        if c: ok+=1
        else: bad.append(n)
    async with async_playwright() as p:
        b, pg = await new_page(p)
        await pg.goto(URL); await pg.wait_for_selector("#bNew", timeout=15000)
        await pg.click("#bNew"); await click_text(pg, "Am listă de la proiectant")
        await pg.fill("#hLuc", "Test cantina UTCB"); await pg.fill("#hBen", "UTCB")
        async with pg.expect_file_chooser() as fc:
            await pg.click("[data-a=nmake]")
            await pg.wait_for_timeout(800)
            # dacă se deschide fișa de import, apasă pe butonul care alege fișierul
            for sel in ["[data-a=impf]", "[data-a=impFile]", "text=Alege fișierul", "text=Alege un fișier"]:
                if await pg.locator(sel).count():
                    await pg.locator(sel).first.click(); break
        f = await fc.value; await f.set_files(EX)
        # trece prin fișele de după import: apasă butoanele principale până ajunge la ofertă
        for i in range(8):
            await pg.wait_for_timeout(1200)
            prim = pg.locator("#ovl button.pri")
            if await prim.count() and await prim.first.is_visible():
                await prim.first.click()
            else: break
        await pg.wait_for_timeout(1500)
        await pg.screenshot(path="u1_oferta.png")
        txt = await pg.evaluate("document.body.innerText")
        chk("oferta are capitole", "poziț" in txt)
        # deschide primul capitol
        await pg.locator("button.tr[data-a=cap]").first.click(); await pg.wait_for_timeout(1200)
        await pg.screenshot(path="u2_pozitii.png", full_page=False)
        n_pos = await pg.locator(".pos").count(); chk("poziții afișate", n_pos > 0)
        n_sem = await pg.locator(".pos.s-ok,.pos.s-sig,.pos.s-est,.pos.s-no").count(); chk("semafor pe poziții", n_sem > 0)
        n_mk = await pg.locator(".pos .mk").count(); chk("linie de piață pe unele poziții", n_mk > 0)
        print("poziții:", n_pos, "cu semafor:", n_sem, "cu piață:", n_mk)
        chips = await pg.locator(".fl button").all_inner_texts(); print("filtre:", chips)
        if n_mk:
            await pg.locator(".pos .mk").first.click(); await pg.wait_for_timeout(600)
            w = await pg.evaluate("document.querySelector('#ovl').innerText")
            chk("fișa De ce acest preț", "De ce acest preț" in w and "piața" in w.lower())
            chk("fișa are surse cu link", await pg.locator("#ovl ul.wl a[href^='http']").count() > 0)
            await pg.screenshot(path="u3_de_ce.png")
            print(w[:700])
            await pg.locator("#ovl h3 [data-a=x]").first.click(); await pg.wait_for_timeout(300)
        if any(c.startswith("De lucrat") for c in chips):
            await pg.locator(".fl button", has_text="De lucrat").click(); await pg.wait_for_timeout(500)
            sts = await pg.evaluate("[...document.querySelectorAll('.pos')].map(e=>[...e.classList].find(c=>c.startsWith('s-')))")
            chk("De lucrat arată doar fără preț / de verificat", all(s in ("s-no","s-est") for s in sts) and len(sts)>0)
        errs=[l for l in pg.logs if "PAGEERROR" in l or l.startswith("error") and "Service Worker" not in l and "ERR_FAILED" not in l]
        chk("fără erori în pagină", not errs)
        if errs: print("\n".join(errs[:10]))
        await b.close()
    print(f"UI: {ok} trecute, {len(bad)} picate"); [print("  ✗", x) for x in bad]
    sys.exit(1 if bad else 0)
asyncio.run(main())
