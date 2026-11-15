"""T11: Excel descărcat = sumele de pe ecran (cu condiții de lucru), și formulele dau același rezultat când le recalculează Excel/LibreOffice."""
import asyncio, sys, os, subprocess, shutil, tempfile
from playwright.async_api import async_playwright
from harness import new_page, make_offer_from_list, lei
import openpyxl
EX = "/home/claude/ofertare/exemple/Cantitati Termice Cantina.xlsx"
OUT = "/home/claude/qa/xl_out"

def find_val(ws, label, col):
    for row in ws.iter_rows():
        for c in row:
            if isinstance(c.value, str) and c.value.strip().startswith(label):
                return ws.cell(c.row, col).value
    return None

def recalc(path):
    d = tempfile.mkdtemp()
    subprocess.run(["soffice", "--headless", "--calc", "--convert-to", "xlsx:Calc MS Excel 2007 XML", "--outdir", d, path], capture_output=True, timeout=120)
    f = os.path.join(d, os.path.basename(path))
    return f if os.path.exists(f) else None

async def download(pg, kind):
    await pg.click("#bXl"); await pg.wait_for_timeout(500)
    if kind != "mare":
        await pg.click(f"#ovl [data-a=xlk][data-k={kind}]"); await pg.wait_for_timeout(300)
    await pg.wait_for_function("document.querySelector('#xGo') && !document.querySelector('#xGo').disabled", timeout=20000)
    async with pg.expect_download() as dl:
        await pg.click("#xGo")
    d = await dl.value
    p = os.path.join(OUT, kind + ".xlsx"); await d.save_as(p); return p, d.suggested_filename

async def main():
    ok=0; bad=[]
    def chk(n,c,info=""):
        nonlocal ok
        if c: ok+=1
        else: bad.append(n+(" → "+str(info) if info else ""))
    shutil.rmtree(OUT, ignore_errors=True); os.makedirs(OUT)
    async with async_playwright() as p:
        b, pg = await new_page(p, 1280, 800)
        await make_offer_from_list(pg, EX, "Test Excel")
        await pg.click("[data-a=menu]"); await pg.get_by_text("Rotunjire, adaos și condiții").first.click()
        await pg.locator("#oUrg button", has_text="urgent").first.click()
        await pg.click("#ovl [data-a=optsok]"); await pg.wait_for_timeout(600)
        sub = lei(await pg.inner_text("#tSub")); t = await pg.evaluate("OFAPP.totals()")
        chk("subtotal pe ecran > 0", sub and sub > 0, sub)
        path, nm = await download(pg, "mare")
        chk("numele fișierului", nm.startswith("OFERTA Test Excel") and nm.endswith(".xlsx"), nm)
        wb = openpyxl.load_workbook(path, data_only=True); ws = wb["OFERTA"]
        xsub = find_val(ws, "Subtotal manoperă", 8)
        chk("Excel subtotal = ecran", xsub is not None and abs(xsub - sub) < 0.011, (xsub, sub))
        xtot = find_val(ws, "TOTAL CU TVA", 9)
        chk("Excel total cu TVA = subtotal × 1,21", xtot is not None and abs(xtot - round(sub*1.21, 2)) < 0.02, (xtot, sub*1.21))
        chk("are foaia Calculator și anexa", "Calculator" in wb.sheetnames and "ANEXA CANTITATI" in wb.sheetnames, wb.sheetnames)
        wa = wb["ANEXA CANTITATI"]
        s_anx = sum(r[6] for r in wa.iter_rows(min_row=1, values_only=True) if len(r) > 6 and isinstance(r[6], (int, float)) and isinstance(r[0], int))
        chk("anexa: suma pozițiilor = subtotal", abs(s_anx - sub) < 1.0, (round(s_anx, 2), sub))
        # cantitate × preț unitar = valoare pe fiecare rând din anexă
        badrows = [r for r in wa.iter_rows(min_row=1, values_only=True) if len(r) > 6 and isinstance(r[0], int) and isinstance(r[5], (int, float)) and isinstance(r[6], (int, float)) and abs((r[4] or 0) * r[5] - r[6]) > 0.011]
        chk("anexa: cantitate × preț = valoare", not badrows, badrows[:3])
        # formulele recalculate de LibreOffice dau aceleași sume
        rp = recalc(path)
        if rp:
            wr = openpyxl.load_workbook(rp, data_only=True)
            rsub = find_val(wr["OFERTA"], "Subtotal manoperă", 8); rtot = find_val(wr["OFERTA"], "TOTAL CU TVA", 9)
            chk("recalculat: subtotal identic", rsub is not None and abs(rsub - sub) < 0.011, (rsub, sub))
            chk("recalculat: total cu TVA identic", rtot is not None and abs(rtot - xtot) < 0.011, (rtot, xtot))
        else: chk("LibreOffice a recalculat", False)
        # oferta scurtă
        path2, nm2 = await download(pg, "scurta")
        w2 = openpyxl.load_workbook(path2, data_only=True); l = w2["Lista"]
        s2 = find_val(l, "Total", 2)
        chk("oferta scurtă: total = ecran", s2 is not None and abs(s2 - sub) < 0.011, (s2, sub))
        errs=[x for x in pg.logs if "PAGEERROR" in x]; chk("fără erori", not errs, errs[:3])
        await b.close()
    print(f"Excel: {ok} trecute, {len(bad)} picate"); [print("  ✗", x) for x in bad]; sys.exit(1 if bad else 0)
asyncio.run(main())
