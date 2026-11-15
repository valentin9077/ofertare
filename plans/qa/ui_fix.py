"""Remedieri după recenzia independentă: condițiile se aplică și rândurilor scrise de mână (nu și reducerilor),
adaosul cu 3 zecimale nu se rotunjește la „Gata”, o ofertă schimbată pe versiunea veche nu are condiții vechi agățate."""
import asyncio, sys, json
from playwright.async_api import async_playwright
from harness import new_page, make_offer_from_list, lei
EX = "/home/claude/ofertare/exemple/Cantitati Termice Cantina.xlsx"

async def add_row(pg, den, cant, pret):
    await pg.click("#bRow"); await pg.wait_for_selector("#rDen")
    await pg.fill("#rDen", den); await pg.fill("#rCant", str(cant)); await pg.fill("#rPret", str(pret))
    sw = pg.locator("#rKeep")
    if await sw.count() and (await sw.get_attribute("aria-checked")) == "true": await sw.click()
    await pg.click("#ovl [data-a=rsave]"); await pg.wait_for_timeout(500)

async def opts(pg, ad=None, acc=None, urg=None):
    await pg.click("[data-a=menu]"); await pg.get_by_text("Rotunjire, adaos și condiții").first.click()
    if ad is not None: await pg.fill("#oAd", str(ad))
    if acc: await pg.locator("#oAcc button", has_text=acc).first.click()
    if urg: await pg.locator("#oUrg button", has_text=urg).first.click()
    await pg.click("#ovl [data-a=optsok]"); await pg.wait_for_timeout(600)

async def main():
    ok=0; bad=[]
    def chk(n,c,info=""):
        nonlocal ok
        if c: ok+=1
        else: bad.append(n+(" → "+str(info) if info else ""))
    async with async_playwright() as p:
        b, pg = await new_page(p)
        await make_offer_from_list(pg, EX, "Test remedieri")
        L = lei(await pg.inner_text("#tSub"))
        await add_row(pg, "Lucrare suplimentară scrisă de mână", 1, 10000)
        await add_row(pg, "Reducere comercială", 1, "-1000")
        s0 = lei(await pg.inner_text("#tSub")); chk("rândurile intră în total", abs(s0 - (L + 9000)) < 0.02, (L, s0))
        await opts(pg, ad=10, acc="greu +10%")
        s1 = lei(await pg.inner_text("#tSub")); exp = round(L*1.21, 2) + 11000 - 1000
        chk("listă ×1,21; rândul scris ×1,10; reducerea rămâne -1000", abs(s1 - exp) <= max(2, L*0.002), (s1, exp))
        txt = await pg.evaluate("document.body.innerText")
        chk("rândul arată prețul cu condițiile", "11.000 lei (cu condițiile)" in txt, [l for l in txt.split("\n") if "cu condițiile" in l][:2])
        await opts(pg); s1b = lei(await pg.inner_text("#tSub")); chk("Gata de două ori: aceeași sumă", s1b == s1, (s1, s1b))
        # Excel: rândul scris de mână are prețul unitar cu condițiile și valoarea egală
        await pg.click("#bXl"); await pg.wait_for_function("document.querySelector('#xGo') && !document.querySelector('#xGo').disabled", timeout=20000)
        async with pg.expect_download() as dl: await pg.click("#xGo")
        d = await dl.value; path = "/home/claude/qa/xl_out/fix.xlsx"; await d.save_as(path)
        import openpyxl
        ws = openpyxl.load_workbook(path, data_only=True)["OFERTA"]; rr = None
        for row in ws.iter_rows():
            for c in row:
                if isinstance(c.value, str) and c.value.startswith("Lucrare suplimentară"): rr = [x.value for x in row]
        chk("Excel: rândul scris = 1 × 11.000", rr is not None and 11000 in rr, rr)
        xsub = None
        for row in ws.iter_rows():
            for c in row:
                if isinstance(c.value, str) and c.value.startswith("Subtotal manoperă"): xsub = ws.cell(c.row, 8).value
        chk("Excel: subtotal = ecran", xsub is not None and abs(xsub - s1) < 0.011, (xsub, s1))
        # fără condiții, adaos 7,125 rămâne exact
        await opts(pg, ad="7,125", acc="normal")
        await opts(pg)   # doar Gata, fără să schimbi nimic
        ad = await pg.evaluate("JSON.parse(localStorage.getItem('mock-db')||'{}')") if False else None
        val = await pg.evaluate("(() => { document.querySelector('[data-a=menu]').click(); return null; })()")
        await pg.get_by_text("Rotunjire, adaos și condiții").first.click(); v = await pg.input_value("#oAd")
        chk("adaosul 7,125 rămâne 7,125", v.replace(",", ".") == "7.125", v)
        await pg.click("#ovl [data-a=optsok]"); await pg.wait_for_timeout(400)
        s2 = lei(await pg.inner_text("#tSub")); chk("rândul scris fără condiții = 10.000 (adaosul tău nu se pune pe el)", abs(s2 - (round(L*1.07125, 2) + 9000)) <= max(2, L*0.002), (s2, L*1.07125 + 9000))
        errs=[x for x in pg.logs if "PAGEERROR" in x]; chk("fără erori", not errs, errs[:3])
        await b.close()
    print(f"Remedieri: {ok} trecute, {len(bad)} picate"); [print("  ✗", x) for x in bad]; sys.exit(1 if bad else 0)
asyncio.run(main())
