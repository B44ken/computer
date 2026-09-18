"""Production HTTP tests: real Next pages, native editor, no mocked execution."""
import json
import os
import subprocess
import time
import urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(os.environ.get('BROWSER_OUTPUT', ROOT / '.test-artifacts/course-browser'))
OUT.mkdir(parents=True, exist_ok=True)
BASE = os.environ.get('BROWSER_BASE_URL', 'http://127.0.0.1:3100')
meta = json.loads(subprocess.check_output([
    'node', '-r', './tools/register-ts.cjs', '-e',
    "console.log(JSON.stringify(require('./lib/course/lessons').lessons))"
], cwd=ROOT, text=True))
server = None
if 'BROWSER_BASE_URL' not in os.environ:
    server = subprocess.Popen(['node', 'node_modules/next/dist/bin/next', 'start', '-p', '3100'],
                              cwd=ROOT, stdout=(OUT / 'server.log').open('w'), stderr=subprocess.STDOUT)
for _ in range(150):
    try:
        urllib.request.urlopen(BASE + '/learn', timeout=2).close()
        break
    except (OSError, TimeoutError):
        time.sleep(.2)
else:
    if server:
        server.terminate()
    raise RuntimeError('production Next server did not start')
errors, bad_responses, checks, screenshots = [], [], [], []
page = None
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path=os.environ.get('CHROMIUM') or p.chromium.executable_path,
                                    args=['--no-sandbox'])
        context = browser.new_context(viewport={'width': 1440, 'height': 1040}, device_scale_factor=1)
        page = context.new_page()
        page.set_default_timeout(25000)
        def track(target):
            target.on('pageerror', lambda e: (errors.append({'url': target.url, 'error': str(e)}), print('PAGE ERROR', target.url, str(e), flush=True)))
            target.on('response', lambda r: bad_responses.append({'status': r.status, 'url': r.url}) if r.status >= 400 and r.url.startswith(BASE) else None)
        track(page)
        def visit(slug):
            print('visit', slug, flush=True)
            page.goto(BASE + slug, wait_until='networkidle')
            if slug == '/' or slug.startswith('/learn'):
                expect(page.locator('h1')).to_be_visible()
        def lab_ready(lab_id):
            lab = page.locator(f'[data-lab="{lab_id}"]')
            lab.get_by_test_id('circuit-board').wait_for()
            page.wait_for_function('(id)=>!!window.courseLabs?.[id]', arg=lab_id)
            return lab
        def check(lab, text):
            lab.get_by_role('button', name='check wiring', exact=True).click()
            expect(lab.locator('.lab-status')).to_contain_text(text, timeout=45000)
        def shot(name, locator=None, full=False):
            filename = name + '.png'
            if locator is None:
                page.screenshot(path=str(OUT / filename), full_page=full)
            else:
                locator.screenshot(path=str(OUT / filename))
            screenshots.append(filename)
        def answer_questions(slug):
            lesson = next(l for l in meta if l['slug'] == slug)
            for i, q in enumerate(lesson['questions']):
                page.locator('.question').nth(i).get_by_role('radio').nth(q['answer']).check()
        def no_overflow(target=page):
            assert target.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), 'horizontal page overflow'
        def native_point(board, point):
            return board.evaluate('''(el,p)=>{
                const r=el.getBoundingClientRect(),s=+el.dataset.scale;
                return {x:r.x+(p.x-(+el.dataset.originX))*s,y:r.y+(p.y-(+el.dataset.originY))*s}
            }''', point)
        visit('/')
        expect(page.get_by_role('heading', name='how to build a computer.')).to_be_visible()
        assert page.locator('.course-outline > a').count() == 13
        shot('00-overview')
        no_overflow()
        # All chapters are actual pre-rendered routes with their real native labs.
        for i, lesson in enumerate(meta):
            visit('/learn/' + lesson['slug'])
            assert page.locator('.question').count() == 2
            for lab_id in lesson['labs']:
                if lab_id in ('transistors', 'programming'):
                    continue
                lab = lab_ready(lab_id)
                actual = page.evaluate('''id=>{
                    const c=window.courseLabs[id].circuit;
                    return {gates:c.gates.length,wires:c.wires.length,connected:c.connections!==null,
                        primitiveTypes:[...new Set(c.gates.map(g=>g.item.type))]}
                }''', lab_id)
                assert actual['gates'] > 0 and actual['wires'] > 0 and actual['connected'], (lab_id, actual)
                # Execute the visible check action, not a second test-only CPU.
                check(lab, 'passed')
                shot(f'lab-{lab_id}', lab)
                checks.append({'lab': lab_id, **actual})
            page.evaluate('scrollTo(0,0)')
            shot(f'{i+1:02d}-{lesson["slug"]}')
            shot(f'{i+1:02d}-{lesson["slug"]}-full', full=True)
            no_overflow()
        # Capture every ideal switch-network layout for visual review.
        visit('/learn/transistors')
        experiment = page.get_by_role('region', name='transistor experiment')
        for mode in ['n switch', 'p switch', 'not', 'nand', 'nor', 'or']:
            experiment.get_by_role('button', name=mode, exact=True).click()
            shot('transistor-' + mode.replace(' ', '-'), experiment)
        # Transistors: floating output plus four actual NAND experiments.
        visit('/learn/transistors')
        experiment = page.get_by_role('region', name='transistor experiment')
        experiment.get_by_role('button', name='n switch', exact=True).click()
        expect(experiment.get_by_test_id('switch-output')).to_contain_text('Z')
        experiment.get_by_role('button', name='nand', exact=True).click()
        expect(experiment.get_by_test_id('switch-output')).to_contain_text('out = 1')
        experiment.get_by_label('transistor input a', exact=True).click()
        experiment.get_by_label('transistor input b', exact=True).click()
        expect(experiment.get_by_test_id('switch-output')).to_contain_text('out = 0')
        experiment.get_by_label('transistor input a', exact=True).click()
        experiment.get_by_role('button', name='record experiment', exact=True).click()
        answer_questions('transistors')
        expect(page.get_by_test_id('lesson-completion')).to_have_text('✓ lesson complete')
        page.reload(wait_until='networkidle')
        expect(page.get_by_test_id('lesson-completion')).to_have_text('✓ lesson complete')
        checks.append('transistor connectivity and persisted experiment/checkpoint')
        # A learner repairs a REAL wire with the shared native Wire tool.
        visit('/learn/gates')
        lab = lab_ready('nand-not')
        lab.get_by_role('button', name='repair challenge', exact=True).click()
        check(lab, 'no driver')
        missing = page.evaluate('''()=>{
            const l=window.courseLabs['nand-not'],c=l.circuit,r=l.reference.circuit;
            const text=w=>JSON.stringify(w.item.path.map(p=>[p.x,p.y]));
            return r.wires.filter(w=>!c.wires.some(v=>text(w)===text(v))).map(w=>w.item.path);
        }''')
        assert len(missing) == 1, missing
        path = missing[0]
        lab.get_by_role('button', name='Wire', exact=True).click()
        board = lab.get_by_test_id('circuit-board')
        board.scroll_into_view_if_needed()
        # Reconstruct each segment through real pointer events; collinear segments
        # need no corner guesses, and the tool's ordinary endpoint junctions join them.
        for a, b in zip(path, path[1:]):
            start, end = native_point(board, a), native_point(board, b)
            page.mouse.move(start['x'], start['y'])
            page.mouse.down()
            page.mouse.move(end['x'], end['y'], steps=6)
            page.mouse.up()
        check(lab, 'passed')
        expect(lab.locator('.badge')).to_have_text('✓ checked')
        # Persist the ACTUAL edited Wire list across a reload.
        before = page.evaluate("window.courseLabs['nand-not'].circuit.wires.length")
        page.reload(wait_until='networkidle')
        lab = lab_ready('nand-not')
        assert page.evaluate("window.courseLabs['nand-not'].circuit.wires.length") == before
        expect(lab.locator('.badge')).to_have_text('✓ checked')
        lab.get_by_role('button', name='Interact', exact=True).click()
        lab.get_by_label('nand-not input a', exact=True).click()
        expect(lab.locator('[data-output="out"]')).to_have_text('0')
        # No saved/edited object may mutate the immutable worked reference.
        lab.get_by_role('button', name='start from parts', exact=True).click()
        assert page.evaluate("window.courseLabs['nand-not'].circuit.wires.length") == 0
        check(lab, 'no driver')
        lab.get_by_role('button', name='reference', exact=True).click()
        check(lab, 'passed')
        assert page.evaluate("window.courseLabs['nand-not'].circuit.wires.length") > 0
        checks.append('native pointer wiring repair, saved Wire geometry, unwired parts and immutable reference')
        shot('native-repaired-gate', lab)
        # Binary explorer reads its actual Button/Wire/Lightbulb values.
        visit('/learn/bits')
        lab = lab_ready('byte')
        for name in ['b1', 'b3', 'b5']:
            lab.get_by_label('byte input ' + name, exact=True).click()
        expect(lab.locator('.word-readout')).to_contain_text('42')
        expect(lab.locator('.word-readout')).to_contain_text('00101010')
        checks.append('eight native wires form byte 42')
        # A real DFF captures once, not whenever D changes at a held-high clock.
        visit('/learn/state')
        lab = lab_ready('dff')
        lab.get_by_label('dff input d', exact=True).click()
        expect(lab.locator('[data-output="q"]')).to_have_text('0')
        lab.get_by_label('dff input clk', exact=True).click()
        expect(lab.locator('[data-output="q"]')).to_have_text('1')
        lab.get_by_label('dff input d', exact=True).click()
        expect(lab.locator('[data-output="q"]')).to_have_text('1')
        lab.get_by_role('button', name='pulse clock', exact=True).click()
        expect(lab.locator('[data-output="q"]')).to_have_text('0')
        checks.append('rising-edge state, no transparent-high latch')
        # Software exercise runs six images through the real gate computer.
        visit('/learn/programming')
        programming = page.get_by_role('region', name='programming exercise')
        programming.get_by_role('button', name='test program', exact=True).click()
        expect(programming.locator('.lab-status')).to_contain_text('some inputs failed', timeout=45000)
        programming.get_by_text('worked solution', exact=True).click()
        programming.get_by_role('button', name='load worked solution', exact=True).click()
        programming.get_by_role('button', name='test program', exact=True).click()
        expect(programming.locator('.lab-status')).to_have_text('all six inputs passed.', timeout=45000)
        assert programming.locator('tbody tr').count() == 6
        shot('programming-passed', programming)
        programming.get_by_label('your assembly program', exact=True).fill('LDA 64')
        programming.get_by_role('button', name='assemble only', exact=True).click()
        expect(programming.locator('[role="alert"]')).to_be_visible()
        checks.append('six native CPU program images plus assembler error')
        # The original merged workbench still functions with shared pointer input.
        visit('/computer')
        board = page.get_by_test_id('circuit-board')
        board.wait_for()
        assert page.locator('[data-gate-type="DFF"]').count() == 14
        shot('original-computer-workbench')
        visit('/halfadder')
        a = page.locator('[data-gate-name="a"]')
        a.click()
        shot('original-half-adder-clicked')
        expect(page.locator('[data-gate-name="sum"] rect')).to_have_attribute('fill', '#7f7')
        checks.append('original native computer and half-adder regression')
        # Mobile: independent touch browser context, actual tap on a native gate.
        mobile_context = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1,
                                             is_mobile=True, has_touch=True)
        mobile = mobile_context.new_page()
        mobile.set_default_timeout(25000)
        track(mobile)
        mobile.goto(BASE + '/learn', wait_until='networkidle')
        no_overflow(mobile)
        mobile.screenshot(path=str(OUT / 'mobile-overview.png'), full_page=True)
        screenshots.append('mobile-overview.png')
        for lesson in meta:
            mobile.get_by_label('chapter', exact=True).select_option(lesson['slug'])
            expect(mobile.locator('h1')).to_have_text(lesson['title'])
            for lab_id in lesson['labs']:
                if lab_id not in ('transistors', 'programming'):
                    mobile.locator(f'[data-lab="{lab_id}"]').get_by_test_id('circuit-board').wait_for()
            no_overflow(mobile)
            mobile.screenshot(path=str(OUT / f'mobile-{lesson["slug"]}.png'), full_page=True)
            screenshots.append(f'mobile-{lesson["slug"]}.png')
        mobile.get_by_label('chapter', exact=True).select_option('gates')
        target = mobile.locator('[data-lab="nand-not"]')
        target.get_by_test_id('circuit-board').wait_for()
        target.locator('[data-gate-name="a"]').tap()
        expect(target.locator('[data-output="out"]')).to_have_text('0')
        checks.append('all 13 mobile chapters: no overflow; native gate responds to touch')
        assert not errors, errors
        assert not bad_responses, bad_responses
        (OUT / 'browser-results.json').write_text(json.dumps({'status': 'passed', 'mode': 'production Next.js HTTP',
            'chapters': 13, 'native_labs': 18, 'checks': checks, 'page_errors': errors,
            'failed_responses': bad_responses, 'screenshots': screenshots}, indent=2))
        print('all production browser checks passed', flush=True)
        browser.close()
except Exception:
    if page:
        try:
            page.screenshot(path=str(OUT / 'failure.png'), full_page=True)
            (OUT / 'failure.html').write_text(page.content())
        except Exception:
            pass
    (OUT / 'browser-errors.json').write_text(json.dumps({'errors': errors, 'http': bad_responses, 'completed': checks}, indent=2))
    raise
finally:
    if server:
        server.terminate()
        server.wait(timeout=10)
