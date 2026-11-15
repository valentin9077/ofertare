import asyncio
from playwright.async_api import async_playwright
from harness import new_page, make_offer_from_list
async def main():
    async with async_playwright() as p:
        b, pg = await new_page(p)
        await make_offer_from_list(pg, "/home/claude/ofertare/exemple/Instalatii Sani+Term+Hidr Cez.xlsx", "cez")
        r = await pg.evaluate("""() => { const it = OFAPP.items(); const n = OFAPP.counts(); const io = OFAPP.indOf();
          const hid = it.filter(i => /hidrant/i.test(OF.strip(i.den))).map(i => [i.den.slice(0,60), i.um, i.cant, i.pret, i.dom]);
          const ob = it.filter(i => i.dom==="s" && i.pret>0).sort((a,b)=>b.pret*b.cant-a.pret*a.cant).slice(0,5).map(i => [i.den.slice(0,60), i.um, i.cant, i.pret]);
          return {n, io, hid: hid.slice(0,8), ob}; }""")
        import json; print(json.dumps(r, ensure_ascii=False, indent=1)[:3000])
        await b.close()
asyncio.run(main())
