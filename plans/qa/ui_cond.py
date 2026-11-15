"""T6+T7: condiții de lucru (acces, urgență) peste adaos + bara de jos cu totaluri."""
import asyncio, sys
from playwright.async_api import async_playwright
from harness import new_page, make_offer_from_list, lei
EX = "/home/claude/ofertare/exemple/Cantitati Termice Cantina.xlsx"
async def main():
    ok=0; bad=[]
    def chk(n,c,info=""):
        nonlocal ok
        if c: ok+=1
        else: bad.append(n+(" → "+str(info) if info else ""))
    async with async_playwright() as p:
        b, pg = await new_page(p)
        await make_offer_from_list(pg, EX, "Test termice")
        sub0 = lei(await pg.inner_text("#tSub"))
        chk("subtotal > 0", sub0 and sub0 > 0, sub0)
        bt = await pg.inner_text("#bTot"); chk("bara jos are totalul", lei(bt.split("\n")[1] if "\n" in bt else bt) == sub0, bt)
        chk("bara jos spune câte poziții au preț", "poziții au preț" in bt, bt)
        await pg.click("[data-a=menu]"); await pg.get_by_text("Rotunjire, adaos și condiții").first.click()
        await pg.locator("#oAcc button", has_text="greu +10%").first.click()
        await pg.locator("#oUrg button", has_text="urgent").first.click()
        await pg.click("#ovl [data-a=optsok]"); await pg.wait_for_timeout(600)
        sub1 = lei(await pg.inner_text("#tSub"))
        chk("subtotal × 1,10 × 1,25", sub1 and abs(sub1 - sub0*1.375) <= max(2, sub0*0.002), (sub0, sub1, sub0*1.375))
        txt = await pg.evaluate("document.body.innerText"); chk("linia de condiții", "Condiții:" in txt and "adaos total 37,5%" in txt)
        await pg.screenshot(path="u4_conditii.png")
        # deschid iar: valorile rămân, apoi le scot
        await pg.click("[data-a=menu]"); await pg.get_by_text("Rotunjire, adaos și condiții").first.click()
        on = await pg.evaluate("[document.querySelector('#oAcc button.on').innerText, document.querySelector('#oUrg button.on').innerText, document.querySelector('#oAd').value]")
        chk("se păstrează alegerile", on[0].startswith("greu") and on[1].startswith("urgent") and on[2]=="", on)
        await pg.locator("#oAcc button", has_text="normal").first.click(); await pg.locator("#oUrg button", has_text="normal").first.click()
        await pg.click("#ovl [data-a=optsok]"); await pg.wait_for_timeout(600)
        sub2 = lei(await pg.inner_text("#tSub")); chk("înapoi la suma inițială", sub2 == sub0, (sub0, sub2))
        # adaos manual 10% + acces foarte greu 20% = 32%
        await pg.click("[data-a=menu]"); await pg.get_by_text("Rotunjire, adaos și condiții").first.click()
        await pg.fill("#oAd", "10"); await pg.locator("#oAcc button", has_text="foarte greu").first.click()
        await pg.click("#ovl [data-a=optsok]"); await pg.wait_for_timeout(600)
        sub3 = lei(await pg.inner_text("#tSub")); chk("10% adaos și +20% acces = 32%", sub3 and abs(sub3 - sub0*1.32) <= max(2, sub0*0.002), (sub0, sub3))
        errs=[l for l in pg.logs if "PAGEERROR" in l]; chk("fără erori", not errs, errs[:3])
        await b.close()
    print(f"UI condiții: {ok} trecute, {len(bad)} picate"); [print("  ✗", x) for x in bad]; sys.exit(1 if bad else 0)
asyncio.run(main())
