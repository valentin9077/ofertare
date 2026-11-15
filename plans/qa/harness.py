import asyncio, json
from playwright.async_api import async_playwright
URL="http://127.0.0.1:8765/scv/ofertare/"
MOCK=open("/home/claude/qa/mock-supabase.js").read()
async def new_page(p, w=390, h=844, seed=None):
    import os
    if os.environ.get("BROWSER") == "webkit":
        b = await p.webkit.launch()
        ctx = await b.new_context(viewport={"width":w,"height":h}, device_scale_factor=2, service_workers="block", is_mobile=False, has_touch=True)
    else:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width":int(os.environ.get("VW", w)),"height":int(os.environ.get("VH", h))}, device_scale_factor=2, service_workers="block")
    async def sup(route): await route.fulfill(status=200, content_type="application/javascript", body=MOCK)
    await ctx.route("**/lib/vendor/supabase.js*", sup)
    await ctx.route("**/*supabase.co/**", lambda r: r.abort())
    init = "localStorage.setItem('scv-me', JSON.stringify({id:'test-user',email:'test@scv.ro'}));"
    if seed: init += "if(!localStorage.getItem('mock-db'))localStorage.setItem('mock-db',"+json.dumps(json.dumps(seed))+");"
    await ctx.add_init_script(init)
    pg = await ctx.new_page()
    pg.logs=[]
    pg.on("console", lambda m: pg.logs.append(m.type+": "+m.text))
    pg.on("pageerror", lambda e: pg.logs.append("PAGEERROR: "+str(e)))
    return b, pg

async def make_offer_from_list(pg, path, luc="Test", ben="Beneficiar test"):
    await pg.goto(URL); await pg.wait_for_selector("#bNew", timeout=15000)
    await pg.click("#bNew"); await pg.get_by_text("Am listă de la proiectant").first.click()
    await pg.fill("#hLuc", luc); await pg.fill("#hBen", ben)
    async with pg.expect_file_chooser() as fc:
        await pg.click("[data-a=nmake]")
        await pg.wait_for_timeout(800)
        for sel in ["[data-a=impf]", "[data-a=impFile]", "text=Alege fișierul", "text=Alege un fișier"]:
            if await pg.locator(sel).count():
                await pg.locator(sel).first.click(); break
    f = await fc.value; await f.set_files(path)
    for i in range(8):
        await pg.wait_for_timeout(1200)
        prim = pg.locator("#ovl button.pri")
        if await prim.count() and await prim.first.is_visible(): await prim.first.click()
        else: break
    await pg.wait_for_timeout(1200)

def lei(t):
    import re
    m = re.search(r"([\d.]+(?:,\d+)?)", t.replace(" "," ")); return float(m.group(1).replace(".","").replace(",",".")) if m else None
