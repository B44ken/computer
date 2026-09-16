"""Exercise /computer and the original editor on a real production Next server."""
import json
import os
import subprocess
import time
import urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(os.environ.get('BROWSER_OUTPUT', str(ROOT / '.test-artifacts/browser')))
OUT.mkdir(parents=True, exist_ok=True)
OFFLINE = os.environ.get('BROWSER_OFFLINE') == '1'
base = os.environ.get('BROWSER_BASE_URL', 'http://127.0.0.1:3100')
server = None
if OFFLINE:
    subprocess.run([str(ROOT / 'node_modules/.bin/esbuild'), 'tests/browser-entry.tsx', '--bundle', '--platform=browser', '--define:process.env.NODE_ENV="production"', f'--outfile={OUT / "app.js"}'], cwd=ROOT, check=True)
    layouts = {m: json.loads((ROOT / f'public/computer/{m}.json').read_text()) for m in ['manual', 'auto']}
    css = (OUT / 'app.css').read_text()
    # The real build's Tailwind sheet also styles the unmodified older pages.
    css += '\n'.join(f.read_text() for f in (ROOT / '.next/static').rglob('*.css'))
    js = (OUT / 'app.js').read_text().replace('</script', '<\\/script')
else:
    if 'BROWSER_BASE_URL' not in os.environ:
        server = subprocess.Popen(['node', 'node_modules/next/dist/bin/next', 'start', '-p', '3100'], cwd=ROOT, stdout=(OUT / 'server.log').open('w'), stderr=subprocess.STDOUT)
    for _ in range(100):
        try:
            urllib.request.urlopen(base + '/computer', timeout=1).close()
            break
        except (OSError, TimeoutError):
            time.sleep(0.2)
    else:
        if server: server.terminate()
        raise RuntimeError('Next.js server did not start')
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM', '/usr/bin/chromium'), headless=True, args=['--no-sandbox'])
        page = browser.new_page(viewport={'width': 1600, 'height': 1000}, device_scale_factor=1)
        errors = []
        page.on('pageerror', lambda e: (errors.append(str(e)), print('PAGE ERROR:', e, flush=True)))
        page.set_default_timeout(15000)
        def visit(name):
            print('visit', name, flush=True)
            if OFFLINE:
                html = '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>*,::before,::after{box-sizing:border-box}body{margin:0}html,body,#root{height:100%}button,select{font:inherit}' + css + '</style></head><body><div id="root"></div><script>window.process={env:{NODE_ENV:"production"}};window.__layouts=' + json.dumps(layouts) + ';window.__pageName=' + json.dumps(name) + ';</script><script>' + js + '</script></body></html>'
                page.set_content(html, wait_until='load')
            else: page.goto(base + '/' + name, wait_until='networkidle')
            page.get_by_test_id('circuit-board').wait_for()
        def at(x, y):
            return page.get_by_test_id('circuit-board').evaluate('(el,p)=>{const q=new DOMPoint(...p).matrixTransform(el.getScreenCTM());return {x:q.x,y:q.y}}', [x, y])
        visit('computer')
        assert page.get_by_test_id('native-circuit').count() == 1
        assert page.locator('[data-gate-type="Memory"]').count() == 1
        assert page.locator('[data-gate-type="DFF"]').count() == 14
        page.screenshot(path=str(OUT / 'manual.png'))
        page.get_by_role('button', name='bit slice', exact=True).click()
        page.screenshot(path=str(OUT / 'manual-bit-slice.png'))
        for _ in range(4): page.get_by_role('button', name='step', exact=False).click()
        assert page.locator('#mem-52').input_value() == '5'
        assert page.get_by_test_id('pc').inner_text() == '04'
        page.get_by_role('button', name='reset', exact=True).click()
        page.evaluate('document.activeElement.blur()'); page.keyboard.press('Space')
        assert page.get_by_test_id('accumulator').inner_text() == '09'
        page.get_by_role('button', name='reset', exact=True).click()
        page.locator('[data-gate="a.0"]').click()
        expect(page.get_by_test_id('circuit-inspector')).to_contain_text('a.0')
        # This is the user's actual Erase tool, deleting a real Gate from Circuit.
        page.get_by_role('button', name='Erase', exact=True).click()
        page.locator('[data-gate="a.0"]').click()
        assert page.locator('[data-gate="a.0"]').count() == 0
        assert page.locator('[data-gate-type="DFF"]').count() == 13
        page.get_by_role('button', name='step', exact=False).click()
        assert page.get_by_test_id('accumulator').inner_text() == '08'
        page.get_by_role('button', name='restore wiring', exact=True).click()
        expect(page.locator('[data-gate-type="DFF"]')).to_have_count(14)
        expect(page.get_by_test_id('pc')).to_have_text('00')
        old_view = page.get_by_test_id('circuit-board').get_attribute('viewBox')
        page.get_by_role('button', name='zoom in', exact=True).click()
        assert page.get_by_test_id('circuit-board').get_attribute('viewBox') != old_view
        page.get_by_role('button', name='fit', exact=True).click()
        for mode in ['manual', 'auto']:
            page.get_by_role('button', name='hand-built' if mode == 'manual' else 'autorouted', exact=True).click()
            page.get_by_test_id('circuit-board').wait_for()
            for program, address, result in [('subtract',52,5), ('countdown',50,0), ('add',52,12), ('multiply',52,42), ('wrap',52,255), ('selfmodify',52,0)]:
                print('program', mode, program, flush=True)
                page.get_by_label('program', exact=True).select_option(program)
                page.get_by_label('clock rate', exact=True).select_option('100')
                page.get_by_role('button', name='run', exact=True).click()
                page.get_by_text('✓ expected result', exact=True).wait_for(timeout=30000)
                assert int(page.locator(f'#mem-{address}').input_value()) == result
            if mode == 'auto': page.screenshot(path=str(OUT / 'autorouted.png'))
        page.get_by_role('button', name='hand-built', exact=True).click()
        page.get_by_test_id('circuit-board').wait_for()
        page.get_by_label('program', exact=True).select_option('subtract')
        page.get_by_text('assembly editor', exact=True).click()
        page.get_by_label('assembly source', exact=True).fill('LDA 64')
        page.get_by_role('button', name='assemble & load', exact=True).click()
        expect(page.get_by_role('alert').filter(has_text='invalid instruction')).to_have_count(1)
        page.get_by_label('program', exact=True).select_option('countdown')
        expect(page.get_by_role('alert').filter(has_text='invalid instruction')).to_have_count(0)
        page.set_viewport_size({'width': 390, 'height': 844})
        page.screenshot(path=str(OUT / 'mobile.png'), full_page=True)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        page.set_viewport_size({'width': 1600, 'height': 1000})
        visit('free')
        for name, x in [('Button', 2), ('Lightbulb', 10)]:
            page.get_by_role('button', name=name, exact=True).click()
            pos = at(x, 2); page.mouse.click(pos['x'], pos['y'])
        expect(page.locator('[data-gate-type="Button"]')).to_have_count(1)
        expect(page.locator('[data-gate-type="Lightbulb"]')).to_have_count(1)
        page.get_by_role('button', name='Wire', exact=True).click()
        start, end = at(4,3), at(10,3)
        page.mouse.move(start['x'],start['y']);page.mouse.down();page.mouse.move(end['x'],end['y'],steps=5);page.mouse.up()
        page.get_by_role('button', name='Interact', exact=True).click()
        page.locator('[data-gate-type="Button"]').click()
        expect(page.locator('[data-gate-type="Lightbulb"] rect')).to_have_attribute('fill','#7f7')
        page.screenshot(path=str(OUT / 'native-free-editor.png'))
        page.get_by_role('button', name='Erase', exact=True).click()
        pos = at(7,3);page.mouse.click(pos['x'],pos['y'])
        expect(page.locator('[data-gate-type="Lightbulb"] rect')).to_have_attribute('fill','#000')
        visit('halfadder')
        page.get_by_role('button', name='fit', exact=True).click()
        page.locator('[data-gate="a"]').click()
        expect(page.locator('[data-gate="sum"] rect')).to_have_attribute('fill','#7f7')
        expect(page.locator('[data-gate="car"] rect')).to_have_attribute('fill','#000')
        page.screenshot(path=str(OUT / 'native-half-adder.png'))
        assert not errors, errors
        (OUT / 'browser-results.json').write_text(json.dumps({'errors': errors, 'programs': 12, 'native_editor_tests': ['CPU gate deletion changes arithmetic', 'restore wiring', 'free editor place/wire/click/erase', 'original half-adder'], 'viewports': ['1600x1000','390x844'], 'mode': 'offline React DOM' if OFFLINE else 'production Next.js HTTP', 'status':'passed'},indent=2))
        browser.close()
finally:
    if server:
        server.terminate()
        server.wait(timeout=10)
