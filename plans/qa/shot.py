import asyncio
from playwright.async_api import async_playwright
from harness import new_page, URL
async def main():
    async with async_playwright() as p:
        b, pg = await new_page(p)
        await pg.goto(URL); await pg.wait_for_timeout(3500)
        await pg.screenshot(path="s1.png")
        print(await pg.evaluate("document.body.innerText.slice(0,1500)"))
        print("\n".join([l for l in pg.logs if 'Service Worker' not in l][:20]))
        await b.close()
asyncio.run(main())
