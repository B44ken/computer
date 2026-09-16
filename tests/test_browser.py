"""Exercise the real React page offline; no server/network navigation required."""
import json
import os
import subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(os.environ.get('BROWSER_OUTPUT', str(ROOT / '.test-artifacts/browser')))
OUT.mkdir(parents=True, exist_ok=True)
subprocess.run([str(ROOT / 'node_modules/.bin/esbuild'), 'tests/browser-entry.tsx', '--bundle', '--platform=browser', '--define:process.env.NODE_ENV="production"', f'--outfile={OUT / "app.js"}'], cwd=ROOT, check=True)
layouts = {m: json.loads((ROOT / f'public/computer/{m}.json').read_text()) for m in ['manual', 'auto']}
css = (OUT / 'app.css').read_text()
js = (OUT / 'app.js').read_text().replace('</script', '<\\/script')
html = '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>*,::before,::after{box-sizing:border-box}body{margin:0}button,select{font:inherit}' + css + '</style></head><body><div id="root"></div><script>window.process={env:{NODE_ENV:"production"}};window.__layouts=' + json.dumps(layouts) + ';</script><script>' + js + '</script></body></html>'
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM', '/usr/bin/chromium'), headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1600, 'height': 1000}, device_scale_factor=1)
    errors = []
    page.on('pageerror', lambda e: (errors.append(str(e)), print('PAGE ERROR:', e, flush=True)))
    page.set_default_timeout(12000)
    page.set_content(html, wait_until='load')
    page.get_by_test_id('gate-board').wait_for()
    page.screenshot(path=str(OUT / 'manual.png'))
    page.get_by_role('button', name='accumulator', exact=True).click()
    page.screenshot(path=str(OUT / 'manual-accumulator.png'))
    page.get_by_role('button', name='bit slice', exact=True).click()
    page.screenshot(path=str(OUT / 'manual-bit-slice.png'))
    for _ in range(4): page.get_by_role('button', name='step', exact=False).click()
    assert page.locator('#mem-52').input_value() == '5'
    assert page.get_by_test_id('pc').inner_text() == '04'
    page.get_by_role('button', name='reset', exact=True).click()
    assert page.get_by_test_id('pc').inner_text() == '00'
    page.evaluate('document.activeElement.blur()')
    page.keyboard.press('Space')
    assert page.get_by_test_id('accumulator').inner_text() == '09'
    page.get_by_role('button', name='reset', exact=True).click()
    page.locator('[data-gate="a.0"]').click()
    assert page.get_by_text('a.0', exact=True).count() >= 1
    page.get_by_role('button', name='fit', exact=True).click()
    old_view = page.get_by_test_id('gate-board').get_attribute('viewBox')
    page.get_by_role('button', name='zoom in', exact=True).click()
    assert page.get_by_test_id('gate-board').get_attribute('viewBox') != old_view
    page.get_by_role('button', name='fit', exact=True).click()
    # Data-path and UI tests, plus program changes, real ticking and stopping.
    for mode in ['manual', 'auto']:
        page.get_by_role('button', name='hand-built' if mode == 'manual' else 'autorouted', exact=True).click()
        page.get_by_test_id('gate-board').wait_for()
        for program, address, result in [('subtract', 52, 5), ('countdown', 50, 0), ('add', 52, 12), ('multiply', 52, 42), ('wrap', 52, 255), ('selfmodify', 52, 0)]:
            page.get_by_label('program', exact=True).select_option(program)
            page.get_by_label('clock rate', exact=True).select_option('100')
            page.get_by_role('button', name='run', exact=True).click()
            page.get_by_text('✓ expected result', exact=True).wait_for(timeout=20000)
            assert int(page.locator(f'#mem-{address}').input_value()) == result
        if mode == 'auto':
            page.screenshot(path=str(OUT / 'autorouted.png'))
    page.get_by_role('button', name='hand-built', exact=True).click()
    page.get_by_test_id('gate-board').wait_for()
    page.get_by_label('program', exact=True).select_option('subtract')
    page.get_by_text('assembly editor', exact=True).click()
    page.get_by_label('assembly source', exact=True).fill('LDA 64')
    page.get_by_role('button', name='assemble & load', exact=True).click()
    assert page.get_by_role('alert').count() == 1
    page.get_by_label('program', exact=True).select_option('countdown')
    assert page.get_by_role('alert').count() == 0
    page.set_viewport_size({'width': 390, 'height': 844})
    page.screenshot(path=str(OUT / 'mobile.png'), full_page=True)
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    assert not errors, errors
    (OUT / 'browser-results.json').write_text(json.dumps({'errors': errors, 'programs': 12, 'viewports': ['1600x1000', '390x844'], 'status': 'passed'}, indent=2))
    browser.close()
