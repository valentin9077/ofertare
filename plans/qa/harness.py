import asyncio, json
from playwright.async_api import async_playwright
URL="http://127.0.0.1:8765/scv/ofertare/"
MOCK=open("/home/claude/qa/mock-supabase.js").read()
async def new_page(p, w=390, h=844, seed=None):
    b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    ctx = await b.new_context(viewport={"width":w,"height":h}, device_scale_factor=2, service_workers="block")
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
